import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, EMPTY } from 'rxjs'
import {
  FeatureFlagOptions,
  FEATURE_FLAG_METADATA,
} from '../decorators/feature-flag.decorator'
import { FeatureFlagsService } from '../../services/feature-flags/feature-flags.service'

@Injectable()
export class FeatureFlagInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const metadata = this.reflector.get<FeatureFlagOptions | undefined>(
      FEATURE_FLAG_METADATA,
      context.getHandler(),
    )

    if (!metadata) {
      return next.handle()
    }

    const nodeEnv = process.env.NODE_ENV || 'development'

    if (nodeEnv === 'development') {
      try {
        const enabled = await this.featureFlagsService.isFeatureEnabled(
          metadata.name,
        )
        if (!enabled) {
          const res = context.switchToHttp().getResponse()
          const body =
            metadata.fallback ??
            {
              success: false,
              message: 'Feature is disabled',
              data: null,
            }
          res.status(200).json(body)
          return EMPTY
        }
        return next.handle()
      } catch (_err) {
        return next.handle()
      }
    }

    try {
      const enabled = await this.featureFlagsService.isFeatureEnabled(
        metadata.name,
      )

      if (!enabled) {
        const res = context.switchToHttp().getResponse()
        const body =
          metadata.fallback ??
          {
            success: false,
            message: 'Feature is disabled',
            data: null,
          }
        res.status(200).json(body)
        return EMPTY
      }

      return next.handle()
    } catch (error) {
      const res = context.switchToHttp().getResponse()
      const fallback =
        metadata.fallback ??
        {
          success: false,
          message: 'Feature is disabled',
          data: null,
        }
      res.status(200).json(fallback)
      return EMPTY
    }
  }
}
