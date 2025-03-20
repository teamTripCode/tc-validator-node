import { Module } from '@nestjs/common';
import { StateService } from './state.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
    imports: [RedisModule],
    providers: [StateService],
    exports: [StateService]
})
export class StateModule { }
