import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, Min, MinLength, validate } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum FeatureFlagsMode {
  Config = 'config',
  Database = 'database',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsNotEmpty()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(3000)
  @Max(65535)
  @Type(() => Number)
  PORT = 3001;

  @IsString()
  @IsNotEmpty()
  POSTGRES_URL: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_URL: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN = '7d';

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  NEXTAUTH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  NEXTAUTH_URL: string;

  @IsString()
  @IsNotEmpty()
  RAZORPAY_KEY_ID: string;

  @IsString()
  @IsNotEmpty()
  RAZORPAY_KEY_SECRET: string;

  @IsString()
  @IsNotEmpty()
  MSG91_AUTHKEY: string;

  @IsString()
  @IsOptional()
  GSTN_SANDBOX_KEY?: string;

  @IsString()
  @IsOptional()
  DGFT_API_KEY?: string;

  @IsUrl()
  @IsOptional()
  GSTN_API_URL?: string;

  @IsUrl()
  @IsOptional()
  INCOME_TAX_API_URL?: string;

  @IsUrl()
  @IsOptional()
  UDYAM_API_URL?: string;

  @IsString()
  @IsNotEmpty()
  FILE_UPLOAD_DIR = './uploads';

  @IsNumber()
  @Min(1024)
  @Max(104857600) // 100MB
  @Type(() => Number)
  MAX_FILE_SIZE = 10485760; // 10MB

  @IsEnum(FeatureFlagsMode)
  FEATURE_FLAGS_MODE: FeatureFlagsMode = FeatureFlagsMode.Config;

  @IsString()
  @IsOptional()
  AWS_REGION?: string;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_BUCKET_NAME?: string;

  @IsString()
  @IsOptional()
  DATADOG_API_KEY?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  BACKEND_URL = 'http://localhost:3001';

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value.split(','))
  CORS_ORIGIN: string[] = ['http://localhost:3000'];

  @IsInt()
  @Min(1)
  @Max(3600)
  @Type(() => Number)
  RATE_LIMIT_TTL = 60;

  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  RATE_LIMIT_MAX = 100;

  @IsInt()
  @Min(10)
  @Max(15)
  @Type(() => Number)
  BCRYPT_SALT_ROUNDS = 12;

  @IsString()
  @IsNotEmpty()
  LOG_LEVEL = 'info';
}

export const validateConfig = async (config: Record<string, any>) => {
  // Transform string values to appropriate types before validation
  const transformedConfig = { ...config };
  
  // Convert numeric fields from strings to numbers
  const numericFields = ['PORT', 'MAX_FILE_SIZE', 'BCRYPT_SALT_ROUNDS', 'RATE_LIMIT_TTL', 'RATE_LIMIT_MAX'];
  numericFields.forEach(field => {
    if (transformedConfig[field] !== undefined) {
      transformedConfig[field] = Number(transformedConfig[field]);
    }
  });
  
  const validatedConfig = Object.assign(new EnvironmentVariables(), transformedConfig);
  
  const errors = await validate(validatedConfig);
  
  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed: ${errors
        .map(error => error.constraints ? Object.values(error.constraints).join(', ') : 'Unknown error')
        .join('; ')}`
    );
  }
  
  return validatedConfig;
};

export default () => ({
  // Database
  database: {
    url: process.env.POSTGRES_URL,
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL,
  },
  
  // Elasticsearch
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // NextAuth
  nextAuth: {
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL,
  },
  
  // Payment Gateway
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  
  // SMS Gateway
  msg91: {
    authKey: process.env.MSG91_AUTHKEY,
    senderId: process.env.MSG91_SENDER_ID || 'B2BMKT',
    route: process.env.MSG91_ROUTE || '4',
  },
  
  // Government APIs
  government: {
    gstn: {
      apiKey: process.env.GSTN_SANDBOX_KEY,
      apiUrl: process.env.GSTN_API_URL,
    },
    dgft: {
      apiKey: process.env.DGFT_API_KEY,
    },
    incomeTax: {
      apiUrl: process.env.INCOME_TAX_API_URL,
    },
    udyam: {
      apiUrl: process.env.UDYAM_API_URL,
    },
  },
  
  // File Storage
  upload: {
    directory: process.env.FILE_UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(','),
  },
  
  // Feature Flags
  featureFlags: {
    mode: process.env.FEATURE_FLAGS_MODE || 'config',
  },
  
  // AWS S3 (Future)
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.AWS_BUCKET_NAME,
    endpoint: process.env.AWS_BUCKET_ENDPOINT,
  },
  
  // Monitoring
  monitoring: {
    datadog: {
      apiKey: process.env.DATADOG_API_KEY,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
    },
  },
  
  // Application
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  },
  
  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  // Security
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    encryption: {
      key: process.env.ENCRYPTION_KEY,
    },
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/application.log',
  },
});