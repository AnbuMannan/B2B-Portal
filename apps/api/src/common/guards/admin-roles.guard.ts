import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../database/database.service';
import { ADMIN_ROLES_KEY, AdminRoleType } from '../decorators/admin-roles.decorator';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  adminRole: AdminRoleType;
  sessionType: string;
}

@Injectable()
export class AdminRolesGuard implements CanActivate {
  private readonly logger = new Logger(AdminRolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRoleType[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin authentication required');
    }

    const token = authHeader.slice(7);
    const secret =
      this.configService.get<string>('JWT_SECRET') ??
      'dev-secret-change-in-production-min-32-chars';

    let payload: AdminJwtPayload;
    try {
      payload = jwt.verify(token, secret) as AdminJwtPayload;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.sessionType !== 'admin') {
      throw new ForbiddenException('Admin session token required');
    }

    // Verify user is still ADMIN in DB and has adminRole set
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, adminRole: true, isActive: true },
    });

    if (!user || !user.isActive || user.role !== 'ADMIN' || !user.adminRole) {
      throw new ForbiddenException('Admin access revoked or account inactive');
    }

    // SUPER_ADMIN bypasses all role checks
    const effectiveRole = user.adminRole as AdminRoleType;
    if (requiredRoles && requiredRoles.length > 0 && effectiveRole !== 'SUPER_ADMIN') {
      if (!requiredRoles.includes(effectiveRole)) {
        this.logger.warn(
          `Admin access denied: ${effectiveRole} attempted [${requiredRoles.join(', ')}]`,
        );
        throw new ForbiddenException(
          `Required admin role: ${requiredRoles.join(' or ')}. Your role: ${effectiveRole}`,
        );
      }
    }

    (request as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole,
    };

    return true;
  }
}
