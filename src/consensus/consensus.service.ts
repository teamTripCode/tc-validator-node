import { Injectable, Logger } from '@nestjs/common';
import { Block } from 'src/block/block';
import { BlockService } from 'src/block/block.service';
import { SignatureService } from 'src/signature/signature.service';

@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  // Maps to store PREPARE and COMMIT messages for each block (keyed by blockHeight:blockHash)
  private prepareMessages: Map<string, ConsensusMessage[]> = new Map();
  private commitMessages: Map<string, ConsensusMessage[]> = new Map();

  constructor(
    private readonly signature: SignatureService,
    private readonly block: BlockService,
  ) { }

  /**
   * Handles incoming consensus messages, verifies their signatures, 
   * and processes them based on their type.
   * @param message - The consensus message to process.
   */
  async handleConsensusMessage(message: ConsensusMessage): Promise<void> {
    try {
      // Verify the message signature before processing
      if (!this.verifyMessageSignature(message)) {
        this.logger.warn(`Invalid signature in consensus message from ${message.validator}`);
        return;
      }

      // Process the message based on its type
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
      this.logger.error(`Error processing consensus message: ${error.message}`);
    }
  }

  /**
   * Handles a PREPARE message by storing it and checking if enough PREPARE messages
   * have been received to proceed with broadcasting a COMMIT.
   * @param message - The PREPARE consensus message.
   */
  private async handlePrepareMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, []);
    }
    this.prepareMessages.get(key).push(message);

    // Check if we have enough PREPARE messages to broadcast a COMMIT
    if (this.prepareMessages.get(key).length >= this.getRequiredPrepares()) {
      await this.broadcastCommit(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Handles a COMMIT message by storing it and checking if enough COMMIT messages
   * have been received to finalize the block.
   * @param message - The COMMIT consensus message.
   */
  private async handleCommitMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, []);
    }
    this.commitMessages.get(key).push(message);

    // Check if we have enough COMMIT messages to finalize the block
    if (this.commitMessages.get(key).length >= this.getRequiredCommits()) {
      await this.finalizeBlock(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Placeholder for handling VIEW_CHANGE messages in PBFT consensus.
   * @param message - The VIEW_CHANGE consensus message.
   */
  private async handleViewChangeMessage(message: ConsensusMessage) {
    // Implement PBFT view change logic here
  }

  /**
   * Calculates the number of required PREPARE messages (2f + 1).
   * @returns The minimum number of PREPARE messages needed for consensus.
   */
  private getRequiredPrepares(): number {
    return Math.floor(this.getTotalValidators() * 2 / 3) + 1;
  }

  /**
   * Calculates the number of required COMMIT messages (same as PREPARE).
   * @returns The minimum number of COMMIT messages needed for consensus.
   */
  private getRequiredCommits(): number {
    return this.getRequiredPrepares();
  }

  /**
   * Placeholder for retrieving the total number of active validators.
   * @returns The total number of validators in the network.
   */
  private getTotalValidators(): number {
    // Implement logic to fetch the total number of active validators
    return 0;
  }

  /**
   * Verifies the signature of a consensus message.
   * @param message - The consensus message to verify.
   * @returns True if the signature is valid, false otherwise.
   */
  private verifyMessageSignature(message: ConsensusMessage): boolean {
    // Implement signature verification logic using the SignatureService
    return true;
  }

  /**
   * Broadcasts a COMMIT message to all validators.
   * @param height - The block height.
   * @param hash - The block hash.
   */
  private async broadcastCommit(height: number, hash: string) {
    // Implement logic to broadcast a COMMIT message
  }

  /**
   * Finalizes a block when enough COMMIT messages have been received.
   * @param height - The block height.
   * @param hash - The block hash.
   */
  private async finalizeBlock(height: number, hash: string) {
    const block = await this.block.getBlock(hash);
    if (block) {
      await this.block.saveBlock(block);
      this.logger.log(`Block ${hash} finalized and saved`);
    }
  }

  async proposeBlock(block: Block) {
    const message: ConsensusMessage = {
      type: ConsensusMessageType.PREPARE,
      blockHeight: block.index,
      blockHash: block.hash,
      validator: this.signature.getAddress(),
      signature: this.signature.signMessage(block.hash),
    };
    this.broadcastPrepare(message);
  }

  private async broadcastPrepare(message: ConsensusMessage) {
    // Implementa la lógica para enviar el mensaje PREPARE a otros validadores
    console.log(`Broadcasting PREPARE message for block ${message.blockHash}`);
  }
}