import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class BlockchainService {
    private readonly logger = new Logger(BlockchainService.name);
    private readonly BLOCKCHAIN_KEY = 'validator:blockchain';
    private fullNodesUri: string[];

    constructor(private readonly redis: RedisService) {
        this.fullNodesUri = process.env.FULL_NODES?.split(',') || [];
    }

    /**
     * Obtiene un bloque específico por su hash desde un nodo completo.
     * @param hash - Hash del bloque a recuperar.
     * @returns El bloque como JSON o null si no se encuentra.
     */
    async getBlock(hash: string): Promise<any> {
        const cachedBlock = await this.redis.hGet(this.BLOCKCHAIN_KEY, hash);
        if (cachedBlock) {
            return JSON.parse(cachedBlock);
        }

        for (const fullNodeUrl of this.fullNodesUri) {
            try {
                const response = await axios.get(`${fullNodeUrl}/blocks/${hash}`);
                const block = response.data;
                await this.redis.hSet(this.BLOCKCHAIN_KEY, hash, JSON.stringify(block)); // Almacena en caché
                return block;
            } catch (error) {
                this.logger.warn(`Error fetching block ${hash} from full node ${fullNodeUrl}: ${error.message}`);
            }
        }
        return null;
    }

    /**
     * Obtiene la altura actual de la blockchain desde un nodo completo.
     * @returns La altura de la blockchain.
     */
    async getBlockHeight(): Promise<number> {
        for (const fullNodeUrl of this.fullNodesUri) {
            try {
                const response = await axios.get(`${fullNodeUrl}/blocks/height`);
                return response.data.height;
            } catch (error) {
                this.logger.warn(`Error fetching block height from full node ${fullNodeUrl}: ${error.message}`);
            }
        }
        return 0;
    }

    /**
     * Obtiene los últimos bloques de la blockchain desde un nodo completo.
     * @param limit - Número máximo de bloques a recuperar (por defecto: 10).
     * @returns Una lista de los últimos bloques.
     */
    async getLatestBlocks(limit = 10): Promise<any[]> {
        for (const fullNodeUrl of this.fullNodesUri) {
            try {
                const response = await axios.get(`${fullNodeUrl}/blocks/latest?limit=${limit}`);
                return response.data.blocks;
            } catch (error) {
                this.logger.warn(`Error fetching latest blocks from full node ${fullNodeUrl}: ${error.message}`);
            }
        }
        return [];
    }

    /**
     * Obtiene todos los bloques de un tipo específico desde un nodo completo.
     * @param type - Tipo de bloque (TRANSACTION o CRITICAL_PROCESS).
     * @returns Una lista de bloques del tipo especificado.
     */
    async getBlocksByType(type: string): Promise<any[]> {
        for (const fullNodeUrl of this.fullNodesUri) {
            try {
                const response = await axios.get(`${fullNodeUrl}/blocks/type/${type}`);
                return response.data.blocks;
            } catch (error) {
                this.logger.warn(`Error fetching blocks by type from full node ${fullNodeUrl}: ${error.message}`);
            }
        }
        return [];
    }
}
