import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ValidatorGateway } from 'src/validator/validator.gateway';

@Module({
  providers: [RedisService],
  exports: [RedisService]
})
export class RedisModule {}
