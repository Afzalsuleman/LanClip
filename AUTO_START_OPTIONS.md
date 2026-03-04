# LANClip - Auto-Start Options

> **Problem:** Users currently have to manually run `pnpm dev:service` in a terminal every time they want clipboard sync. This document outlines three options to make the service start automatically.

---

## 📋 Options Overview

| Option | Platform | Complexity | User Effort After Setup | Time to Build |
|--------|----------|-----------|------------------------|---------------|
| [Option 1: macOS LaunchAgent](#option-1-macos-launchagent) | macOS only | Low | Zero (auto-starts) | ~15 mins |
| [Option 2: Electron Desktop App](#option-2-electron-desktop-app) | macOS + Windows + Linux | High | Zero (system tray app) | 2–3 days |
| [Option 3: npm Global Package](#option-3-npm-global-package) | macOS + Windows + Linux | Medium | One-time terminal command | ~1 hour |

---

## Option 1: macOS LaunchAgent

### What is it?
A **LaunchAgent** is macOS's built-in mechanism to auto-start apps and services when a user logs in — the same way Dropbox, Spotify, and other apps auto-start.

### How it Works
1. A `.plist` configuration file is placed in `~/Library/LaunchAgents/`
2. macOS reads it on login and starts the specified process
3. If the service crashes, macOS can optionally restart it automatically

### User Experience
```
First time (run once):
  ./install.sh
  ✅ LANClip installed! Service will start automatically on login.

Every login after:
  (Nothing to do — it just starts automatically)
```

### Files to Create

#### `install.sh` (macOS)
```bash
#!/bin/bash
set -e

echo "🚀 Installing LANClip auto-start..."

# Find Node.js path
NODE_PATH=$(which node)
SERVICE_DIR="$(cd "$(dirname "$0")/packages/local-service" && pwd)"

# Create LaunchAgent plist
PLIST_PATH="$HOME/Library/LaunchAgents/com.lanclip.service.plist"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.lanclip.service</string>

  <key>ProgramArguments</key>
  <array>
    <string>$NODE_PATH</string>
    <string>$SERVICE_DIR/dist/main.js</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$HOME/.lanclip/service.log</string>

  <key>StandardErrorPath</key>
  <string>$HOME/.lanclip/service-error.log</string>

  <key>WorkingDirectory</key>
  <string>$SERVICE_DIR</string>
</dict>
</plist>
EOF

# Create log directory
mkdir -p "$HOME/.lanclip"

# Load it immediately
launchctl load "$PLIST_PATH"

echo "✅ LANClip service installed and started!"
echo "📋 Service will auto-start on every login."
echo ""
echo "Useful commands:"
echo "  Stop:    launchctl unload ~/Library/LaunchAgents/com.lanclip.service.plist"
echo "  Start:   launchctl load ~/Library/LaunchAgents/com.lanclip.service.plist"
echo "  Logs:    tail -f ~/.lanclip/service.log"
echo "  Uninstall: ./uninstall.sh"
```

#### `uninstall.sh` (macOS)
```bash
#!/bin/bash
PLIST="$HOME/Library/LaunchAgents/com.lanclip.service.plist"
launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"
echo "✅ LANClip auto-start removed."
```

### Commands Reference
```bash
# Install / enable auto-start
./install.sh

# Check if running
launchctl list | grep lanclip

# View logs
tail -f ~/.lanclip/service.log

# Stop service
launchctl unload ~/Library/LaunchAgents/com.lanclip.service.plist

# Restart service
launchctl unload ~/Library/LaunchAgents/com.lanclip.service.plist
launchctl load ~/Library/LaunchAgents/com.lanclip.service.plist

# Uninstall
./uninstall.sh
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|--------|--------|
| Uses built-in macOS feature | macOS only |
| Zero user effort after install | Requires Node.js installed |
| Auto-restart if service crashes | No GUI/visual feedback |
| Lightweight & fast | Needs manual build first |
| Works without any extra software | |

---

## Option 2: Electron Desktop App

### What is it?
An **Electron app** packages Node.js + your code into a single `.app` (macOS) or `.exe` (Windows) that users install like any normal application. It runs a **system tray icon** showing connection status.

### How it Works
1. User downloads `LANClip.dmg` or `LANClip.exe`
2. Installs it like any app (drag to Applications or run installer)
3. App runs in the **system tray** — no dock icon, no terminal
4. The local service runs inside the Electron process
5. Tray icon shows green/red dot for connection status

### User Experience
```
1. Download LANClip.dmg
2. Drag to Applications → Double-click
3. See 📋 icon in menu bar/system tray
4. Click icon → see connected devices
5. Copy on Device A → paste on Device B
   (Just works! No terminal, no configuration)
```

### Architecture
```
LANClip.app (Electron)
├── main process (Node.js)
│   ├── Runs WebSocket server (port 8765)
│   ├── Runs clipboard monitor
│   ├── Runs subnet scanner
│   └── Controls system tray icon
├── renderer process (optional settings window)
│   └── React UI for settings
└── System Tray
    ├── 🟢 Connected (2 devices)
    ├── 🔴 Disconnected
    ├── --- Devices ---
    ├── 💻 Afzal's MacBook
    ├── 💻 Desktop-PC
    ├── ---
    └── ⚙️ Preferences / Quit
```

### Files to Create

#### `packages/desktop/package.json`
```json
{
  "name": "@lanclip/desktop",
  "version": "0.1.0",
  "main": "dist/main.js",
  "scripts": {
    "dev": "electron .",
    "build": "electron-builder",
    "pack": "electron-builder --dir"
  },
  "build": {
    "appId": "com.lanclip.app",
    "productName": "LANClip",
    "mac": {
      "category": "public.app-category.productivity",
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  },
  "dependencies": {
    "@lanclip/local-service": "workspace:*",
    "electron": "^28.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0"
  }
}
```

#### `packages/desktop/src/main.ts` (Electron main process)
```typescript
import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';

// Import our local service modules
import { WebSocketServer } from '@lanclip/local-service/websocket-server';
import { ClipboardMonitor } from '@lanclip/local-service/clipboard-monitor';
import { SubnetScanner } from '@lanclip/local-service/subnet-scanner';

let tray: Tray | null = null;
let connectedPeers: string[] = [];

app.whenReady().then(async () => {
  // Hide from dock (menu bar app only)
  app.dock?.hide();

  // Start the service
  const wsServer = new WebSocketServer(8765);
  await wsServer.start();

  const scanner = new SubnetScanner(8765, 'electron-device');
  scanner.on('deviceFound', (device) => {
    wsServer.connectToPeer(device);
    connectedPeers.push(device.name);
    updateTray();
  });
  scanner.start();

  const clipboard = new ClipboardMonitor('electron-device');
  clipboard.on('change', (text: string) => {
    wsServer.broadcast({ type: 'clipboard.update', payload: { data: text, /* ... */ } });
  });
  clipboard.start();

  // Create system tray
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon16.png'));
  tray = new Tray(icon);
  updateTray();
});

function updateTray() {
  const statusLabel = connectedPeers.length > 0
    ? `🟢 Connected (${connectedPeers.length} device${connectedPeers.length > 1 ? 's' : ''})`
    : '🔴 No devices found';

  const menu = Menu.buildFromTemplate([
    { label: 'LANClip', enabled: false },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    ...(connectedPeers.length > 0
      ? connectedPeers.map(name => ({ label: `  💻 ${name}`, enabled: false }))
      : [{ label: '  Searching for devices...', enabled: false }]
    ),
    { type: 'separator' },
    { label: 'Launch at Login', type: 'checkbox', checked: true },
    { label: 'Quit LANClip', click: () => app.quit() },
  ]);

  tray!.setContextMenu(menu);
  tray!.setToolTip(statusLabel);
}
```

### Build & Distribute
```bash
# Install dependencies
pnpm install

# Build for macOS
pnpm --filter @lanclip/desktop build --mac

# Build for Windows
pnpm --filter @lanclip/desktop build --win

# Build for Linux
pnpm --filter @lanclip/desktop build --linux

# Output:
# dist/LANClip-0.1.0.dmg          (macOS)
# dist/LANClip-Setup-0.1.0.exe    (Windows)
# dist/LANClip-0.1.0.AppImage     (Linux)
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|--------|--------|
| Most user-friendly | Takes 2-3 days to build |
| Works on all platforms | Large app size (~150MB with Electron) |
| No terminal ever needed | Higher memory usage |
| System tray status icon | More complex code |
| Bundled installer (dmg/exe) | Slower startup |
| No Node.js required for users | |
| "Launch at Login" option | |

---

## Option 3: npm Global Package

### What is it?
Publish LANClip to **npm** so users can install it globally with a single command, then register it as a startup item.

### How it Works
1. User installs with `npm install -g lanclip`
2. Runs `lanclip install` to register as startup item
3. Service auto-starts from then on

### User Experience
```bash
# One-time setup (in terminal)
npm install -g lanclip
lanclip install

# Output:
# ✅ LANClip installed!
# ✅ Service registered for auto-start
# ✅ Service started

# Daily usage: (nothing - it auto-starts)

# Check status
lanclip status
# ✅ LANClip running on port 8765
# 💻 Connected to: Desktop-PC (192.168.1.11)

# Update
npm update -g lanclip
```

### CLI Commands to Implement

```typescript
// bin/lanclip.ts - CLI entry point
#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
  case 'start':
    // Start the service
    break;
  case 'stop':
    // Stop the service
    break;
  case 'install':
    // Register as startup item (LaunchAgent on mac, Task Scheduler on Windows)
    break;
  case 'uninstall':
    // Remove startup item
    break;
  case 'status':
    // Show running status + connected peers
    break;
  case 'logs':
    // Show service logs
    break;
}
```

### Cross-Platform Startup Registration

```typescript
import { platform } from 'os';

function registerStartup() {
  switch (platform()) {
    case 'darwin': // macOS
      // Write LaunchAgent plist to ~/Library/LaunchAgents/
      installLaunchAgent();
      break;

    case 'win32': // Windows
      // Add to Windows Task Scheduler or registry Run key
      installWindowsStartup();
      break;

    case 'linux': // Linux
      // Write systemd user service file
      installSystemdService();
      break;
  }
}
```

### package.json for npm publish
```json
{
  "name": "lanclip",
  "version": "0.1.0",
  "description": "LAN clipboard sync - auto-starts clipboard sync on your network",
  "bin": {
    "lanclip": "./bin/lanclip.js"
  },
  "files": [
    "dist/",
    "bin/"
  ],
  "keywords": ["clipboard", "sync", "lan", "network", "productivity"],
  "engines": {
    "node": ">=18"
  }
}
```

### Publishing to npm
```bash
# Build the package
pnpm build

# Login to npm
npm login

# Publish
npm publish

# Users can then install with:
npm install -g lanclip
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|--------|--------|
| Works on all platforms | Requires Node.js installed |
| Easy to update (`npm update -g lanclip`) | Initial terminal setup needed |
| Professional npm distribution | No GUI/visual feedback |
| Simple CLI interface | Users must know npm |
| Small download size | |

---

## 🎯 Recommendation

### For POC / Internal Testing → **Option 1 (LaunchAgent)**
- Fastest to implement (~15 mins)
- Works great on Mac
- Zero effort after install script

### For Public Release → **Option 2 (Electron App)**
- Most professional and user-friendly
- No technical knowledge needed
- Works on all platforms
- Proper installer (DMG/EXE)

### For Developer Audience → **Option 3 (npm Package)**
- Best for developers
- Easy distribution and updates
- Works cross-platform

---

## 📅 Implementation Plan

| Phase | Option | Status |
|-------|--------|--------|
| Now | Option 1: macOS LaunchAgent | 🔜 Ready to implement |
| Week 2 | Option 3: npm global package | 🔜 Planned |
| Post-MVP | Option 2: Electron app | 🔜 Future |
