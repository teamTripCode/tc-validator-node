import { PartialType } from '@nestjs/mapped-types';
import { CreateConsensusDto } from './create-consensus.dto';

export class UpdateConsensusDto extends PartialType(CreateConsensusDto) {}
