import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { FileSystemService } from './services/file-system/file-system.service';
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
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';
import { BuyLeadsModule } from './modules/buy-leads/buy-leads.module';
import { SellerKycModule } from './modules/seller-kyc/seller-kyc.module';
import { UploadModule } from './modules/upload/upload.module';
import { SellerProductsModule } from './modules/seller-products/seller-products.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { FeatureFlagInterceptor } from './common/interceptors/feature-flag.interceptor';
import { SeoModule } from './modules/seo/seo.module';

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
    SearchModule,
    BuyLeadsModule,
    SellerKycModule,
    UploadModule,
    SellerProductsModule,
    WalletModule,
    WebhooksModule,
    LeadContactModule,
    AuditModule,
    FeatureFlagsModule,
    SeoModule,
  ],
  controllers: [],
  providers: [
    FileSystemService,
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
    // Apply custom rate limiting ONLY to sensitive routes.
    // General routes are protected by ThrottlerModule (100 req/min) already.
    // Applying to '*' was adding 2 Redis calls to every single request.
    consumer.apply(RateLimitMiddleware).forRoutes(
      'api/auth/login',
      'api/auth/register',
      'api/auth/forgot-password',
      'api/auth/reset-password',
      'api/seller/wallet',
      'api/search',
      'api/upload',
    );
  }
}
