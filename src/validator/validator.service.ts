import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { ConsensusState, ValidatorInfo, ValidatorStatus } from "./dto/validator.dto";
import { Interval } from "@nestjs/schedule";
import { SignatureService } from "src/signature/signature.service";
import { Socket, io } from 'socket.io-client';
import axios from "axios";
import { BlockService } from "src/block/block.service";
import { Block } from "src/block/block";
import { ConsensusService } from "src/consensus/consensus.service";

@Injectable()
export class ValidatorService {
    private logger = new Logger(ValidatorService.name);

    // Current consensus state and validator information
    private consensusState: ConsensusState;
    private myValidatorInfo: ValidatorInfo;

    // Authentication and connection-related properties
    private authenticated: boolean = false;
    private authToken: string = null;
    private clientId: string = null;
    private socket: Socket = null;

    /**
     * Constructor initializes the service with dependencies.
     * @param redis - Redis service for storing and retrieving validator data.
     * @param signature - Signature service for cryptographic operations.
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
                    break;
                }
            } catch (error) {
                this.logger.error(`Error authenticating with seed node ${seedNode}: ${error.message}`);
            }
        }
        if (!this.authenticated) {
            this.logger.error('Failed to authenticate with any seed node');
            // Retry after 30 seconds
            setTimeout(() => this.authenticateWithSeedNode(), 30000);
        }
    }

    /**
     * Establishes a WebSocket connection with the seed node for real-time communication.
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
     * @param data - Peer discovery data containing new or disconnected peers.
     */
    private handlePeerDiscovery(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Updating network peer list');
                // Update local peer list
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
     * @param data - State synchronization data containing updated peer information.
     */
    private handleStateSync(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Synchronizing state with new peers');
                // Update local state with new information
            }
        } catch (error) {
            this.logger.error(`Error during state synchronization: ${error.message}`);
        }
    }

    /**
     * Handles failover events initiated by the seed node.
     */
    private handleFailover() {
        this.logger.warn('Failover initiated by seed node');
        // Implement failover logic here
    }

    /**
     * Fetches the list of validators from a seed node.
     * @param seedNode - The URL of the seed node.
     * @returns A list of validators.
     */
    private async getValidatorsFromSeed(seedNode: string): Promise<ValidatorInfo[]> {
        // Implement logic to fetch validators from the seed node via HTTP/WebSocket
        return [];
    }

    /**
     * Synchronizes the validator set with the seed nodes.
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
     */
    @Interval(5000)
    async participateInConsensus() {
        if (this.myValidatorInfo.status !== ValidatorStatus.ACTIVE) return;
        try {
            // Update validator activity timestamp
            this.myValidatorInfo.lastActive = Date.now();

            // Participate in the current consensus round
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

    /**
     * Checks if this validator is the leader for the current consensus round.
     * @returns True if this validator is the leader, false otherwise.
     */
    private checkIfLeader(): boolean {
        // Implement DPoS logic to determine if this validator is the leader
        return false;
    }

    /**
     * Proposes a new block when this validator is the leader.
     */
    private async proposeNewBlock() {
        try {
            // Obtener las transacciones del mempool
            const transactions = await this.block.getMempoolTransactions();

            // Obtener la altura actual del bloque y calcular la nueva altura
            const currentHeight = await this.block.getBlockHeight();
            const newHeight = currentHeight + 1;

            // Crear un nuevo bloque
            const newBlock = new Block(
                newHeight,
                new Date().toISOString(),
                transactions
            );

            // Proponer el nuevo bloque al consenso
            await this.consensus.proposeBlock(newBlock);
            this.logger.log(`Proposed new block with hash: ${newBlock.hash}`);
        } catch (error) {
            this.logger.error(`Error proposing new block: ${error.message}`);
        }
    }

    /**
     * Validates a proposed block using PBFT consensus logic.
     */
    private async validateProposedBlock() {
        // Implement PBFT logic to validate the proposed block
    }
}