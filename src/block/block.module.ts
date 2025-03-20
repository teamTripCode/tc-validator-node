import { Module } from "@nestjs/common";
import { BlockService } from "./block.service";
import { RedisModule } from "src/redis/redis.module";

@Module({
    imports: [RedisModule],
    providers: [BlockService],
    exports: [BlockService]
})
export class BlockModule { }