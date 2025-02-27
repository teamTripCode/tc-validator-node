import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ValidatorService } from '../validator/validator.service';
import { BlockchainService } from 'src/blockchain/blockchain.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly validator: ValidatorService,
    private readonly blockchain: BlockchainService,
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

  @Get('status')
  async getStatus() {
    const blockHeight = await this.blockchain.getBlockHeight();
    const peers = this.validator.getConnectedPeers();

    return {
      blockchain: {
        blockHeight,
        peers: peers.length,
        peerList: peers,
      },
    };
  }
}