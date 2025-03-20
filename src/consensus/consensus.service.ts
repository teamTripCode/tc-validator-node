import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { BlockService } from 'src/block/block.service';
import { IBlock } from 'src/block/dto/block.dto';
import { QueueService } from 'src/queue/queue.service';
import { SignatureService } from 'src/signature/signature.service';
import { TripcoinService } from 'src/tripcoin/tripcoin.service';
import { ValidatorGateway } from 'src/validator/validator.gateway';
import {
  ConsensusMessage,
  ConsensusMessageType,
  NewViewMessage,
  ViewChangeMessage,
} from './dto/create-consensus.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ConsensusService manages the consensus mechanism for the blockchain, ensuring agreement among validators.
 * It handles PREPARE, COMMIT, and VIEW_CHANGE messages, verifies signatures, and finalizes blocks when consensus is reached.
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  /**
   * Maps to store messages for each block and fase del consenso
   * Key format: blockHeight:blockHash
   */
  private prePrepareMessages: Map<string, ConsensusMessage[]> = new Map();
  private prepareMessages: Map<string, ConsensusMessage[]> = new Map();
  private commitMessages: Map<string, ConsensusMessage[]> = new Map();
  private viewChangeMessages: Map<number, ViewChangeMessage[]> = new Map();

  // Estado actual del consenso
  private currentView: number = 0;
  private isViewChanging: boolean = false;
  private viewChangeTimeout: NodeJS.Timeout | null = null;
  private lastExecutedBlock: number = 0;
  private activeValidators: string[] = [];
  private isPrimary: boolean = false;
  private viewChangeTimeoutMs: number = 10000; // 10 segundos timeout para detección de fallo
  private processingBlocks: Set<string> = new Set(); // Bloques actualmente en proceso

  constructor(
    private readonly signature: SignatureService,
    private readonly block: BlockService,
    private readonly tripcoin: TripcoinService,
    @Inject(forwardRef(() => QueueService))
    private readonly queue: QueueService,
    @Inject(forwardRef(() => ValidatorGateway))
    private readonly gateway: ValidatorGateway,
    private readonly eventEmitter: EventEmitter2
  ) {
    // Inicializar el estado
    this.initialize();
  }

  /**
   * Inicializa el servicio de consenso, determina si es el validador primario.
   */
  private async initialize(): Promise<void> {
    // Recuperar la lista de validadores activos
    await this.updateValidatorList();

    // Determinar si este nodo es el primario (líder) en la vista actual
    this.isPrimary = this.isPrimaryValidator(this.currentView);

    // Configurar temporizador de heartbeat para detectar fallos del líder
    this.setupViewChangeTimeout();

    this.logger.log(`Consenso inicializado: isPrimary=${this.isPrimary}, view=${this.currentView}`);

    // Publicar evento de inicialización
    this.eventEmitter.emit('consensus.initialized', {
      isPrimary: this.isPrimary,
      currentView: this.currentView
    });
  }

  /**
   * Actualiza la lista de validadores activos del blockchain
   */
  private async updateValidatorList(): Promise<void> {
    try {
      // Aquí se debe implementar la lógica para obtener validadores activos
      // Por ejemplo, desde un contrato inteligente o servicio específico
      // Por ahora, usamos un mock
      this.activeValidators = [
        this.signature.getAddress(),
        'validator2',
        'validator3',
        'validator4'
      ];
    } catch (error) {
      this.logger.error(`Error actualizando lista de validadores: ${error.message}`);
    }
  }

  /**
   * Determina si este nodo es el validador primario para la vista actual
   * @param view Número de vista
   * @returns true si es primario, false en caso contrario
   */
  private isPrimaryValidator(view: number): boolean {
    if (this.activeValidators.length === 0) return false;

    // El líder rota en cada vista, usando el módulo del número de validadores
    const primaryIndex = view % this.activeValidators.length;
    const primaryAddress = this.activeValidators[primaryIndex];

    return primaryAddress === this.signature.getAddress();
  }

  /**
   * Configura el temporizador para detectar fallos del líder
   */
  private setupViewChangeTimeout(): void {
    // Limpiar temporizador existente si hay uno
    if (this.viewChangeTimeout) {
      clearTimeout(this.viewChangeTimeout);
    }

    // Solo configurar temporizador si no somos el primario
    if (!this.isPrimary && !this.isViewChanging) {
      this.viewChangeTimeout = setTimeout(() => {
        this.initiateViewChange();
      }, this.viewChangeTimeoutMs);
    }
  }

  /**
   * Resetea el temporizador de cambio de vista cuando se recibe actividad del líder
   */
  private resetViewChangeTimeout(): void {
    if (!this.isPrimary) {
      this.setupViewChangeTimeout();
    }
  }

  /**
   * Inicia el proceso de cambio de vista cuando se detecta un fallo del líder
   */
  private async initiateViewChange(): Promise<void> {
    if (this.isViewChanging) return;

    this.isViewChanging = true;
    const newView = this.currentView + 1;

    this.logger.warn(`Iniciando cambio de vista de ${this.currentView} a ${newView}`);

    // Crear mensaje de cambio de vista
    const viewChangeMessage: ViewChangeMessage = {
      type: ConsensusMessageType.VIEW_CHANGE,
      blockHeight: this.lastExecutedBlock,
      blockHash: '', // No es relevante para VIEW_CHANGE
      validator: this.signature.getAddress(),
      view: this.currentView,
      newView: newView,
      lastPreparedSeqNum: this.lastExecutedBlock,
      viewChangeProof: [],
      signature: ''
    };

    // Firmar el mensaje
    viewChangeMessage.signature = this.signature.signMessage(
      JSON.stringify({
        ...viewChangeMessage,
        signature: undefined
      })
    );

    // Almacenar localmente
    if (!this.viewChangeMessages.has(newView)) {
      this.viewChangeMessages.set(newView, []);
    }
    this.viewChangeMessages.get(newView)?.push(viewChangeMessage);

    // Encolar y difundir
    await this.queue.enqueueConsensusMessage(viewChangeMessage);
    this.gateway.broadcastConsensusMessage(viewChangeMessage);

    // Comenzar temporizador de espera para cambio de vista
    setTimeout(() => {
      this.checkViewChangeProgress(newView);
    }, this.viewChangeTimeoutMs);
  }

  /**
   * Comprueba si se ha alcanzado consenso en el cambio de vista
   * @param newView Nueva vista propuesta
   */
  private async checkViewChangeProgress(newView: number): Promise<void> {
    if (!this.isViewChanging || this.currentView >= newView) return;

    const messages = this.viewChangeMessages.get(newView) || [];
    const quorum = this.getRequiredQuorum();

    if (messages.length >= quorum) {
      // Tenemos suficientes mensajes para realizar el cambio de vista
      await this.completeViewChange(newView, messages);
    } else {
      // No se alcanzó el consenso, incrementar la vista y reintentar
      this.logger.warn(`No se alcanzó consenso para cambio a vista ${newView}, reintentando`);
      await this.initiateViewChange();
    }
  }

  /**
   * Completa el proceso de cambio de vista y establece el nuevo primario
   * @param newView Nueva vista
   * @param messages Mensajes de cambio de vista que justifican el cambio
   */
  private async completeViewChange(newView: number, messages: ViewChangeMessage[]): Promise<void> {
    this.currentView = newView;
    this.isPrimary = this.isPrimaryValidator(newView);
    this.isViewChanging = false;

    this.logger.log(`Completado cambio a vista ${newView}, isPrimary=${this.isPrimary}`);

    // Si somos el nuevo primario, enviamos NEW_VIEW
    if (this.isPrimary) {
      await this.sendNewView(newView, messages);
    } else {
      // Si no somos primario, reiniciamos temporizador
      this.setupViewChangeTimeout();
    }

    // Publicar evento de cambio de vista
    this.eventEmitter.emit('consensus.viewChanged', {
      newView: this.currentView,
      isPrimary: this.isPrimary
    });
  }

  /**
   * Envía mensaje NEW_VIEW como nuevo primario
   * @param newView Nueva vista
   * @param viewChangeMessages Mensajes que justifican el cambio
   */
  private async sendNewView(newView: number, viewChangeMessages: ViewChangeMessage[]): Promise<void> {
    // Serializar mensajes de cambio de vista
    const serializedVCMessages = viewChangeMessages.map(m => JSON.stringify(m));

    // Generar mensaje de nueva vista
    const newViewMessage: NewViewMessage = {
      type: ConsensusMessageType.NEW_VIEW,
      blockHeight: this.lastExecutedBlock,
      blockHash: '',
      validator: this.signature.getAddress(),
      view: newView,
      viewChangeMessages: serializedVCMessages,
      preprepareMessages: [],
      signature: ''
    };

    // Firmar mensaje
    newViewMessage.signature = this.signature.signMessage(
      JSON.stringify({
        ...newViewMessage,
        signature: undefined
      })
    );

    // Encolar y difundir
    await this.queue.enqueueConsensusMessage(newViewMessage);
    this.gateway.broadcastConsensusMessage(newViewMessage);

    // Recuperar y reproponar bloques pendientes
    await this.reproposePendingBlocks();
  }

  /**
   * Repropone bloques pendientes después de un cambio de vista
   */
  private async reproposePendingBlocks(): Promise<void> {
    if (!this.isPrimary) return;

    try {
      // Obtener bloques pendientes desde el último ejecutado
      const pendingBlocks = await this.block.getPendingBlocks(this.lastExecutedBlock);

      for (const block of pendingBlocks) {
        // Proponer cada bloque pendiente de nuevo
        await this.proposeBlock(block);
      }

      this.logger.log(`Repropuestos ${pendingBlocks.length} bloques pendientes`);
    } catch (error) {
      this.logger.error(`Error reproponiendo bloques: ${error.message}`);
    }
  }

  /**
     * Handles incoming consensus messages, verifies their signatures,
     * and processes them based on their type
     * @param message - The consensus message to process.
     */
  async handleConsensusMessage(message: ConsensusMessage): Promise<void> {
    try {
      // Resetear timeout si recibimos mensaje del primario
      if (this.isPrimaryValidator(this.currentView) &&
        message.validator === this.activeValidators[this.currentView % this.activeValidators.length]) {
        this.resetViewChangeTimeout();
      }

      if (!this.verifyMessageSignature(message)) {
        this.logger.warn(`Invalid signature in consensus message from ${message.validator}`);
        return;
      }

      // Verificar que el mensaje corresponda a la vista actual
      if (message.view !== undefined && message.view < this.currentView &&
        message.type !== ConsensusMessageType.VIEW_CHANGE &&
        message.type !== ConsensusMessageType.NEW_VIEW) {
        this.logger.warn(`Mensaje de vista obsoleta ${message.view}, vista actual: ${this.currentView}`);
        return;
      }

      // Route message to the corresponding handler based on its type
      switch (message.type) {
        case ConsensusMessageType.PRE_PREPARE:
          await this.handlePrePrepareMessage(message);
          break;
        case ConsensusMessageType.PREPARE:
          await this.handlePrepareMessage(message);
          break;
        case ConsensusMessageType.COMMIT:
          await this.handleCommitMessage(message);
          break;
        case ConsensusMessageType.VIEW_CHANGE:
          await this.handleViewChangeMessage(message as ViewChangeMessage);
          break;
        case ConsensusMessageType.NEW_VIEW:
          await this.handleNewViewMessage(message as NewViewMessage);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing consensus message: ${error.message}`);
    }
  }

  /**
   * Retorna de forma segura el estado actual de los mensajes de consenso.
   */
  public getConsensusStatus(): {
    currentView: number,
    isPrimary: boolean,
    isViewChanging: boolean,
    lastExecutedBlock: number,
    prePrepareMessages: number,
    prepareMessages: number,
    commitMessages: number,
    viewChangeMessages: number
  } {
    return {
      currentView: this.currentView,
      isPrimary: this.isPrimary,
      isViewChanging: this.isViewChanging,
      lastExecutedBlock: this.lastExecutedBlock,
      prePrepareMessages: this.prePrepareMessages.size,
      prepareMessages: this.prepareMessages.size,
      commitMessages: this.commitMessages.size,
      viewChangeMessages: this.viewChangeMessages.size
    };
  }

  /**
   * Fase 1: Pre-Prepare - Solo el primario puede iniciar esta fase
   */
  private async handlePrePrepareMessage(message: ConsensusMessage) {
    // Solo aceptar PRE_PREPARE del validador primario
    if (!this.isPrimaryValidator(this.currentView) &&
      message.validator !== this.activeValidators[this.currentView % this.activeValidators.length]) {
      this.logger.warn(`PRE_PREPARE rechazado: remitente ${message.validator} no es primario`);
      return;
    }

    // Verificar que no estemos procesando ya este bloque
    const key = `${message.blockHeight}:${message.blockHash}`;
    if (this.processingBlocks.has(key)) {
      this.logger.debug(`Bloque ${key} ya está en proceso`);
      return;
    }

    // Marcar bloque como en procesamiento
    this.processingBlocks.add(key);

    // Enqueue message for distributed processing
    await this.queue.enqueueConsensusMessage(message);

    if (!this.prePrepareMessages.has(key)) {
      this.prePrepareMessages.set(key, []);
    }
    this.prePrepareMessages.get(key)?.push(message);

    // Verificar validez del bloque usando BlockService
    const block = await this.block.getBlock(message.blockHash);
    if (!block || !(await this.block.isValidBlock(block))) {
      this.logger.warn(`Invalid block in Pre-Prepare phase: ${message.blockHash}`);
      this.processingBlocks.delete(key);
      return;
    }

    // Crear mensaje PREPARE para difundir
    const prepareMessage: ConsensusMessage = {
      type: ConsensusMessageType.PREPARE,
      blockHeight: message.blockHeight,
      blockHash: message.blockHash,
      validator: this.signature.getAddress(),
      view: this.currentView,
      signature: ''
    };

    // Firmar el mensaje
    prepareMessage.signature = this.signature.signMessage(
      JSON.stringify({ ...prepareMessage, signature: undefined })
    );

    // Difundir mensaje Prepare - Fix: Pass the message object instead of height and hash
    await this.broadcastPrepare(prepareMessage);
  }

  /**
   * Fase 2: Prepare - Todos los validadores participan
   * @param message - El mensaje PREPARE de consenso.
   */
  private async handlePrepareMessage(message: ConsensusMessage) {
    // Enqueue message for distributed processing
    await this.queue.enqueueConsensusMessage(message);

    const key = `${message.blockHeight}:${message.blockHash}`;

    // Verificar que hayamos recibido un PRE_PREPARE para este bloque
    if (!this.prePrepareMessages.has(key)) {
      this.logger.warn(`Recibido PREPARE sin PRE_PREPARE previo para ${key}`);
      return;
    }

    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, []);
    }

    // Verificar que no tengamos ya un mensaje de este validador
    const existingMsg = this.prepareMessages.get(key)?.find(m => m.validator === message.validator);
    if (existingMsg) {
      this.logger.debug(`Mensaje PREPARE duplicado de ${message.validator} para ${key}`);
      return;
    }

    this.prepareMessages.get(key)?.push(message);

    // Si alcanzamos el quorum, avanzar a fase COMMIT
    if (this.prepareMessages.get(key)?.length >= this.getRequiredPrepares()) {
      this.logger.log(`Quorum PREPARE alcanzado para bloque ${key}, avanzando a COMMIT`);
      await this.broadcastCommit(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Fase 3: Commit - Validadores confirman que ejecutarán el bloque
   * @param message - El mensaje COMMIT de consenso.
   */
  private async handleCommitMessage(message: ConsensusMessage) {
    // Enqueue message for distributed processing
    await this.queue.enqueueConsensusMessage(message);

    const key = `${message.blockHeight}:${message.blockHash}`;

    // Verificar que hayamos alcanzado la fase PREPARE para este bloque
    if (!this.prepareMessages.has(key) ||
      this.prepareMessages.get(key)?.length < this.getRequiredPrepares()) {
      this.logger.warn(`Recibido COMMIT sin suficientes PREPARE para ${key}`);
      return;
    }

    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, []);
    }

    // Verificar que no tengamos ya un mensaje de este validador
    const existingMsg = this.commitMessages.get(key)?.find(m => m.validator === message.validator);
    if (existingMsg) {
      this.logger.debug(`Mensaje COMMIT duplicado de ${message.validator} para ${key}`);
      return;
    }

    this.commitMessages.get(key)?.push(message);

    // Si alcanzamos el quorum, finalizar el bloque
    if (this.commitMessages.get(key)?.length >= this.getRequiredCommits()) {
      this.logger.log(`Quorum COMMIT alcanzado para bloque ${key}, finalizando`);
      await this.finalizeBlock(message.blockHeight, message.blockHash);
    }
  }

  /**
   * Maneja mensajes de CAMBIO DE VISTA durante fallo del líder
   * @param message - El mensaje VIEW_CHANGE.
   */
  private async handleViewChangeMessage(message: ViewChangeMessage) {
    const { newView } = message;

    // Ignorar mensajes de vistas anteriores o iguales a la actual
    if (newView <= this.currentView) {
      this.logger.debug(`Ignorando VIEW_CHANGE obsoleto para vista ${newView}`);
      return;
    }

    // Encolar para procesamiento distribuido
    await this.queue.enqueueConsensusMessage(message);

    // Almacenar el mensaje
    if (!this.viewChangeMessages.has(newView)) {
      this.viewChangeMessages.set(newView, []);
    }

    this.viewChangeMessages.get(newView)?.push(message);

    // Si no estamos en proceso de cambio de vista, iniciarlo
    if (!this.isViewChanging && newView > this.currentView) {
      await this.initiateViewChange();
    }

    // Verificar si alcanzamos el quorum para cambio de vista
    const messages = this.viewChangeMessages.get(newView) || [];
    if (messages.length >= this.getRequiredQuorum()) {
      await this.completeViewChange(newView, messages);
    }
  }

  /**
   * Maneja mensaje de NUEVA VISTA después de un cambio de primario
   * @param message - El mensaje NEW_VIEW.
   */
  private async handleNewViewMessage(message: NewViewMessage) {
    const { view, viewChangeMessages, preprepareMessages } = message;

    // Verificar que el remitente sea el primario para la nueva vista
    const expectedPrimary = this.activeValidators[view % this.activeValidators.length];
    if (message.validator !== expectedPrimary) {
      this.logger.warn(`NEW_VIEW rechazado: remitente ${message.validator} no es primario para vista ${view}`);
      return;
    }

    // Verificar que la vista sea mayor que la actual
    if (view <= this.currentView) {
      this.logger.debug(`Ignorando NEW_VIEW obsoleto para vista ${view}`);
      return;
    }

    // Enqueue message for distributed processing
    await this.queue.enqueueConsensusMessage(message);

    // Verificar prueba de cambio de vista (que hay suficientes mensajes VIEW_CHANGE)
    const vcMessages: ViewChangeMessage[] = viewChangeMessages.map(m => JSON.parse(m));
    if (vcMessages.length < this.getRequiredQuorum()) {
      this.logger.warn(`NEW_VIEW rechazado: insuficientes mensajes VIEW_CHANGE (${vcMessages.length})`);
      return;
    }

    // Actualizar estado a nueva vista
    this.currentView = view;
    this.isPrimary = this.isPrimaryValidator(view);
    this.isViewChanging = false;

    this.logger.log(`Vista actualizada a ${view} por mensaje NEW_VIEW`);

    // Reiniciar temporizador si no somos primario
    if (!this.isPrimary) {
      this.setupViewChangeTimeout();
    }

    // Procesar mensajes PRE_PREPARE incluidos en NEW_VIEW
    for (const preprepareMsg of preprepareMessages) {
      const msg = JSON.parse(preprepareMsg);
      await this.handlePrePrepareMessage(msg);
    }

    // Publicar evento de cambio de vista
    this.eventEmitter.emit('consensus.viewChanged', {
      newView: this.currentView,
      isPrimary: this.isPrimary,
      source: 'new_view_message'
    });
  }

  /**
   * Procesa un mensaje de consenso recibido de la cola sin reencolarlo
   * @param message Mensaje a procesar
   */
  async processQueuedMessage(message: ConsensusMessage): Promise<void> {
    try {
      if (!this.verifyMessageSignature(message)) {
        this.logger.warn(`Invalid signature in queued consensus message from ${message.validator}`);
        return;
      }

      const key = `${message.blockHeight}:${message.blockHash}`;

      switch (message.type) {
        case ConsensusMessageType.PRE_PREPARE:
          if (!this.prePrepareMessages.has(key)) {
            this.prePrepareMessages.set(key, []);
          }
          this.prePrepareMessages.get(key)?.push(message);
          break;

        case ConsensusMessageType.PREPARE:
          if (!this.prepareMessages.has(key)) {
            this.prepareMessages.set(key, []);
          }
          this.prepareMessages.get(key)?.push(message);

          if (this.prepareMessages.get(key)?.length >= this.getRequiredPrepares()) {
            await this.broadcastCommit(message.blockHeight, message.blockHash);
          }
          break;

        case ConsensusMessageType.COMMIT:
          if (!this.commitMessages.has(key)) {
            this.commitMessages.set(key, []);
          }
          this.commitMessages.get(key)?.push(message);

          if (this.commitMessages.get(key)?.length >= this.getRequiredCommits()) {
            await this.finalizeBlock(message.blockHeight, message.blockHash);
          }
          break;

        case ConsensusMessageType.VIEW_CHANGE:
          const vcMessage = message as ViewChangeMessage;
          if (!this.viewChangeMessages.has(vcMessage.newView)) {
            this.viewChangeMessages.set(vcMessage.newView, []);
          }
          this.viewChangeMessages.get(vcMessage.newView)?.push(vcMessage);

          // Verificar si tenemos quorum para cambio de vista
          if (this.viewChangeMessages.get(vcMessage.newView)?.length >= this.getRequiredQuorum()) {
            await this.completeViewChange(
              vcMessage.newView,
              this.viewChangeMessages.get(vcMessage.newView) || []
            );
          }
          break;

        case ConsensusMessageType.NEW_VIEW:
          // Procesar NEW_VIEW (ya implementado en handleNewViewMessage)
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing queued consensus message: ${error.message}`);
    }
  }

  /**
   * Calcula el quórum requerido (2f + 1).
   */
  private getRequiredQuorum(): number {
    const totalValidators = this.getTotalValidators();
    return Math.floor((totalValidators * 2) / 3) + 1;
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
    return this.activeValidators.length;
  }

  /**
   * Verifies the signature of a consensus message.
   * @param message - The consensus message to verify.
   * @returns True if valid, false otherwise.
   */
  private verifyMessageSignature(message: ConsensusMessage): boolean {
    return this.signature.verifySignature(
      JSON.stringify({ ...message, signature: undefined }),
      message.signature,
      message.validator
    );
  }

  /**
   * Broadcasts a COMMIT message to all validators.
   * @param height - Block height.
   * @param hash - Block hash.
   */
  private async broadcastCommit(height: number, hash: string): Promise<void> {
    const message: ConsensusMessage = {
      type: ConsensusMessageType.COMMIT,
      blockHeight: height,
      blockHash: hash,
      validator: this.signature.getAddress(),
      view: this.currentView,
      signature: ''
    };

    message.signature = this.signature.signMessage(
      JSON.stringify({ ...message, signature: undefined })
    );

    this.logger.log(`Broadcasting COMMIT message for block ${hash}`);

    // use the gateway to broadcast the message
    this.gateway.broadcastConsensusMessage(message);

    // Also enqueue the commit message for local processing
    await this.queue.enqueueConsensusMessage(message);
  }

  /**
   * Finalizes a block when enough COMMIT messages are received.
   * @param height - Block height.
   * @param hash - Block hash.
   */
  private async finalizeBlock(height: number, hash: string) {
    try {
      const block = await this.block.getBlock(hash);
      if (!block) {
        this.logger.error(`No se puede finalizar bloque ${hash}: no encontrado`);
        return;
      }

      // Guardar el bloque y actualizar estado
      await this.block.saveBlock(block);

      // Distribuir recompensa si estamos en una vista estable
      if (!this.isViewChanging) {
        await this.tripcoin.distributeBlockReward(block.index);
      }

      // Actualizar último bloque ejecutado
      this.lastExecutedBlock = Math.max(this.lastExecutedBlock, height);

      // Liberar recursos
      const key = `${height}:${hash}`;
      this.processingBlocks.delete(key);

      // Limpiar mensajes para este bloque (opcional, podría guardarse para análisis)
      this.prePrepareMessages.delete(key);
      this.prepareMessages.delete(key);
      this.commitMessages.delete(key);

      this.logger.log(`✅ Bloque ${hash} finalizado y guardado. Altura: ${height}`);

      // Publicar evento de bloque finalizado
      this.eventEmitter.emit('consensus.blockFinalized', {
        blockHeight: height,
        blockHash: hash
      });
    } catch (error) {
      this.logger.error(`Error finalizando bloque ${hash}: ${error.message}`);
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
   * @param message - The PREPARE message to broadcast.
   */
  private async broadcastPrepare(message: ConsensusMessage): Promise<void> {
    this.logger.log(`Broadcasting PREPARE message for block ${message.blockHash} at height ${message.blockHeight}`);

    // Usar el gateway para difundir el mensaje
    this.gateway.broadcastConsensusMessage(message);

    // Also enqueue the prepare message for local processing
    await this.queue.enqueueConsensusMessage(message);
  }
}
