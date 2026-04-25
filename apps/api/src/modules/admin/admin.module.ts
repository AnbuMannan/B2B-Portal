import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminKycController } from './admin-kyc.controller';
import { AdminKycService } from './admin-kyc.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminFraudController } from './admin-fraud.controller';
import { AdminFraudService } from './admin-fraud.service';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { AdminComplaintsController } from './admin-complaints.controller';
import { AdminComplaintsService } from './admin-complaints.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { DatabaseModule } from '../../database/database.module';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../../services/redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { GstinService } from '../../services/government/gstin.service';
import { PanService } from '../../services/government/pan.service';
import { IecService } from '../../services/government/iec.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({
        secret:
          cs.get<string>('JWT_SECRET') ??
          'dev-secret-change-in-production-min-32-chars',
        signOptions: { expiresIn: '240m' },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuditModule,
    RedisModule,
    QueueModule,
  ],
  controllers: [AdminAuthController, AdminDashboardController, AdminKycController, AdminProductsController, AdminFinanceController, AdminFraudController, AdminContentController, AdminComplaintsController, AdminUsersController],
  providers: [AdminAuthService, AdminDashboardService, AdminKycService, AdminProductsService, AdminFinanceService, AdminFraudService, AdminContentService, AdminComplaintsService, AdminUsersService, GstinService, PanService, IecService, RazorpayService],
  exports: [AdminAuthService, AdminProductsService],
})
export class AdminModule {}
