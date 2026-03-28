import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface AuditLogInput {
  userId?: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Log an action to the audit trail
   * Async operation - doesn't block the request
   */
  async logAction(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action as any,
          oldValue: input.oldValue ? JSON.stringify(input.oldValue) : undefined,
          newValue: input.newValue ? JSON.stringify(input.newValue) : undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          timestamp: new Date(),
          createdAt: new Date(),
        },
      });

      this.logger.debug(
        `✅ Audit logged: ${input.action} ${input.entityType} ${input.entityId} by user ${input.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log audit: ${input.action} ${input.entityType}`,
        error,
      );
      // Don't throw - audit logging failure shouldn't break main operation
    }
  }

  /**
   * Query audit logs by entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 50,
  ): Promise<any[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs.map((log: any) => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
    }));
  }

  /**
   * Query audit logs by user
   */
  async getUserAuditTrail(userId: string, limit: number = 100): Promise<any[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs.map((log: any) => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
    }));
  }

  /**
   * Daily purge job - removes logs older than 7 years (tax compliance)
   * Runs at 2 AM IST every day
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeOldAuditLogs(): Promise<void> {
    try {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

      const deleted = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: sevenYearsAgo,
          },
        },
      });

      this.logger.log(
        `🗑️ Audit log purge job completed. Deleted ${deleted.count} logs older than 7 years.`,
      );
    } catch (error) {
      this.logger.error('Audit log purge job failed', error);
    }
  }

  /**
   * Get audit logs for compliance report (last 30 days)
   */
  async getComplianceReport(days: number = 30): Promise<{
    totalActions: number;
    byAction: Record<string, number>;
    byEntity: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
    });

    const report = {
      totalActions: logs.length,
      byAction: {} as Record<string, number>,
      byEntity: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
    };

    logs.forEach((log: any) => {
      // Count by action
      report.byAction[log.action] = (report.byAction[log.action] || 0) + 1;

      // Count by entity type
      report.byEntity[log.entityType] =
        (report.byEntity[log.entityType] || 0) + 1;

      // Count by user
      if (log.userId) {
        report.byUser[log.userId] = (report.byUser[log.userId] || 0) + 1;
      }
    });

    return report;
  }
}
