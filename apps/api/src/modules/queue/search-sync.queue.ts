import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface SearchSyncJob {
  entityType: 'PRODUCT' | 'BUY_LEAD' | 'SELLER';
  entityId: string;
  action: 'INDEX' | 'DELETE' | 'UPDATE';
  requestId: string;
}

@Processor('search-sync')
@Injectable()
export class SearchSyncQueueConsumer {
  private readonly logger = new Logger(SearchSyncQueueConsumer.name);

  @Process({ concurrency: 5 })
  async handleSearchSyncJob(job: Job<SearchSyncJob>) {
    const { entityType, entityId, action, requestId } = job.data;
    this.logger.log(`Processing search-sync job: ${job.id}, Entity: ${entityType}, Action: ${action}, RequestId: ${requestId}`);

    try {
      // TODO: Call Elasticsearch service to perform indexing or deletion
      this.logger.log(`Synchronizing ${entityType} (ID: ${entityId}) to Elasticsearch, Action: ${action}`);

      // Example pseudo-implementation
      switch (action) {
        case 'INDEX':
        case 'UPDATE':
          // await this.elasticsearchService.index(entityType, entityId);
          break;
        case 'DELETE':
          // await this.elasticsearchService.delete(entityType, entityId);
          break;
        default:
          this.logger.warn(`Unsupported search-sync action: ${action}`);
          break;
      }

      this.logger.log(`Successfully processed search-sync job: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process search-sync job: ${job.id}`, error);
      throw error;
    }
  }
}
