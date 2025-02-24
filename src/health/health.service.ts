import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from 'src/blockchain/blockchain.service';
import { ValidatorGateway } from 'src/validator/validator.gateway';

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);
    private startupTime = Date.now();
  
    constructor(
      private readonly blockchain: BlockchainService,
      private readonly p2p: ValidatorGateway,
    ) {}
  
    async getHealthStatus() {
      return {
        uptime: Date.now() - this.startupTime,
        blockHeight: await this.blockchain.getBlockHeight(),
        peersConnected: this.p2p.isConnected() ? 1 : 0,
        status: this.p2p.isConnected() ? 'healthy' : 'degraded',
        lastCheck: new Date().toISOString(),
      };
    }
}
