import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { RejectProductDto, BulkApproveDto } from './dto/product-review.dto';

const PROHIBITED_FLAG_NAME = 'prohibited_keywords';

const DEFAULT_PROHIBITED_KEYWORDS = [
  // Weapons
  'weapon', 'firearms', 'pistol', 'revolver', 'rifle', 'shotgun', 'ammunition', 'bullet', 'grenade',
  'explosive', 'bomb', 'landmine', 'rpg', 'mortar',
  // Drugs / narcotics (trade name patterns)
  'cocaine', 'heroin', 'methamphetamine', 'fentanyl', 'mdma', 'lsd', 'cannabis oil',
  'opium', 'morphine sulphate', 'pseudoephedrine',
  // Counterfeit indicators
  'replica branded', 'fake brand', 'counterfeit', 'clone iphone', 'clone samsung',
  'duplicate currency',
  // Wildlife / CITES
  'tiger skin', 'elephant ivory', 'rhino horn', 'pangolin',
  // Hazardous chemicals
  'sarin', 'vx nerve', 'mustard gas', 'chlorine gas',
  // Human trafficking
  'human organ', 'kidney for sale', 'human trafficking',
];

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  hsnCode: true,
  unit: true,
  images: true,
  adminApprovalStatus: true,
  isFlagged: true,
  flagReason: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: {
      id: true,
      companyName: true,
      state: true,
      userId: true,
      user: { select: { email: true } },
    },
  },
  categories: {
    select: { category: { select: { id: true, name: true } } },
  },
};

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
    @InjectQueue('search-sync') private readonly searchSyncQueue: Queue,
  ) {}

  // ── Keyword management ────────────────────────────────────────────────────

  async getProhibitedKeywords(): Promise<string[]> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: PROHIBITED_FLAG_NAME },
    });
    if (!flag) return DEFAULT_PROHIBITED_KEYWORDS;
    const data = flag.targetAudience as { keywords?: string[] };
    return data?.keywords ?? DEFAULT_PROHIBITED_KEYWORDS;
  }

  async updateProhibitedKeywords(keywords: string[]): Promise<string[]> {
    await this.prisma.featureFlag.upsert({
      where: { name: PROHIBITED_FLAG_NAME },
      create: {
        name: PROHIBITED_FLAG_NAME,
        isEnabled: true,
        rolloutPercentage: 100,
        targetAudience: { keywords },
      },
      update: { targetAudience: { keywords } },
    });
    return keywords;
  }

  /** Called by SellerProductsService on product create/update */
  async screenProduct(
    productId: string,
    name: string,
    description: string | null,
  ): Promise<{ flagged: boolean; reason: string | null }> {
    const keywords = await this.getProhibitedKeywords();
    const searchText = `${name} ${description ?? ''}`.toLowerCase();
    const matched = keywords.filter((kw) => searchText.includes(kw.toLowerCase()));

    if (matched.length === 0) return { flagged: false, reason: null };

    const reason = `Prohibited keyword match: ${matched.slice(0, 3).join(', ')}`;
    await this.prisma.product.update({
      where: { id: productId },
      data: { isFlagged: true, flagReason: reason },
    });
    this.logger.warn(`Product ${productId} flagged: ${reason}`);
    return { flagged: true, reason };
  }

  // ── Queue ────────────────────────────────────────────────────────────────

  async getQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { adminApprovalStatus: 'PENDING', deletedAt: null, isFlagged: false },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: PRODUCT_SELECT,
      }),
      this.prisma.product.count({
        where: { adminApprovalStatus: 'PENDING', deletedAt: null, isFlagged: false },
      }),
    ]);
    return { items, total, page, limit };
  }

  async getFlagged(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { isFlagged: true, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: PRODUCT_SELECT,
      }),
      this.prisma.product.count({
        where: { isFlagged: true, deletedAt: null },
      }),
    ]);
    return { items, total, page, limit };
  }

  // ── Approve ──────────────────────────────────────────────────────────────

  async approve(productId: string, adminUserId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, name: true, adminApprovalStatus: true, deletedAt: true,
        seller: { select: { userId: true, companyName: true } },
      },
    });

    if (!product || product.deletedAt) throw new NotFoundException('Product not found');
    if (product.adminApprovalStatus === 'APPROVED') {
      throw new BadRequestException('Product is already approved');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          adminApprovalStatus: 'APPROVED',
          approvedBy: adminUserId,
          approvalDate: new Date(),
          isFlagged: false,
        },
      });

      await tx.adminApproval.create({
        data: {
          adminId: adminUserId,
          entityType: 'PRODUCT_LISTING',
          entityId: productId,
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewNotes: 'Product listing approved',
        },
      });
    });

    // Queue Elasticsearch indexing
    this.searchSyncQueue.add(
      { entityType: 'PRODUCT', entityId: productId, action: 'INDEX', requestId: uuidv4() },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    ).catch((e) => this.logger.warn(`search-sync queue failed: ${e.message}`));

    // Notify seller
    this.notifQueue.add('product-approved', {
      userId: product.seller.userId,
      type: 'EMAIL',
      templateId: 'product-approved',
      data: { productName: product.name, companyName: product.seller.companyName },
      requestId: uuidv4(),
    }).catch((e) => this.logger.warn(`Notification queue failed: ${e.message}`));

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'PRODUCT_LISTING',
      entityId: productId,
      action: 'UPDATE',
      newValue: { status: 'APPROVED', productName: product.name },
    });

    this.logger.log(`Product approved: ${productId} by admin ${adminUserId}`);
    return { productId, status: 'APPROVED' };
  }

  async reject(productId: string, adminUserId: string, dto: RejectProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, name: true, adminApprovalStatus: true, deletedAt: true,
        seller: { select: { userId: true, companyName: true } },
      },
    });

    if (!product || product.deletedAt) throw new NotFoundException('Product not found');
    if (product.adminApprovalStatus === 'REJECTED') {
      throw new BadRequestException('Product is already rejected');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          adminApprovalStatus: 'REJECTED',
          flagReason: dto.reason,
        },
      });

      await tx.adminApproval.create({
        data: {
          adminId: adminUserId,
          entityType: 'PRODUCT_LISTING',
          entityId: productId,
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewNotes: dto.reason,
        },
      });
    });

    // Remove from search index if it was previously approved
    this.searchSyncQueue.add(
      { entityType: 'PRODUCT', entityId: productId, action: 'DELETE', requestId: uuidv4() },
    ).catch((e) => this.logger.warn(`search-sync delete failed: ${e.message}`));

    this.notifQueue.add('product-rejected', {
      userId: product.seller.userId,
      type: 'EMAIL',
      templateId: 'product-rejected',
      data: { productName: product.name, reason: dto.reason },
      requestId: uuidv4(),
    }).catch((e) => this.logger.warn(`Notification queue failed: ${e.message}`));

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'PRODUCT_LISTING',
      entityId: productId,
      action: 'UPDATE',
      newValue: { status: 'REJECTED', reason: dto.reason },
    });

    this.logger.log(`Product rejected: ${productId} by admin ${adminUserId}`);
    return { productId, status: 'REJECTED', reason: dto.reason };
  }

  async bulkApprove(dto: BulkApproveDto, adminUserId: string) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds }, adminApprovalStatus: 'PENDING', deletedAt: null },
      select: {
        id: true, name: true,
        seller: { select: { userId: true, companyName: true } },
      },
    });

    if (products.length === 0) {
      throw new BadRequestException('No pending products found for the given IDs');
    }

    const approvedIds = products.map((p) => p.id);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: approvedIds } },
        data: {
          adminApprovalStatus: 'APPROVED',
          approvedBy: adminUserId,
          approvalDate: now,
          isFlagged: false,
        },
      });

      await tx.adminApproval.createMany({
        data: approvedIds.map((id) => ({
          adminId: adminUserId,
          entityType: 'PRODUCT_LISTING' as const,
          entityId: id,
          status: 'APPROVED' as const,
          reviewedAt: now,
          reviewNotes: 'Bulk approved',
        })),
      });
    });

    // Queue Elasticsearch indexing for each
    for (const id of approvedIds) {
      this.searchSyncQueue.add(
        { entityType: 'PRODUCT', entityId: id, action: 'INDEX', requestId: uuidv4() },
      ).catch(() => { /* noop */ });
    }

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'PRODUCT_LISTING',
      entityId: 'BULK',
      action: 'UPDATE',
      newValue: { status: 'APPROVED', count: approvedIds.length, productIds: approvedIds },
    });

    this.logger.log(`Bulk approved ${approvedIds.length} products by admin ${adminUserId}`);
    return { approved: approvedIds.length, productIds: approvedIds };
  }
}
