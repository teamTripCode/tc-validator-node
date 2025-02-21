/**
 * Enum representing the type of a block in the blockchain.
 * Blocks can either contain transactions or critical processes.
 */
export enum BlockType {
    TRANSACTION = 'TRANSACTION', // Indicates a block containing transactions
    CRITICAL_PROCESS = 'CRITICAL_PROCESS' // Indicates a block containing critical processes
}

/**
 * Interface defining the structure of a block in the blockchain.
 */
export interface IBlock {
    index: number; // The block's position in the blockchain
    timestamp: string; // Timestamp of when the block was created
    type: BlockType; // Type of block (transaction or critical process)
    transactions?: ITransaction[]; // Optional list of transactions included in the block
    criticalProcesses?: ICriticalProcess[]; // Optional list of critical processes included in the block
    previousHash: string; // Hash of the previous block in the chain
    hash: string; // Hash of the current block
    nonce: number; // Nonce used in mining to achieve the desired difficulty
    signature: string; // Validator's signature for proof-of-authority
    validator: string; // Address or identifier of the validator who forged the block

    /**
     * Method to calculate the hash of the block.
     * @returns The hexadecimal hash of the block.
     */
    calculateHash(): string;

    /**
     * Method to mine the block by finding a hash that meets the required difficulty.
     * @param difficulty - The number of leading zeros required in the hash.
     */
    mineBlock(difficulty: number): void;

    /**
     * Method to forge the block by assigning it to a validator.
     * @param validator - The address or identifier of the validator forging the block.
     */
    forgeBlock(validator: string): void;
}

/**
 * Interface defining the structure of transaction data within a block.
 */
export interface BlockDataTransaction {
    from: string; // Sender's address
    to: string; // Receiver's address
    amount: number; // Amount being transferred
    currency?: string; // Optional currency type (e.g., BTC, ETH)
    description?: string; // Optional description of the transaction
}

/**
 * Interface defining the structure of a transaction included in a block.
 */
export interface ITransaction {
    processId: string; // Unique identifier for the transaction
    description: string; // Description of the transaction
    data: BlockDataTransaction; // Detailed transaction data
    timestamp: string; // Timestamp of when the transaction was created
    signature: string; // Signature of the transaction for validation
}

/**
 * Interface defining the structure of a critical process included in a block.
 */
export interface ICriticalProcess {
    processId: string; // Unique identifier for the critical process
    hashData: string; // Hashed version of sensitive data for privacy
    originalDataStructure: NestedObject; // Original sensitive data structure before hashing
    description: string; // Description of the critical process
    timestamp: string; // Timestamp of when the critical process was created
    signature: string; // Signature of the critical process for validation
}

/**
 * Interface defining the structure of a nested object, which can represent complex data structures.
 */
export interface NestedObject {
    [key: string]: string | number | boolean | null | NestedObject | NestedObject[]; // Recursive structure for nested objects
}