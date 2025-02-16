import { Module } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';

@Module({
  controllers: [ConsensusController],
  providers: [ConsensusService],
})
export class ConsensusModule {}
