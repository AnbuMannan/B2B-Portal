import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SearchService } from './search.service';

interface SearchSyncJob {
  entityType: 'PRODUCT' | 'BUY_LEAD' | 'SELLER';
  entityId: string;
  action: 'INDEX' | 'DELETE' | 'UPDATE' | 'CREATE';
  requestId: string;
}

@Processor('search-sync')
@Injectable()
export class SearchSyncConsumer {
  private readonly logger = new Logger(SearchSyncConsumer.name);

  constructor(private readonly searchService: SearchService) {}

  @Process({ concurrency: 5 })
  async handleSearchSyncJob(job: Job<SearchSyncJob>) {
    const { entityType, entityId, action, requestId } = job.data;
    this.logger.log(
      `search-sync job ${job.id}: ${action} ${entityType} ${entityId} (requestId=${requestId})`,
    );

    try {
      if (entityType !== 'PRODUCT') {
        this.logger.log(`Skipping non-product entity type: ${entityType}`);
        return;
      }

      switch (action) {
        case 'INDEX':
        case 'CREATE':
        case 'UPDATE':
          await this.searchService.indexProduct(entityId);
          break;
        case 'DELETE':
          await this.searchService.deleteProductFromIndex(entityId);
          break;
        default:
          this.logger.warn(`Unsupported search-sync action: ${action}`);
      }

      this.logger.log(`Completed search-sync job ${job.id}`);
    } catch (error) {
      this.logger.error(`search-sync job ${job.id} failed: ${error.message}`, error.stack);
      throw error; // Rethrow so BullMQ retries per defaultJobOptions
    }
  }
}
