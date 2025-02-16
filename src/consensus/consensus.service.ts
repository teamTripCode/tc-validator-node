import { Injectable, Logger } from '@nestjs/common';
import { SignatureService } from 'src/signature/signature.service';


@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);
  private prepareMessages: Map<string, ConsensusMessage[]> = new Map();
  private commitMessages: Map<string, ConsensusMessage[]> = new Map();

  constructor() { }

  async handleConsensusMessage(message: ConsensusMessage): Promise<void> {
    try {
      // Verificar firma del mensaje
      if (!this.verifyMessageSignature(message)) {
        this.logger.warn(`Mensaje de consenso con firma inválida de ${message.validator}`);
        return;
      }

      switch (message.type) {
        case ConsensusMessageType.PREPARE:
          await this.handlePrepareMessage(message);
          break;
        case ConsensusMessageType.COMMIT:
          await this.handleCommitMessage(message);
          break;
        case ConsensusMessageType.VIEW_CHANGE:
          await this.handleViewChangeMessage(message);
          break;
      }
    } catch (error) {
      this.logger.error(`Error procesando mensaje de consenso: ${error.message}`);
    }
  }

  private async handlePrepareMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, []);
    }
    this.prepareMessages.get(key).push(message);

    // Verificar si tenemos suficientes mensajes PREPARE
    if (this.prepareMessages.get(key).length >= this.getRequiredPrepares()) {
      await this.broadcastCommit(message.blockHeight, message.blockHash);
    }
  }

  private async handleCommitMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, []);
    }
    this.commitMessages.get(key).push(message);

    // Verificar si tenemos suficientes mensajes COMMIT
    if (this.commitMessages.get(key).length >= this.getRequiredCommits()) {
      await this.finalizeBlock(message.blockHeight, message.blockHash);
    }
  }

  private async handleViewChangeMessage(message: ConsensusMessage) {
    // Implementar lógica de cambio de vista PBFT
  }

  private getRequiredPrepares(): number {
    // Calcular 2f + 1 donde f es el número máximo de nodos maliciosos tolerados
    return Math.floor(this.getTotalValidators() * 2 / 3) + 1;
  }

  private getRequiredCommits(): number {
    // Similar a PREPARE, necesitamos 2f + 1 commits
    return this.getRequiredPrepares();
  }

  private getTotalValidators(): number {
    // Obtener número total de validadores activos
    return 0; // Implementar
  }

  private verifyMessageSignature(message: ConsensusMessage): boolean {
    // Verificar firma del mensaje usando el servicio de firmas
    return true; // Implementar
  }

  private async broadcastCommit(height: number, hash: string) {
    // Enviar mensaje COMMIT a todos los validadores
  }

  private async finalizeBlock(height: number, hash: string) {
    // Finalizar el bloque cuando tenemos suficientes COMMIT
  }
}
