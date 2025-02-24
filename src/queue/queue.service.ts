import { Injectable, Logger } from '@nestjs/common';
import { ConsensusService } from 'src/consensus/consensus.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class QueueService {
    private readonly logger = new Logger(QueueService.name);
    private readonly STREAM_NAME = 'consensus_messages';
    private readonly CONSUMER_GROUP = 'consensus_processors';
    private readonly CONSUMER_NAME = `processor-${Math.random().toString(36).substring(2, 10)}`;
    private readonly BATCH_SIZE = 50;
    private isProcessing = false;
    private processingInterval = 50; // milisegundos entre procesamiento de lotes

    constructor(
        private readonly redis: RedisService,
        private readonly consensus: ConsensusService,
    ) { }

    /**
     * Inicializa el stream de Redis y el grupo de consumidores
     */
    private async initializeStream(): Promise<void> {
        try {
            // Verifica si el stream existe, si no, créalo con un mensaje dummy
            const streamExists = await this.redis.get(`stream-exists:${this.STREAM_NAME}`);
            if (!streamExists) {
                await this.redis.set(`stream-exists:${this.STREAM_NAME}`, 'true');
                // Agregar mensaje dummy para inicializar el stream
                const initMessage = { init: 'true' };
                await this.addMessageToStream(initMessage as any);
            }

            // Crea el grupo de consumidores si no existe
            try {
                // Intenta crear el grupo de consumidores
                // Nota: Esto requiere un cliente Redis con xgroup.create implementado
                // Usa un comando raw en vez de métodos de alto nivel
                await this.redis.redisCommand('XGROUP', 'CREATE', this.STREAM_NAME, this.CONSUMER_GROUP, '0', 'MKSTREAM');
            } catch (error) {
                // Si el grupo ya existe, Redis arrojará un error
                if (!error.message.includes('BUSYGROUP')) {
                    throw error;
                }
            }

            this.logger.log(`Inicializado stream ${this.STREAM_NAME} con grupo ${this.CONSUMER_GROUP}`);
        } catch (error) {
            this.logger.error(`Error inicializando Redis Stream: ${error.message}`);
        }
    }

    /**
     * Agrega un mensaje de consenso al stream de Redis
     * @param message Mensaje de consenso a encolar
     */
    async enqueueConsensusMessage(message: ConsensusMessage): Promise<void> {
        try {
            await this.addMessageToStream(message);
            this.logger.debug(`Mensaje de tipo ${message.type} para bloque ${message.blockHash} encolado correctamente`);
        } catch (error) {
            this.logger.error(`Error al encolar mensaje de consenso: ${error.message}`);
        }
    }

    /**
     * Método auxiliar para agregar un mensaje al stream
     */
    private async addMessageToStream(message: ConsensusMessage): Promise<void> {
        const messageId = '*'; // Permite que Redis genere un ID automáticamente

        // Convertimos el mensaje a un objeto plano para Redis
        const entry = {
            'message': JSON.stringify(message)
        };

        // Usamos un comando raw de Redis para XADD
        await this.redis.redisCommand('XADD', this.STREAM_NAME, messageId, ...this.flattenObject(entry));
    }

    /**
     * Convierte un objeto en una lista plana de pares clave-valor para Redis
     */
    private flattenObject(obj: Record<string, any>): string[] {
        const result: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
            result.push(key, value);
        }
        return result;
    }

    /**
     * Inicia el procesamiento por lotes de mensajes
     */
    private startBatchProcessing(): void {
        setInterval(() => {
            if (!this.isProcessing) {
                this.processBatch().catch(err =>
                    this.logger.error(`Error procesando lote de mensajes: ${err.message}`)
                );
            }
        }, this.processingInterval);
    }

    /**
     * Procesa un lote de mensajes del stream
     */
    private async processBatch(): Promise<void> {
        this.isProcessing = true;
        try {
            // Lee mensajes pendientes usando XREADGROUP
            const result = await this.redis.redisCommand(
                'XREADGROUP', 'GROUP', this.CONSUMER_GROUP, this.CONSUMER_NAME,
                'COUNT', this.BATCH_SIZE.toString(), 'BLOCK', '100', 'STREAMS',
                this.STREAM_NAME, '>'
            );

            if (!result) {
                this.isProcessing = false;
                return;
            }

            // Extraer los mensajes del resultado
            const stream = result[0];
            const entries = stream[1];

            if (entries.length === 0) {
                this.isProcessing = false;
                return;
            }

            this.logger.log(`Procesando lote de ${entries.length} mensajes`);

            // Procesar cada mensaje
            const promises = entries.map(async entry => {
                const [messageId, fields] = entry;
                // fields viene como [key1, value1, key2, value2...]
                const message = JSON.parse(fields[1]);

                try {
                    await this.consensus.handleConsensusMessage(message);
                    // Confirmar procesamiento exitoso (ACK)
                    await this.redis.redisCommand('XACK', this.STREAM_NAME, this.CONSUMER_GROUP, messageId);
                } catch (error) {
                    this.logger.error(`Error procesando mensaje ${messageId}: ${error.message}`);
                    // Podríamos implementar lógica de reintento aquí
                }
            });

            await Promise.all(promises);

        } catch (error) {
            this.logger.error(`Error en procesamiento por lotes: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Método para obtener estadísticas de la cola
     */
    async getQueueStats(): Promise<any> {
        try {
            // Obtener información sobre la longitud del stream
            const streamInfo = await this.redis.redisCommand('XINFO', 'STREAM', this.STREAM_NAME);

            // Obtener información sobre los grupos de consumidores
            const groupInfo = await this.redis.redisCommand('XINFO', 'GROUPS', this.STREAM_NAME);

            // Formatea los resultados para facilitar su lectura
            const formattedStreamInfo: Record<string, any> = {};
            for (let i = 0; i < streamInfo.length; i += 2) {
                formattedStreamInfo[streamInfo[i]] = streamInfo[i + 1];
            }

            return {
                streamInfo: {
                    length: formattedStreamInfo.length,
                    firstEntry: formattedStreamInfo['first-entry'],
                    lastEntry: formattedStreamInfo['last-entry'],
                },
                consumerGroups: groupInfo.map((group: any[]) => {
                    const groupObj: Record<string, any> = {};
                    for (let i = 0; i < group.length; i += 2) {
                        groupObj[group[i]] = group[i + 1];
                    }
                    return {
                        name: groupObj.name,
                        consumers: groupObj.consumers,
                        pending: groupObj.pending,
                        lastDeliveredId: groupObj['last-delivered-id'],
                    };
                }),
            };
        } catch (error) {
            this.logger.error(`Error obteniendo estadísticas de la cola: ${error.message}`);
            return { error: error.message };
        }
    }
}
