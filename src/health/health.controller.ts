import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ValidatorService } from '../validator/validator.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly validator: ValidatorService,
  ) {}

  @Get()
  async checkHealth() {
    const redisStatus = await this.redis.ping();
    const validatorStatus = this.validator.myValidatorInfo.status;

    return {
      status: 'OK',
      redis: redisStatus === 'PONG' ? 'Connected' : 'Disconnected',
      validator: {
        address: this.validator.myValidatorInfo.address,
        status: validatorStatus,
      },
    };
  }
}