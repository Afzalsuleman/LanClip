# LANClip - Setup Guide for Second Device

## 🚀 Quick Setup on Second Device

### Prerequisites
- Node.js 20+ installed
- Both devices on the **same LAN/WiFi network**
- Git installed

### Step 1: Clone the Repository

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

### Step 4: Build the Project

```bash
pnpm build
```

### Step 5: Run the Local Service

```bash
pnpm dev:service
```

You should see:
```
🚀 Starting LANClip Local Service...
Device: Your-Device-Name
✅ WebSocket server started on port 8765
📡 Broadcasting device: Your-Device-Name on port 8765
✅ mDNS discovery started
✅ Clipboard monitoring started
✨ LANClip service running successfully!
💡 Copy text on this device to sync with peers on the same network
```

---

## 🧪 Testing Clipboard Sync

### Device A (First Device)
1. Service should already be running
2. Look for log: `📍 Device found: [Second-Device-Name]`
3. Copy some text: `Hello from Device A`

### Device B (Second Device)
1. Service should be running
2. Look for log: `📍 Device found: [First-Device-Name]`
3. Look for log: `📥 Received clipboard update from peer`
4. Try pasting - you should see: `Hello from Device A`

### Test Bidirectional Sync
1. On Device B, copy: `Response from Device B`
2. On Device A, paste - you should see: `Response from Device B`

---

## 🔧 Troubleshooting

### Devices not discovering each other

**Check 1: Same Network**
```bash
# On both devices, check IP addresses
# macOS/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig
```
Both devices should be on same subnet (e.g., `192.168.1.x`)

**Check 2: Firewall**
- Allow port 8765 on both devices
- macOS: System Preferences → Security & Privacy → Firewall
- Windows: Windows Defender Firewall → Allow an app

**Check 3: mDNS/Bonjour**
- macOS: Built-in, should work
- Windows: May need to install Bonjour Service
- Linux: Install `avahi-daemon`

### Port 8765 already in use

```bash
# Find process using port 8765
lsof -ti:8765

# Kill the process
lsof -ti:8765 | xargs kill -9
```

### Clipboard not syncing

1. Check logs on both devices
2. Look for `📍 Device found` messages
3. Look for `📥 Received clipboard update` messages
4. Ensure no VPN is active
5. Try copying simple text first (not images/files)

---

## 📊 Expected Log Output

### On Device A:
```
[INFO] 🚀 Starting LANClip Local Service...
[INFO] Device: MacBook-Pro.local
[INFO] ✅ WebSocket server started on port 8765
[INFO] 📡 Broadcasting device: MacBook-Pro.local on port 8765
[INFO] ✅ mDNS discovery started
[INFO] ✅ Clipboard monitoring started
[INFO] ✨ LANClip service running successfully!

[INFO] 📍 Device found: Desktop-PC at 192.168.1.50:8765
[INFO] ✅ Connected to peer: Desktop-PC (192.168.1.50:8765)

[INFO] 📋 Clipboard changed (18 chars), broadcasting to peers...
```

### On Device B:
```
[INFO] 🚀 Starting LANClip Local Service...
[INFO] Device: Desktop-PC
[INFO] ✅ WebSocket server started on port 8765
[INFO] 📡 Broadcasting device: Desktop-PC on port 8765
[INFO] ✅ mDNS discovery started
[INFO] ✅ Clipboard monitoring started
[INFO] ✨ LANClip service running successfully!

[INFO] 📍 Device found: MacBook-Pro.local at 192.168.1.100:8765
[INFO] ✅ Connected to peer: MacBook-Pro.local (192.168.1.100:8765)

[INFO] 📥 Received clipboard update from peer: lanclip-MacBook-Pro-...
```

---

## ⏹️ Stopping the Service

Press `Ctrl+C` in the terminal where the service is running.

---

## 🎯 Success Criteria

✅ Both devices show up in each other's logs  
✅ Copying text on Device A appears on Device B within 500ms  
✅ Bidirectional sync works  
✅ Memory usage < 50MB  
✅ No crashes during normal operation  

---

## 📞 Need Help?

- Check `DEVELOPMENT_TRACKER.md` for current status
- Review `LANCLIP_TECHNICAL_DESIGN.md` for architecture details
- Look at logs for specific error messages

---

**Happy syncing! 📋✨**
