import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface SmsJob {
  to: string;
  message?: string;
  otp?: string;
  templateId: string;
  data?: Record<string, any>;
  requestId: string;
}

@Processor('sms')
@Injectable()
export class SmsQueueConsumer {
  private readonly logger = new Logger(SmsQueueConsumer.name);

  @Process({ concurrency: 5 })
  async handleSmsJob(job: Job<SmsJob>) {
    const { to, otp, templateId, requestId } = job.data;
    this.logger.log(`Processing SMS job: ${job.id}, To: ${to}, RequestId: ${requestId}`);

    try {
      this.logger.log(`Sending SMS via MSG91: ${to}, Template: ${templateId}, OTP: ${otp ? 'Yes' : 'No'}`);

      // TODO: Call MSG91 service to send the SMS
      // await this.msg91Service.send(to, templateId, otp, data);

      this.logger.log(`Successfully processed SMS job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process SMS job: ${job.id}`, error);
      throw error;
    }
  }
}
