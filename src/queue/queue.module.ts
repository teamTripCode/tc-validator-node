import { forwardRef, Module } from '@nestjs/common';
import { RedisModule } from 'src/redis/redis.module';
import { QueueService } from './queue.service';
import { ConsensusModule } from 'src/consensus/consensus.module';

@Module({
    imports: [
        RedisModule,
        forwardRef(() => ConsensusModule)],
    providers: [QueueService],
    exports: [QueueService]
})
export class QueueModule { }
