// src/validator/validator.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ValidatorGateway } from './validator.gateway';
import { ValidatorService } from './validator.service';
import { ValidatorController } from './validator.controller';
import { RedisModule } from '../redis/redis.module'; // Si usa Redis
import { ConsensusModule } from 'src/consensus/consensus.module';
import { SignatureModule } from 'src/signature/signature.module';
import { QueueModule } from 'src/queue/queue.module';
import { TripCoinModule } from 'src/tripcoin/tripcoin.module';
import { BlockModule } from 'src/block/block.module';

@Module({
  imports: [
    RedisModule,
    forwardRef(() => ConsensusModule),
    SignatureModule,
    QueueModule,
    forwardRef(() => TripCoinModule),
    BlockModule,
  ],
  providers: [ValidatorGateway, ValidatorService],
  controllers: [ValidatorController],
  exports: [ValidatorGateway, ValidatorService],
})
export class ValidatorModule {}