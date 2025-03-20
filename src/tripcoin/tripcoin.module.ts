import { Module } from '@nestjs/common';
import { TripcoinService } from './tripcoin.service';
import { RedisModule } from 'src/redis/redis.module';
import { StateModule } from 'src/state/state.module';
import { ValidatorGateway } from 'src/validator/validator.gateway';

@Module({
    imports: [RedisModule, StateModule, ValidatorGateway],
    providers: [TripcoinService],
    exports: [TripcoinService]
})
export class TripCoinModule { }
