import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { ConsensusState, ValidatorInfo, ValidatorStatus } from "./dto/validator.dto";
import { Interval } from "@nestjs/schedule";
import { SignatureService } from "src/signature/signature.service";


@Injectable()
export class ValidatorService {
    private logger = new Logger(ValidatorService.name);
    private consensusState: ConsensusState;
    private myValidatorInfo: ValidatorInfo;

    constructor(
        private readonly redis: RedisService,
        private readonly signature: SignatureService,
    ) {
        this.initializeValidator();
    }

    private async initializeValidator() {
        this.myValidatorInfo = {
            address: this.signature.getAddress(),
            stake: 0, // Inicialmente sin stake
            reputation: 0,
            lastActive: Date.now(),
            publicKey: this.signature.getPublicKey(),
            status: ValidatorStatus.STANDBY
        };

        await this.syncValidatorsFromSeed();
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