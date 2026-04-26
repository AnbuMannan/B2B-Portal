import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as path from 'path';
import { validateConfig } from './config/configuration';
import { RedisService } from './services/redis/redis.service';
// import { ElasticsearchService } from './services/elasticsearch/elasticsearch.service'; // TODO: Enable when Elasticsearch is available
import { DatabaseService } from './database/database.service';
import { FileSystemService } from './services/file-system/file-system.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv !== 'development') {
      logger.log('Validating environment configuration...');
      await validateConfig(process.env);
      logger.log('Environment configuration validated successfully');
    } else {
      logger.log('Skipping strict env validation in development mode');
    }

    // Step 2: Create the NestJS application
    // rawBody: true preserves req.rawBody for Razorpay webhook signature verification
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
      bufferLogs: true,
      rawBody: true,
    });

    // Step 3: Get config service
    const configService = app.get(ConfigService);
    
    // Step 3b: Serve uploaded files as static assets
    // Files are stored in ./uploads/; URLs like /products/... map to ./uploads/products/...
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    app.useStaticAssets(uploadsDir);

    // Step 4: Configure global pipes and filters
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Step 5: Enable CORS
    const corsOrigin = configService.get<string[]>('app.corsOrigin');
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
      ],
    });

    // Step 6: Enable shutdown hooks
    app.enableShutdownHooks();

    // Step 7: Perform startup validations (skip in development)
    const env = configService.get<string>('app.env') || 'development';
    if (env !== 'development') {
      await performStartupValidations(app);
    }

    // Step 8: Start the application
    const port = process.env.PORT || configService.get<number>('app.port') || 3001;
    await app.listen(port, '0.0.0.0');

    logger.log(`🚀 Application is running on: ${await app.getUrl()}`);
    logger.log(`📊 Environment: ${configService.get('app.env')}`);
    logger.log(`🌐 Frontend URL: ${configService.get('app.frontendUrl')}`);
    
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

async function performStartupValidations(app: INestApplication) {
  const logger = new Logger('StartupValidation');
  const configService = app.get(ConfigService);

  logger.log('Performing startup validations...');

  // 1. Database connection validation
  try {
    logger.log('Validating database connection...');
    const databaseService = app.get(DatabaseService);
    await databaseService.validateConnection();
    logger.log('✅ Database connection validated');
  } catch (e: any) {
    logger.warn(`⚠️ Database validation failed, continuing anyway: ${e.message}`);
  }

  // 2. Redis connection validation
  try {
    logger.log('Validating Redis connection...');
    const redisService = app.get(RedisService);
    await redisService.validateConnection();
    logger.log('✅ Redis connection validated');
  } catch (e: any) {
    logger.warn(`⚠️ Redis connection failed, continuing without cache: ${e.message}`);
  }

  // 4. File system validation
  try {
    logger.log('Validating file system permissions...');
    const fileSystemService = app.get(FileSystemService);
    await fileSystemService.validateFileSystem();
    logger.log('✅ File system permissions validated');
  } catch (e: any) {
    logger.warn(`⚠️ File system validation failed: ${e.message}`);
  }

  // 5. Check required directories
  try {
    const fileSystemService = app.get(FileSystemService);
    const uploadDir = configService.get<string>('upload.directory');
    if (!uploadDir) {
      throw new Error('Upload directory configuration is missing');
    }
    await fileSystemService.ensureDirectoryExists(uploadDir);
    logger.log(`✅ Upload directory ready: ${uploadDir}`);
  } catch (e: any) {
    logger.warn(`⚠️ Upload dir check failed: ${e.message}`);
  }

  logger.log('🎉 Startup validations complete');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught exception', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
bootstrap();
