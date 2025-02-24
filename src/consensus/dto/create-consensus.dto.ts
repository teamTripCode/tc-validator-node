/**
 * Interface representing a consensus message used in the PBFT (Practical Byzantine Fault Tolerance) consensus protocol.
 * Consensus messages are used to achieve agreement among validators on the state of the blockchain.
 */
export interface ConsensusMessage {
    type: ConsensusMessageType; // The type of consensus message (PREPARE, COMMIT, or VIEW_CHANGE)
    blockHeight: number; // The height of the block associated with the message
    blockHash: string; // The hash of the block associated with the message
    validator: string; // The address or identifier of the validator sending the message
    signature: string; // The cryptographic signature of the message for validation
    view?: number;  // Número de vista actual para VIEW_CHANGE
    newView?: number;  // Nueva vista propuesta para VIEW_CHANGE
    viewChangeProof?: string[];  // Pruebas para el cambio de vista
}

/**
 * Enum representing the types of consensus messages in the PBFT protocol.
 */
export enum ConsensusMessageType {
    PREPARE = 'PREPARE', // Indicates a PREPARE message used to propose a block
    COMMIT = 'COMMIT', // Indicates a COMMIT message used to finalize a block
    VIEW_CHANGE = 'VIEW_CHANGE', // Indicates a VIEW_CHANGE message used to handle changes in the primary validator
    PRE_PREPARE = 'PRE_PREPARE', // Indicates a PRE-PREPARE message used to propose a block in the first phase of PBFT
    NEW_VIEW = 'NEW_VIEW'
}

// Interfaz para mensajes de cambio de vista
export interface ViewChangeMessage extends ConsensusMessage {
    view: number;
    newView: number;
    lastPreparedSeqNum: number;
    viewChangeProof: string[];  // Firmas de otros validadores que soportan el cambio
}

// Interfaz para mensajes de nueva vista
export interface NewViewMessage extends ConsensusMessage {
    view: number;
    viewChangeMessages: string[];  // Mensajes de cambio de vista que justifican el cambio
    preprepareMessages: string[];  // Nuevos mensajes pre-prepare para bloques pendientes
}