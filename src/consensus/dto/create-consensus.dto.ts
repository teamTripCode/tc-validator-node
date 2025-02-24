/**
 * Interface representing a consensus message used in the PBFT (Practical Byzantine Fault Tolerance) consensus protocol.
 * Consensus messages are used to achieve agreement among validators on the state of the blockchain.
 */
interface ConsensusMessage {
    type: ConsensusMessageType; // The type of consensus message (PREPARE, COMMIT, or VIEW_CHANGE)
    blockHeight: number; // The height of the block associated with the message
    blockHash: string; // The hash of the block associated with the message
    validator: string; // The address or identifier of the validator sending the message
    signature: string; // The cryptographic signature of the message for validation
}

/**
 * Enum representing the types of consensus messages in the PBFT protocol.
 */
enum ConsensusMessageType {
    PREPARE = 'PREPARE', // Indicates a PREPARE message used to propose a block
    COMMIT = 'COMMIT', // Indicates a COMMIT message used to finalize a block
    VIEW_CHANGE = 'VIEW_CHANGE', // Indicates a VIEW_CHANGE message used to handle changes in the primary validator
    PRE_PREPARE = 'PRE_PREPARE', // Indicates a PRE-PREPARE message used to propose a block in the first phase of PBFT
}