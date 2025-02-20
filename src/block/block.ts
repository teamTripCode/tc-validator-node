import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common';
import { BlockType, IBlock, ICriticalProcess, ITransaction } from './dto/block.dto';
import { MemPoolService } from 'src/mempool/mempool.service';

@Injectable()
export class Block implements IBlock {
    index: number;
    timestamp: string;
    type: BlockType;
    transactions?: ITransaction[];
    criticalProcesses?: ICriticalProcess[];
    previousHash: string;
    hash: string;
    nonce: number;
    signature: string;
    validator: string;

    constructor(
        index: number,
        timestamp: string,
        transactions?: ITransaction[],
        criticalProcesses?: ICriticalProcess[],
        previousHash = '',
        signature: string = ''
    ) {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.criticalProcesses = criticalProcesses?.map(process => ({
            ...process,
            hashedData: this.hashSensitiveData(JSON.stringify(process.originalDataStructure)) // Hashear datos sensibles
        }));
        this.previousHash = previousHash;
        this.nonce = 0;
        this.signature = signature;
        this.validator = '';
        this.hash = this.calculateHash();
        this.type = transactions ? BlockType.TRANSACTION : BlockType.CRITICAL_PROCESS;
    }

    /**
     * Calcula el hash del bloque usando SHA-256.
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

    mineBlock(difficulty: number): void {
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`Block mined: ${this.hash}`);
    }

    forgeBlock(validator: string): void {
        this.validator = validator;
        this.hash = this.calculateHash();
        console.log(`Block forged by: ${validator}`);
    }

    /**
     * Hashea datos sensibles.
     */
    private hashSensitiveData(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}