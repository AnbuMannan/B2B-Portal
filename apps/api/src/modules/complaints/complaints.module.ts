import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
