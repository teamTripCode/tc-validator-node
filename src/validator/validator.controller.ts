import { Controller, Get } from '@nestjs/common';
import { ValidatorService } from './validator.service';

@Controller('validators')
export class ValidatorController {
  constructor(private readonly validator: ValidatorService) {}

  @Get()
  async getAllValidators() {
    return this.validator.getValidatorsFromBlockchain();
  }

  @Get('me')
  async getMyValidatorInfo() {
    return this.validator.myValidatorInfo;
  }

  @Get('peers')
  async getConnectedPeers() {
    return this.validator.getConnectedPeers();
  }
}