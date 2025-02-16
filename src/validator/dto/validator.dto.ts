export class ValidatorInfo {
    address: string;
    stake: number;
    reputation: number;
    lastActive: number;
    publicKey: string;
    status: ValidatorStatus;
}

export enum ValidatorStatus {
    ACTIVE = 'ACTIVE',
    STANDBY = 'STANDBY',
    PENALIZED = 'PENALIZED'
}

export class ConsensusState {
    currentRound: number;
    currentLeader: string;
    roundStartTime: number;
    validatorsSet: Map<string, ValidatorInfo>;
}