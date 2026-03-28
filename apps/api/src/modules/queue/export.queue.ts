import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface ExportJob {
  userId: string;
  reportType: 'CSV' | 'EXCEL';
  entity: 'PRODUCTS' | 'ORDERS' | 'BUY_LEADS';
  filters: Record<string, any>;
  requestId: string;
}

@Processor('export')
@Injectable()
export class ExportQueueConsumer {
  private readonly logger = new Logger(ExportQueueConsumer.name);

  @Process({ concurrency: 5 })
  async handleExportJob(job: Job<ExportJob>) {
    const { userId, reportType, entity, filters, requestId } = job.data;
    this.logger.log(`Processing export job: ${job.id}, Entity: ${entity}, Format: ${reportType}, User: ${userId}, RequestId: ${requestId}`);

    try {
      this.logger.log(`Generating ${reportType} report for ${entity} using filters: ${JSON.stringify(filters)}`);

      // TODO: Implement report generation and file export logic
      // await this.reportGeneratorService.generate(userId, reportType, entity, filters);

      this.logger.log(`Successfully processed export job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process export job: ${job.id}`, error);
      throw error;
    }
  }
}
