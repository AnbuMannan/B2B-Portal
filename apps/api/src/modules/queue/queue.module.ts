import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

import { NotificationQueueConsumer } from './notification.queue';
import { EmailQueueConsumer } from './email.queue';
import { SmsQueueConsumer } from './sms.queue';
import { ExportQueueConsumer } from './export.queue';

// NOTE: SearchSyncQueueConsumer has been moved to SearchModule (search-sync.consumer.ts)
// to co-locate it with SearchService which it depends on. QueueModule still registers
// the queues here so other modules can inject them via @InjectQueue.

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
      { name: 'search-analytics' },
      { name: 'email' },
      { name: 'sms' },
      { name: 'export' },
      { name: 'payments' },
    ),
  ],
  providers: [
    NotificationQueueConsumer,
    EmailQueueConsumer,
    SmsQueueConsumer,
    ExportQueueConsumer,
  ],
  exports: [BullModule],
})
export class QueueModule {}
