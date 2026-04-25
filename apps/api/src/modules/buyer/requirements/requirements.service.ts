import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { RequirementMatchingService } from './matching.service';
import {
  CreateRequirementDto,
  UpdateRequirementDto,
} from './dto/requirement.dto';

const DEFAULT_EXPIRY_DAYS = 30;

@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: RequirementMatchingService,
  ) {}

  // ─── POST /api/buyer/requirements ────────────────────────────────────────

  async create(userId: string, dto: CreateRequirementDto) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) {
      throw new ForbiddenException(
        'Buyer profile not found. Please complete your profile first.',
      );
    }

    if (
      dto.targetPriceMin != null &&
      dto.targetPriceMax != null &&
      dto.targetPriceMin > dto.targetPriceMax
    ) {
      throw new BadRequestException(
        'targetPriceMin cannot exceed targetPriceMax',
      );
    }

    const expiresAt = new Date(
      Date.now() + (dto.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 24 * 3600 * 1000,
    );

    const lead = await this.prisma.buyLead.create({
      data: {
        buyerId: buyer.id,
        productName: dto.productName,
        categoryId: dto.categoryId ?? null,
        requirementType: dto.requirementType as any,
        quantity: dto.quantity ?? null,
        unit: dto.unit ?? null,
        targetPriceMin: dto.targetPriceMin ?? null,
        targetPriceMax: dto.targetPriceMax ?? null,
        currency: (dto.currency ?? 'INR') as any,
        deliveryState: dto.deliveryState ?? null,
        expectedCountry: dto.expectedCountry ?? 'India',
        contactChannel: dto.contactChannel as any,
        repeatOption: (dto.repeatOption ?? 'NONE') as any,
        additionalNotes: dto.additionalNotes ?? null,
        isOpen: true,
        expiresAt,
        expiryDate: expiresAt,
      },
    });

    this.logger.log(
      `Requirement ${lead.id} posted by buyer ${buyer.id} — ${dto.productName}`,
    );

    // Fire-and-forget matching
    this.matching
      .notifyMatchingSellers({
        id: lead.id,
        productName: lead.productName,
        categoryId: lead.categoryId,
      })
      .catch((err) =>
        this.logger.warn(
          `Matching failed for requirement ${lead.id}: ${err.message}`,
        ),
      );

    return {
      id: lead.id,
      productName: lead.productName,
      expiresAt,
      status: this.deriveStatus(lead),
    };
  }

  // ─── GET /api/buyer/requirements ─────────────────────────────────────────

  async list(userId: string, page: number, limit: number) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');

    const skip = (page - 1) * limit;

    const [total, leads] = await Promise.all([
      this.prisma.buyLead.count({
        where: { buyerId: buyer.id, deletedAt: null },
      }),
      this.prisma.buyLead.findMany({
        where: { buyerId: buyer.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { contactReveals: true } },
        },
      }),
    ]);

    return {
      requirements: leads.map((lead) => this.toDetail(lead)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── GET /api/buyer/requirements/:id ─────────────────────────────────────

  async getOne(userId: string, id: string) {
    const buyer = await this.requireBuyer(userId);
    const lead = await this.prisma.buyLead.findFirst({
      where: { id, buyerId: buyer.id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { contactReveals: true } },
      },
    });
    if (!lead) throw new NotFoundException('Requirement not found');
    return this.toDetail(lead);
  }

  // ─── PATCH /api/buyer/requirements/:id ───────────────────────────────────

  async update(userId: string, id: string, dto: UpdateRequirementDto) {
    const buyer = await this.requireBuyer(userId);
    const lead = await this.prisma.buyLead.findFirst({
      where: { id, buyerId: buyer.id, deletedAt: null },
      include: { _count: { select: { contactReveals: true } } },
    });
    if (!lead) throw new NotFoundException('Requirement not found');

    // Once a seller has revealed contact, editing the requirement would
    // change the terms for a seller who has already paid — block it.
    if ((lead._count?.contactReveals ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot edit a requirement after sellers have revealed contact. Repost instead.',
      );
    }

    if (
      dto.targetPriceMin != null &&
      dto.targetPriceMax != null &&
      dto.targetPriceMin > dto.targetPriceMax
    ) {
      throw new BadRequestException(
        'targetPriceMin cannot exceed targetPriceMax',
      );
    }

    const updated = await this.prisma.buyLead.update({
      where: { id },
      data: {
        productName: dto.productName ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        requirementType: dto.requirementType as any,
        quantity: dto.quantity ?? undefined,
        unit: dto.unit ?? undefined,
        targetPriceMin: dto.targetPriceMin ?? undefined,
        targetPriceMax: dto.targetPriceMax ?? undefined,
        currency: dto.currency as any,
        deliveryState: dto.deliveryState ?? undefined,
        expectedCountry: dto.expectedCountry ?? undefined,
        contactChannel: dto.contactChannel as any,
        repeatOption: dto.repeatOption as any,
        additionalNotes: dto.additionalNotes ?? undefined,
      },
    });

    return { id: updated.id, updated: true };
  }

  // ─── DELETE /api/buyer/requirements/:id ──────────────────────────────────

  async cancel(userId: string, id: string) {
    const buyer = await this.requireBuyer(userId);
    const lead = await this.prisma.buyLead.findFirst({
      where: { id, buyerId: buyer.id, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Requirement not found');

    await this.prisma.buyLead.update({
      where: { id },
      data: { isOpen: false, deletedAt: new Date() },
    });

    return { id, cancelled: true };
  }

  // ─── POST /api/buyer/requirements/:id/repost ─────────────────────────────

  async repost(userId: string, id: string) {
    const buyer = await this.requireBuyer(userId);
    const source = await this.prisma.buyLead.findFirst({
      where: { id, buyerId: buyer.id },
    });
    if (!source) throw new NotFoundException('Requirement not found');

    const expiresAt = new Date(
      Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 3600 * 1000,
    );

    const copy = await this.prisma.buyLead.create({
      data: {
        buyerId: buyer.id,
        productName: source.productName,
        categoryId: source.categoryId,
        requirementType: source.requirementType as any,
        quantity: source.quantity ?? null,
        unit: source.unit,
        targetPriceMin: source.targetPriceMin,
        targetPriceMax: source.targetPriceMax,
        currency: source.currency as any,
        deliveryState: source.deliveryState,
        expectedCountry: source.expectedCountry,
        contactChannel: source.contactChannel,
        repeatOption: source.repeatOption,
        additionalNotes: source.additionalNotes,
        isOpen: true,
        expiresAt,
        expiryDate: expiresAt,
      },
    });

    this.matching
      .notifyMatchingSellers({
        id: copy.id,
        productName: copy.productName,
        categoryId: copy.categoryId,
      })
      .catch((err) =>
        this.logger.warn(
          `Matching failed for reposted requirement ${copy.id}: ${err.message}`,
        ),
      );

    return { id: copy.id, reposted: true, expiresAt };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async requireBuyer(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');
    return buyer;
  }

  /**
   * BuyLead has no direct link to Order/Quote, so we use the count of
   * LeadContactReveal rows as a proxy for "quotes received" — every reveal
   * means a seller paid to respond to this requirement.
   */
  private deriveStatus(
    lead: { isOpen: boolean; deletedAt: Date | null; expiryDate: Date | null },
    quoteCount = 0,
  ): 'OPEN' | 'QUOTED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED' {
    if (lead.deletedAt) return 'CANCELLED';
    if (lead.expiryDate && lead.expiryDate < new Date()) return 'EXPIRED';
    if (!lead.isOpen) return 'FULFILLED';
    if (quoteCount > 0) return 'QUOTED';
    return 'OPEN';
  }

  private toDetail(lead: any) {
    const quoteCount = lead._count?.contactReveals ?? 0;
    return {
      id: lead.id,
      productName: lead.productName,
      categoryId: lead.categoryId,
      category: lead.category ?? null,
      requirementType: lead.requirementType ?? null,
      quantity: lead.quantity ? Number(lead.quantity) : lead.quantityRequired,
      unit: lead.unit ?? null,
      targetPriceMin:
        lead.targetPriceMin != null ? Number(lead.targetPriceMin) : null,
      targetPriceMax:
        lead.targetPriceMax != null ? Number(lead.targetPriceMax) : null,
      currency: lead.currency ?? 'INR',
      deliveryState: lead.deliveryState ?? null,
      expectedCountry: lead.expectedCountry ?? null,
      contactChannel: lead.contactChannel,
      repeatOption: lead.repeatOption,
      additionalNotes: lead.additionalNotes ?? null,
      isOpen: lead.isOpen,
      expiryDate: lead.expiryDate,
      createdAt: lead.createdAt,
      revealCount: quoteCount,
      quoteCount,
      status: this.deriveStatus(lead, quoteCount),
    };
  }
}
