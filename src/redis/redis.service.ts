import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * RedisService handles the connection and operations related to Redis.
 * It includes methods for validator peer management and generic Redis commands.
 */
@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private redisClient: RedisClientType;

  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    this.setupRedisEventHandlers();
  }

  /**
   * Sets up event handlers for Redis client connection and error events.
   */
  private setupRedisEventHandlers() {
    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis Error: ${err.message}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  /**
   * Establishes a connection to Redis.
   */
  async connectToRedis() {
    try {
      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Error connecting to Redis: ${error.message}`);
    }
  }

  /**
   * Disconnects from Redis.
   */
  async disconnect() {
    try {
      await this.redisClient.quit();
      this.logger.log('Disconnected from Redis');
    } catch (error) {
      this.logger.error(`Error disconnecting from Redis: ${error.message}`);
    }
  }

  /**
   * Stores validator peers in Redis.
   * @param peers Object containing peer data.
   */
  async storeValidatorPeers(peers: Record<string, string>) {
    try {
      await this.redisClient.hSet('validatorPeers', peers);
    } catch (error) {
      this.logger.error(`Error storing validator peers: ${error.message}`);
    }
  }

  /**
   * Removes a validator peer from Redis.
   * @param ip IP address of the validator peer.
   */
  async removeValidatorPeer(ip: string) {
    try {
      await this.redisClient.hDel('validatorPeers', ip);
    } catch (error) {
      this.logger.error(`Error removing validator peer: ${error.message}`);
    }
  }

  /**
   * Retrieves all fields and values for a given key from Redis.
   * @param key The key to query.
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.redisClient.hGetAll(key);
    } catch (error) {
      this.logger.error(`Error in hGetAll(${key}): ${error.message}`);
      return {};
    }
  }

  /**
   * Sets a field in a hash stored at key.
   * @param key Redis key.
   * @param field Field name.
   * @param value Field value.
   */
  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.redisClient.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Error in hSet(${key}, ${field}): ${error.message}`);
    }
  }

  /**
   * Checks if a field exists in a hash.
   * @param key Redis key.
   * @param field Field name.
   */
  async hExists(key: string, field: string): Promise<boolean> {
    try {
      return await this.redisClient.hExists(key, field);
    } catch (error) {
      this.logger.error(`Error in hExists(${key}, ${field}): ${error.message}`);
      return false;
    }
  }

  /**
   * Retrieves the value of a field in a hash.
   * @param key Redis key.
   * @param field Field name.
   */
  async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.redisClient.hGet(key, field);
    } catch (error) {
      this.logger.error(`Error in hGet(${key}, ${field}): ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieves the value of a key.
   * @param key Redis key.
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Error in get(${key}): ${error.message}`);
      return null;
    }
  }

  /**
   * Sets a value for a given key in Redis.
   * @param key Redis key.
   * @param value Value to set.
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await this.redisClient.set(key, value);
    } catch (error) {
      this.logger.error(`Error in set(${key}, ${value}): ${error.message}`);
    }
  }

  /**
   * Deletes a key from Redis.
   * @param key Redis key to delete.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Error in del(${key}): ${error.message}`);
    }
  }

  /**
   * Pings the Redis server to check connectivity.
   */
  async ping(): Promise<string> {
    try {
      return await this.redisClient.ping();
    } catch (error) {
      this.logger.error(`Error in ping(): ${error.message}`);
      return 'Error';
    }
  }
}
