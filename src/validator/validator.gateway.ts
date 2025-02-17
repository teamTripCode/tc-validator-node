import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { RedisService } from "../redis/redis.service";

@WebSocketGateway({ transports: ["websocket"], cors: true })
export class ValidatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger(ValidatorGateway.name);
  private connectedValidators: Map<string, Socket> = new Map();

  constructor(private readonly redisService: RedisService) { }

  async handleConnection(client: Socket) {
    const { token, role } = client.handshake.query;

    if (!token || role !== "validator") {
      this.logger.warn(`Conexión rechazada: Token inválido o rol incorrecto`);
      client.disconnect();
      return;
    }

    this.connectedValidators.set(client.id, client);
    this.logger.log(`Nuevo validador conectado: ${client.id}`);

    // Guardar el nuevo validador en Redis
    await this.redisService.hSet("validatorPeers", client.id, client.handshake.address);

    // Notificar a todos los validadores sobre el nuevo nodo
    this.server.emit("peerDiscovery", { newPeer: client.id });
  }

  async handleDisconnect(client: Socket) {
    this.connectedValidators.delete(client.id);
    this.logger.warn(`Validador desconectado: ${client.id}`);

    // Eliminar el validador de Redis
    await this.redisService.removeValidatorPeer(client.id);

    // Notificar a todos los validadores sobre la desconexión
    this.server.emit("peerDiscovery", { disconnectedPeer: client.id });
  }

  @SubscribeMessage("heartbeat")
  async handleHeartbeat(client: Socket) {
    this.logger.log(`Heartbeat recibido de: ${client.id}`);
  }

  @SubscribeMessage("STATE_SYNC")
  async handleStateSync(client: Socket, data: any) {
    this.logger.log(`Sincronización de estado recibida de: ${client.id}`);
    this.server.emit("STATE_SYNC", data);
  }

  @SubscribeMessage("FAILOVER_INITIATED")
  async handleFailover(client: Socket) {
    this.logger.warn(`Failover iniciado por: ${client.id}`);
    this.server.emit("FAILOVER_INITIATED");
  }
}
