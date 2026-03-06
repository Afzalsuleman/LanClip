# LANClip - Quick Start Guide

## 📋 What You Need
- Both devices on the **same WiFi network**
- **Node.js 18+** installed on both devices → [Download](https://nodejs.org)
- **Chrome browser** on both devices
- **Git** installed on both devices

---

## 🖥️ Device A Setup (First Device)

### Step 1: Clone the Project
```bash
git clone https://github.com/Afzalsuleman/LanClip.git
cd LanClip
```

### Step 2: Install pnpm (if not installed)
```bash
npm install -g pnpm
```

### Step 3: Install Dependencies
```bash
pnpm install
```

### Step 4: Set Encryption Key (IMPORTANT!)
> Use the same key on BOTH devices. Min 6 characters.
```bash
node packages/local-service/dist/bin/lanclip.js set-key YOUR-SECRET-KEY
```
Example:
```bash
node packages/local-service/dist/bin/lanclip.js set-key my-secret-123
```

### Step 5: Build the Project
```bash
pnpm build
```

### Step 6: Start the Service
```bash
pnpm dev:service
```
You should see:
```
✅ WebSocket server started on port 8765
🔐 Encryption: ENABLED
✅ mDNS discovery started
✅ Subnet scanner started (auto-discovery)
✅ Clipboard monitoring started
✨ LANClip service running successfully!
```

### Step 7: Install Chrome Extension
1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Navigate to: `LanClip/packages/extension/dist`
5. Click **"Select Folder"**
6. Click the 📋 LANClip icon in Chrome toolbar
7. The **setup wizard** will appear — click through the steps

---

## 💻 Device B Setup (Second Device)

### Step 1: Clone the Project
```bash
git clone https://github.com/Afzalsuleman/LanClip.git
cd LanClip
```

### Step 2: Install pnpm (if not installed)
```bash
npm install -g pnpm
```

### Step 3: Install Dependencies
```bash
pnpm install
```

### Step 4: Set the SAME Encryption Key as Device A
```bash
node packages/local-service/dist/bin/lanclip.js set-key YOUR-SECRET-KEY
```
> ⚠️ Must be EXACTLY the same key as Device A

### Step 5: Build the Project
```bash
pnpm build
```

### Step 6: Start the Service
```bash
pnpm dev:service
```

### Step 7: Install Chrome Extension (same as Device A steps 7.1–7.7)

---

## ✅ Test Clipboard Sync

1. **Copy text on Device A** (Cmd+C / Ctrl+C)
2. **Paste on Device B** (Cmd+V / Ctrl+V)
3. It should paste Device A's clipboard content! 🎉

**Bidirectional:** Also works from Device B → Device A

---

## 📊 What You'll See in the Service Logs

When devices find each other:
```
🔍 Scanning 253 IPs on subnet for LANClip peers...
✅ Found 1 peer(s) on subnet: 192.168.1.11
📍 Device found: 192.168.1.11 at 192.168.1.11:8765
✅ Connected to peer: 192.168.1.11
```

When clipboard syncs:
```
📋 Clipboard changed (10 chars), broadcasting to peers...
📥 Received clipboard update from peer: lanclip-Device-B
```

---

## 🔐 Encryption Status

In the Chrome extension popup header:
- `🔐 Encrypted` — encryption is working ✅
- `⚠️ No key` — no encryption key set (clipboard sent as plain text)

---

## 🔧 Useful Commands

```bash
# Check service status
node packages/local-service/dist/bin/lanclip.js status

# Change encryption key
node packages/local-service/dist/bin/lanclip.js set-key new-key-here

# Disable encryption
node packages/local-service/dist/bin/lanclip.js clear-key

# View current config
node packages/local-service/dist/bin/lanclip.js config
```

---

## 🆘 Troubleshooting

### "No peers found"
- Make sure both devices are on the **same WiFi network**
- Check that the service is running on **both** devices
- Wait up to 30 seconds (scanner runs every 30s)

### Extension shows "Disconnected"
- Make sure `pnpm dev:service` is running
- Reload the extension: `chrome://extensions` → click the 🔄 reload button

### Wrong key / clipboard not syncing
- Verify both devices use the **exact same key**
- Run `lanclip.js config` on both to check the key

### Port 8765 already in use
```bash
lsof -ti:8765 | xargs kill -9
```

---

## 📱 Chrome Extension Popup

| Screen | Shown When |
|--------|-----------|
| **Setup Wizard** | First launch (guides you through setup) |
| **Normal UI** | Service is running and connected |

Click **"📖 View setup guide →"** anytime to re-open the wizard.
