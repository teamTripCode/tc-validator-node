import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { BlockService } from 'src/block/block.service';
import { Block } from 'src/block/block';
import { BlockType } from 'src/block/dto/block.dto';

@Injectable()
export class BlockchainService {
    private readonly logger = new Logger(BlockchainService.name);
    private readonly BLOCKCHAIN_KEY = 'fullnode:blockchain';

    constructor(
        private readonly redis: RedisService,
        private readonly blockService: BlockService
    ) { }

    /**
     * Agrega un nuevo bloque a la cadena de bloques.
     * @param block - El bloque a agregar.
     */
    async addBlock(block: Block): Promise<void> {
        const exists = await this.redis.hExists(this.BLOCKCHAIN_KEY, block.hash);
        if (!exists) {
            // Usa BlockService para validar y guardar el bloque
            await this.blockService.saveBlock(block);

            // Log dependiendo del tipo de bloque
            if (block.type === BlockType.TRANSACTION) {
                this.logger.log(`Transaction block ${block.hash} added to storage`);
            } else if (block.type === BlockType.CRITICAL_PROCESS) {
                this.logger.log(`Critical process block ${block.hash} added to storage`);
            }
        }
    }

    /**
     * Obtiene un bloque por su hash.
     * @param hash - El hash del bloque.
     * @returns El bloque como una cadena JSON (puede ser undefined si no existe).
     */
    async getBlock(hash: string): Promise<string | null | undefined> {
        return this.redis.hGet(this.BLOCKCHAIN_KEY, hash);
    }

    /**
     * Obtiene la altura actual de la cadena de bloques.
     * @returns La altura de la cadena (número de bloques).
     */
    async getBlockHeight(): Promise<number> {
        const blocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.keys(blocks).length;
    }

    /**
     * Obtiene los últimos bloques de la cadena.
     * @param limit - Número máximo de bloques a devolver (por defecto: 10).
     * @returns Una lista de bloques ordenados por altura descendente.
     */
    async getLatestBlocks(limit = 10): Promise<Block[]> {
        const allBlocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.values(allBlocks)
            .map((block) => JSON.parse(block) as Block)
            .sort((a, b) => b.index - a.index) // Ordena por índice (altura)
            .slice(0, limit);
    }

    /**
     * Obtiene todos los bloques de un tipo específico.
     * @param type - El tipo de bloque (TRANSACTION o CRITICAL_PROCESS).
     * @returns Una lista de bloques del tipo especificado.
     */
    async getBlocksByType(type: BlockType): Promise<Block[]> {
        const allBlocks = await this.redis.hGetAll(this.BLOCKCHAIN_KEY);
        return Object.values(allBlocks)
            .map((block) => JSON.parse(block) as Block)
            .filter((block) => block.type === type)
            .sort((a, b) => b.index - a.index); // Ordena por índice (altura)
    }
}