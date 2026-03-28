import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../../services/feature-flags/feature-flags.service';
import { FEATURE_FLAG_METADATA, FeatureFlagOptions } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<FeatureFlagOptions>(
      FEATURE_FLAG_METADATA,
      context.getHandler()
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Extract user information from request
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const isEnabled = await this.featureFlagsService.isEnabled(
      options.name,
      userId,
      userRole
    );

    if (!isEnabled) {
      if (options.fallback !== undefined) {
        return options.fallback;
      }
      throw new ForbiddenException(
        `Feature '${options.name}' is not available`
      );
    }

    return true;
  }
}