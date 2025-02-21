import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * StateService manages the current state of the blockchain,
 * handling balance updates, nonces, and contract states.
 */
@Injectable()
export class StateService {
    private readonly logger = new Logger(StateService.name); // Logger for StateService
    private readonly STATE_KEY = 'blockchain:state'; // Redis key for blockchain state

    /**
     * Constructor injects the RedisService dependency.
     * @param redis - Instance of RedisService for state storage.
     */
    constructor(private readonly redis: RedisService) { }

    /**
     * Updates the blockchain state based on the given block's transactions.
     * @param block - The block containing transactions to apply.
     */
    async updateState(block: any): Promise<void> {
        const state = await this.getCurrentState();

        // Apply each transaction to the current state
        for (const tx of block.transactions || []) {
            await this.applyTransaction(state, tx);
        }

        // Save the updated state back to Redis
        await this.saveState(state);
    }

    /**
     * Retrieves the current state from Redis or returns the initial state if none exists.
     * @returns The current blockchain state object.
     */
    private async getCurrentState(): Promise<any> {
        const state = await this.redis.get(this.STATE_KEY);
        return state ? JSON.parse(state) : this.getInitialState();
    }

    /**
     * Provides the initial structure of the blockchain state.
     * @returns An object representing the initial state.
     */
    private getInitialState(): any {
        return {
            balances: {},
            nonces: {},
            contracts: {},
        };
    }

    /**
     * Applies a single transaction to the given state, updating balances and nonces.
     * @param state - The current state to update.
     * @param tx - The transaction to apply.
     */
    private async applyTransaction(state: any, tx: any): Promise<void> {
        // Update sender and receiver balances
        state.balances[tx.from] = (state.balances[tx.from] || 0) - tx.amount;
        state.balances[tx.to] = (state.balances[tx.to] || 0) + tx.amount;

        // Increment the nonce for the sender
        state.nonces[tx.from] = (state.nonces[tx.from] || 0) + 1;
    }

    /**
     * Saves the updated blockchain state to Redis.
     * @param state - The state object to save.
     */
    private async saveState(state: any): Promise<void> {
        await this.redis.set(this.STATE_KEY, JSON.stringify(state));
    }
}