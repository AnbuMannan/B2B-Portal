import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage, diskStorage } from 'multer';
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
      storage: diskStorage({
        destination: KYC_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `kyc-${uuidv4()}${ext}`);
        },
      }),
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
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      fs.unlink(file.path, () => {});
      throw new BadRequestException('File size exceeds 5 MB limit');
    }

    this.logger.log(`KYC document uploaded by ${user.id}: ${file.filename} (${file.size} bytes)`);

    const fileUrl = `/kyc-docs/${file.filename}`;
    return ApiResponseDto.success('File uploaded successfully', {
      fileUrl,
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
      storage: memoryStorage(), // buffer for Sharp processing
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
    if (!file) {
      throw new BadRequestException('No file provided');
    }

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
      // Full image: 800×800 max, WebP 85% quality, maintain aspect ratio
      await (sharp as any)(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(fullPath);

      // Thumbnail: 200×200, WebP 80% quality
      await (sharp as any)(file.buffer)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    } catch (err: any) {
      this.logger.error(`Image processing failed: ${err.message}`);
      throw new BadRequestException('Image processing failed. Please try a different file.');
    }

    this.logger.log(`Product image uploaded by seller ${sellerId}: ${uuid}.webp`);

    const fileUrl = `/products/${sellerId}/${fullFilename}`;
    const thumbUrl = `/products/${sellerId}/thumb/${thumbFilename}`;

    return ApiResponseDto.success('Image uploaded successfully', {
      fileUrl,
      thumbUrl,
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
      limits: { fileSize: 2 * 1024 * 1024 },
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

    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Logo must be under 2 MB');
    }

    const sellerId = user.id; // NOTE: user.id on a SELLER token is the Seller.id (set in jwt.strategy)
    // Actually user.id from JWT is the userId — we let the service resolve sellerId
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
