import { forwardRef, Module } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';
import { BlockModule } from 'src/block/block.module';
import { SignatureModule } from 'src/signature/signature.module';
import { TripCoinModule } from 'src/tripcoin/tripcoin.module';
import { QueueModule } from 'src/queue/queue.module';
import { ValidatorModule } from 'src/validator/validator.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    SignatureModule,
    BlockModule,
    TripCoinModule,
    forwardRef(() => QueueModule),
    forwardRef(() => ValidatorModule),
    EventEmitterModule.forRoot(),
  ],
  controllers: [ConsensusController],
  providers: [ConsensusService],
  exports: [ConsensusService],
})
export class ConsensusModule {}
