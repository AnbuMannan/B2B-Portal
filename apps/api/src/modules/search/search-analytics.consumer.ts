import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../database/database.service';

interface SearchAnalyticsJob {
  query: string;
  resultsCount: number;
  filters: Record<string, any> | null;
  userId: string | null;
  ipAddress: string | null;
}

@Processor('search-analytics')
@Injectable()
export class SearchAnalyticsConsumer {
  private readonly logger = new Logger(SearchAnalyticsConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('log-search')
  async handleLogSearch(job: Job<SearchAnalyticsJob>) {
    const { query, resultsCount, filters, userId, ipAddress } = job.data;

    try {
      await (this.prisma as any).searchLog.create({
        data: {
          query,
          resultsCount,
          filters: filters ?? undefined,
          userId: userId ?? undefined,
          ipAddress: ipAddress ?? undefined,
        },
      });
    } catch (error) {
      // Analytics failures must never bubble up to impact search response
      this.logger.warn(`Failed to write SearchLog entry: ${error.message}`);
    }
  }
}
