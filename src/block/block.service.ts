import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Block } from './block';
import { TripcoinService } from 'src/tripcoin/tripcoin.service';
/**
 * BlockService is responsible for managing blockchain operations including block creation, validation, storage, and retrieval.
 * It interacts with Redis for persistent storage and maintains an in-memory mempool for pending transactions.
 */
@Injectable()
export class BlockService {
    private readonly logger = new Logger(BlockService.name);
    private mempool: Map<string, Block>; // In-memory storage for pending transactions
    private blockHeight: number; // Tracks the current height of the blockchain
    private readonly BLOCKS_KEY = 'blockchain:blocks'; // Redis key for storing blocks
    private readonly HEIGHT_KEY = 'blockchain:height'; // Redis key for storing blockchain height
    private readonly TX_INDEX_KEY = 'blockchain:tx-index'; // Redis key for indexing transactions
    private readonly SNAPSHOT_KEY = 'blockchain:snapshots'; // Redis key for storing periodic snapshot

    constructor(
        private readonly redis: RedisService, // Dependency injection for Redis service
        private readonly tripcoin: TripcoinService
    ) {
        this.mempool = new Map(); // Initialize mempool
        this.blockHeight = 0; // Start with a height of 0
        this.initializeStorage(); // Initialize storage on service startup
    }

    /**
     * Initializes blockchain storage by retrieving the current height from Redis.
     */
    private async initializeStorage() {
        try {
            const height = await this.redis.get(this.HEIGHT_KEY); // Get current blockchain height
            this.blockHeight = height ? parseInt(height) : 0; // Set height or default to 0
        } catch (error) {
            this.logger.error('Error initializing blockchain storage:', error);
            throw error;
        }
    }

    /**
     * Creates and saves the genesis block if the blockchain is empty.
     */
    async createAndSaveGenesisBlock(): Promise<Block> {
        const genesisBlock = new Block(
            0,
            new Date().toISOString(),
            this.tripcoin,
            [], // No transactions in genesis block
            [], // No critical processes in genesis block
            '0', // Previous hash is '0' for genesis block
            ''
        );
        genesisBlock.hash = genesisBlock.calculateHash(); // Calculate hash for the block
        genesisBlock.validator = 'system'; // Genesis block is validated by the system
        await this.saveBlock(genesisBlock); // Save the genesis block
        return genesisBlock;
    }

    /**
     * Saves a block to Redis after validating it and updating necessary indices.
     */
    async saveBlock(block: Block): Promise<void> {
        try {
            if (!await this.isValidBlock(block)) {
                throw new Error('Invalid block');
            }

            // Serialize and store the block in Redis
            await this.redis.hSet(
                this.BLOCKS_KEY,
                block.hash,
                JSON.stringify(block)
            );

            // Update height-related indices
            await this.redis.set(`${this.HEIGHT_KEY}:${block.index}`, block.hash);
            await this.redis.set(this.HEIGHT_KEY, block.index.toString());

            // Index transactions if they exist
            if (block.transactions) {
                for (const tx of block.transactions) {
                    await this.redis.hSet(
                        this.TX_INDEX_KEY,
                        tx.processId,
                        block.hash
                    );
                }

                // Remove transactions of mempool
                block.transactions.forEach(tx => {
                    this.mempool.delete(tx.processId);
                });
            }

            // Index critical processes if they exist
            if (block.criticalProcesses) {
                for (const process of block.criticalProcesses) {
                    await this.redis.hSet(
                        this.TX_INDEX_KEY,
                        process.processId,
                        block.hash
                    );
                }
            }

            // Update blockchain height
            this.blockHeight = Math.max(this.blockHeight, block.index);

            // Create a snapshot every 1000 blocks
            if (block.index % 1000 === 0) {
                await this.createSnapshot(block.index);
            }

            this.logger.log(`Block saved successfully: ${block.hash}`);
        } catch (error) {
            this.logger.error('Error saving block:', error);
            throw error;
        }
    }

    /**
     * Creates a snapshot of the blockchain state at a given height.
     */
    private async createSnapshot(height: number) {
        const snapshot = {
            height,
            timestamp: new Date().toISOString(),
            chainState: await this.getChainState() // Capture current chain state
        };

        await this.redis.hSet(
            this.SNAPSHOT_KEY,
            height.toString(),
            JSON.stringify(snapshot)
        );
    }

    /**
     * Initializes the blockchain by either creating a genesis block or loading recent blocks into memory.
     */
    async initializeChain(): Promise<Block[]> {
        try {
            // Check if blockchain exists
            const blockCount = await this.getBlockHeight();

            if (blockCount === 0) {
                const genesisBlock = await this.createAndSaveGenesisBlock();
                return [genesisBlock];
            }

            // Load last 100 blocks into memory for caching
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

    /**
     * Retrieves a block by its hash from Redis or mempool.
     */
    async getBlock(hash: string): Promise<Block | undefined> {
        try {
            const cachedBlock = this.mempool.get(hash); // Check mempool first
            if (cachedBlock) {
                return cachedBlock;
            }

            const blockData = await this.redis.hGet(this.BLOCKS_KEY, hash); // Fetch from Redis
            if (!blockData) return undefined;

            // Deserialize and reconstruct Block instance
            const block = JSON.parse(blockData);
            const blockInstance = new Block(
                block.index,
                block.timestamp,
                block.transactions || [],
                block.criticalProcesses || [],
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

    /**
     * Retrieves a block by its height.
     */
    async getBlockByHeight(height: number): Promise<Block | undefined> {
        try {
            const blockHash = await this.redis.get(`${this.HEIGHT_KEY}:${height}`);
            return blockHash ? this.getBlock(blockHash) : undefined;
        } catch (error) {
            this.logger.error('Error getting block by height:', error);
            throw error;
        }
    }

    /**
     * Returns the current height of the blockchain.
     */
    async getBlockHeight(): Promise<number> {
        const height = await this.redis.get(this.HEIGHT_KEY);
        return height ? parseInt(height) : 0;
    }

    /**
     * Returns the current state of the blockchain.
     */
    private async getChainState(): Promise<any> {
        // Implementar lógica para obtener el estado actual de la cadena
        // (balances, contratos activos, etc.)
        return {};
    }

    /**
     * Validates a block by checking its hash, previous hash, and validator signature.
     */
    private async isValidBlock(block: Block): Promise<boolean> {
        // 1. Verificar hash del bloque
        const calculatedHash = block.calculateHash();
        if (block.hash !== calculatedHash) return false; // Hash mismatch

        const previousBlock = await this.getBlockByHeight(block.index - 1);
        if (previousBlock && block.previousHash !== previousBlock.hash) return false; // Invalid previous hash

        // TODO: Implement validator signature verification
        return true;
    }

    /**
     * Adds a transaction to the mempool for inclusion in the next block.
     */
    async addToMempool(transaction: any): Promise<void> {
        // Añadir transacción al mempool para inclusión en próximo bloque
        this.mempool.set(transaction.processId, transaction);
    }

    /**
     * Retrieves all transactions currently in the mempool.
     */
    async getMempoolTransactions(): Promise<any[]> {
        // Devuelve todas las transacciones en el mempool
        return Array.from(this.mempool.values());
    }

    /**
     * Retrieves the block containing a specific transaction by its ID.
     */
    async getTransactionBlock(txId: string): Promise<Block | undefined> {
        try {
            const blockHash = await this.redis.hGet(this.TX_INDEX_KEY, txId);
            return blockHash ? this.getBlock(blockHash) : undefined;
        } catch (error) {
            this.logger.error('Error getting transaction block:', error);
            throw error;
        }
    }


    async createBlock(transactions: any[]): Promise<Block> {
 
        // Obtener la altura actual del blockchain
        const height = await this.getBlockHeight();
        const previousBlock = await this.getBlockByHeight(height);

        // Crear un nuevo bloque con los argumentos en el orden correcto
        const newBlock = new Block(
            height + 1, // Índice del bloque
            new Date().toISOString(), // Timestamp
            this.tripcoin, // Servicio Tripcoin (tercer argumento)
            transactions, // Transacciones (cuarto argumento)
            [], // Procesos críticos (quinto argumento)
            previousBlock?.hash || '0' // Hash del bloque anterior
        );

        return newBlock;
    }
}