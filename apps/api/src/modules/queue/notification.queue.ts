import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface NotificationJob {
  userId: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP';
  templateId: string;
  data: Record<string, any>;
  requestId: string; // For idempotency
}

@Processor('notifications')
@Injectable()
export class NotificationQueueConsumer {
  private readonly logger = new Logger(NotificationQueueConsumer.name);

  @Process({ concurrency: 5 })
  async handleNotificationJob(job: Job<NotificationJob>) {
    const { userId, type, templateId, data, requestId } = job.data;
    this.logger.log(`Processing notification job: ${job.id}, Type: ${type}, RequestId: ${requestId}`);

    try {
      // Check idempotency: if job already processed, skip 
      // TODO: Implement idempotency check via Redis 

      switch (type) {
        case 'EMAIL':
          this.logger.log(`Sending Email for User: ${userId}, Template: ${templateId}`);
          // TODO: Call SendGrid service
          break;
        case 'SMS':
          this.logger.log(`Sending SMS for User: ${userId}, Template: ${templateId}`);
          // TODO: Call MSG91 service
          break;
        case 'WHATSAPP':
          this.logger.log(`Sending WhatsApp for User: ${userId}, Template: ${templateId}`);
          // TODO: Call WhatsApp BSP service
          break;
        default:
          this.logger.warn(`Unsupported notification type: ${type}`);
          break;
      }

      this.logger.log(`Successfully processed notification job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process notification job: ${job.id}`, error);
      throw error; // Let Bull handle retries
    }
  }
}
