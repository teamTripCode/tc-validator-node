import { Module } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { SignatureController } from './signature.controller';

@Module({
  controllers: [SignatureController],
  providers: [SignatureService],
  exports: [SignatureService]
})
export class SignatureModule {}
