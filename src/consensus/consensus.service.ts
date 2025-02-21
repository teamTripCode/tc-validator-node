import { Injectable, Logger } from '@nestjs/common';
import { BlockService } from 'src/block/block.service';
import { IBlock } from 'src/block/dto/block.dto';
import { SignatureService } from 'src/signature/signature.service';
import { TripcoinService } from 'src/tripcoin/tripcoin.service';

/**
 * ConsensusService manages the consensus mechanism for the blockchain, ensuring agreement among validators.
 * It handles PREPARE, COMMIT, and VIEW_CHANGE messages, verifies signatures, and finalizes blocks when consensus is reached.
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  /**
   * Maps to store PREPARE and COMMIT messages for each block
   * Key format: blockHeight:blockHash
   */
  private prepareMessages: Map<string, ConsensusMessage[]> = new Map();
  private commitMessages: Map<string, ConsensusMessage[]> = new Map();

  constructor(
    private readonly signature: SignatureService,
    private readonly block: BlockService,
    private readonly tripcoin: TripcoinService,
  ) { }

  /**
   * Handles incoming consensus messages, verifies their signatures,
   * and processes them based on their type (PREPARE, COMMIT, VIEW_CHANGE).
   * @param message - The consensus message to process.
   */
  async handleConsensusMessage(message: ConsensusMessage): Promise<void> {
    try {
      if (!this.verifyMessageSignature(message)) {
        this.logger.warn(`Invalid signature in consensus message from ${message.validator}`);
        return;
      }

      // Route message to the corresponding handler based on its type
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
   * Handles a PREPARE message: stores it and broadcasts COMMIT if quorum is reached.
   * @param message - The PREPARE consensus message.
   */
  private async handlePrepareMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, []);
    }
    this.prepareMessages.get(key).push(message);

    if (this.prepareMessages.get(key).length >= this.getRequiredPrepares()) {
      await this.broadcastCommit(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Handles a COMMIT message: stores it and finalizes the block if quorum is reached.
   * @param message - The COMMIT consensus message.
   */
  private async handleCommitMessage(message: ConsensusMessage) {
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, []);
    }
    this.commitMessages.get(key).push(message);

    if (this.commitMessages.get(key).length >= this.getRequiredCommits()) {
      await this.finalizeBlock(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Placeholder for VIEW_CHANGE message handling in PBFT consensus.
   * @param message - The VIEW_CHANGE consensus message.
   */
  private async handleViewChangeMessage(message: ConsensusMessage) {
    // Implement PBFT view change logic here
  }

  /**
   * Calculates the minimum number of PREPARE messages required (2f + 1).
   * @returns Required PREPARE messages for consensus.
   */
  private getRequiredPrepares(): number {
    return Math.floor(this.getTotalValidators() * 2 / 3) + 1;
  }

  /**
   * Calculates the minimum number of COMMIT messages required (same as PREPARE).
   * @returns Required COMMIT messages for consensus.
   */
  private getRequiredCommits(): number {
    return this.getRequiredPrepares();
  }

  /**
   * Retrieves the total number of active validators in the network.
   * @returns Total validator count.
   */
  private getTotalValidators(): number {
    // Implement logic to fetch total validators
    return 0;
  }

  /**
   * Verifies the signature of a consensus message.
   * @param message - The consensus message to verify.
   * @returns True if valid, false otherwise.
   */
  private verifyMessageSignature(message: ConsensusMessage): boolean {
    // Implement signature verification using SignatureService
    return true;
  }

  /**
   * Broadcasts a COMMIT message to all validators.
   * @param height - Block height.
   * @param hash - Block hash.
   */
  private async broadcastCommit(height: number, hash: string) {
    // Implement broadcasting logic
  }

  /**
   * Finalizes a block when enough COMMIT messages are received.
   * @param height - Block height.
   * @param hash - Block hash.
   */
  private async finalizeBlock(height: number, hash: string) {
    const block = await this.block.getBlock(hash);
    if (block) {
      await this.block.saveBlock(block);
      await this.tripcoin.distributeBlockReward(block.index);
      this.logger.log(`Block ${hash} finalized and saved`);
    }
  }

  /**
   * Proposes a new block by broadcasting a PREPARE message.
   * @param block - The block to propose.
   */
  async proposeBlock(block: IBlock) {
    const message: ConsensusMessage = {
      type: ConsensusMessageType.PREPARE,
      blockHeight: block.index,
      blockHash: block.hash,
      validator: this.signature.getAddress(),
      signature: this.signature.signMessage(block.hash),
    };
    this.broadcastPrepare(message);
  }

  /**
   * Broadcasts a PREPARE message to all validators.
   * @param message - The PREPARE consensus message.
   */
  private async broadcastPrepare(message: ConsensusMessage) {
    // Implement the logic to broadcast PREPARE messages
    console.log(`Broadcasting PREPARE message for block ${message.blockHash}`);
  }
}
