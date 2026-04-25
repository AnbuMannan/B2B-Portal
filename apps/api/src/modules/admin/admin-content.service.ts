import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateCreditPackDto,
  UpdateCreditPackDto,
  AddKeywordDto,
  BulkAddKeywordsDto,
  UpdateNotificationTemplateDto,
} from './dto/content.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Categories ───────────────────────────────────────────────────────────────

  async getCategories() {
    const [all, counts] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
          children: {
            orderBy: { name: 'asc' },
            include: {
              children: { orderBy: { name: 'asc' } },
            },
          },
        },
        where: { parentId: null },
      }),
      this.prisma.productCategory.groupBy({
        by: ['categoryId'],
        _count: { categoryId: true },
      }),
    ]);

    const countMap = new Map(counts.map((c) => [c.categoryId, c._count.categoryId]));

    const attachCount = (cat: any): any => ({
      ...cat,
      _count: { productLinks: countMap.get(cat.id) ?? 0 },
      children: cat.children?.map(attachCount) ?? [],
    });

    return all.map(attachCount);
  }

  async createCategory(dto: CreateCategoryDto, adminId: string) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const existing = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Category name already exists');

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        description: dto.description,
        industryType: dto.industryType ?? [],
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: category.id,
      action: 'CREATE',
      newValue: { type: 'CATEGORY', name: dto.name },
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, adminId: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.category.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Category name already exists');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.industryType && { industryType: dto.industryType }),
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'UPDATE',
      newValue: { type: 'CATEGORY', ...dto },
    });

    return updated;
  }

  async deleteCategory(id: string, adminId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, _count: { select: { productLinks: true, buyLeads: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category.children.length > 0) {
      throw new BadRequestException('Cannot delete category with subcategories. Move or delete them first.');
    }
    if (category._count.productLinks > 0 || category._count.buyLeads > 0) {
      throw new BadRequestException(
        `Category is in use (${category._count.productLinks} products, ${category._count.buyLeads} buy leads). Reassign them first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'DELETE',
      newValue: { type: 'CATEGORY', name: category.name },
    });

    return { deleted: true };
  }

  // ── Banners ──────────────────────────────────────────────────────────────────

  async getBanners() {
    return this.prisma.homepageBanner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createBanner(dto: CreateBannerDto, adminId: string) {
    const banner = await this.prisma.homepageBanner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: banner.id,
      action: 'CREATE',
      newValue: { type: 'BANNER', title: dto.title },
    });

    return banner;
  }

  async updateBanner(id: string, dto: UpdateBannerDto, adminId: string) {
    const banner = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    const updated = await this.prisma.homepageBanner.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.imageUrl && { imageUrl: dto.imageUrl }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'UPDATE',
      newValue: { type: 'BANNER', ...dto },
    });

    return updated;
  }

  async deleteBanner(id: string, adminId: string) {
    const banner = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.prisma.homepageBanner.delete({ where: { id } });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'DELETE',
      newValue: { type: 'BANNER', title: banner.title },
    });

    return { deleted: true };
  }

  // ── Credit Pack Config ────────────────────────────────────────────────────────

  async getCreditPacks() {
    return this.prisma.creditPackConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createCreditPack(dto: CreateCreditPackDto, adminId: string) {
    const pack = await this.prisma.creditPackConfig.create({
      data: {
        name: dto.name,
        credits: dto.credits,
        priceInr: dto.priceInr,
        isActive: true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: pack.id,
      action: 'CREATE',
      newValue: { type: 'CREDIT_PACK', name: dto.name, credits: dto.credits, priceInr: dto.priceInr },
    });

    return pack;
  }

  async updateCreditPack(id: string, dto: UpdateCreditPackDto, adminId: string) {
    const pack = await this.prisma.creditPackConfig.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const updated = await this.prisma.creditPackConfig.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.credits !== undefined && { credits: dto.credits }),
        ...(dto.priceInr !== undefined && { priceInr: dto.priceInr }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'UPDATE',
      newValue: { type: 'CREDIT_PACK', ...dto },
    });

    return updated;
  }

  // ── Prohibited Keywords ──────────────────────────────────────────────────────

  async getKeywords(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.prohibitedKeyword.findMany({
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.prohibitedKeyword.count(),
    ]);
    return { items, total, page, limit };
  }

  async addKeyword(dto: AddKeywordDto, adminId: string) {
    const normalized = dto.keyword.toLowerCase().trim();
    const existing = await this.prisma.prohibitedKeyword.findUnique({ where: { keyword: normalized } });
    if (existing) throw new ConflictException('Keyword already exists');

    const kw = await this.prisma.prohibitedKeyword.create({
      data: { keyword: normalized, addedBy: adminId },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: kw.id,
      action: 'CREATE',
      newValue: { type: 'PROHIBITED_KEYWORD', keyword: normalized },
    });

    return kw;
  }

  async bulkAddKeywords(dto: BulkAddKeywordsDto, adminId: string) {
    const normalized = [...new Set(dto.keywords.map((k) => k.toLowerCase().trim()))];
    const created: string[] = [];
    const skipped: string[] = [];

    for (const keyword of normalized) {
      try {
        await this.prisma.prohibitedKeyword.create({ data: { keyword, addedBy: adminId } });
        created.push(keyword);
      } catch {
        skipped.push(keyword);
      }
    }

    if (created.length > 0) {
      await this.auditService.logAction({
        userId: adminId,
        entityType: 'SELLER_KYC',
        entityId: adminId,
        action: 'CREATE',
        newValue: { type: 'PROHIBITED_KEYWORDS_BULK', created, skipped },
      });
    }

    return { created: created.length, skipped: skipped.length, keywords: created };
  }

  async deleteKeyword(id: string, adminId: string) {
    const kw = await this.prisma.prohibitedKeyword.findUnique({ where: { id } });
    if (!kw) throw new NotFoundException('Keyword not found');

    await this.prisma.prohibitedKeyword.delete({ where: { id } });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: id,
      action: 'DELETE',
      newValue: { type: 'PROHIBITED_KEYWORD', keyword: kw.keyword },
    });

    return { deleted: true };
  }

  // ── Notification Templates ────────────────────────────────────────────────────

  async getNotificationTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async updateNotificationTemplate(key: string, dto: UpdateNotificationTemplateDto, adminId: string) {
    const tmpl = await this.prisma.notificationTemplate.findUnique({ where: { key } });
    if (!tmpl) throw new NotFoundException(`Template '${key}' not found`);

    const updated = await this.prisma.notificationTemplate.update({
      where: { key },
      data: {
        ...(dto.titleEn && { titleEn: dto.titleEn }),
        ...(dto.bodyEn && { bodyEn: dto.bodyEn }),
        ...(dto.titleHi && { titleHi: dto.titleHi }),
        ...(dto.bodyHi && { bodyHi: dto.bodyHi }),
        ...(dto.variables && { variables: dto.variables }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: adminId,
      },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'SELLER_KYC',
      entityId: tmpl.id,
      action: 'UPDATE',
      newValue: { type: 'NOTIFICATION_TEMPLATE', key, ...dto },
    });

    return updated;
  }
}
