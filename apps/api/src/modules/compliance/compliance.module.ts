import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production-min-32-chars',
        signOptions: { expiresIn: '240m' },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'export' },
      { name: 'email' },
      { name: 'notifications' },
    ),
    DatabaseModule,
    AuditModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
