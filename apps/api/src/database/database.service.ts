import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url:
            configService.get<string>('database.url') ||
            process.env.POSTGRES_URL,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        throw error;
      }
      // In development, continue even if DB connection fails
      this.logger.warn('⚠️ Continuing in development mode without database connection');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  async validateConnection(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection validated successfully');
    } catch (error) {
      this.logger.error('❌ Database connection validation failed', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }
}

// Export PrismaService as an alias for DatabaseService for backward compatibility if needed,
// but better to just export DatabaseService and use it everywhere.
export { DatabaseService as PrismaService };
