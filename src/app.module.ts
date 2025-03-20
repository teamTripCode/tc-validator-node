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
import { StateModule } from './state/state.module';
import { TripCoinModule } from './tripcoin/tripcoin.module';
import { StateService } from './state/state.service';

@Module({
  imports: [
    RedisModule,
    ConsensusModule,
    SignatureModule,
    StateModule,
    TripCoinModule,
  ],
  controllers: [AppController],
  providers: [AppService, ValidatorGateway, TripcoinService, QueueService, BlockchainService, StateService],
})
export class AppModule {}
