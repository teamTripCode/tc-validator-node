import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorGateway } from './validator.gateway';

describe('ValidatorGateway', () => {
  let gateway: ValidatorGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidatorGateway],
    }).compile();

    gateway = module.get<ValidatorGateway>(ValidatorGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
