import { Controller } from '@nestjs/common';
import { ConsensusService } from './consensus.service';

@Controller('consensus')
export class ConsensusController {
  constructor(private readonly consensusService: ConsensusService) {}
}
