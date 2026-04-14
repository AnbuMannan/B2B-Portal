import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [MulterModule.register(), SellersModule],
  controllers: [UploadController],
})
export class UploadModule {}
