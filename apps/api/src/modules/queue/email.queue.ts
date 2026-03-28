import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface EmailJob {
  to: string;
  from: string;
  subject: string;
  templateId: string;
  data: Record<string, any>;
  requestId: string;
}

@Processor('email')
@Injectable()
export class EmailQueueConsumer {
  private readonly logger = new Logger(EmailQueueConsumer.name);

  @Process({ concurrency: 5 })
  async handleEmailJob(job: Job<EmailJob>) {
    const { to, subject, templateId, requestId } = job.data;
    this.logger.log(`Processing email job: ${job.id}, To: ${to}, RequestId: ${requestId}`);

    try {
      this.logger.log(`Sending transactional email via SendGrid: ${to}, Subject: ${subject}, Template: ${templateId}`);

      // TODO: Call SendGrid service to send the email
      // await this.sendgridService.send(to, from, subject, templateId, data);

      this.logger.log(`Successfully processed email job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process email job: ${job.id}`, error);
      throw error;
    }
  }
}
