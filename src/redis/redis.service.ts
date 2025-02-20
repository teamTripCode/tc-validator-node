import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private redisClient: RedisClientType;

  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    this.setupRedisEventHandlers();
  }

  private setupRedisEventHandlers() {
    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis Error: ${err.message}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async connectToRedis() {
    try {
      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Error connecting to Redis: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      await this.redisClient.quit();
      this.logger.log('Disconnected from Redis');
    } catch (error) {
      this.logger.error(`Error disconnecting from Redis: ${error.message}`);
    }
  }

  async storeValidatorPeers(peers: Record<string, string>) {
    try {
      await this.redisClient.hSet('validatorPeers', peers);
    } catch (error) {
      this.logger.error(`Error storing validator peers: ${error.message}`);
    }
  }

  async removeValidatorPeer(ip: string) {
    try {
      await this.redisClient.hDel('validatorPeers', ip);
    } catch (error) {
      this.logger.error(`Error removing validator peer: ${error.message}`);
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.redisClient.hGetAll(key);
    } catch (error) {
      this.logger.error(`Error in hGetAll(${key}): ${error.message}`);
      return {};
    }
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.redisClient.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Error in hSet(${key}, ${field}): ${error.message}`);
    }
  }

  async hExists(key: string, field: string): Promise<boolean> {
    try {
      return await this.redisClient.hExists(key, field);
    } catch (error) {
      this.logger.error(`Error in hExists(${key}, ${field}): ${error.message}`);
      return false;
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.redisClient.hGet(key, field);
    } catch (error) {
      this.logger.error(`Error in hGet(${key}, ${field}): ${error.message}`);
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Error in get(${key}): ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.redisClient.set(key, value);
    } catch (error) {
      this.logger.error(`Error in set(${key}, ${value}): ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Error in del(${key}): ${error.message}`);
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.redisClient.ping();
    } catch (error) {
      this.logger.error(`Error in ping(): ${error.message}`);
      return 'Error';
    }
  }

}
