# LANClip - Cross-Device Clipboard Sync

> **Status:** POC Phase - Week 1 Development  
> **Focus:** LAN-only clipboard synchronization (no auth, no encryption)

## 📋 Overview

LANClip is a cross-device clipboard synchronization tool that allows you to copy text on one device and paste it on another device on the same local network.

### POC Goals
- ✅ Real-time clipboard sync across devices on same LAN
- ✅ Automatic device discovery using mDNS
- ✅ Lightweight (<50MB memory usage)
- ✅ Simple setup (<2 minutes)

## 🏗️ Architecture

```
LanClip/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── local-service/   # Background service (Node.js)
│   └── extension/       # Chrome extension (coming soon)
├── LANCLIP_TECHNICAL_DESIGN.md
├── DEVELOPMENT_TRACKER.md
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **pnpm** (Install: `npm install -g pnpm`)
- **macOS/Windows/Linux**
- Devices on the **same LAN**

### Installation

1. **Clone the repository:**
   ```bash
   cd /Users/afzalsulemani/Desktop/LanClip
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build the project:**
   ```bash
   pnpm build
   ```

### Running the Local Service

#### Development Mode (with hot reload):
```bash
pnpm dev:service
```

#### Production Mode:
```bash
pnpm build:service
cd packages/local-service
pnpm start
```

### Testing

1. **Start the service on Device A:**
   ```bash
   pnpm dev:service
   ```
   You should see:
   ```
   🚀 Starting LANClip Local Service...
   ✅ WebSocket server started on port 8765
   ✅ mDNS discovery started
   ✅ Clipboard monitoring started
   ✨ LANClip service running successfully!
   ```

2. **Start the service on Device B** (same network):
   ```bash
   pnpm dev:service
   ```

3. **Test clipboard sync:**
   - Copy text on Device A: `Hello from Device A`
   - Paste on Device B: Should show `Hello from Device A`
   - Copy text on Device B: `Response from Device B`
   - Paste on Device A: Should show `Response from Device B`

## 📦 Project Structure

### packages/shared
Shared TypeScript types and interfaces used by all packages.

### packages/local-service
Node.js background service that runs on each device:
- **Clipboard monitoring:** Detects clipboard changes every 500ms
- **mDNS discovery:** Broadcasts and discovers devices on LAN
- **WebSocket P2P:** Direct device-to-device communication
- **Message routing:** Syncs clipboard content to all peers

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev:service          # Run local service with hot reload
pnpm dev:extension        # Run extension dev server (coming soon)

# Building
pnpm build               # Build all packages
pnpm build:service       # Build local service only
pnpm build:extension     # Build extension only

# Code Quality
pnpm lint                # Lint all packages
pnpm format              # Format code with Prettier
pnpm type-check          # TypeScript type checking
```

### Adding Dependencies

```bash
# Add to root
pnpm add -D <package> -w

# Add to specific package
pnpm --filter @lanclip/local-service add <package>
pnpm --filter @lanclip/extension add <package>
```

## 🔧 Troubleshooting

### Port 8765 already in use
```bash
# Find and kill the process using port 8765
lsof -ti:8765 | xargs kill -9
```

### mDNS not discovering devices
- Ensure devices are on the **same network**
- Check firewall settings (allow port 8765)
- Try disabling VPN if active

### Clipboard not syncing
- Check that the service is running on both devices
- Look for connection messages in the logs
- Verify no network restrictions

## 📝 Current Limitations (POC)

- ✅ **Text only** - No images or files
- ✅ **LAN only** - No internet sync
- ✅ **No encryption** - Data sent as plain text
- ✅ **No authentication** - Anyone on LAN can connect
- ✅ **No history** - Clipboard not persisted

**These will be addressed in post-POC phases.**

## 🗓️ Development Roadmap

### ✅ Week 1: POC Foundation (Current)
- [x] Project setup
- [x] Local service core modules
- [ ] Chrome extension
- [ ] End-to-end testing

### 📅 Week 2: Chrome Extension & Polish
- [ ] Extension popup UI
- [ ] Native messaging
- [ ] Cross-platform testing
- [ ] Documentation

### 🔮 Post-POC
- [ ] End-to-end encryption
- [ ] User authentication
- [ ] Cloud sync (WebSocket relay)
- [ ] Clipboard history
- [ ] File & image sync

## 📚 Documentation

- [Technical Design](./LANCLIP_TECHNICAL_DESIGN.md)
- [Development Tracker](./DEVELOPMENT_TRACKER.md)
- [REST API PRD](./REST_API_PRD.md) (for backend team)
- [WebSocket Relay PRD](./WEBSOCKET_RELAY_PRD.md) (for backend team)

## 🤝 Contributing

This is currently in POC phase. Stay tuned for contribution guidelines!

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for seamless cross-device productivity**
