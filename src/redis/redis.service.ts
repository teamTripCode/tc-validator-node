import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private redisClient: RedisClientType;

  /**
   * Constructor initializes the Redis client and sets up event handlers.
   */
  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    this.setupRedisEventHandlers();
  }

  /**
   * Sets up event handlers for Redis client events such as 'error' and 'connect'.
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
   * Establishes a connection to the Redis server.
   * Logs an error if the connection fails.
   */
  async connectToRedis() {
    try {
      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Error connecting to Redis: ${error.message}`);
    }
  }

  /**
   * Stores validator peers in Redis using a hash structure.
   * @param peers - A record of IP addresses and their corresponding metadata.
   */
  async storeValidatorPeers(peers: Record<string, string>) {
    try {
      await this.redisClient.hSet('validatorPeers', peers);
    } catch (error) {
      this.logger.error(`Error storing validator peers: ${error.message}`);
    }
  }

  /**
   * Removes a validator peer from Redis by its IP address.
   * @param ip - The IP address of the peer to remove.
   */
  async removeValidatorPeer(ip: string) {
    try {
      await this.redisClient.hDel('validatorPeers', ip);
    } catch (error) {
      this.logger.error(`Error removing validator peer: ${error.message}`);
    }
  }

  /**
   * Retrieves all fields and values of a hash stored in Redis.
   * @param key - The key of the hash to retrieve.
   * @returns A record of fields and values, or an empty object if an error occurs.
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
   * Sets a field-value pair in a hash stored in Redis.
   * @param key - The key of the hash.
   * @param field - The field to set.
   * @param value - The value to assign to the field.
   */
  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.redisClient.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Error in hSet(${key}, ${field}): ${error.message}`);
    }
  }
}