// Shared types for LANClip POC

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: 'online' | 'offline';
  lastSeen?: number;
}

export interface ClipboardMessage {
  type: 'clipboard.update' | 'clipboard.sync';
  payload: ClipboardPayload;
}

export interface ClipboardPayload {
  id: string;
  data: string; // Plain text content (POC - no encryption)
  contentType: 'text';
  timestamp: number;
  sourceDeviceId: string;
}

export interface DeviceAnnounceMessage {
  type: 'device.announce';
  payload: {
    deviceId: string;
    deviceName: string;
    ip: string;
    port: number;
  };
}

export interface DeviceListMessage {
  type: 'devices.list';
  devices: Device[];
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export type WebSocketMessage =
  | ClipboardMessage
  | DeviceAnnounceMessage
  | DeviceListMessage
  | PingMessage
  | PongMessage;

// Native messaging types (Extension <-> Local Service)
export interface NativeMessage {
  type: 'clipboard.update' | 'devices.request' | 'devices.list';
  payload?: unknown;
}

export interface DevicesRequestMessage {
  type: 'devices.request';
}

export interface DevicesResponseMessage {
  type: 'devices.list';
  devices: Device[];
}
