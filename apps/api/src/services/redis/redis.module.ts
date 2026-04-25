import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheService } from '../../common/services/cache.service';

@Global()
@Module({
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
