import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ValidatorGateway } from './validator/validator.gateway';
import { RedisModule } from './redis/redis.module';
import { ConsensusModule } from './consensus/consensus.module';
import { SignatureModule } from './signature/signature.module';

@Module({
  imports: [RedisModule, ConsensusModule, SignatureModule],
  controllers: [AppController],
  providers: [AppService, ValidatorGateway],
})
export class AppModule {}
