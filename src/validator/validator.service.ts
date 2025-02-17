import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { ConsensusState, ValidatorInfo, ValidatorStatus } from "./dto/validator.dto";
import { Interval } from "@nestjs/schedule";
import { SignatureService } from "src/signature/signature.service";
import { Socket, io } from 'socket.io-client';
import axios from "axios";

@Injectable()
export class ValidatorService {
    private logger = new Logger(ValidatorService.name);
    private consensusState: ConsensusState;
    private myValidatorInfo: ValidatorInfo;
    private authenticated: boolean = false;
    private authToken: string = null;
    private clientId: string = null;
    private socket: Socket = null;

    constructor(
        private readonly redis: RedisService,
        private readonly signature: SignatureService,
    ) {
        this.initializeValidator();
    }

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

    private async authenticateWithSeedNode() {
        const seedNodes = process.env.SEED_NODES?.split(',') || [];

        for (const seedNode of seedNodes) {
            try {
                this.logger.log(`Iniciando proceso de autenticación con nodo semilla ${seedNode}`);

                // 1. Solicitar nuevo token
                const tokenResponse = await axios.post(`${seedNode}/auth/token`);
                if (!tokenResponse.data?.token) {
                    throw new Error('No se pudo obtener token de autenticación');
                }

                const initialToken = tokenResponse.data.token;

                // 2. Autenticar el token
                const authResponse = await axios.post(`${seedNode}/auth/authenticate`, {
                    token: initialToken
                });

                if (authResponse.data?.clientId) {
                    this.authToken = initialToken;
                    this.clientId = authResponse.data.clientId;
                    this.authenticated = true;

                    this.logger.log(`Autenticación exitosa con nodo semilla ${seedNode}`);
                    this.logger.log(`ClientID asignado: ${this.clientId}`);

                    // 3. Establecer conexión WebSocket
                    await this.establishWebSocketConnection(seedNode);

                    // 4. Sincronizar validadores
                    await this.syncValidatorsFromSeed();
                    break;
                }
            } catch (error) {
                this.logger.error(`Error en autenticación con nodo semilla ${seedNode}: ${error.message}`);
            }
        }

        if (!this.authenticated) {
            this.logger.error('No se pudo autenticar con ningún nodo semilla');
            // Reintentar después de 30 segundos
            setTimeout(() => this.authenticateWithSeedNode(), 30000);
        }
    }

    private async establishWebSocketConnection(seedNode: string) {
        try {
            // Crear conexión Socket.IO con los parámetros requeridos
            this.socket = io(`${seedNode}`, {
                transports: ['websocket'],
                query: {
                    token: this.authToken,
                    role: 'validator'
                }
            });

            this.socket.on('connect', () => {
                this.logger.log('Conexión WebSocket establecida con nodo semilla');
            });

            this.socket.on('peerDiscovery', (data) => {
                this.handlePeerDiscovery(data);
            });

            this.socket.on('disconnect', () => {
                this.logger.warn('Conexión WebSocket perdida con nodo semilla');
                // Reintentar conexión después de 5 segundos
                setTimeout(() => this.establishWebSocketConnection(seedNode), 5000);
            });

            this.socket.on('FAILOVER_INITIATED', () => {
                this.handleFailover();
            });

            this.socket.on('STATE_SYNC', (data) => {
                this.handleStateSync(data);
            });

            // Iniciar heartbeat
            setInterval(() => {
                if (this.socket.connected) {
                    this.socket.emit('heartbeat');
                }
            }, 30000);

        } catch (error) {
            this.logger.error(`Error estableciendo conexión WebSocket: ${error.message}`);
        }
    }

    private handlePeerDiscovery(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Actualizando lista de peers del network');
                // Actualizar lista de peers en el estado local
            }
            if (data.newPeer) {
                this.logger.log(`Nuevo peer conectado: ${data.newPeer.ip}`);
                // Agregar nuevo peer al estado local
            }
            if (data.disconnectedPeer) {
                this.logger.log(`Peer desconectado: ${data.disconnectedPeer}`);
                // Remover peer del estado local
            }
        } catch (error) {
            this.logger.error(`Error procesando peer discovery: ${error.message}`);
        }
    }

    private handleStateSync(data: any) {
        try {
            if (data.peers) {
                this.logger.log('Sincronizando estado con nuevos peers');
                // Actualizar estado local con la nueva información
            }
        } catch (error) {
            this.logger.error(`Error en sincronización de estado: ${error.message}`);
        }
    }

    private handleFailover() {
        this.logger.warn('Failover iniciado por el nodo semilla');
        // Implementar lógica de failover
    }

    private async getValidatorsFromSeed(seedNode: string): Promise<ValidatorInfo[]> {
        // Implementar lógica para obtener validadores del nodo semilla
        // Usar HTTP/WebSocket según configuración
        return [];
    }

    async syncValidatorsFromSeed() {
        try {
            const seedNodes = process.env.SEED_NODES?.split(',') || [];
            for (const seedNode of seedNodes) {
                try {
                    // Intentar obtener lista de validadores del nodo semilla
                    const validators = await this.getValidatorsFromSeed(seedNode);
                    if (validators) {
                        await this.updateValidatorSet(validators);
                        break;
                    }
                } catch (error) {
                    this.logger.warn(`Error al sincronizar con nodo semilla ${seedNode}`);
                }
            }
        } catch (error) {
            this.logger.error('Error en sincronización inicial de validadores');
        }
    }

    @Interval(30000) // Cada 30 segundos
    async updateValidatorSet(newValidators?: ValidatorInfo[]) {
        try {
            // Si no recibimos nuevos validadores, obtenerlos de Redis
            if (!newValidators) {
                const validatorsData = await this.redis.hGetAll('validators');
                newValidators = Object.values(validatorsData).map(v => JSON.parse(v));
            }

            // Actualizar el conjunto de validadores
            this.consensusState.validatorsSet = new Map(
                newValidators.map(v => [v.address, v])
            );

            // Verificar si somos parte del conjunto de validadores
            const amIValidator = this.consensusState.validatorsSet.has(this.myValidatorInfo.address);
            if (amIValidator) {
                this.myValidatorInfo.status = ValidatorStatus.ACTIVE;
            } else {
                this.myValidatorInfo.status = ValidatorStatus.STANDBY;
            }

            await this.redis.hSet(
                'validators',
                this.myValidatorInfo.address,
                JSON.stringify(this.myValidatorInfo)
            );
        } catch (error) {
            this.logger.error(`Error actualizando conjunto de validadores: ${error.message}`);
        }
    }

    @Interval(5000) // Cada 5 segundos
    async participateInConsensus() {
        if (this.myValidatorInfo.status !== ValidatorStatus.ACTIVE) return;

        try {
            // Actualizar estado del validador
            this.myValidatorInfo.lastActive = Date.now();

            // Participar en la ronda de consenso actual
            const isLeader = this.checkIfLeader();
            if (isLeader) {
                await this.proposeNewBlock();
            } else {
                await this.validateProposedBlock();
            }
        } catch (error) {
            this.logger.error(`Error en ronda de consenso: ${error.message}`);
        }
    }

    private checkIfLeader(): boolean {
        // Implementar lógica DPoS para determinar si somos el líder
        // de la ronda actual
        return false;
    }

    private async proposeNewBlock() {
        // Implementar lógica para proponer nuevo bloque cuando somos líder
    }

    private async validateProposedBlock() {
        // Implementar lógica PBFT para validar bloque propuesto
    }
}