import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { TripcoinService } from "src/tripcoin/tripcoin.service";

/**
 * MemPoolService manages the memory pool (mempool) of pending transactions.
 * It ensures that transactions are validated, stored temporarily, and cleaned up periodically.
 */
@Injectable()
export class MemPoolService {
    private readonly logger = new Logger(MemPoolService.name);

    // Maximum number of transactions allowed in the mempool
    private readonly MAX_MEMPOOL_SIZE = 5000; // Transactions

    // Maximum age of a transaction in the mempool (72 hours in seconds)
    private readonly MAX_TX_AGE = 72 * 60 * 60;

    // Map to store transactions in the mempool (key: transaction hash, value: transaction data)
    private mempool: Map<string, any> = new Map();

    // Map to track the timestamp of when each transaction was added to the mempool
    private txTimes: Map<string, number> = new Map();

    constructor(private readonly tripcoin: TripcoinService) {}

    /**
     * Adds a transaction to the mempool after validating it.
     * If the mempool is full, removes low-fee transactions to make space.
     * @param tx - The transaction to add.
     * @returns True if the transaction was successfully added, false otherwise.
     */
    async addTransaction(tx: any): Promise<boolean> {
        // Remove low-fee transactions if the mempool is full
        if (this.mempool.size >= this.MAX_MEMPOOL_SIZE) {
            this.removeLowestFeeTransactions();
        }

        // Validate the transaction before adding it
        if (await this.validateTransaction(tx)) {
            this.mempool.set(tx.hash, tx); // Add transaction to mempool
            this.txTimes.set(tx.hash, Date.now()); // Track the timestamp of the transaction
            return true;
        }
        return false;
    }

    /**
     * Validates a transaction before adding it to the mempool.
     * @param tx - The transaction to validate.
     * @returns True if the transaction is valid, false otherwise.
     */
    private async validateTransaction(tx: any): Promise<boolean> {
        // Basic structural validation
        if (!tx.hash || !tx.from || !tx.to || !tx.amount) {
            return false;
        }

        // Ensure the transaction does not already exist in the mempool
        if (this.mempool.has(tx.hash)) {
            return false;
        }

        const fee = this.tripcoin.calculateTransactionFee(tx.gasLimit);
        const valid = await this.tripcoin.validateTransaction(tx.from, tx.amount, fee);

        return valid;
    }

    /**
     * Retrieves the best transactions for inclusion in the next block.
     * Transactions are sorted by fee-per-byte and limited by the specified maximum size.
     * @param maxSize - The maximum number of transactions to include in the block.
     * @returns An array of the best transactions for the block.
     */
    getTransactionsForBlock(maxSize: number): any[] {
        const txs = Array.from(this.mempool.values());
        // Sort transactions by fee-per-byte in descending order
        txs.sort((a, b) => (b.fee / b.size) - (a.fee / a.size));
        // Return the top transactions up to the maxSize limit
        return txs.slice(0, maxSize);
    }

    /**
     * Periodically cleans up old transactions from the mempool.
     * This method runs every minute and removes transactions older than MAX_TX_AGE.
     */
    @Interval(60000) // Runs every minute
    private cleanupOldTransactions() {
        const now = Date.now();
        for (const [hash, time] of this.txTimes.entries()) {
            // Remove transactions older than MAX_TX_AGE
            if ((now - time) / 1000 > this.MAX_TX_AGE) {
                this.mempool.delete(hash);
                this.txTimes.delete(hash);
            }
        }
    }

    /**
     * Removes the lowest-fee transactions from the mempool to free up space.
     * This method removes the bottom 10% of transactions based on fee-per-byte.
     */
    private removeLowestFeeTransactions() {
        const txs = Array.from(this.mempool.entries());
        // Sort transactions by fee-per-byte in ascending order
        txs.sort((a, b) => (a[1].fee / a[1].size) - (b[1].fee / b[1].size));

        // Calculate the number of transactions to remove (10% of the mempool size)
        const toRemove = Math.ceil(this.mempool.size * 0.1);

        // Remove the lowest-fee transactions
        for (let i = 0; i < toRemove; i++) {
            if (txs[i]) {
                this.mempool.delete(txs[i][0]); // Remove transaction from mempool
                this.txTimes.delete(txs[i][0]); // Remove timestamp tracking
            }
        }
    }
}