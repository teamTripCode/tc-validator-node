import { Test, TestingModule } from '@nestjs/testing';
import { ConsensusController } from './consensus.controller';
import { ConsensusService } from './consensus.service';

describe('ConsensusController', () => {
  let controller: ConsensusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsensusController],
      providers: [ConsensusService],
    }).compile();

    controller = module.get<ConsensusController>(ConsensusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
