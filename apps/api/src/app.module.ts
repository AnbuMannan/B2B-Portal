import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { FileSystemService } from './services/file-system/file-system.service';
import { ElasticsearchService } from './services/elasticsearch/elasticsearch.service';
import { RedisModule } from './services/redis/redis.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { QueueModule } from './modules/queue/queue.module';
import { LeadContactModule } from './modules/lead-contact/lead-contact.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { FeatureFlagsModule } from './services/feature-flags/feature-flags.module';
import { BaseExceptionFilter } from './common/filters/base-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { JwtExceptionFilter } from './common/filters/jwt-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { RoleBasedGuard } from './common/guards/role-based.guard';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { CacheInvalidationService } from './common/services/cache-invalidation.service';
import { ProductsModule } from './modules/products/products.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { FeatureFlagInterceptor } from './common/interceptors/feature-flag.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env'],
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    HomepageModule,
    ProductsModule,
    SellersModule,
    AuthModule,
    HealthModule,
    QueueModule,
    LeadContactModule,
    AuditModule,
    FeatureFlagsModule,
  ],
  controllers: [],
  providers: [
    FileSystemService,
    ElasticsearchService,
    {
      provide: APP_GUARD,
      useClass: RoleBasedGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: FeatureFlagInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: JwtExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DatabaseExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: BaseExceptionFilter,
    },
    CacheInvalidationService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
