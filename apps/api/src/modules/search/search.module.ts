import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../services/redis/redis.module';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchSyncConsumer } from './search-sync.consumer';
import { SearchAnalyticsConsumer } from './search-analytics.consumer';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    // Register both queues so @InjectQueue works in this module.
    // BullModule.forRootAsync() is called in QueueModule which is imported by AppModule
    // before SearchModule, so the Redis connection is already established.
    BullModule.registerQueue(
      { name: 'search-sync' },
      { name: 'search-analytics' },
    ),
  ],
  controllers: [SearchController],
  providers: [
    ElasticsearchService,
    SearchService,
    SearchSyncConsumer,
    SearchAnalyticsConsumer,
  ],
  exports: [SearchService],
})
export class SearchModule {}
