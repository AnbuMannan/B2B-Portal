import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { DatabaseModule } from '../../database/database.module'
import { RedisModule } from '../../services/redis/redis.module'
import { QueueModule } from '../queue/queue.module'
// import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service' // TODO: Enable when Elasticsearch is available
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service'

@Module({
  imports: [DatabaseModule, RedisModule, QueueModule],
  controllers: [ProductsController],
  providers: [ProductsService, CacheInvalidationService],
  exports: [ProductsService],
})
export class ProductsModule {}

