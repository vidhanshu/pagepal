import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis connection error: ${err.message}`),
    );

    await this.client.connect();
    this.logger.log(`Connected to Redis at ${url}`);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const stream = this.client.scanStream({ match: pattern, count: 100 });

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          void this.client.del(...keys);
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    });
  }
}
