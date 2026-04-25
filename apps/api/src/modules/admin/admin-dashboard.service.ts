import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      totalSellers,
      totalBuyers,
      totalProducts,
      pendingKyc,
      pendingProducts,
      openComplaints,
      totalOrders,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.seller.count(),
      this.prisma.buyer.count(),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.adminApproval.count({
        where: { entityType: 'SELLER_KYC', status: 'PENDING' },
      }),
      this.prisma.adminApproval.count({
        where: { entityType: 'PRODUCT_LISTING', status: 'PENDING' },
      }),
      this.prisma.complaintTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.order.count(),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          ipAddress: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    return {
      stats: {
        totalUsers,
        totalSellers,
        totalBuyers,
        totalProducts,
        pendingKyc,
        pendingProducts,
        openComplaints,
        totalOrders,
      },
      recentActivity: recentAuditLogs,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, adminRole: true, createdAt: true },
    });
    return user;
  }

  async getAuditLogs(opts: { page: number; limit: number; entityType?: string; action?: string; userId?: string }) {
    const { page, limit, entityType, action, userId } = opts;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          newValue: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, email: true, adminRole: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getAdminAccounts() {
    return this.prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, adminRole: true, isActive: true, createdAt: true, twoFaEnabled: true },
    });
  }

  async createAdminAccount(dto: { email: string; password: string; adminRole: string }, createdBy: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(dto.password, parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12'));

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hash,
        role: 'ADMIN' as any,
        adminRole: dto.adminRole as any,
        isActive: true,
        phoneVerified: false,
      },
      select: { id: true, email: true, adminRole: true, isActive: true, createdAt: true },
    });

    return user;
  }

  async updateAdminAccount(id: string, dto: { adminRole?: string; isActive?: boolean }, updatedBy: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'ADMIN', deletedAt: null } });
    if (!user) throw new NotFoundException('Admin account not found');

    if (user.adminRole === 'SUPER_ADMIN' && dto.adminRole && dto.adminRole !== 'SUPER_ADMIN') {
      const saCount = await this.prisma.user.count({ where: { adminRole: 'SUPER_ADMIN', deletedAt: null } });
      if (saCount <= 1) throw new BadRequestException('Cannot demote the last SUPER_ADMIN');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.adminRole !== undefined && { adminRole: dto.adminRole as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { id: true, email: true, adminRole: true, isActive: true },
    });
  }

  async revokeAdminAccount(id: string, revokedBy: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'ADMIN', deletedAt: null } });
    if (!user) throw new NotFoundException('Admin account not found');
    if (user.adminRole === 'SUPER_ADMIN') throw new BadRequestException('Cannot revoke SUPER_ADMIN access');

    return this.prisma.user.update({
      where: { id },
      data: { adminRole: null, isActive: false },
      select: { id: true, email: true, adminRole: true },
    });
  }
}
