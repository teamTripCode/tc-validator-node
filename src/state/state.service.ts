import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StateService {
    private readonly logger = new Logger(StateService.name);
    private readonly STATE_KEY = 'blockchain:state';

    constructor(private readonly redis: RedisService) { }

    async updateState(block: any): Promise<void> {
        const state = await this.getCurrentState();

        // Aplicar transacciones al estado
        for (const tx of block.transactions || []) {
            await this.applyTransaction(state, tx);
        }

        // Guardar nuevo estado
        await this.saveState(state);
    }

    private async getCurrentState(): Promise<any> {
        const state = await this.redis.get(this.STATE_KEY);
        return state ? JSON.parse(state) : this.getInitialState();
    }

    private getInitialState(): any {
        return {
            balances: {},
            nonces: {},
            contracts: {},
        };
    }

    private async applyTransaction(state: any, tx: any): Promise<void> {
        // Actualizar balances
        state.balances[tx.from] = (state.balances[tx.from] || 0) - tx.amount;
        state.balances[tx.to] = (state.balances[tx.to] || 0) + tx.amount;

        // Actualizar nonce
        state.nonces[tx.from] = (state.nonces[tx.from] || 0) + 1;
    }

    private async saveState(state: any): Promise<void> {
        await this.redis.set(this.STATE_KEY, JSON.stringify(state));
    }
}