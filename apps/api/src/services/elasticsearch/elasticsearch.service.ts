import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, ClientOptions } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService {
  private client: Client;
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(private configService: ConfigService) {
    this.initializeElasticsearch();
  }

  private initializeElasticsearch() {
    const elasticsearchUrl = this.configService.get<string>('elasticsearch.url');
    const username = process.env.ELASTICSEARCH_USERNAME;
    const password = process.env.ELASTICSEARCH_PASSWORD;

    const clientOptions: ClientOptions = {
      node: elasticsearchUrl,
      requestTimeout: 2000, // fail fast → Prisma fallback kicks in within 2s
      maxRetries: 0,        // no retries — we have a Prisma fallback
    };

    if (username && password) {
      clientOptions.auth = {
        username,
        password,
      };
    }

    this.client = new Client(clientOptions);
  }

  async validateConnection(): Promise<void> {
    try {
      const response = await this.client.ping();
      
      if (response) {
        this.logger.log('✅ Elasticsearch connection validated successfully');
        
        // Check cluster health
        const health = await this.client.cluster.health();
        this.logger.log(`📊 Elasticsearch cluster status: ${health.status}`);
        
      } else {
        throw new Error('Elasticsearch ping failed');
      }
    } catch (error) {
      this.logger.error('❌ Elasticsearch connection validation failed', error);
      throw new Error(`Elasticsearch connection failed: ${error.message}`);
    }
  }

  async onApplicationShutdown() {
    if (this.client) {
      await this.client.close();
      this.logger.log('Elasticsearch connection closed');
    }
  }

  async search(params: any): Promise<any> {
    try {
      return await this.client.search(params);
    } catch (error) {
      this.logger.error(`Elasticsearch search error: ${error.message}`, error);
      throw error;
    }
  }

  getClient(): Client {
    return this.client;
  }
}