import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Block } from './block';

@Injectable()
export class BlockService {
    private readonly logger = new Logger(BlockService.name);
    private mempool: Map<string, Block>;
    private blockHeight: number;

    private readonly BLOCKS_KEY = 'blockchain:blocks';
    private readonly HEIGHT_KEY = 'blockchain:height';
    private readonly TX_INDEX_KEY = 'blockchain:tx-index';
    private readonly SNAPSHOT_KEY = 'blockchain:snapshots';

    constructor(private readonly redis: RedisService) {
        this.mempool = new Map();
        this.blockHeight = 0;
        this.initializeStorage();
    }

    private async initializeStorage() {
        try {
            // Recuperar altura actual de la blockchain
            const height = await this.redis.get(this.HEIGHT_KEY);
            this.blockHeight = height ? parseInt(height) : 0;
        } catch (error) {
            this.logger.error('Error initializing blockchain storage:', error);
            throw error;
        }
    }

    async createAndSaveGenesisBlock(): Promise<Block> {
        const genesisBlock = new Block(
            0,
            new Date().toISOString(),
            [], // Transacciones vacías
            [], // Procesos críticos vacíos
            '0',
            ''
        );
        genesisBlock.hash = genesisBlock.calculateHash();
        genesisBlock.validator = 'system';

        // Guardar bloque génesis
        await this.saveBlock(genesisBlock);
        return genesisBlock;
    }

    async saveBlock(block: Block): Promise<void> {
        try {
            // 1. Validar el bloque
            if (!await this.isValidBlock(block)) {
                throw new Error('Invalid block');
            }

            // 2. Serializar y guardar el bloque
            await this.redis.hSet(
                this.BLOCKS_KEY,
                block.hash,
                JSON.stringify(block)
            );

            // 3. Actualizar índices
            await this.redis.set(`${this.HEIGHT_KEY}:${block.index}`, block.hash);
            await this.redis.set(this.HEIGHT_KEY, block.index.toString());

            // 4. Indexar transacciones (si existen)
            if (block.transactions) {
                for (const tx of block.transactions) {
                    await this.redis.hSet(
                        this.TX_INDEX_KEY,
                        tx.processId,
                        block.hash
                    );
                }

                // 5. Remover transacciones del mempool
                block.transactions.forEach(tx => {
                    this.mempool.delete(tx.processId);
                });
            }

            // 6. Indexar procesos críticos (si existen)
            if (block.criticalProcesses) {
                for (const process of block.criticalProcesses) {
                    await this.redis.hSet(
                        this.TX_INDEX_KEY,
                        process.processId,
                        block.hash
                    );
                }
            }

            // 7. Actualizar altura de la blockchain
            this.blockHeight = Math.max(this.blockHeight, block.index);

            // 8. Crear snapshot periódico (cada 1000 bloques)
            if (block.index % 1000 === 0) {
                await this.createSnapshot(block.index);
            }

            this.logger.log(`Block saved successfully: ${block.hash}`);
        } catch (error) {
            this.logger.error('Error saving block:', error);
            throw error;
        }
    }

    private async createSnapshot(height: number) {
        const snapshot = {
            height,
            timestamp: new Date().toISOString(),
            chainState: await this.getChainState()
        };

        await this.redis.hSet(
            this.SNAPSHOT_KEY,
            height.toString(),
            JSON.stringify(snapshot)
        );
    }

    async initializeChain(): Promise<Block[]> {
        try {
            // 1. Verificar si existe cadena
            const blockCount = await this.getBlockHeight();

            if (blockCount === 0) {
                const genesisBlock = await this.createAndSaveGenesisBlock();
                return [genesisBlock];
            }

            // 2. Recuperar últimos 100 bloques para memoria caché
            const blocks: Block[] = [];
            const startHeight = Math.max(0, this.blockHeight - 100);

            for (let i = startHeight; i <= this.blockHeight; i++) {
                const blockHash = await this.redis.get(`${this.HEIGHT_KEY}:${i}`);
                if (blockHash) {
                    const block = await this.getBlock(blockHash);
                    if (block) {
                        blocks.push(block);
                    }
                }
            }

            return blocks;

        } catch (error) {
            this.logger.error('Error initializing chain:', error);
            throw error;
        }
    }

    async getBlock(hash: string): Promise<Block | undefined> {
        try {
            // 1. Buscar en caché de memoria
            const cachedBlock = this.mempool.get(hash);
            if (cachedBlock) {
                return cachedBlock;
            }

            // 2. Obtener bloque de Redis
            const blockData = await this.redis.hGet(this.BLOCKS_KEY, hash);
            if (!blockData) return undefined;

            // 3. Deserializar y reconstruir instancia de Block
            const block = JSON.parse(blockData);
            const blockInstance = new Block(
                block.index,
                block.timestamp,
                block.transactions || [], // Usar un array vacío si transactions es undefined
                block.criticalProcesses || [], // Usar un array vacío si criticalProcesses es undefined
                block.previousHash,
                block.signature
            );
            blockInstance.hash = block.hash;
            blockInstance.nonce = block.nonce;
            blockInstance.validator = block.validator;

            return blockInstance;
        } catch (error) {
            this.logger.error('Error getting block:', error);
            throw error;
        }
    }

    async getBlockByHeight(height: number): Promise<Block | undefined> {
        try {
            const blockHash = await this.redis.get(`${this.HEIGHT_KEY}:${height}`);
            return blockHash ? this.getBlock(blockHash) : undefined;
        } catch (error) {
            this.logger.error('Error getting block by height:', error);
            throw error;
        }
    }

    async getBlockHeight(): Promise<number> {
        const height = await this.redis.get(this.HEIGHT_KEY);
        return height ? parseInt(height) : 0;
    }

    private async getChainState(): Promise<any> {
        // Implementar lógica para obtener el estado actual de la cadena
        // (balances, contratos activos, etc.)
        return {};
    }

    private async isValidBlock(block: Block): Promise<boolean> {
        // 1. Verificar hash del bloque
        const calculatedHash = block.calculateHash();
        if (block.hash !== calculatedHash) {
            return false;
        }

        // 2. Verificar índice y hash previo
        if (block.index > 0) {
            const previousBlock = await this.getBlockByHeight(block.index - 1);
            if (!previousBlock || block.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        // 3. Verificar firma del validador
        // Implementar verificación de firma aquí

        return true;
    }

    async addToMempool(transaction: any): Promise<void> {
        // Añadir transacción al mempool para inclusión en próximo bloque
        this.mempool.set(transaction.processId, transaction);
    }

    async getTransactionBlock(txId: string): Promise<Block | undefined> {
        try {
            const blockHash = await this.redis.hGet(this.TX_INDEX_KEY, txId);
            return blockHash ? this.getBlock(blockHash) : undefined;
        } catch (error) {
            this.logger.error('Error getting transaction block:', error);
            throw error;
        }
    }
}