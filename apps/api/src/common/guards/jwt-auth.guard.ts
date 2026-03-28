import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Validates the Bearer JWT from the Authorization header.
 * On success, attaches the user to request.user.
 * Apply at method or controller level — the global RoleBasedGuard
 * will handle role enforcement separately via @Roles() decorator.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any): any {
    if (err || !user) {
      throw err ?? new UnauthorizedException(
        'Authentication required. Please provide a valid Bearer token.',
      );
    }
    return user;
  }
}
