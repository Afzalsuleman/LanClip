# LANClip Troubleshooting Guide

## Issue: Devices Not Discovering Each Other

If you see "📋 Clipboard changed, broadcasting to peers..." but NO "📍 Device found" messages, the devices aren't discovering each other via mDNS.

### Step 1: Run mDNS Debug Script

**On BOTH devices, run:**

```bash
cd /Users/afzalsulemani/Desktop/LanClip
pnpm --filter @lanclip/local-service debug-mdns
```

This will run for 30 seconds and show you:
- Your network interfaces and IP addresses
- If mDNS service is publishing correctly
- If it can find other devices

**Expected output:**
```
🔍 Starting mDNS debug...
Device: MacBook-Pro.local
Network interfaces:
  en0: 192.168.1.100

📡 Publishing mDNS service...
Published: [object]

🔎 Browsing for lanclip services...

✅ FOUND SERVICE:
  Name: Desktop-PC
  Type: lanclip
  Port: 8765
  IP: 192.168.1.50
```

### Step 2: Check Network Configuration

**Ensure both devices are on the SAME network:**

```bash
# On both devices:
ifconfig | grep "inet "
```

Both should show similar IP addresses (e.g., `192.168.1.x` or `10.0.0.x`)

### Step 3: Check Firewall

**macOS:**
1. System Preferences → Security & Privacy → Firewall
2. Click "Firewall Options"
3. Allow incoming connections for Node/tsx
4. Enable "Automatically allow built-in software to receive incoming connections"

**Windows:**
1. Windows Defender Firewall → Allow an app
2. Add Node.js
3. Allow both Private and Public networks

**Linux:**
```bash
sudo ufw allow 8765
sudo ufw allow 5353/udp  # mDNS port
```

### Step 4: Test Direct WebSocket Connection

If mDNS isn't working, you can manually connect devices:

**Get IP of Device B:**
```bash
# macOS/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig
```

**Then modify the code to add manual connection (temporary workaround):**

```typescript
// In packages/local-service/src/main.ts
// After mdns.start(), add:

// Manual connection for testing
setTimeout(() => {
  const manualDevice = {
    id: 'manual-device',
    name: 'Device-B',
    ip: '192.168.1.50',  // Change this to other device's IP
    port: 8765,
    status: 'online' as const
  };
  wsServer.connectToPeer(manualDevice);
}, 3000);
```

### Common Issues & Solutions

#### 1. VPN Active
**Problem:** VPN can block mDNS
**Solution:** Disable VPN temporarily for testing

#### 2. Different Networks
**Problem:** Devices on different WiFi networks or subnets
**Solution:** Connect to same WiFi network

#### 3. Corporate Network
**Problem:** Corporate networks often block mDNS/multicast
**Solution:** 
- Try on home network
- Or use manual IP connection (see Step 4)

#### 4. Port 8765 Blocked
**Problem:** Another app using port 8765
**Solution:**
```bash
# Find and kill process on port 8765
lsof -ti:8765 | xargs kill -9
```

#### 5. mDNS Not Working on Windows
**Problem:** Windows doesn't have Bonjour by default
**Solution:** Install Bonjour Print Services from Apple

#### 6. Both Devices Same Hostname
**Problem:** If both devices have same name, mDNS might conflict
**Solution:** Check device names are different:
```bash
hostname
```

### Quick Network Test

**Test if devices can reach each other:**

On Device A:
```bash
ping 192.168.1.50  # Device B's IP
```

On Device B:
```bash
ping 192.168.1.100  # Device A's IP
```

Both should respond. If not, network issue exists.

### Still Not Working?

1. **Check the debug script output** on both devices
2. **Verify IP addresses** are on same subnet
3. **Try manual connection** method (Step 4)
4. **Check firewall logs** for blocked connections
5. **Restart both services** after making changes

### Alternative: Use Manual IP Mode

If mDNS continues to fail, we can add a "manual mode" where you specify the other device's IP address. This bypasses mDNS entirely.

Let me know if you need help implementing this!
