import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';

const USER_SELECT = {
  id: true,
  email: true,
  phoneNumber: true,
  role: true,
  adminRole: true,
  isActive: true,
  phoneVerified: true,
  twoFaEnabled: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  sellers: { select: { id: true, companyName: true, kycStatus: true } },
  buyers:  { select: { id: true } },
  _count: {
    select: {
      auditLogs: true,
      reportedTickets: true,
    },
  },
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(opts: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 30, search, role, isActive } = opts;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: string, adminId: string, dto: {
    role?: string;
    adminRole?: string | null;
    isActive?: boolean;
    phoneVerified?: boolean;
  }) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    // Prevent removing the last SUPER_ADMIN
    if (user.adminRole === 'SUPER_ADMIN' && dto.adminRole !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { adminRole: 'SUPER_ADMIN', deletedAt: null },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot demote the last SUPER_ADMIN');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role as any ?? undefined,
        adminRole: dto.adminRole !== undefined ? (dto.adminRole as any) : undefined,
        isActive: dto.isActive ?? undefined,
        phoneVerified: dto.phoneVerified ?? undefined,
      },
      select: USER_SELECT,
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: id,
      action: 'UPDATE',
      newValue: { event: 'USER_UPDATED', changes: dto },
    });

    return updated;
  }

  async deactivateUser(id: string, adminId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('User is already inactive');

    await this.prisma.user.update({ where: { id }, data: { isActive: false } });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: id,
      action: 'UPDATE',
      newValue: { event: 'USER_DEACTIVATED' },
    });

    return { id, deactivated: true };
  }

  async reactivateUser(id: string, adminId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isActive) throw new BadRequestException('User is already active');

    await this.prisma.user.update({ where: { id }, data: { isActive: true } });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: id,
      action: 'UPDATE',
      newValue: { event: 'USER_REACTIVATED' },
    });

    return { id, reactivated: true };
  }

  async softDeleteUser(id: string, adminId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    if (user.adminRole === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot delete a SUPER_ADMIN account');
    }

    // Check no open orders
    const openOrders = await this.prisma.order.count({
      where: {
        status: { in: ['QUOTED', 'ACCEPTED'] as any },
        OR: [
          { buyerId: id },
          { seller: { userId: id } },
        ],
      },
    });
    if (openOrders > 0) throw new BadRequestException('User has open orders — resolve them first');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: id,
      action: 'DELETE',
      newValue: { event: 'USER_SOFT_DELETED' },
    });

    return { id, deleted: true };
  }

  async getUserStats() {
    const [total, sellers, buyers, admins, inactive, newThisMonth] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'SELLER', deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'BUYER', deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
      this.prisma.user.count({ where: { isActive: false, deletedAt: null } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);
    return { total, sellers, buyers, admins, inactive, newThisMonth };
  }

  async resetPassword(id: string, adminId: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const bcrypt = await import('bcrypt');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12');
    const hash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash, passwordResetToken: null, passwordResetExpiry: null },
    });

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: id,
      action: 'UPDATE',
      newValue: { event: 'ADMIN_PASSWORD_RESET' },
    });

    return { id, passwordReset: true };
  }
}
