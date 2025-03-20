import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { StateService } from 'src/state/state.service';
import { ValidatorGateway } from 'src/validator/validator.gateway';

@Injectable()
export class TripcoinService {
    private readonly logger = new Logger(TripcoinService.name);
    private readonly GAS_PRICE = parseInt(process.env.GAS_PRICE) || 10;
    private readonly BLOCK_REWARD = parseInt(process.env.BLOCK_REWARD) || 50;
    private readonly SUPPLY_CAP = parseInt(process.env.SUPPLY_CAP) || 21_000_000;
    private readonly INITIAL_SUPPLY = 1_000_000;

    constructor(
        private readonly redis: RedisService,
        private readonly state: StateService,
        private readonly validators: ValidatorGateway,
    ) {
        this.initializeSupply();
    }

    private async initializeSupply(): Promise<void> {
        const currentSupply = await this.getTotalSupply();
        if (currentSupply === 0) {
            await this.mint(this.INITIAL_SUPPLY);
            await this.state.setBalance('foundation', this.INITIAL_SUPPLY);
        }
    }

    calculateTransactionFee(gasLimit: number): number {
        return gasLimit * this.GAS_PRICE;
    }

    async validateTransaction(sender: string, amount: number, fee: number): Promise<boolean> {
        const balance = await this.state.getAccountBalance(sender);
        return balance >= amount + fee;
    }

    async deductGasFee(sender: string, fee: number): Promise<void> {
        await this.state.incrementBalance(sender, -fee);
        await this.state.incrementBalance('FEE_POOL', fee);
    }

    async distributeBlockReward(blockHeight: number): Promise<void> {
        try {
            const feePool = await this.state.getAccountBalance('FEE_POOL');
            const blockReward = this.BLOCK_REWARD;

            // Validar suministro
            const newSupply = await this.getTotalSupply() + blockReward;
            if (newSupply > this.SUPPLY_CAP) {
                throw new Error('Exceeds supply cap');
            }

            await this.mint(blockReward);
            await this.state.incrementBalance('FEE_POOL', blockReward);

            const validators = await this.validators.getActiveValidators();
            const totalReward = feePool + blockReward;
            const rewardPerValidator = totalReward / validators.length;

            for (const validator of validators) {
                await this.transfer('FEE_POOL', validator.address, rewardPerValidator);
            }

            await this.state.setBalance('FEE_POOL', 0);
            this.logger.log(`Rewards distributed for block ${blockHeight}`);
        } catch (error) {
            this.logger.error(`Error distributing rewards: ${error.message}`);
        }
    }

    async transfer(sender: string, recipient: string, amount: number): Promise<void> {
        await this.state.incrementBalance(sender, -amount);
        await this.state.incrementBalance(recipient, amount);
    }

    async getBalance(address: string): Promise<number> {
        return this.state.getAccountBalance(address);
    }

    private async getTotalSupply(): Promise<number> {
        const supply = await this.redis.get('tripcoin:supply');
        return parseInt(supply) || 0;
    }

    private async mint(amount: number): Promise<void> {
        const current = await this.getTotalSupply();
        if (current + amount > this.SUPPLY_CAP) throw new Error('Supply cap exceeded');
        await this.redis.set('tripcoin:supply', (current + amount).toString());
    }
}
