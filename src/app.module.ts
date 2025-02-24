import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ValidatorGateway } from './validator/validator.gateway';
import { RedisModule } from './redis/redis.module';
import { ConsensusModule } from './consensus/consensus.module';
import { SignatureModule } from './signature/signature.module';
import { TripcoinService } from './tripcoin/tripcoin.service';
import { QueueService } from './queue/queue.service';
import { BlockchainService } from './blockchain/blockchain.service';

@Module({
  imports: [RedisModule, ConsensusModule, SignatureModule],
  controllers: [AppController],
  providers: [AppService, ValidatorGateway, TripcoinService, QueueService, BlockchainService],
})
export class AppModule {}
