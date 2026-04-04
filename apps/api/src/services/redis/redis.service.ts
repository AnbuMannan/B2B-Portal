import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private client: RedisClientType | null = null;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const url = this.configService.get<string>('redis.url') || process.env.REDIS_URL;
    if (url) {
      this.client = createClient({ url });
      this.client.on('error', (err) => this.logger.error('Redis Client Error', err));
      this.client.on('connect', () => this.logger.log('✅ Redis connected'));
    } else {
      this.logger.log('Redis not configured — caching disabled, running without cache');
    }
  }

  async validateConnection(): Promise<void> {
    if (!this.client) throw new Error('Redis not configured');
    if (!this.client.isOpen) await this.client.connect();
    const pong = await this.client.ping();
    if (pong !== 'PONG') throw new Error('Redis ping failed');
    this.logger.log('✅ Redis validated');
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      if (!this.client.isOpen) await this.connect();
      const value = await this.client.get(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Get failed: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.isOpen) await this.connect();
      const json = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, json);
      } else {
        await this.client.set(key, json);
      }
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds || 'none'})`);
    } catch (error) {
      this.logger.error(`Set failed: ${key}`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.isOpen) await this.connect();
      await this.client.del(key);
      this.logger.debug(`Cache DELETE: ${key}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${key}`, error);
    }
  }

  async flush(): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.isOpen) await this.connect();
      await this.client.flushDb();
      this.logger.log('✅ Redis flushed');
    } catch (error) {
      this.logger.error('Flush failed', error);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 1;
    try {
      if (!this.client.isOpen) await this.connect();
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Incr failed: ${key}`, error);
      return 1;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.isOpen) await this.connect();
      await this.client.expire(key, seconds);
      this.logger.debug(`Cache EXPIRE: ${key} (${seconds}s)`);
    } catch (error) {
      this.logger.error(`Expire failed: ${key}`, error);
    }
  }

  async createSession(userId: string, data: any, ttlSeconds: number = 86400): Promise<string> {
    const sessionId = `session:${userId}:${Date.now()}`;
    await this.set(sessionId, data, ttlSeconds);
    return sessionId;
  }

  async getSession(sessionId: string): Promise<any> {
    return this.get(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete(sessionId);
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  async getKeys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      if (!this.client.isOpen) await this.connect();
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`GetKeys failed with pattern: ${pattern}`, error);
      return [];
    }
  }

  private async connect(): Promise<void> {
    if (this.client && !this.client.isOpen) {
      await this.client.connect();
    }
  }

  async onApplicationShutdown() {
    if (this.client?.isOpen) {
      await this.client.disconnect();
      this.logger.log('Redis connection closed');
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isAvailable(): boolean {
    return !!(this.client && this.client.isOpen);
  }
}
