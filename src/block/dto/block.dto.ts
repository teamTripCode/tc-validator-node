export enum BlockType {
    TRANSACTION = 'TRANSACTION',
    CRITICAL_PROCESS = 'CRITICAL_PROCESS'
}

export interface IBlock {
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
    calculateHash(): string;
    mineBlock(difficulty: number): void;
    forgeBlock(validator: string): void;
}

export interface BlockDataTransaction {
    from: string;
    to: string;
    amount: number;
    currency?: string;
    description?: string;
}

export interface ITransaction {
    processId: string;
    description: string;
    data: BlockDataTransaction;
    timestamp: string;
    signature: string;
}

export interface ICriticalProcess {
    processId: string;
    hashData: string; // Datos sensibles hasheados
    originalDataStructure: NestedObject;
    description: string;
    timestamp: string;
    signature: string;
}

export interface NestedObject {
    [key: string]: string | number | boolean | null | NestedObject | NestedObject[];
}