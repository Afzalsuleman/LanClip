// WebSocket P2P server
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { Device, WebSocketMessage } from '@lanclip/shared';
import { logger } from '../utils/logger.js';

export class WebSocketServer extends EventEmitter {
  private wss: WSServer | null = null;
  private peers: Map<string, WebSocket> = new Map();
  private port: number;

  constructor(port: number) {
    super();
    this.port = port;
  }

  async start() {
    this.wss = new WSServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`New peer connected from ${clientIp}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          logger.error('Invalid message received:', error);
        }
      });

      ws.on('close', () => {
        logger.info(`Peer disconnected: ${clientIp}`);
        // Remove from peers map
        for (const [id, socket] of this.peers.entries()) {
          if (socket === ws) {
            this.peers.delete(id);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info(`WebSocket server listening on port ${this.port}`);
  }

  broadcast(message: WebSocketMessage) {
    const data = JSON.stringify(message);
    this.peers.forEach((peer) => {
      if (peer.readyState === WebSocket.OPEN) {
        peer.send(data);
      }
    });
  }

  broadcastToPeer(peerId: string, message: WebSocketMessage) {
    const peer = this.peers.get(peerId);
    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify(message));
    }
  }

  connectToPeer(device: Device) {
    // Don't connect if already connected
    if (this.peers.has(device.id)) {
      logger.debug(`Already connected to ${device.name}`);
      return;
    }

    try {
      const ws = new WebSocket(`ws://${device.ip}:${device.port}`);

      ws.on('open', () => {
        logger.info(`✅ Connected to peer: ${device.name} (${device.ip}:${device.port})`);
        this.peers.set(device.id, ws);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          logger.error('Invalid message from peer:', error);
        }
      });

      ws.on('close', () => {
        logger.info(`Peer connection closed: ${device.name}`);
        this.peers.delete(device.id);
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
    }
  }

  stop() {
    // Close all peer connections
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();

    // Close server
    if (this.wss) {
      this.wss.close();
      logger.info('WebSocket server stopped');
    }
  }
}
