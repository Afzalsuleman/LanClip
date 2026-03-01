# LANClip - Manual Connection Guide

## 🔧 When to Use Manual Connection

Use this when mDNS discovery doesn't work (devices can't find each other automatically).

## 📋 Quick Setup (2 Steps)

### Step 1: Get Device IP Addresses

On **both devices**, run:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Example:
- Device A: `192.168.1.5`
- Device B: `192.168.1.10`

### Step 2: Set PEER_IP Environment Variable

**On Device A:**
```bash
cd /Users/afzalsulemani/Desktop/LanClip
export PEER_IP=192.168.1.10  # Device B's IP
pnpm dev:service
```

**On Device B:**
```bash
cd /path/to/LanClip
export PEER_IP=192.168.1.5  # Device A's IP
pnpm dev:service
```

## ✅ What Success Looks Like

You should see:
```
🔧 Manual peer mode enabled
⚙️  Connecting to manual peer at 192.168.1.10:8765
✅ Connected to peer: Manual-Peer-192.168.1.10
```

Then test:
1. Copy text on Device A
2. Paste on Device B - should appear! 🎉

## 🔄 To Make It Permanent

Create a `.env` file in `packages/local-service/`:

**Device A:**
```bash
echo "PEER_IP=192.168.1.10" > packages/local-service/.env
```

**Device B:**
```bash
echo "PEER_IP=192.168.1.5" > packages/local-service/.env
```

Then just run `pnpm dev:service` - it will auto-connect!

## 🆘 Still Not Working?

1. **Check devices can ping each other:**
   ```bash
   ping 192.168.1.10
   ```

2. **Check firewall allows port 8765**

3. **Verify both on same network** (same subnet like 192.168.1.x)

4. **Check logs** for connection errors
