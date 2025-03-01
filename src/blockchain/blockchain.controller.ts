import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blocks')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('latest')
  async getLatestBlocks(@Query('limit') limit = 10) {
    return this.blockchainService.getLatestBlocks(limit);
  }

  @Get(':hash')
  async getBlock(@Param('hash') hash: string) {
    return this.blockchainService.getBlock(hash);
  }

  @Get('height')
  async getBlockHeight() {
    return this.blockchainService.getBlockHeight();
  }

  @Get('type/:type')
  async getBlocksByType(@Param('type') type: string) {
    return this.blockchainService.getBlocksByType(type);
  }
}