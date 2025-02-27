import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { ConsensusState, ValidatorInfo, ValidatorStatus } from "./dto/validator.dto";
import { Interval } from "@nestjs/schedule";
import { SignatureService } from "src/signature/signature.service";
import { Socket, io } from 'socket.io-client';
import axios from "axios";
import { BlockService } from "src/block/block.service";
import { ConsensusService } from "src/consensus/consensus.service";
import { ConsensusMessageType } from "src/consensus/dto/create-consensus.dto";

/**
 * Service responsible for validator node functionality in the blockchain network.
 * Handles validator initialization, authentication, consensus participation,
 * and state synchronization with other network nodes.
 */
@Injectable()
export class ValidatorService {
    private logger = new Logger(ValidatorService.name);

    // Current consensus state and validator information
    private consensusState: ConsensusState;
    myValidatorInfo: ValidatorInfo;
    private connectedPeers: Array<{ id: string, ip: string, role: string }> = [];

    // Authentication and connection-related properties
    private authenticated: boolean = false;
    private authToken: string = null;
    private clientId: string = null;
    private socket: Socket = null;

    /**
     * Constructor initializes the service with dependencies.
     * @param redis - Redis service for storing and retrieving validator data.
     * @param signature - Signature service for cryptographic operations.
     * @param block - Block service for blockchain operations.
     * @param consensus - Consensus service for participating in the network consensus.
     */
    constructor(
        private readonly redis: RedisService,
        private readonly signature: SignatureService,
        private readonly block: BlockService,
        private readonly consensus: ConsensusService
    ) {
        this.initializeValidator();
    }

    /**
     * Initializes the validator by setting up its metadata and syncing with seed nodes.
     * Creates the validator's identity using cryptographic keys and prepares it for
     * network participation.
     */
    private async initializeValidator() {
        this.myValidatorInfo = {
            address: this.signature.getAddress(),
            stake: 0,
            reputation: 0,
            lastActive: Date.now(),
            publicKey: this.signature.getPublicKey(),
            status: ValidatorStatus.STANDBY
        };
        await this.syncValidatorsFromSeed();
    }

    /**
     * Authenticates the validator with a seed node to obtain a token and client ID.
     * Tries multiple seed nodes in case of failure and establishes WebSocket connection
     * upon successful authentication.
     */
    private async authenticateWithSeedNode() {
        const seedNodes = process.env.SEED_NODES?.split(',') || [];
        for (const seedNode of seedNodes) {
            try {
                this.logger.log(`Starting authentication process with seed node ${seedNode}`);
                // Step 1: Request a new token
                const tokenResponse = await axios.post(`${seedNode}/auth/token`);
                if (!tokenResponse.data?.token) {
                    throw new Error('Failed to obtain authentication token');
                }
                const initialToken = tokenResponse.data.token;

                // Step 2: Authenticate the token
                const authResponse = await axios.post(`${seedNode}/auth/authenticate`, {
                    token: initialToken
                });
                if (authResponse.data?.clientId) {
                    this.authToken = initialToken;
                    this.clientId = authResponse.data.clientId;
                    this.authenticated = true;
                    this.logger.log(`Authentication successful with seed node ${seedNode}`);
                    this.logger.log(`Assigned ClientID: ${this.clientId}`);

                    // Step 3: Establish WebSocket connection
                    await this.establishWebSocketConnection(seedNode);

                    // Step 4: Sync validators
                    await this.syncValidatorsFromSeed();
                    break; // Exit loop after successful authentication
                }
            } catch (error) {
                this.logger.error(`Error authenticating with seed node ${seedNode}: ${error.message}`);
            }
        }
        if (!this.authenticated) {
            this.logger.error('Failed to authenticate with any seed node');
            // Retry after 30 seconds
            /** 
             * Implementing exponential backoff strategy would be better here
             * but using fixed interval for simplicity
             */
            setTimeout(() => this.authenticateWithSeedNode(), 30000);
        }
    }

    /**
     * Establishes a WebSocket connection with the seed node for real-time communication.
     * Sets up event handlers for various network events like peer discovery and failover.
     * 
     * @param seedNode - The URL of the seed node.
     */
    private async establishWebSocketConnection(seedNode: string) {
        try {
            this.socket = io(`${seedNode}`, {
                transports: ['websocket'],
                query: {
                    token: this.authToken,
                    role: 'validator'
                }
            });

            this.socket.on('connect', () => {
                this.logger.log('WebSocket connection established with seed node');
            });

            this.socket.on('peerDiscovery', (data) => {
                this.handlePeerDiscovery(data);
            });

            this.socket.on('disconnect', () => {
                this.logger.warn('WebSocket connection lost with seed node');
                // Retry connection after 5 seconds
                setTimeout(() => this.establishWebSocketConnection(seedNode), 5000);
            });

            this.socket.on('FAILOVER_INITIATED', () => {
                this.handleFailover();
            });

            this.socket.on('STATE_SYNC', (data) => {
                this.handleStateSync(data);
            });

            // Start heartbeat interval
            /** 
             * Regular heartbeats help detect connection issues early
             * and maintain presence in the network
             */
            setInterval(() => {
                if (this.socket.connected) {
                    this.socket.emit('heartbeat');
                }
            }, 30000);
        } catch (error) {
            this.logger.error(`Error establishing WebSocket connection: ${error.message}`);
        }
    }

    /**
     * Handles peer discovery events to update the list of connected peers.
     * Updates local state with information about new and disconnected peers.
     * 
     * @param data - Peer discovery data containing new or disconnected peers.
     */
    private handlePeerDiscovery(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Updating network peer list');
                // Update local peer list
                /** 
                 * Here we would store the full peer list in a local data structure
                 * for use in consensus and other network operations
                 */
            }
            if (data.newPeer) {
                this.logger.log(`New peer connected: ${data.newPeer.ip}`);
                // Add new peer to local state
            }
            if (data.disconnectedPeer) {
                this.logger.log(`Peer disconnected: ${data.disconnectedPeer}`);
                // Remove peer from local state
            }
        } catch (error) {
            this.logger.error(`Error processing peer discovery: ${error.message}`);
        }
    }

    /**
     * Handles state synchronization events to update the validator's state.
     * Ensures this validator has the latest network information.
     * 
     * @param data - State synchronization data containing updated peer information.
     */
    private handleStateSync(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Synchronizing state with new peers');
                // Update local state with new information
                /** 
                 * This would typically involve updating the local blockchain state,
                 * pending transactions, and validator information
                 */
            }
        } catch (error) {
            this.logger.error(`Error during state synchronization: ${error.message}`);
        }
    }

    /**
     * Handles failover events initiated by the seed node.
     * Implements recovery procedures when primary nodes fail.
     */
    private handleFailover() {
        this.logger.warn('Failover initiated by seed node');
        // Implement failover logic here
        /** 
         * Failover logic might include:
         * 1. Stopping normal operations
         * 2. Re-evaluating the leader
         * 3. Re-synchronizing state
         * 4. Resuming operations under new leadership
         */
    }

    /**
     * Fetches the list of validators from a seed node.
     * Used during synchronization to get the latest validator set.
     * 
     * @param seedNode - The URL of the seed node.
     * @returns A list of validators.
     */
    private async getValidatorsFromSeed(seedNode: string): Promise<ValidatorInfo[]> {
        try {
            this.logger.log(`Fetching validators from seed node: ${seedNode}`);

            // First check if we're already authenticated
            if (!this.authenticated || !this.authToken) {
                this.logger.warn('Not authenticated, attempting to authenticate first');
                await this.authenticateWithSeedNode();

                // If authentication still failed, return empty array
                if (!this.authenticated) {
                    throw new Error('Authentication required to fetch validator list');
                }
            }

            // Make HTTP request to the seed node's validator endpoint
            const response = await axios.get(`${seedNode}/validators`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'X-Client-ID': this.clientId
                }
            });

            if (!response.data || !Array.isArray(response.data.validators)) {
                throw new Error('Invalid response format from seed node');
            }

            // Parse and validate the validator information received
            const validators: ValidatorInfo[] = response.data.validators.map(v => ({
                address: v.address,
                stake: Number(v.stake) || 0,
                reputation: Number(v.reputation) || 0,
                lastActive: Number(v.lastActive) || Date.now(),
                publicKey: v.publicKey,
                status: this.validateStatus(v.status) ? v.status : ValidatorStatus.STANDBY
            }));

            this.logger.log(`Successfully retrieved ${validators.length} validators from seed node`);

            // Also try to fetch via WebSocket for redundancy if socket is connected
            if (this.socket && this.socket.connected) {
                this.socket.emit('getValidators');

                // Register a one-time listener for the response
                this.socket.once('validatorList', (data) => {
                    // Merge with existing list or update if newer
                    this.compareAndUpdateValidators(validators, data.validators);
                });
            }

            return validators;
        } catch (error) {
            this.logger.error(`Error fetching validators from seed node ${seedNode}: ${error.message}`);

            // Try alternative method via block history if HTTP fails
            try {
                return await this.getValidatorsFromBlockchain();
            } catch (fallbackError) {
                this.logger.error(`Fallback method also failed: ${fallbackError.message}`);
                return [];
            }
        }
    }

    /**
     * Synchronizes the validator set with the seed nodes.
     * Ensures this node has up-to-date information about all validators.
     */
    async syncValidatorsFromSeed() {
        try {
            const seedNodes = process.env.SEED_NODES?.split(',') || [];
            for (const seedNode of seedNodes) {
                try {
                    const validators = await this.getValidatorsFromSeed(seedNode);
                    if (validators) {
                        await this.updateValidatorSet(validators);
                        break;
                    }
                } catch (error) {
                    this.logger.warn(`Error synchronizing with seed node ${seedNode}`);
                }
            }
        } catch (error) {
            this.logger.error('Error during initial validator synchronization');
        }
    }

    /**
     * Updates the validator set periodically (every 30 seconds).
     * Maintains the current state of all validators in the network.
     * 
     * @param newValidators - Optional list of new validators to update the set.
     */
    @Interval(30000)
    async updateValidatorSet(newValidators?: ValidatorInfo[]) {
        try {
            // If no new validators are provided, fetch them from Redis
            if (!newValidators) {
                const validatorsData = await this.redis.hGetAll('validators');
                newValidators = Object.values(validatorsData).map(v => JSON.parse(v));
            }

            // Update the validator set
            this.consensusState.validatorsSet = new Map(
                newValidators.map(v => [v.address, v])
            );

            // Check if this validator is part of the active set
            /** 
             * Active validators participate in block production and validation,
             * while standby validators are ready to join if needed
             */
            const amIValidator = this.consensusState.validatorsSet.has(this.myValidatorInfo.address);
            if (amIValidator) {
                this.myValidatorInfo.status = ValidatorStatus.ACTIVE;
            } else {
                this.myValidatorInfo.status = ValidatorStatus.STANDBY;
            }

            // Store updated validator info in Redis
            await this.redis.hSet(
                'validators',
                this.myValidatorInfo.address,
                JSON.stringify(this.myValidatorInfo)
            );
        } catch (error) {
            this.logger.error(`Error updating validator set: ${error.message}`);
        }
    }

    /**
     * Participates in the consensus process periodically (every 5 seconds).
     * Active validators propose or validate blocks based on their role.
     */
    @Interval(5000)
    async participateInConsensus() {
        if (this.myValidatorInfo.status !== ValidatorStatus.ACTIVE) return;

        try {
            // Update validator activity timestamp
            this.myValidatorInfo.lastActive = Date.now();

            // Participate in the current consensus round
            /** 
             * The consensus mechanism follows a leader-follower pattern
             * where one validator proposes and others validate
             */
            const isLeader = this.checkIfLeader();
            if (isLeader) {
                await this.proposeNewBlock();
            } else {
                await this.validateProposedBlock();
            }
        } catch (error) {
            this.logger.error(`Error during consensus round: ${error.message}`);
        }
    }

    public getConnectedPeers(): Array<{ id: string, ip: string, role: string }> {
        try {
            // If we're not connected to the network, try to fetch peers via API if authenticated
            if (this.connectedPeers.length === 0 && this.authenticated && this.authToken) {
                this.requestPeerList();
            }

            return this.connectedPeers;
        } catch (error) {
            this.logger.error(`Error getting connected peers: ${error.message}`);
            return [];
        }
    }

    /**
     * Checks if this validator is the leader for the current consensus round.
     * Uses a Delegated Proof of Stake (DPoS) algorithm to determine leadership.
     * 
     * @returns True if this validator is the leader, false otherwise.
     */
    private checkIfLeader(): boolean {
        // Implement DPoS logic to determine if this validator is the leader
        /** 
         * Leadership determination might involve:
         * 1. Calculating a deterministic schedule based on validator stakes
         * 2. Checking if it's this validator's turn in the schedule
         * 3. Verifying leadership eligibility based on reputation
         */
        return false;
    }

    /**
     * Proposes a new block when this validator is the leader.
     * Collects transactions, creates a block, and submits it for consensus.
     */
    private async proposeNewBlock() {
        try {
            // Get transactions from the mempool
            const transactions = await this.block.getMempoolTransactions();

            const newBlock = await this.block.proposeNewBlock(transactions);

            // Propose the new block to the consensus
            await this.consensus.proposeBlock(newBlock);
            this.logger.log(`Proposed new block with hash: ${newBlock.hash}`);
        } catch (error) {
            this.logger.error(`Error proposing new block: ${error.message}`);
        }
    }

    /**
     * Validates a proposed block using PBFT consensus logic.
     * Non-leader validators verify and vote on proposed blocks.
     */
    private async validateProposedBlock() {
        // Get the proposed block from the mempool
        const proposedBlock = await this.block.getBlockFromMempool();
        if (!proposedBlock) {
            this.logger.warn("No proposed block to validate");
            return;
        }

        // Validate the proposed block
        if (!this.block.isValidBlock(proposedBlock)) {
            this.logger.warn("Invalid proposed block");
            return;
        }

        // Handle the PREPARE message for the proposed block
        await this.consensus.handleConsensusMessage({
            type: ConsensusMessageType.PREPARE,
            blockHeight: proposedBlock.index,
            blockHash: proposedBlock.hash,
            validator: this.myValidatorInfo.address,
            signature: this.signature.signMessage(proposedBlock.hash),
        });
    }

    /**
     * Helper method to validate that a status value is a valid ValidatorStatus enum value
     */
    private validateStatus(status: any): boolean {
        return Object.values(ValidatorStatus).includes(status);
    }

    /**
     * Compares two validator lists and updates validators array with any additional validators
     * or more up-to-date information from the second list.
     */
    private compareAndUpdateValidators(validators: ValidatorInfo[], newValidators: any[]): ValidatorInfo[] {
        if (!Array.isArray(newValidators)) return validators;

        // Create a map of existing validators for quick lookup
        const validatorMap = new Map(validators.map(v => [v.address, v]));

        for (const newVal of newValidators) {
            if (!newVal.address || !newVal.publicKey) continue;

            const existing = validatorMap.get(newVal.address);

            if (!existing) {
                // Add new validator
                validators.push({
                    address: newVal.address,
                    stake: Number(newVal.stake) || 0,
                    reputation: Number(newVal.reputation) || 0,
                    lastActive: Number(newVal.lastActive) || Date.now(),
                    publicKey: newVal.publicKey,
                    status: this.validateStatus(newVal.status) ? newVal.status : ValidatorStatus.STANDBY
                });
            } else if (newVal.lastActive > existing.lastActive) {
                // Update existing validator if data is more recent
                existing.stake = Number(newVal.stake) || existing.stake;
                existing.reputation = Number(newVal.reputation) || existing.reputation;
                existing.lastActive = Number(newVal.lastActive);
                existing.status = this.validateStatus(newVal.status) ? newVal.status : existing.status;
            }
        }

        return validators;
    }

    /**
     * Fallback method to extract validator list from recent blocks in case
     * direct fetch from seed nodes fails.
     */
    private async getValidatorsFromBlockchain(): Promise<ValidatorInfo[]> {
        this.logger.log('Attempting to fetch validators from blockchain history');

        // Get last 10 blocks to extract validator information
        const recentBlocks = await this.block.getRecentBlocks(10);
        if (!recentBlocks || recentBlocks.length === 0) {
            throw new Error('No blocks available to extract validator information');
        }

        const validatorMap = new Map<string, ValidatorInfo>();

        // Extract validator information from block signatures
        for (const block of recentBlocks) {
            if (block.signatures && Array.isArray(block.signatures)) {
                for (const sig of block.signatures) {
                    if (!validatorMap.has(sig.validator)) {
                        validatorMap.set(sig.validator, {
                            address: sig.validator,
                            publicKey: sig.publicKey || '',
                            stake: 0,
                            reputation: 0,
                            lastActive: block.timestamp || Date.now(),
                            status: ValidatorStatus.ACTIVE // Assume active if they signed blocks
                        });
                    }
                }
            }
        }

        this.logger.log(`Extracted ${validatorMap.size} validators from blockchain history`);
        return Array.from(validatorMap.values());
    }

    private requestPeerList(): void {
        if (this.socket && this.socket.connected) {
            this.socket.emit('getPeers');

            // Register a one-time listener for the response
            this.socket.once('peerList', (data) => {
                if (data && Array.isArray(data.peers)) {
                    this.connectedPeers = data.peers;
                    this.logger.log(`Updated peer list, ${this.connectedPeers.length} peers connected`);
                }
            });
        }
    }
}