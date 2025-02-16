import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { CreateConsensusDto } from './dto/create-consensus.dto';
import { UpdateConsensusDto } from './dto/update-consensus.dto';

@Controller('consensus')
export class ConsensusController {
  constructor(private readonly consensusService: ConsensusService) {}

  @Post()
  create(@Body() createConsensusDto: CreateConsensusDto) {
    return this.consensusService.create(createConsensusDto);
  }

  @Get()
  findAll() {
    return this.consensusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consensusService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConsensusDto: UpdateConsensusDto) {
    return this.consensusService.update(+id, updateConsensusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.consensusService.remove(+id);
  }
}
