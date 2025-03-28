import { forwardRef, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { ConsensusModule } from './consensus/consensus.module';
import { SignatureModule } from './signature/signature.module';
import { StateModule } from './state/state.module';
import { TripCoinModule } from './tripcoin/tripcoin.module';
import { QueueModule } from './queue/queue.module';
import { ValidatorGateway } from './validator/validator.gateway';
import { RedisService } from './redis/redis.service';
import { ValidatorModule } from './validator/validator.module';

@Module({
  imports: [
    RedisModule,
    forwardRef(() => ConsensusModule),
    SignatureModule,
    StateModule,
    TripCoinModule,
    QueueModule,
    ValidatorModule
  ],
  controllers: [AppController],
  providers: [AppService, ValidatorGateway, RedisService],
})
export class AppModule {}
