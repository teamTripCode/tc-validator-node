
interface ConsensusMessage {
    type: ConsensusMessageType;
    blockHeight: number;
    blockHash: string;
    validator: string;
    signature: string;
}

enum ConsensusMessageType {
    PREPARE = 'PREPARE',
    COMMIT = 'COMMIT',
    VIEW_CHANGE = 'VIEW_CHANGE'
}