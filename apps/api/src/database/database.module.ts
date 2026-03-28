import { Module, Global } from '@nestjs/common';
import { DatabaseService, PrismaService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService, PrismaService],
  exports: [DatabaseService, PrismaService],
})
export class DatabaseModule {}
