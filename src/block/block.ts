import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common';
import { BlockType, IBlock, ICriticalProcess, ITransaction } from './dto/block.dto';
import { MemPoolService } from 'src/mempool/mempool.service';
import { TripcoinService } from 'src/tripcoin/tripcoin.service';

@Injectable()
export class Block implements IBlock {
    index: number; // The block's position in the blockchain
    timestamp: string; // Timestamp of when the block was created
    type: BlockType; // Type of block (e.g., transaction or critical process)
    transactions?: ITransaction[]; // Optional list of transactions included in the block
    criticalProcesses?: ICriticalProcess[]; // Optional list of critical processes included in the block
    previousHash: string; // Hash of the previous block in the chain
    hash: string; // Hash of the current block
    nonce: number; // Nonce used in mining to achieve the desired difficulty
    signature: string; // Validator's signature for proof-of-authority
    validator: string; // Address or identifier of the validator who forged the block
    totalFees?: number; // Nueva propiedad para almacenar el total de fees
    tripcoin: TripcoinService;

    /**
     * Constructor initializes a new block with the provided data.
     * @param index - The block's index in the blockchain.
     * @param timestamp - The timestamp of block creation.
     * @param transactions - Optional list of transactions to include in the block.
     * @param criticalProcesses - Optional list of critical processes to include in the block.
     * @param previousHash - The hash of the previous block in the chain.
     * @param signature - The validator's signature for proof-of-authority.
     */
    constructor(
        index: number,
        timestamp: string,
        tripcoin: TripcoinService,
        transactions?: ITransaction[],
        criticalProcesses?: ICriticalProcess[],
        previousHash = '',
        signature: string = '',
    ) {
        this.tripcoin = tripcoin;
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;

        // Hash sensitive data in critical processes before storing them
        this.criticalProcesses = criticalProcesses?.map(process => ({
            ...process,
            hashedData: this.hashSensitiveData(JSON.stringify(process.originalDataStructure)) // Hash sensitive data
        }));

        this.previousHash = previousHash;
        this.nonce = 0; // Initialize nonce for mining
        this.signature = signature;
        this.validator = ''; // Validator is set during block forging
        this.hash = this.calculateHash(); // Calculate the initial hash of the block
        this.type = transactions ? BlockType.TRANSACTION : BlockType.CRITICAL_PROCESS; // Determine block type

        if (transactions) {
            this.totalFees = transactions.reduce((sum, tx) => 
            sum + this.tripcoin.calculateTransactionFee(tx.gasLimit), 0)
        }
    }

    /**
     * Calculates the hash of the block using SHA-256.
     * @returns The hexadecimal hash of the block.
     */
    calculateHash(): string {
        return crypto
            .createHash('sha256')
            .update(
                this.index +
                this.previousHash +
                this.timestamp +
                JSON.stringify(this.transactions || []) + // Usar transacciones si existen
                JSON.stringify((this.criticalProcesses || []).map(p => p.hashData)) + // Usar datos hasheados de procesos críticos si existen
                this.nonce +
                this.signature
            )
            .digest('hex');
    }

    /**
     * Mines the block by incrementing the nonce until the hash meets the required difficulty.
     * @param difficulty - The number of leading zeros required in the hash.
     */
    mineBlock(difficulty: number): void {
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`Block mined: ${this.hash}`);
    }

    /**
     * Forges the block by assigning it to a validator and recalculating the hash.
     * @param validator - The address or identifier of the validator forging the block.
     */
    forgeBlock(validator: string): void {
        this.validator = validator;
        this.hash = this.calculateHash();
        console.log(`Block forged by: ${validator}`);
    }

    /**
     * Hashes sensitive data using SHA-256 to ensure privacy and security.
     * @param data - The sensitive data to hash.
     * @returns The hexadecimal hash of the sensitive data.
     */
    private hashSensitiveData(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}