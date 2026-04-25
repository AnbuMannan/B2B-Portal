import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';

/**
 * Global guard that enforces @Roles() decorator.
 *
 * Why this guard validates JWT itself:
 *   NestJS runs APP_GUARD (global) BEFORE route-level @UseGuards(AuthGuard('jwt')).
 *   So request.user is null when this guard runs for @Roles() routes.
 *   Fix: extract + verify the JWT here using jsonwebtoken directly (no DI scope issue),
 *   then set request.user so controllers and subsequent guards can rely on it.
 */
@Injectable()
export class RoleBasedGuard implements CanActivate {
  private readonly logger = new Logger(RoleBasedGuard.name);

  // Cache TTL for user lookups — 5 minutes. Short enough that role changes propagate quickly.
  private readonly USER_CACHE_TTL = 300;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Check both method-level and controller-level @Roles decorators
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles decorator → public route, allow through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    let user = (request as any).user;

    // JWT guard hasn't run yet (global guards execute first), so validate the token here
    if (!user) {
      const authHeader = request.headers['authorization'] as string | undefined;

      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Authentication required');
      }

      const token = authHeader.slice(7);
      const secret =
        this.configService.get<string>('JWT_SECRET') ??
        'dev-secret-change-in-production-min-32-chars';

      let payload: { sub: string; email: string; role: string };
      try {
        payload = jwt.verify(token, secret) as typeof payload;
      } catch (err) {
        this.logger.warn(`JWT verification failed: ${(err as Error).message}`);
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Try Redis cache before hitting the DB — eliminates a DB round-trip on every request
      type CachedUser = { id: string; email: string; role: string; isActive: boolean };
      const cacheKey = `auth:user:${payload.sub}`;
      let dbUser = await this.redis.get<CachedUser>(cacheKey);

      if (!dbUser) {
        dbUser = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true, isActive: true },
        });

        if (dbUser?.isActive) {
          // Only cache active users; inactive users should fail fast without cache
          await this.redis.set(cacheKey, dbUser, this.USER_CACHE_TTL);
        }
      }

      if (!dbUser || !dbUser.isActive) {
        throw new UnauthorizedException('User account not found or inactive');
      }

      // Set on request so controllers (@CurrentUser) and subsequent guards use it
      (request as any).user = dbUser;
      user = dbUser;
    }

    // Role check
    if (!requiredRoles.includes(user.role)) {
      this.logger.warn(
        `Access denied: ${user.role} ${user.id} → required [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Required role: ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    this.logger.debug(`Auth OK: ${user.role} ${user.id} → ${request.method} ${request.path}`);
    return true;
  }
}
