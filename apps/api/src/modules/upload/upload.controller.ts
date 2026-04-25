import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { SellerAccountService } from '../sellers/seller-account.service';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

const KYC_UPLOAD_DIR = process.env.KYC_UPLOAD_DIR || './uploads/kyc-docs';
const PRODUCT_UPLOAD_BASE = process.env.PRODUCT_UPLOAD_DIR || './uploads/products';
const LOGO_UPLOAD_DIR = process.env.LOGO_UPLOAD_DIR || './uploads/logos';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_PRODUCT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Ensure upload directories exist
if (!fs.existsSync(KYC_UPLOAD_DIR))   fs.mkdirSync(KYC_UPLOAD_DIR,   { recursive: true });
if (!fs.existsSync(LOGO_UPLOAD_DIR))  fs.mkdirSync(LOGO_UPLOAD_DIR,  { recursive: true });

/**
 * Sniff actual file type from magic bytes — prevents extension/MIME spoofing.
 * Returns null if the buffer is too small or no signature matches.
 */
function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  return null;
}

function assertMagicBytes(buf: Buffer, allowed: string[], label: string) {
  const detected = detectMimeFromBuffer(buf);
  if (!detected || !allowed.includes(detected)) {
    throw new BadRequestException(
      `${label}: file content does not match a permitted type (${allowed.join(', ')})`,
    );
  }
}

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly accountService: SellerAccountService) {}

  // ─── KYC Document Upload ───────────────────────────────────────────────────

  @Post('kyc-document')
  @Roles('SELLER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_KYC_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF, JPG, and PNG files are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a KYC document (PDF/JPG/PNG, max 5 MB)' })
  @ApiResponse({ status: 201, description: 'File uploaded, returns secure fileUrl' })
  async uploadKycDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<any>> {
    if (!file) throw new BadRequestException('No file provided');

    assertMagicBytes(file.buffer, ALLOWED_KYC_MIME_TYPES, 'KYC document');

    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const filename = `kyc-${uuidv4()}${ext}`;
    const destPath = path.join(KYC_UPLOAD_DIR, filename);
    fs.writeFileSync(destPath, file.buffer);

    this.logger.log(`KYC document uploaded by ${user.id}: ${filename} (${file.size} bytes)`);

    return ApiResponseDto.success('File uploaded successfully', {
      fileUrl: `/kyc-docs/${filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  // ─── Product Image Upload (with Sharp processing) ─────────────────────────

  @Post('product-image')
  @Roles('SELLER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_PRODUCT_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPG, PNG, or WebP images are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a product image — resized to 800×800 WebP (full) + 200×200 WebP (thumb)',
  })
  @ApiResponse({ status: 201, description: 'Image processed and stored, returns URLs' })
  async uploadProductImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<any>> {
    if (!file) throw new BadRequestException('No file provided');

    assertMagicBytes(file.buffer, ALLOWED_PRODUCT_MIME_TYPES, 'Product image');

    const sellerId = user.id;
    const uuid = uuidv4();

    const sellerDir = path.join(PRODUCT_UPLOAD_BASE, sellerId);
    const thumbDir = path.join(sellerDir, 'thumb');

    if (!fs.existsSync(sellerDir)) fs.mkdirSync(sellerDir, { recursive: true });
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

    const fullFilename = `${uuid}.webp`;
    const thumbFilename = `${uuid}.webp`;
    const fullPath = path.join(sellerDir, fullFilename);
    const thumbPath = path.join(thumbDir, thumbFilename);

    try {
      await (sharp as any)(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(fullPath);

      await (sharp as any)(file.buffer)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    } catch (err: any) {
      this.logger.error(`Image processing failed: ${err.message}`);
      throw new BadRequestException('Image processing failed. Please try a different file.');
    }

    this.logger.log(`Product image uploaded by seller ${sellerId}: ${uuid}.webp`);

    return ApiResponseDto.success('Image uploaded successfully', {
      fileUrl: `/products/${sellerId}/${fullFilename}`,
      thumbUrl: `/products/${sellerId}/thumb/${thumbFilename}`,
      fileName: file.originalname,
      mimeType: 'image/webp',
    });
  }

  // ─── Company Logo Upload ──────────────────────────────────────────────────

  @Post('seller/logo')
  @Roles('SELLER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: LOGO_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPG, PNG, or WebP images are allowed for logos'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload company logo — resized to 400×400 WebP, stored at /uploads/logos/{sellerId}.webp',
  })
  @ApiResponse({ status: 201, description: 'Logo uploaded and seller record updated' })
  async uploadSellerLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<any>> {
    if (!file) throw new BadRequestException('No file provided');

    assertMagicBytes(file.buffer, ALLOWED_LOGO_MIME_TYPES, 'Logo');

    const logoPath = path.join(LOGO_UPLOAD_DIR, `${user.id}.webp`);

    try {
      await (sharp as any)(file.buffer)
        .resize(400, 400, { fit: 'cover', position: 'centre' })
        .webp({ quality: 90 })
        .toFile(logoPath);
    } catch (err: any) {
      this.logger.error(`Logo processing failed: ${err.message}`);
      throw new BadRequestException('Image processing failed. Please try a different file.');
    }

    const logoUrl = `/logos/${user.id}.webp`;
    await this.accountService.updateLogo(user.id, logoUrl);

    this.logger.log(`Seller logo uploaded: userId=${user.id}`);
    return ApiResponseDto.success('Logo uploaded successfully', { logoUrl });
  }
}
