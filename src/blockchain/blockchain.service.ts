import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { BlockService } from 'src/block/block.service';
import { Block } from 'src/block/block';
import { BlockType } from 'src/block/dto/block.dto';

/**
 * BlockchainService is responsible for managing the blockchain's storage, retrieval, and querying operations.
 * It interacts with Redis for persistent storage and leverages BlockService for block validation and saving.
 */
@Injectable()
export class BlockchainService {
    private readonly logger = new Logger(BlockchainService.name);
    private readonly BLOCKCHAIN_KEY = 'fullnode:blockchain'; // Redis key for storing the entire blockchain

    constructor(
        private readonly redis: RedisService,
        private readonly blockService: BlockService
    ) { }

    /**
     * Adds a new block to the blockchain if it does not already exist.
     * Uses BlockService to validate and save the block.
     * Logs the addition based on the block type.
     * @param block - The block to be added.
     */
    async addBlock(block: Block): Promise<void> {
        const exists = await this.redis.hExists(this.BLOCKCHAIN_KEY, block.hash);
        if (!exists) {
            await this.blockService.saveBlock(block); // Save the validated block

            // Log based on block type
            if (block.type === BlockType.TRANSACTION) {
                this.logger.log(`Transaction block ${block.hash} added to storage`);
            } else if (block.type === BlockType.CRITICAL_PROCESS) {
                this.logger.log(`Critical process block ${block.hash} added to storage`);
            }
        }
    }

    /**
     * Retrieves a block by its hash.
     * @param hash - The hash of the block to retrieve.
     * @returns The block as a JSON string or null/undefined if not found.
     */
    async getBlock(hash: string): Promise<string | null | undefined> {
        return this.redis.hGet(this.BLOCKCHAIN_KEY, hash); // Return block from Redis
    }

    /**
     * Gets the current height of the blockchain.
     * The height represents the total number of blocks.
     * @returns The blockchain height (number of blocks).
     */
    async getBlockHeight(): Promise<number> {
        const blocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.keys(blocks).length; // Count total blocks
    }

    /**
     * Retrieves the latest blocks in the blockchain.
     * Blocks are ordered by index in descending order.
     * @param limit - The maximum number of blocks to return (default: 10).
     * @returns A list of the latest blocks.
     */
    async getLatestBlocks(limit = 10): Promise<Block[]> {
        const allBlocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.values(allBlocks)
            .map((block) => JSON.parse(block) as Block) // Parse JSON to Block objects
            .sort((a, b) => b.index - a.index) // Sort by index (height) descending
            .slice(0, limit); // Return limited number of latest blocks
    }

    /**
     * Retrieves all blocks of a specific type (TRANSACTION or CRITICAL_PROCESS).
     * The returned list is sorted by index in descending order.
     * @param type - The type of block to retrieve.
     * @returns A list of blocks matching the specified type.
     */
    async getBlocksByType(type: BlockType): Promise<Block[]> {
        const allBlocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.values(allBlocks)
            .map((block) => JSON.parse(block) as Block)
            .filter((block) => block.type === type) // Filter by specified block type
            .sort((a, b) => b.index - a.index); // Sort by index descending
    }
}
