// WebSocket P2P server + local extension bridge
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { Device, WebSocketMessage } from '@lanclip/shared';
import { logger } from '../utils/logger.js';

export class WebSocketServer extends EventEmitter {
  private wss: WSServer | null = null;
  // Remote peers (other LANClip devices)
  private peers: Map<string, WebSocket> = new Map();
  // Local clients (Chrome extension on same machine)
  private localClients: Set<WebSocket> = new Set();
  private port: number;

  constructor(port: number) {
    super();
    this.port = port;
  }

  async start() {
    this.wss = new WSServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress ?? '';
      const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

      if (isLocal) {
        // ── Chrome Extension Client ──────────────────────────────────
        logger.info('🔌 Chrome extension connected');
        this.localClients.add(ws);

        // Send current status immediately
        this.sendStatusToClient(ws);

        ws.on('message', (data: Buffer) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            if (message.type === 'get_status') {
              this.sendStatusToClient(ws);
            } else {
              // Extension sending clipboard → broadcast to peers
              this.emit('message', message);
              this.broadcast(message);
            }
          } catch (error) {
            logger.error('Invalid message from extension:', error);
          }
        });

        ws.on('close', () => {
          logger.info('🔌 Chrome extension disconnected');
          this.localClients.delete(ws);
        });

        ws.on('error', () => this.localClients.delete(ws));
      } else {
        // ── Remote Peer (LANClip on another device) ──────────────────
        logger.info(`New peer connected from ${clientIp}`);

        // Store the inbound peer connection by IP
        const peerId = `inbound-${clientIp}`;
        this.peers.set(peerId, ws);
        this.notifyExtensionPeerChange();

        ws.on('message', (data: Buffer) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            // Forward to extension
            this.broadcastToLocalClients(message);
            // Emit for main.ts to handle (e.g. write to local clipboard)
            this.emit('message', message);
          } catch (error) {
            logger.error('Invalid message received:', error);
          }
        });

        ws.on('close', () => {
          logger.info(`Peer disconnected: ${clientIp}`);
          this.peers.delete(peerId);
          this.notifyExtensionPeerChange();
        });

        ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          this.peers.delete(peerId);
        });
      }
    });

    logger.info(`WebSocket server listening on port ${this.port}`);
  }

  // Send status message to a specific local client
  private sendStatusToClient(ws: WebSocket) {
    const peerNames = Array.from(this.peers.keys());
    const msg = JSON.stringify({
      type: 'status',
      payload: { peers: peerNames },
    });
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }

  // Notify all extension clients about peer change
  private notifyExtensionPeerChange() {
    const peerNames = Array.from(this.peers.keys());
    const msg = JSON.stringify({
      type: 'status',
      payload: { peers: peerNames },
    });
    for (const client of this.localClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  }

  // Forward a message to all local extension clients
  private broadcastToLocalClients(message: WebSocketMessage) {
    const data = JSON.stringify(message);
    for (const client of this.localClients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  broadcast(message: WebSocketMessage) {
    const data = JSON.stringify(message);
    this.peers.forEach((peer) => {
      if (peer.readyState === WebSocket.OPEN) {
        peer.send(data);
      }
    });
    // Also forward to local extension clients so they see what was sent
    this.broadcastToLocalClients(message);
  }

  broadcastToPeer(peerId: string, message: WebSocketMessage) {
    const peer = this.peers.get(peerId);
    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify(message));
    }
  }

  connectToPeer(device: Device) {
    if (this.peers.has(device.id)) {
      logger.debug(`Already connected to ${device.name}`);
      return;
    }

    try {
      const ws = new WebSocket(`ws://${device.ip}:${device.port}`);

      ws.on('open', () => {
        logger.info(`✅ Connected to peer: ${device.name} (${device.ip}:${device.port})`);
        this.peers.set(device.id, ws);
        this.notifyExtensionPeerChange();
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          // Forward clipboard to extension
          this.broadcastToLocalClients(message);
          this.emit('message', message);
        } catch (error) {
          logger.error('Invalid message from peer:', error);
        }
      });

      ws.on('close', () => {
        logger.info(`Peer connection closed: ${device.name}`);
        this.peers.delete(device.id);
        this.notifyExtensionPeerChange();
      });

      ws.on('error', (error) => {
        logger.error(`Error connecting to ${device.name}:`, error.message);
        this.peers.delete(device.id);
      });
    } catch (error) {
      logger.error(`Failed to connect to ${device.name}:`, error);
    }
  }

  disconnectPeer(deviceId: string) {
    const peer = this.peers.get(deviceId);
    if (peer) {
      peer.close();
      this.peers.delete(deviceId);
      this.notifyExtensionPeerChange();
    }
  }

  stop() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.localClients.forEach((c) => c.close());
    this.localClients.clear();
    if (this.wss) {
      this.wss.close();
      logger.info('WebSocket server stopped');
    }
  }
}
