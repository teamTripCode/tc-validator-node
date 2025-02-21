/**
 * Represents a validator node in the blockchain network with its associated properties.
 * Contains all the metadata needed to identify and evaluate a validator.
 */
export class ValidatorInfo {
    /** Unique blockchain address of the validator (derived from public key) */
    address: string;
    
    /** Amount of tokens staked by the validator, determines voting power */
    stake: number;
    
    /** Reputation score based on past performance and behavior */
    reputation: number;
    
    /** Timestamp of validator's last activity (used to detect inactive validators) */
    lastActive: number;
    
    /** Validator's public key used for signature verification */
    publicKey: string;
    
    /** Current operational status of the validator */
    status: ValidatorStatus;
}

/**
 * Enum representing possible validator statuses in the network.
 * Determines validator's participation rights in consensus.
 */
export enum ValidatorStatus {
    /** Actively participating in consensus and block production */
    ACTIVE = 'ACTIVE',
    
    /** Not currently participating but available if needed */
    STANDBY = 'STANDBY',
    
    /** Temporarily removed from active set due to misbehavior */
    PENALIZED = 'PENALIZED'
}

/**
 * Represents the current state of the consensus process.
 * Tracks the active validator set and leadership information.
 */
export class ConsensusState {
    /** Current consensus round number (increments with each new block) */
    currentRound: number;
    
    /** Address of the validator currently assigned as leader */
    currentLeader: string;
    
    /** Timestamp when the current round started */
    roundStartTime: number;
    
    /** Map of all active validators indexed by their addresses */
    validatorsSet: Map<string, ValidatorInfo>;
}