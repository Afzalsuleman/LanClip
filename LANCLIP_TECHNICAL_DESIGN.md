# LANClip - Client-Side Technical Design

**Version:** 2.0  
**Date:** January 2026  
**Author:** Senior Technical Lead  
**Status:** POC Focus - Simplified Approach

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [POC Approach](#2-poc-approach)
3. [Client-Side Architecture](#3-client-side-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Component Design](#5-component-design)
6. [LAN P2P Protocol](#6-lan-p2p-protocol)
7. [Development Roadmap](#7-development-roadmap)
8. [Future Integration](#8-future-integration)

---

## 1. Executive Summary

### 1.1 Revised Focus
This document focuses **exclusively on the client-side components**:
- **Chrome Extension** (Manifest V3)
- **Local Background Service** (Node.js)
- **LAN P2P Clipboard Sync** (mDNS + WebSocket)

### 1.2 Backend Services (Black Box)
The following components will be developed by separate teams:
- **REST API Server** (Java/Go) - See separate PRD
- **WebSocket Relay Server** (TBD) - See separate PRD

### 1.3 POC Philosophy
**Start Simple, Iterate Fast:**
1. ✅ Core Feature First: Device A → Device B clipboard sync on LAN
2. ✅ No Authentication (POC phase)
3. ✅ No Encryption (POC phase)
4. ✅ Prove the concept works
5. ⏭️ Then add security, auth, cloud sync, etc.

---

## 2. POC Approach

### 2.1 POC Goals
- Detect clipboard changes on Device A
- Broadcast to Device B on same LAN
- Update clipboard on Device B
- **Total Time:** 1-2 weeks

### 2.2 POC Scope

#### ✅ In Scope (POC)
- Clipboard monitoring (text only)
- mDNS device discovery on LAN
- Direct WebSocket connection between devices
- Plain text transmission (no encryption)
- Simple device pairing (no auth)
- Chrome extension popup to show status

#### ❌ Out of Scope (POC)
- User authentication
- Data encryption
- Cloud sync
- Clipboard history
- Database storage
- File/image sync
- Payment/subscriptions

### 2.3 POC Success Criteria
- [ ] Copy text on Device A
- [ ] Text appears on Device B clipboard within 500ms
- [ ] Works across Mac, Windows, Linux
- [ ] Minimal setup (install extension + background service)

---

## 3. Client-Side Architecture

### 3.1 High-Level Architecture (POC)

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL NETWORK (LAN)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │   Device A       │              │   Device B       │    │
│  │   (Mac/Win)      │              │   (Mac/Win)      │    │
│  │                  │              │                  │    │
│  │ ┌──────────────┐ │              │ ┌──────────────┐ │    │
│  │ │   Chrome     │ │              │ │   Chrome     │ │    │
│  │ │  Extension   │ │              │ │  Extension   │ │    │
│  │ └──────┬───────┘ │              │ └──────┬───────┘ │    │
│  │        │         │              │        │         │    │
│  │        │ Native  │              │        │ Native  │    │
│  │        │ Msg     │              │        │ Msg     │    │
│  │        │         │              │        │         │    │
│  │ ┌──────▼───────┐ │              │ ┌──────▼───────┐ │    │
│  │ │   Local      │ │              │ │   Local      │ │    │
│  │ │  Service     │◄──────────────►│ │  Service     │ │    │
│  │ │  (Node.js)   │ │  WebSocket   │ │  (Node.js)   │ │    │
│  │ │              │ │   (Direct)   │ │              │ │    │
│  │ └──────┬───────┘ │              │ └──────┬───────┘ │    │
│  │        │         │              │        │         │    │
│  │ ┌──────▼───────┐ │              │ ┌──────▼───────┐ │    │
│  │ │  Clipboard   │ │              │ │  Clipboard   │ │    │
│  │ │   Monitor    │ │              │ │   Monitor    │ │    │
│  │ └──────────────┘ │              │ └──────────────┘ │    │
│  │                  │              │                  │    │
│  │  mDNS: _lanclip._tcp.local     │                  │    │
│  │  Port: 8765                     │  Port: 8765     │    │
│  └──────────────────┘              └──────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Communication Flow (POC)

```
Device A                                     Device B
   │                                            │
   │ 1. Start Service                           │ 1. Start Service
   │    ↓                                       │    ↓
   │ 2. Broadcast mDNS                          │ 2. Broadcast mDNS
   │    "_lanclip._tcp.local"                   │    "_lanclip._tcp.local"
   │                                            │
   │ ←────────── 3. Discover Each Other ────────→
   │                                            │
   │ 4. Establish WebSocket Connection          │
   │ ────────────────────────────────────────→  │
   │                                            │
   │ 5. User copies "Hello World"               │
   │    ↓                                       │
   │ 6. Clipboard monitor detects change        │
   │    ↓                                       │
   │ 7. Send via WebSocket                      │
   │    { type: "clipboard", data: "Hello World" }
   │ ────────────────────────────────────────→  │
   │                                            │ 8. Receive message
   │                                            │    ↓
   │                                            │ 9. Update clipboard
   │                                            │    ↓
   │                                            │ 10. User pastes "Hello World"
```

---

## 4. Technology Stack

### 4.1 Chrome Extension (Client)

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Framework** | React 18 | Simple, familiar, fast development |
| **Build Tool** | Vite | Fast builds, HMR for extension dev |
| **UI** | Tailwind CSS | Quick styling for POC |
| **Extension Type** | Manifest V3 | Chrome requirement |
| **Communication** | Native Messaging API | Extension ↔ Local Service |

### 4.2 Local Background Service

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Runtime** | Node.js 20 LTS | Cross-platform, easy to distribute |
| **Framework** | Express.js (minimal) | Lightweight HTTP server |
| **WebSocket** | `ws` library | Simple, no overhead |
| **Clipboard** | `clipboardy` | Cross-platform clipboard access |
| **mDNS** | `bonjour` | Easy LAN discovery |
| **Language** | TypeScript | Type safety, better DX |

### 4.3 Development Tools

| Tool | Technology |
|------|-----------|
| **Package Manager** | pnpm |
| **Monorepo** | pnpm workspaces |
| **Linting** | ESLint + Prettier |
| **Version Control** | Git + GitHub |

---

## 5. Component Design

### 5.1 Project Structure

```
lanclip/
├── packages/
│   ├── extension/              # Chrome Extension
│   │   ├── manifest.json
│   │   ├── src/
│   │   │   ├── background/
│   │   │   │   └── service-worker.ts
│   │   │   ├── popup/
│   │   │   │   ├── App.tsx
│   │   │   │   └── index.tsx
│   │   │   └── shared/
│   │   │       ├── types.ts
│   │   │       └── messaging.ts
│   │   ├── public/
│   │   │   └── icons/
│   │   └── package.json
│   │
│   ├── local-service/          # Background Service
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── clipboard/
│   │   │   │   └── monitor.ts
│   │   │   ├── network/
│   │   │   │   ├── mdns-discovery.ts
│   │   │   │   └── websocket-server.ts
│   │   │   ├── messaging/
│   │   │   │   └── native-host.ts
│   │   │   └── utils/
│   │   │       └── logger.ts
│   │   ├── installer/
│   │   │   ├── macos/
│   │   │   └── windows/
│   │   └── package.json
│   │
│   └── shared/                 # Shared types/utils
│       ├── src/
│       │   └── types.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### 5.2 Chrome Extension Components

#### manifest.json (Manifest V3)
```json
{
  "manifest_version": 3,
  "name": "LANClip - POC",
  "version": "0.1.0",
  "description": "Clipboard sync across devices on LAN",
  
  "permissions": [
    "nativeMessaging",
    "storage"
  ],
  
  "background": {
    "service_worker": "background/service-worker.js"
  },
  
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### Background Service Worker
```typescript
// background/service-worker.ts

// Connect to native messaging host
let nativePort: chrome.runtime.Port | null = null;

// Connect to local service
function connectToNativeHost() {
  nativePort = chrome.runtime.connectNative('com.lanclip.local');
  
  nativePort.onMessage.addListener((message) => {
    console.log('Received from local service:', message);
    
    if (message.type === 'clipboard.update') {
      // Forward to popup if open
      chrome.runtime.sendMessage(message);
    }
    
    if (message.type === 'devices.list') {
      // Update device list
      chrome.storage.local.set({ devices: message.devices });
    }
  });
  
  nativePort.onDisconnect.addListener(() => {
    console.error('Disconnected from local service');
    nativePort = null;
    // Retry connection after 5 seconds
    setTimeout(connectToNativeHost, 5000);
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  connectToNativeHost();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get.devices' && nativePort) {
    nativePort.postMessage({ type: 'devices.request' });
  }
});
```

#### Popup UI
```typescript
// popup/App.tsx

import { useEffect, useState } from 'react';

interface Device {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline';
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get device list from storage
    chrome.storage.local.get(['devices'], (result) => {
      if (result.devices) {
        setDevices(result.devices);
      }
    });

    // Listen for updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'devices.list') {
        setDevices(message.devices);
      }
      
      if (message.type === 'clipboard.update') {
        setIsConnected(true);
      }
    });

    // Request device list
    chrome.runtime.sendMessage({ type: 'get.devices' });
  }, []);

  return (
    <div className="w-80 p-4">
      <h1 className="text-xl font-bold mb-4">LANClip POC</h1>
      
      <div className="mb-4">
        <div className={`flex items-center gap-2 ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-gray-400'}`}></div>
          <span>{isConnected ? 'Connected' : 'Waiting for connection...'}</span>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Devices on Network</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-500">No devices found</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium text-sm">{device.name}</div>
                  <div className="text-xs text-gray-500">{device.ip}</div>
                </div>
                <div className={`text-xs ${device.status === 'online' ? 'text-green-600' : 'text-gray-400'}`}>
                  {device.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

### 5.3 Local Background Service Components

#### Main Entry Point
```typescript
// src/main.ts

import { ClipboardMonitor } from './clipboard/monitor';
import { MDNSDiscovery } from './network/mdns-discovery';
import { WebSocketServer } from './network/websocket-server';
import { NativeMessagingHost } from './messaging/native-host';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting LANClip Local Service...');

  // 1. Start WebSocket server for P2P communication
  const wsServer = new WebSocketServer(8765);
  await wsServer.start();
  logger.info('WebSocket server started on port 8765');

  // 2. Start mDNS discovery
  const mdns = new MDNSDiscovery('_lanclip._tcp.local', 8765);
  await mdns.start();
  logger.info('mDNS discovery started');

  // 3. Start clipboard monitoring
  const clipboard = new ClipboardMonitor();
  clipboard.on('change', async (text: string) => {
    logger.info('Clipboard changed, broadcasting to peers...');
    wsServer.broadcast({ type: 'clipboard.update', data: text });
  });
  clipboard.start();
  logger.info('Clipboard monitoring started');

  // 4. Start native messaging host for Chrome extension
  const nativeHost = new NativeMessagingHost();
  nativeHost.on('message', (message) => {
    if (message.type === 'devices.request') {
      const devices = mdns.getDiscoveredDevices();
      nativeHost.send({ type: 'devices.list', devices });
    }
  });
  nativeHost.start();
  logger.info('Native messaging host started');

  // Handle incoming clipboard updates from peers
  wsServer.on('message', (data) => {
    if (data.type === 'clipboard.update') {
      logger.info('Received clipboard update from peer');
      clipboard.setClipboard(data.data);
      // Notify extension
      nativeHost.send({ type: 'clipboard.update', data: data.data });
    }
  });

  logger.info('LANClip service running successfully!');
}

main().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});
```

#### Clipboard Monitor
```typescript
// src/clipboard/monitor.ts

import clipboardy from 'clipboardy';
import { EventEmitter } from 'events';

export class ClipboardMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private lastContent: string = '';
  private pollInterval: number = 500; // 500ms

  start() {
    this.intervalId = setInterval(() => {
      this.checkClipboard();
    }, this.pollInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkClipboard() {
    try {
      const currentContent = await clipboardy.read();
      
      if (currentContent !== this.lastContent && currentContent.length > 0) {
        this.lastContent = currentContent;
        this.emit('change', currentContent);
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }

  async setClipboard(text: string) {
    try {
      this.lastContent = text; // Prevent triggering own change event
      await clipboardy.write(text);
    } catch (error) {
      console.error('Error writing to clipboard:', error);
    }
  }
}
```

#### mDNS Discovery
```typescript
// src/network/mdns-discovery.ts

import bonjour from 'bonjour';
import os from 'os';

export interface DiscoveredDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: 'online' | 'offline';
}

export class MDNSDiscovery {
  private bonjour: any;
  private service: any;
  private devices: Map<string, DiscoveredDevice> = new Map();
  private serviceName: string;
  private port: number;

  constructor(serviceName: string, port: number) {
    this.serviceName = serviceName;
    this.port = port;
    this.bonjour = bonjour();
  }

  async start() {
    // Get device name
    const deviceName = os.hostname();

    // Publish this device
    this.service = this.bonjour.publish({
      name: deviceName,
      type: 'lanclip',
      port: this.port,
    });

    // Discover other devices
    this.bonjour.find({ type: 'lanclip' }, (service: any) => {
      if (service.name !== deviceName) {
        const device: DiscoveredDevice = {
          id: service.fqdn,
          name: service.name,
          ip: service.referer.address,
          port: service.port,
          status: 'online',
        };
        
        this.devices.set(service.fqdn, device);
        console.log('Discovered device:', device);
      }
    });
  }

  stop() {
    if (this.service) {
      this.service.stop();
    }
    this.bonjour.destroy();
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.devices.values());
  }
}
```

#### WebSocket Server
```typescript
// src/network/websocket-server.ts

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class WebSocketServer extends EventEmitter {
  private wss: WSServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number;

  constructor(port: number) {
    super();
    this.port = port;
  }

  async start() {
    this.wss = new WSServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New peer connected');
      this.clients.add(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Peer disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}
```

#### Native Messaging Host
```typescript
// src/messaging/native-host.ts

import { EventEmitter } from 'events';

export class NativeMessagingHost extends EventEmitter {
  start() {
    // Read from stdin
    process.stdin.on('data', (buffer) => {
      try {
        const messageLength = buffer.readUInt32LE(0);
        const messageContent = buffer.slice(4, 4 + messageLength).toString();
        const message = JSON.parse(messageContent);
        this.emit('message', message);
      } catch (error) {
        console.error('Error parsing native message:', error);
      }
    });
  }

  send(message: any) {
    const messageString = JSON.stringify(message);
    const messageBuffer = Buffer.from(messageString);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

    process.stdout.write(lengthBuffer);
    process.stdout.write(messageBuffer);
  }
}
```

---

## 6. LAN P2P Protocol

### 6.1 Message Format (POC - Simple JSON)

```typescript
// Message Types

// Clipboard Update
{
  type: 'clipboard.update',
  data: string,              // Plain text content
  timestamp: number,         // Unix timestamp
  deviceId: string           // Source device identifier
}

// Device Discovery
{
  type: 'device.announce',
  deviceId: string,
  deviceName: string,
  ip: string,
  port: number
}

// Heartbeat
{
  type: 'ping',
  timestamp: number
}

{
  type: 'pong',
  timestamp: number
}
```

### 6.2 Connection Flow

1. **Service Startup**
   - Start WebSocket server on port 8765
   - Broadcast mDNS service announcement
   - Listen for other devices

2. **Device Discovery**
   - Receive mDNS announcements from peers
   - Establish WebSocket connection to discovered devices
   - Exchange device info

3. **Clipboard Sync**
   - Monitor local clipboard for changes
   - On change, broadcast to all connected peers
   - Receive updates from peers and update local clipboard

---

## 7. Development Roadmap

### Week 1: POC Foundation

#### Day 1-2: Project Setup
- [ ] Initialize monorepo with pnpm
- [ ] Set up TypeScript configs
- [ ] Create basic folder structure
- [ ] Set up ESLint + Prettier

#### Day 3-4: Local Background Service
- [ ] Implement clipboard monitoring (text only)
- [ ] Create WebSocket server
- [ ] Test clipboard detection and WebSocket communication locally

#### Day 5-7: mDNS Discovery & P2P
- [ ] Implement mDNS broadcasting and discovery
- [ ] Establish WebSocket connections between discovered devices
- [ ] Test clipboard sync between 2 devices on LAN
- [ ] Debug and fix issues

### Week 2: Chrome Extension & Polish

#### Day 1-3: Chrome Extension
- [ ] Create Manifest V3 extension scaffold
- [ ] Implement native messaging host
- [ ] Build popup UI to show device list
- [ ] Test extension ↔ local service communication

#### Day 4-5: Integration & Testing
- [ ] End-to-end testing (copy on Device A, paste on Device B)
- [ ] Test on Mac, Windows, Linux
- [ ] Handle edge cases (rapid clipboard changes, reconnection)
- [ ] Performance testing (latency measurement)

#### Day 6-7: Documentation & Demo
- [ ] Write installation guide
- [ ] Create demo video
- [ ] Document setup process
- [ ] Prepare POC demo for review

### POC Deliverable
✅ Working clipboard sync on LAN (text only)  
✅ Chrome extension showing connected devices  
✅ Simple installation process  
✅ Sub-500ms sync latency  

---

## 8. Future Integration

### 8.1 Backend Services (Post-POC)

Once POC is validated, the client will integrate with:

#### REST API Server (Java/Go - Separate Team)
- User authentication
- Device management
- Subscription handling
- Clipboard history storage
- **Integration Point:** HTTP REST endpoints
- **PRD:** See `REST_API_PRD.md`

#### WebSocket Relay Server (TBD - Separate Team)
- Cloud-based message relay
- Cross-internet clipboard sync
- Room management
- **Integration Point:** WebSocket WSS connection
- **PRD:** See `WEBSOCKET_RELAY_PRD.md`

### 8.2 Future Enhancements (Post-POC)

After POC validation:
1. **Add Encryption** - AES-256-GCM for clipboard data
2. **Add Authentication** - JWT tokens from REST API
3. **Cloud Sync** - Connect to WebSocket relay server
4. **Clipboard History** - Store locally + sync to cloud
5. **File/Image Sync** - Extend beyond text
6. **Team Features** - Shared clipboard rooms

---

## 9. Installation & Setup (POC)

### 9.1 Prerequisites
- Node.js 20+
- Chrome Browser
- Same LAN network for all devices

### 9.2 Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/your-org/lanclip.git
cd lanclip

# 2. Install dependencies
pnpm install

# 3. Build local service
cd packages/local-service
pnpm build

# 4. Run local service
pnpm start

# 5. Build extension (in another terminal)
cd packages/extension
pnpm build

# 6. Load extension in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select packages/extension/dist folder

# 7. Repeat steps 3-6 on second device
```

---

## 10. Testing the POC

### 10.1 Manual Test Cases

**Test 1: Basic Clipboard Sync**
1. Start local service on both devices
2. Load extension on both devices
3. Copy text "Hello from Device A" on Device A
4. Paste on Device B
5. ✅ Expected: "Hello from Device A" appears

**Test 2: Bidirectional Sync**
1. Copy text "Response from Device B" on Device B
2. Paste on Device A
3. ✅ Expected: "Response from Device B" appears

**Test 3: Rapid Changes**
1. Copy multiple texts rapidly on Device A
2. Verify all changes propagate to Device B
3. ✅ Expected: Final clipboard content matches

**Test 4: Device Discovery**
1. Open extension popup on Device A
2. ✅ Expected: Device B appears in list with "online" status

**Test 5: Reconnection**
1. Stop local service on Device B
2. Verify Device A shows Device B as "offline"
3. Restart service on Device B
4. ✅ Expected: Device B reconnects automatically

---

## 11. Known Limitations (POC)

- ✅ Text only (no images, files)
- ✅ LAN only (no internet sync)
- ✅ No encryption (data sent as plain text)
- ✅ No authentication (anyone on LAN can connect)
- ✅ No persistence (clipboard history not saved)
- ✅ No conflict resolution (last write wins)

**These will be addressed post-POC validation.**

---

## 12. Success Metrics (POC)

- [ ] ✅ Clipboard sync works reliably (99%+ success rate)
- [ ] ✅ Sync latency <500ms on LAN
- [ ] ✅ Works on macOS, Windows, Linux
- [ ] ✅ Simple installation (<5 minutes)
- [ ] ✅ Zero crashes during 1-hour continuous testing
- [ ] ✅ Memory usage <50MB
- [ ] ✅ Positive feedback from initial testers

---

**Next Steps:**
1. Review this simplified design
2. Review backend PRDs (REST API, WebSocket Relay)
3. Set up development environment
4. Begin Week 1 implementation

---

**Document Version:** 2.0  
**Last Updated:** January 2026  
**Status:** POC Focus - Ready for Development  
**Focus:** Client-Side Only (Extension + Local Service)
