import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class RoleBasedGuard implements CanActivate {
  private readonly logger = new Logger(RoleBasedGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles decorator
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // No user authenticated
    if (!user) {
      this.logger.warn('No authenticated user found in request');
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has required role
    const hasRequiredRole = requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      this.logger.warn(
        `Authorization failed: User ${user.id} (role: ${user.role}) denied access to ${request.path}. Required roles: ${requiredRoles.join(', ')}`,
      );

      throw new ForbiddenException(
        `This endpoint requires one of the following roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    this.logger.debug(
      `Authorization succeeded: User ${user.id} (role: ${user.role}) accessing ${request.method} ${request.path}`,
    );

    return true;
  }
}
