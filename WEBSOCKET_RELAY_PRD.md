# LANClip WebSocket Relay Server - Product Requirements Document

**Version:** 1.0  
**Date:** January 2026  
**Target Implementation:** Node.js / Go / Rust (TBD)  
**Status:** Ready for Backend Team

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technical Requirements](#2-technical-requirements)
3. [WebSocket Protocol](#3-websocket-protocol)
4. [Authentication](#4-authentication)
5. [Room Management](#5-room-management)
6. [Message Routing](#6-message-routing)
7. [Performance Requirements](#7-performance-requirements)
8. [Deployment](#8-deployment)

---

## 1. Overview

### 1.1 Purpose
The WebSocket Relay Server enables **real-time clipboard synchronization across the internet** (cloud mode) when devices are not on the same LAN.

### 1.2 Core Responsibilities
✅ **Zero-Knowledge Message Relay** - Pass encrypted messages without decrypting  
✅ **User Room Management** - Group devices by user account  
✅ **Device Presence** - Track online/offline device status  
✅ **Message Broadcasting** - Route clipboard updates to all user's devices  
✅ **Connection Management** - Handle reconnections, heartbeats  

### 1.3 Key Principle
**The relay server CANNOT decrypt clipboard content.**  
- All clipboard data is end-to-end encrypted on client side
- Server only routes encrypted payloads between devices
- Server stores NO clipboard content

---

## 2. Technical Requirements

### 2.1 Technology Stack Options

#### Option A: Node.js (Recommended for MVP)
```
Node.js 20 LTS
- ws / Socket.io library
- Express.js (for health checks)
- Redis (for connection state)
- Fast, easy to scale horizontally
```

#### Option B: Go
```
Go 1.21+
- gorilla/websocket
- High performance
- Better for high concurrency
```

#### Option C: Rust
```
Rust
- tokio + tungstenite
- Maximum performance
- Lower memory footprint
- Steeper learning curve
```

**Recommendation:** Start with **Node.js + Socket.io** for rapid development, migrate to Go/Rust if needed for scale.

### 2.2 Infrastructure Requirements
- **Redis:** For storing connection state, user rooms, device presence
- **Load Balancer:** NGINX with sticky sessions (or Redis pub/sub for multi-instance)
- **TLS/SSL:** Required for WSS (WebSocket Secure)

### 2.3 Scalability Pattern
```
┌─────────────────────────────────────────────┐
│         Load Balancer (NGINX)               │
│         - Sticky sessions (IP hash)         │
│         - WSS termination                   │
└───────────────┬─────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼─────┐  ┌───────▼─────┐
│ WS Server 1 │  │ WS Server 2 │
│ (Node.js)   │  │ (Node.js)   │
└───────┬─────┘  └───────┬─────┘
        │                │
        └────────┬────────┘
                 │
         ┌───────▼────────┐
         │  Redis Pub/Sub │
         │  (Shared State)│
         └────────────────┘
```

---

## 3. WebSocket Protocol

### 3.1 Connection Endpoint
```
wss://relay.lanclip.io/ws
```

### 3.2 Connection Flow

```
Client                                    Relay Server
  │                                             │
  │ 1. Connect with JWT                         │
  │ ──────────────────────────────────────────> │
  │                                             │ 2. Validate JWT
  │                                             │    (verify signature)
  │                                             │
  │ <────────── 3. Connection Accepted ──────── │
  │     { type: 'auth.success', userId: '...' } │
  │                                             │
  │ 4. Join user room                           │
  │                                             │ Store: userId → connectionId
  │                                             │ Publish: User online event
  │                                             │
  │ <────── 5. Device List ──────────────────── │
  │     { type: 'devices.list', devices: [...] }│
  │                                             │
  │ 6. Send clipboard update                    │
  │ { type: 'clipboard.update', encrypted... } ──>
  │                                             │ 7. Broadcast to user's
  │                                             │    other devices
  │ <────── 8. Receive on other devices ─────── │
```

### 3.3 Connection Authentication

**Query Parameter Method:**
```
wss://relay.lanclip.io/ws?token=<JWT_ACCESS_TOKEN>
```

**First Message Method:**
```javascript
// Client connects
ws.connect('wss://relay.lanclip.io/ws');

// Send auth message within 5 seconds
ws.send({
  type: 'auth',
  token: 'eyJhbGc...'
});
```

**Server Response:**
```json
// Success
{
  "type": "auth.success",
  "userId": "uuid-v4",
  "deviceId": "uuid-v4",
  "connectedDevices": 2
}

// Failure
{
  "type": "auth.error",
  "error": "Invalid token"
}
// Server closes connection after auth failure
```

---

## 4. Authentication

### 4.1 JWT Validation

**Server MUST validate JWT:**
- Verify signature using shared secret with REST API
- Check expiration (`exp` claim)
- Extract `userId` and `deviceId` from claims

**JWT Claims Expected:**
```json
{
  "userId": "uuid-v4",
  "deviceId": "uuid-v4",
  "email": "user@example.com",
  "tier": "PRO",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 4.2 Authorization Rules
- **FREE tier:** WebSocket relay DISABLED (return 403 with upgrade message)
- **PRO tier:** WebSocket relay ENABLED
- **TEAM tier:** WebSocket relay + Team rooms ENABLED

**Check tier before allowing connection:**
```javascript
if (jwt.tier === 'FREE') {
  ws.send({
    type: 'auth.error',
    error: 'Cloud sync requires PRO subscription',
    upgradeUrl: 'https://lanclip.io/upgrade'
  });
  ws.close();
}
```

---

## 5. Room Management

### 5.1 User Rooms
Each user has a private room identified by `userId`.

**Redis Structure:**
```
Key: room:<userId>
Value: Set of connectionIds

Example:
room:user-123-uuid = { conn-abc, conn-def, conn-xyz }
```

### 5.2 Device Tracking

**Redis Structure:**
```
Key: connection:<connectionId>
Value: { userId, deviceId, deviceName, connectedAt }

Key: user:<userId>:devices
Value: Set of { deviceId, deviceName, status: 'online' }
```

### 5.3 Room Operations

#### Join Room (on connection)
```javascript
// Add connection to user's room
SADD room:<userId> <connectionId>

// Store connection metadata
SETEX connection:<connectionId> 3600 { userId, deviceId, deviceName }

// Update device status
HSET user:<userId>:devices <deviceId> { status: 'online', lastSeen: timestamp }

// Publish event to other instances (multi-server)
PUBLISH user-events { type: 'device.online', userId, deviceId }
```

#### Leave Room (on disconnect)
```javascript
// Remove from room
SREM room:<userId> <connectionId>

// Delete connection metadata
DEL connection:<connectionId>

// Update device status
HSET user:<userId>:devices <deviceId> { status: 'offline', lastSeen: timestamp }

// Publish event
PUBLISH user-events { type: 'device.offline', userId, deviceId }
```

---

## 6. Message Routing

### 6.1 Message Types

#### Client → Server: Clipboard Update
```json
{
  "type": "clipboard.update",
  "payload": {
    "id": "uuid-v4",
    "encryptedContent": "base64-encrypted-data",
    "contentType": "TEXT",
    "timestamp": 1234567890,
    "sourceDeviceId": "uuid-v4",
    "iv": "base64-iv",
    "authTag": "base64-auth-tag"
  }
}
```

**Server Action:**
1. Validate message format
2. Add server timestamp
3. Broadcast to all devices in user's room EXCEPT sender
4. Do NOT decrypt content

#### Server → Clients: Clipboard Sync
```json
{
  "type": "clipboard.sync",
  "payload": {
    "id": "uuid-v4",
    "encryptedContent": "base64-encrypted-data",
    "contentType": "TEXT",
    "timestamp": 1234567890,
    "sourceDeviceId": "uuid-v4",
    "iv": "base64-iv",
    "authTag": "base64-auth-tag",
    "serverTimestamp": 1234567891
  }
}
```

#### Client → Server: Heartbeat
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

#### Server → Client: Heartbeat Response
```json
{
  "type": "pong",
  "timestamp": 1234567891
}
```

#### Server → Clients: Device List
```json
{
  "type": "devices.update",
  "devices": [
    {
      "deviceId": "uuid-v4",
      "deviceName": "MacBook Pro",
      "status": "online",
      "lastSeen": 1234567890
    },
    {
      "deviceId": "uuid-v5",
      "deviceName": "Desktop PC",
      "status": "offline",
      "lastSeen": 1234567800
    }
  ]
}
```

**Send when:**
- A device connects/disconnects
- User requests device list

---

### 6.2 Broadcast Logic

```javascript
async function broadcastToUser(userId, message, excludeConnectionId = null) {
  // Get all connections in user's room
  const connectionIds = await redis.smembers(`room:${userId}`);
  
  // Broadcast to each connection except sender
  for (const connId of connectionIds) {
    if (connId !== excludeConnectionId) {
      const ws = getConnectionById(connId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }
}

// Usage
onMessage('clipboard.update', async (ws, message) => {
  const userId = ws.userId;
  const connectionId = ws.connectionId;
  
  // Broadcast to all user's other devices
  await broadcastToUser(userId, {
    type: 'clipboard.sync',
    payload: message.payload
  }, connectionId);
});
```

---

### 6.3 Multi-Server Broadcasting (Redis Pub/Sub)

For horizontal scaling across multiple WebSocket servers:

```javascript
// Subscribe to user events
redis.subscribe('user-events');

redis.on('message', (channel, message) => {
  const event = JSON.parse(message);
  
  if (event.type === 'clipboard.update') {
    // Forward to local connections for this user
    broadcastToLocalConnections(event.userId, event.payload);
  }
});

// Publish clipboard updates
function onClipboardUpdate(userId, payload) {
  redis.publish('user-events', JSON.stringify({
    type: 'clipboard.update',
    userId,
    payload
  }));
}
```

---

## 7. Performance Requirements

### 7.1 Connection Limits
- **Per Server Instance:** 10,000 concurrent connections
- **Per User:** Unlimited devices (PRO tier)
- **Message Rate:** 100 messages/second per connection

### 7.2 Latency Targets
- **Message Relay:** <100ms server-side processing
- **End-to-End Sync:** <800ms (including network)
- **Heartbeat Interval:** 30 seconds
- **Connection Timeout:** 60 seconds (no pong received)

### 7.3 Message Size Limits
- **Max Message Size:** 1MB (reject larger messages)
- **Typical Clipboard Text:** <10KB
- **Large Items:** Should use S3 upload, send only reference

### 7.4 Resource Usage
- **Memory:** <200MB per 1,000 connections
- **CPU:** <50% under normal load
- **Network:** Low overhead (encrypted pass-through)

---

## 8. Deployment

### 8.1 Environment Variables
```bash
# Server
PORT=8080
NODE_ENV=production

# Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=xxx

# JWT
JWT_SECRET=same-secret-as-rest-api
JWT_ISSUER=lanclip.io

# Limits
MAX_CONNECTIONS_PER_INSTANCE=10000
MAX_MESSAGE_SIZE=1048576
HEARTBEAT_INTERVAL=30000
CONNECTION_TIMEOUT=60000

# Rate Limiting
MAX_MESSAGES_PER_SECOND=100

# CORS
ALLOWED_ORIGINS=https://lanclip.io,chrome-extension://*
```

### 8.2 Health Checks
```
GET /health
Response: { "status": "ok", "connections": 1234 }

GET /health/redis
Response: { "redis": "connected", "latency": "2ms" }

GET /metrics
Response: Prometheus metrics
  - websocket_connections_total
  - websocket_messages_total
  - websocket_message_latency
  - redis_operations_total
```

### 8.3 Logging Requirements

**Log Events:**
- Connection open/close
- Authentication success/failure
- Message routing (debug level)
- Errors and exceptions

**Log Format (JSON):**
```json
{
  "timestamp": "2026-01-03T12:00:00Z",
  "level": "INFO",
  "event": "connection.open",
  "userId": "uuid",
  "deviceId": "uuid",
  "ip": "1.2.3.4",
  "connectionId": "conn-abc"
}
```

### 8.4 Monitoring Metrics

**Key Metrics to Track:**
- Active connections (gauge)
- Messages per second (counter)
- Message relay latency (histogram)
- Authentication failures (counter)
- Connection errors (counter)
- Redis latency (histogram)

**Prometheus Example:**
```javascript
const prometheus = require('prom-client');

const activeConnections = new prometheus.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

const messagesTotal = new prometheus.Counter({
  name: 'websocket_messages_total',
  help: 'Total messages relayed',
  labelNames: ['type']
});

const messageLatency = new prometheus.Histogram({
  name: 'websocket_message_latency_seconds',
  help: 'Message relay latency',
  buckets: [0.01, 0.05, 0.1, 0.5, 1.0]
});
```

---

## 9. Error Handling

### 9.1 Connection Errors

**Invalid JWT:**
```json
{
  "type": "error",
  "code": "INVALID_TOKEN",
  "message": "JWT validation failed"
}
// Close connection
```

**Free Tier Attempted:**
```json
{
  "type": "error",
  "code": "UPGRADE_REQUIRED",
  "message": "Cloud sync requires PRO subscription",
  "upgradeUrl": "https://lanclip.io/upgrade"
}
// Close connection
```

**Connection Limit Reached:**
```json
{
  "type": "error",
  "code": "CONNECTION_LIMIT",
  "message": "Too many devices connected"
}
// Close connection
```

### 9.2 Message Errors

**Invalid Message Format:**
```json
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "Message validation failed"
}
// Don't close connection, just reject message
```

**Message Too Large:**
```json
{
  "type": "error",
  "code": "MESSAGE_TOO_LARGE",
  "message": "Message exceeds 1MB limit"
}
```

**Rate Limit Exceeded:**
```json
{
  "type": "error",
  "code": "RATE_LIMIT",
  "message": "Too many messages, slow down"
}
```

---

## 10. Security Considerations

### 10.1 DDoS Protection
- Rate limiting per connection
- Max connections per IP
- Max connections per user
- Message size limits

### 10.2 Zero-Knowledge Guarantee
```
✅ Server NEVER decrypts clipboard content
✅ Server NEVER stores clipboard content
✅ Server only routes encrypted payloads
✅ All encryption/decryption happens client-side
```

### 10.3 Connection Security
- WSS (WebSocket Secure) only - no plain WS
- TLS 1.3 for all connections
- JWT validation on every connection
- Automatic disconnect on token expiry

---

## 11. API Contract with REST API

### 11.1 JWT Validation
WebSocket server needs access to:
- JWT secret (shared with REST API)
- Same signing algorithm
- Same token structure

### 11.2 Subscription Tier Check
**Option A:** Read from JWT claims
```json
{ "tier": "PRO" }
```

**Option B:** Call REST API to verify
```
GET /api/v1/internal/users/:userId/subscription
Authorization: Internal-Secret
```

**Recommendation:** Use JWT claims for performance.

---

## 12. Testing Requirements

### 12.1 Unit Tests
- Message routing logic
- Room management
- JWT validation
- Error handling

### 12.2 Integration Tests
- Connection flow
- Multi-device broadcasting
- Reconnection handling
- Authentication failures

### 12.3 Load Tests
- 10,000 concurrent connections
- 1,000 messages/second throughput
- Multi-server coordination (Redis pub/sub)
- Connection churn (rapid connect/disconnect)

---

## 13. Deliverables

### Backend Team Must Provide:
1. ✅ Working WebSocket server matching this specification
2. ✅ Docker image for deployment
3. ✅ Health check endpoints
4. ✅ Prometheus metrics endpoint
5. ✅ Load testing results (10K connections)
6. ✅ Integration test suite
7. ✅ Deployment documentation

---

## 14. Sample Implementation (Node.js)

### 14.1 Basic Server Structure
```javascript
// server.js
const WebSocket = require('ws');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

const redis = new Redis(process.env.REDIS_URL);
const wss = new WebSocket.Server({ port: 8080 });

// Connection map
const connections = new Map();

wss.on('connection', async (ws, req) => {
  try {
    // Extract and validate JWT
    const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check subscription tier
    if (decoded.tier === 'FREE') {
      ws.send(JSON.stringify({ 
        type: 'error', 
        code: 'UPGRADE_REQUIRED' 
      }));
      ws.close();
      return;
    }
    
    // Store connection info
    const connectionId = generateId();
    ws.userId = decoded.userId;
    ws.deviceId = decoded.deviceId;
    ws.connectionId = connectionId;
    connections.set(connectionId, ws);
    
    // Join user room
    await redis.sadd(`room:${decoded.userId}`, connectionId);
    await redis.setex(`connection:${connectionId}`, 3600, JSON.stringify({
      userId: decoded.userId,
      deviceId: decoded.deviceId,
      connectedAt: Date.now()
    }));
    
    // Send success
    ws.send(JSON.stringify({ 
      type: 'auth.success', 
      userId: decoded.userId 
    }));
    
    // Handle messages
    ws.on('message', async (data) => {
      const message = JSON.parse(data);
      
      if (message.type === 'clipboard.update') {
        // Broadcast to user's other devices
        await broadcastToUser(decoded.userId, {
          type: 'clipboard.sync',
          payload: message.payload
        }, connectionId);
      }
      
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    });
    
    // Handle disconnect
    ws.on('close', async () => {
      await redis.srem(`room:${decoded.userId}`, connectionId);
      await redis.del(`connection:${connectionId}`);
      connections.delete(connectionId);
    });
    
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
    ws.close();
  }
});

async function broadcastToUser(userId, message, excludeId) {
  const connectionIds = await redis.smembers(`room:${userId}`);
  
  for (const connId of connectionIds) {
    if (connId !== excludeId) {
      const ws = connections.get(connId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }
}
```

---

**Contact for Questions:**  
Frontend Team Lead: [Email/Slack]

**Timeline:**  
Target completion: 3-4 weeks

**Document Status:** Ready for Implementation
