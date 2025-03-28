import { forwardRef, Module } from '@nestjs/common';
import { TripcoinService } from './tripcoin.service';
import { RedisModule } from 'src/redis/redis.module';
import { StateModule } from 'src/state/state.module';
import { ValidatorGateway } from 'src/validator/validator.gateway';
import { QueueModule } from 'src/queue/queue.module';
import { ValidatorModule } from 'src/validator/validator.module';

@Module({
    imports: [
        RedisModule,
        StateModule,
        QueueModule,
        forwardRef(() => ValidatorModule)
    ],
    providers: [TripcoinService],
    exports: [TripcoinService]
})
export class TripCoinModule { }
