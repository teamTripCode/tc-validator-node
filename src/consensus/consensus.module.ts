import { forwardRef, Module } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';
import { BlockModule } from 'src/block/block.module';
import { SignatureModule } from 'src/signature/signature.module';
import { TripCoinModule } from 'src/tripcoin/tripcoin.module';
import { QueueModule } from 'src/queue/queue.module';
import { ValidatorModule } from 'src/validator/validator.module';

@Module({
  imports: [
    SignatureModule,
    BlockModule,
    TripCoinModule,
    forwardRef(() => QueueModule),
    forwardRef(() => ValidatorModule), // ← Usa forwardRef aquí
  ],
  controllers: [ConsensusController],
  providers: [ConsensusService],
})
export class ConsensusModule {}
