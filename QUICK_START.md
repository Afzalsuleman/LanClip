# LANClip - Quick Start Guide

## 📋 What You Need
- Both devices on the **same WiFi network**
- **Node.js 18+** on both devices → [Download](https://nodejs.org)
- **Chrome browser** on both devices
- **Git** installed on both devices

---

## 🚀 Setup (Same Steps on Both Devices)

### Step 1: Clone the Project
```bash
git clone https://github.com/Afzalsulemen/LanClip.git
cd LanClip
```

### Step 2: Install pnpm (if not installed)
```bash
npm install -g pnpm
```

### Step 3: Install Dependencies & Build
```bash
pnpm install
pnpm build
```

### Step 4: Start the Service
```bash
pnpm dev:service
```

**On the first run, it will ask you to enter a room code:**

```
🎉 Welcome to LANClip!
──────────────────────────────────────────
🔐 No encryption key found.
   Both devices must use the SAME key to sync.

   Enter a room code (min 6 chars): █
```

> ⚠️ **Enter the SAME room code on BOTH devices!**
> For example: `my-team-2024`

After entering the key, the service starts automatically:
```
   ✅ Key saved: "my-team-2024"
   Use the same key on all devices!
──────────────────────────────────────────

🚀 Starting LANClip service...
✅ WebSocket server started on port 8765
🔐 Encryption: ENABLED
✅ Subnet scanner started (auto-discovery)
✅ Clipboard monitoring started
✨ LANClip service running successfully!
```

### Step 5: Install Chrome Extension
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select: `LanClip/packages/extension/dist`
5. Click 📋 LANClip icon in toolbar → setup wizard appears → click through it

---

## ✅ Test Clipboard Sync

After both devices are set up:
1. **Copy text on Device A** (Cmd+C / Ctrl+C)
2. **Paste on Device B** (Cmd+V / Ctrl+V)
3. You get Device A's text! 🎉

Works in **both directions** automatically.

---

## 📊 Expected Logs When Working

Devices find each other (within ~30 seconds):
```
🔍 Scanning 253 IPs on subnet...
✅ Found 1 peer(s) on subnet: 192.168.1.11
📍 Device found: 192.168.1.11 at 192.168.1.11:8765
✅ Connected to peer: 192.168.1.11
```

Clipboard sync:
```
📋 Clipboard changed (10 chars), broadcasting to peers...
📥 Received & decrypted clipboard from peer: lanclip-Device-B
```

---

## 🔧 Useful Commands

```bash
# Change room code
node packages/local-service/dist/bin/lanclip.js set-key new-key

# Check status
node packages/local-service/dist/bin/lanclip.js status

# View config
node packages/local-service/dist/bin/lanclip.js config
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "No peers found" | Ensure both devices on same WiFi |
| Extension "Disconnected" | Run `pnpm dev:service`, reload extension |
| Clipboard not syncing | Verify SAME key on both devices |
| Port 8765 in use | Run: `lsof -ti:8765 \| xargs kill -9` |
