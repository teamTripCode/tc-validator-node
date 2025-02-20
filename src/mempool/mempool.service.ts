import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

@Injectable()
export class MemPoolService {
    private readonly logger = new Logger(MemPoolService.name);
    private readonly MAX_MEMPOOL_SIZE = 5000; // Transacciones
    private readonly MAX_TX_AGE = 72 * 60 * 60; // 72 horas en segundos

    private mempool: Map<string, any> = new Map();
    private txTimes: Map<string, number> = new Map();

    async addTransaction(tx: any): Promise<boolean> {
        if (this.mempool.size >= this.MAX_MEMPOOL_SIZE) {
            this.removeLowestFeeTransactions();
        }

        if (await this.validateTransaction(tx)) {
            this.mempool.set(tx.hash, tx);
            this.txTimes.set(tx.hash, Date.now());
            return true;
        }
        return false;
    }

    private async validateTransaction(tx: any): Promise<boolean> {
        // Validación básica de estructura
        if (!tx.hash || !tx.from || !tx.to || !tx.amount) {
            return false;
        }

        // Validar que no existe en mempool
        if (this.mempool.has(tx.hash)) {
            return false;
        }

        // Más validaciones...
        return true;
    }

    getTransactionsForBlock(maxSize: number): any[] {
        // Ordenar por fee/byte y seleccionar las mejores
        const txs = Array.from(this.mempool.values());
        txs.sort((a, b) => (b.fee / b.size) - (a.fee / a.size));
        return txs.slice(0, maxSize);
    }

    @Interval(60000) // Cada minuto
    private cleanupOldTransactions() {
        const now = Date.now();
        for (const [hash, time] of this.txTimes.entries()) {
            if ((now - time) / 1000 > this.MAX_TX_AGE) {
                this.mempool.delete(hash);
                this.txTimes.delete(hash);
            }
        }
    }

    private removeLowestFeeTransactions() {
        const txs = Array.from(this.mempool.entries());
        txs.sort((a, b) => (a[1].fee / a[1].size) - (b[1].fee / b[1].size));

        // Eliminar el 10% de las transacciones con menor fee
        const toRemove = Math.ceil(this.mempool.size * 0.1);
        for (let i = 0; i < toRemove; i++) {
            if (txs[i]) {
                this.mempool.delete(txs[i][0]);
                this.txTimes.delete(txs[i][0]);
            }
        }
    }
}