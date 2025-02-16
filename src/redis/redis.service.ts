import { Injectable, Logger } from '@nestjs/common';
import { CreateRediDto } from './dto/create-redi.dto';
import { UpdateRediDto } from './dto/update-redi.dto';
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
      this.logger.log('Conectado a Redis');
    });
  }

  async connectToRedis() {
    try {
      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Error conectando a Redis: ${error.message}`);
    }
  }

  async storeValidatorPeers(peers: Record<string, string>) {
    try {
      await this.redisClient.hSet('validatorPeers', peers);
    } catch (error) {
      this.logger.error(`Error al almacenar peers validadores: ${error.message}`);
    }
  }

  async removeValidatorPeer(ip: string) {
    try {
      await this.redisClient.hDel('validatorPeers', ip);
    } catch (error) {
      this.logger.error(`Error al eliminar peer validador: ${error.message}`);
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.redisClient.hGetAll(key);
    } catch (error) {
      this.logger.error(`Error en hGetAll(${key}): ${error.message}`);
      return {};
    }
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.redisClient.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Error en hSet(${key}, ${field}): ${error.message}`);
    }
  }
}
