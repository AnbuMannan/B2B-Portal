import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

import { NotificationQueueConsumer } from './notification.queue';
import { SearchSyncQueueConsumer } from './search-sync.queue';
import { EmailQueueConsumer } from './email.queue';
import { SmsQueueConsumer } from './sms.queue';
import { ExportQueueConsumer } from './export.queue';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url') || process.env.REDIS_URL;
        return {
          url: redisUrl,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'search-sync' },
      { name: 'email' },
      { name: 'sms' },
      { name: 'export' },
      { name: 'payments' },
    ),
  ],
  providers: [
    NotificationQueueConsumer,
    SearchSyncQueueConsumer,
    EmailQueueConsumer,
    SmsQueueConsumer,
    ExportQueueConsumer,
  ],
  exports: [BullModule],
})
export class QueueModule {}
