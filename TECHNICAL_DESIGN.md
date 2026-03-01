# LANClip - Technical Design Document (TDD)

**Version:** 1.0  
**Date:** January 2026  
**Author:** Senior Technical Lead  
**Status:** Draft for Review

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Component Design](#4-component-design)
5. [Data Models & Database Schema](#5-data-models--database-schema)
6. [API Design](#6-api-design)
7. [Security Architecture](#7-security-architecture)
8. [Performance & Scalability](#8-performance--scalability)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Development Phases](#10-development-phases)
11. [Risk Assessment](#11-risk-assessment)
12. [Testing Strategy](#12-testing-strategy)

---

## 1. Executive Summary

### 1.1 Technical Vision
Build a lightweight, secure, cross-platform clipboard synchronization platform with dual-mode operation (LAN P2P + Cloud Relay) using modern web technologies and cryptographic best practices.

### 1.2 Key Technical Challenges
- **Real-time Sync:** Sub-second clipboard propagation across devices
- **Security:** End-to-end encryption without compromising performance
- **Cross-Platform:** Browser extension + native background service
- **Network Discovery:** Automatic LAN device detection
- **Resource Efficiency:** <50MB memory footprint

### 1.3 Architecture Philosophy
- **Microservices-lite:** Separation of concerns without over-engineering
- **Security-first:** Encryption at rest and in transit
- **Progressive Enhancement:** Works on LAN, enhanced via cloud
- **Zero-knowledge Server:** Server cannot decrypt clipboard content

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DEVICES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   Device A       │              │   Device B       │        │
│  │                  │              │                  │        │
│  │ ┌──────────────┐ │              │ ┌──────────────┐ │        │
│  │ │Chrome Extension│◄─────────────┤ │Chrome Extension│        │
│  │ └───────┬──────┘ │   LAN P2P    │ └───────┬──────┘ │        │
│  │         │        │   (mDNS)     │         │        │        │
│  │ ┌───────▼──────┐ │              │ ┌───────▼──────┐ │        │
│  │ │Local Service │ │              │ │Local Service │ │        │
│  │ │ (Node.js)    │ │              │ │ (Node.js)    │ │        │
│  │ └───────┬──────┘ │              │ └───────┬──────┘ │        │
│  │         │        │              │         │        │        │
│  │ ┌───────▼──────┐ │              │ ┌───────▼──────┐ │        │
│  │ │  Clipboard   │ │              │ │  Clipboard   │ │        │
│  │ │   Monitor    │ │              │ │   Monitor    │ │        │
│  │ └──────────────┘ │              │ └──────────────┘ │        │
│  └──────────────────┘              └──────────────────┘        │
│           │                                   │                 │
│           │         WebSocket (WSS)           │                 │
│           └───────────────┬───────────────────┘                 │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ TLS 1.3
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    CLOUD INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Load Balancer (NGINX)                     │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                         │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │         WebSocket Relay Server (Node.js)               │    │
│  │  - Room Management                                     │    │
│  │  - Device Registry                                     │    │
│  │  - Message Routing (Encrypted Pass-through)            │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                         │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │         REST API Server (Express.js)                   │    │
│  │  - Authentication (JWT)                                │    │
│  │  - User Management                                     │    │
│  │  - Subscription Management                             │    │
│  │  - History Storage                                     │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                         │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │              PostgreSQL Database                       │    │
│  │  - Users                                               │    │
│  │  - Devices                                             │    │
│  │  - Encrypted History Metadata                          │    │
│  │  - Subscriptions                                       │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                         │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │              Redis Cache                               │    │
│  │  - Session Management                                  │    │
│  │  - Rate Limiting                                       │    │
│  │  - Device Online Status                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         S3 / Object Storage                            │    │
│  │  - Encrypted Clipboard History (Large Items)           │    │
│  │  - File Attachments                                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Communication Patterns

#### LAN Mode (Free Tier)
- **Protocol:** mDNS (Multicast DNS) for discovery
- **Transport:** Direct WebSocket connections between devices
- **Encryption:** Symmetric encryption using shared secret
- **Latency Target:** <300ms

#### Cloud Mode (Pro Tier)
- **Protocol:** WebSocket Secure (WSS)
- **Transport:** Devices ↔ Relay Server (zero-knowledge relay)
- **Encryption:** End-to-end using device-specific keys
- **Latency Target:** <800ms

---

## 3. Technology Stack

### 3.1 Frontend (Browser Extension)

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Framework** | React 18 | Efficient UI updates, hooks for state management |
| **Extension Type** | Manifest V3 | Latest Chrome standard, better security |
| **State Management** | Zustand | Lightweight, simpler than Redux for extension |
| **Build Tool** | Vite | Fast HMR, optimized builds |
| **UI Library** | Tailwind CSS + Shadcn/ui | Rapid prototyping, professional look |
| **Communication** | Native Messaging API | Chrome ↔ Background Service |

### 3.2 Local Background Service

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Runtime** | Node.js 20 LTS | Cross-platform, efficient I/O, active ecosystem |
| **Framework** | Express.js (REST) + ws (WebSocket) | Lightweight, battle-tested |
| **Clipboard Access** | `clipboardy` library | Cross-platform clipboard monitoring |
| **Network Discovery** | `bonjour` / `mdns` | mDNS service discovery |
| **Encryption** | `node:crypto` (built-in) | Native performance, AES-256-GCM |
| **Process Management** | `node-windows` / `node-mac` | System service installation |
| **IPC** | Native Messaging + WebSocket | Chrome ↔ Service communication |

### 3.3 Backend Services

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **API Server** | Node.js + Express.js | Consistent stack, async performance |
| **WebSocket Server** | Socket.io | Room management, reconnection logic |
| **Database** | PostgreSQL 15+ | ACID compliance, JSON support, scalability |
| **Cache** | Redis 7+ | Session storage, rate limiting, pub/sub |
| **Object Storage** | AWS S3 / DigitalOcean Spaces | Encrypted file storage |
| **Authentication** | JWT + Refresh Tokens | Stateless, scalable |
| **Payment Processing** | Stripe | Industry standard, subscription management |
| **Email Service** | SendGrid / AWS SES | Transactional emails |

### 3.4 DevOps & Infrastructure

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Hosting** | DigitalOcean Droplets | Cost-effective, good performance |
| **Containerization** | Docker + Docker Compose | Environment consistency |
| **Orchestration** | Docker Swarm (Phase 1) → Kubernetes (Phase 3) | Progressive scaling |
| **Reverse Proxy** | NGINX | SSL termination, load balancing |
| **CI/CD** | GitHub Actions | Integrated with repo, free tier |
| **Monitoring** | Grafana + Prometheus | Open-source, powerful |
| **Logging** | Winston + Loki | Centralized logging |
| **Error Tracking** | Sentry | Real-time error monitoring |

### 3.5 Development Tools

| Tool | Technology |
|------|-----------|
| **Version Control** | Git + GitHub |
| **API Documentation** | Swagger / OpenAPI 3.0 |
| **Code Quality** | ESLint + Prettier |
| **Testing** | Jest + Supertest + Playwright |
| **Type Safety** | TypeScript (Backend + Extension) |
| **Package Manager** | pnpm |

---

## 4. Component Design

### 4.1 Chrome Extension Architecture

```
extension/
├── manifest.json                 # Manifest V3 configuration
├── src/
│   ├── background/
│   │   ├── service-worker.ts    # Background script (Manifest V3)
│   │   ├── clipboard-bridge.ts  # Native messaging bridge
│   │   └── storage-manager.ts   # Chrome storage API wrapper
│   ├── popup/
│   │   ├── App.tsx              # Main popup UI
│   │   ├── components/
│   │   │   ├── ClipboardHistory.tsx
│   │   │   ├── DeviceList.tsx
│   │   │   └── Settings.tsx
│   │   └── stores/
│   │       └── useClipboardStore.ts
│   ├── content/
│   │   └── content-script.ts    # Minimal content script
│   ├── shared/
│   │   ├── crypto.ts            # Encryption utilities
│   │   ├── api.ts               # API client
│   │   └── types.ts             # TypeScript types
│   └── assets/
├── public/
│   ├── icons/
│   └── native-messaging-host/   # Native host manifest
└── package.json
```

**Key Responsibilities:**
- Monitor clipboard changes via native messaging
- Display clipboard history
- Device pairing UI
- Settings management
- Sync status indicator

### 4.2 Local Background Service Architecture

```
local-service/
├── src/
│   ├── main.ts                  # Entry point
│   ├── server/
│   │   ├── websocket-server.ts  # Local WS server for extension
│   │   └── p2p-server.ts        # LAN P2P server
│   ├── clipboard/
│   │   ├── monitor.ts           # OS clipboard watcher
│   │   ├── processor.ts         # Content type detection
│   │   └── history-manager.ts   # Local history cache
│   ├── network/
│   │   ├── mdns-discovery.ts    # LAN device discovery
│   │   ├── p2p-client.ts        # Direct device communication
│   │   └── cloud-client.ts      # Cloud relay connection
│   ├── crypto/
│   │   ├── encryption.ts        # AES-256-GCM encryption
│   │   ├── key-manager.ts       # Device key management
│   │   └── handshake.ts         # Device pairing protocol
│   ├── storage/
│   │   └── local-db.ts          # SQLite for local history
│   ├── auth/
│   │   └── token-manager.ts     # JWT storage & refresh
│   └── utils/
│       ├── logger.ts
│       └── config.ts
├── installer/
│   ├── windows/                 # Windows service installer
│   ├── macos/                   # macOS LaunchAgent
│   └── linux/                   # systemd service
└── package.json
```

**Key Responsibilities:**
- OS-level clipboard monitoring
- mDNS service broadcasting & discovery
- Local WebSocket server for extension communication
- Encryption/decryption of clipboard data
- Cloud relay WebSocket client
- Local clipboard history storage (SQLite)

### 4.3 Backend API Server Architecture

```
backend/
├── src/
│   ├── app.ts                   # Express app setup
│   ├── server.ts                # Server entry point
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   ├── routes/
│   │   ├── auth.routes.ts       # POST /auth/login, /auth/register
│   │   ├── users.routes.ts      # GET /users/profile
│   │   ├── devices.routes.ts    # CRUD device management
│   │   ├── history.routes.ts    # Clipboard history API
│   │   └── subscriptions.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── users.controller.ts
│   │   ├── devices.controller.ts
│   │   └── history.controller.ts
│   ├── services/
│   │   ├── auth.service.ts      # JWT generation, validation
│   │   ├── user.service.ts      # User business logic
│   │   ├── device.service.ts    # Device registration
│   │   ├── history.service.ts   # History storage/retrieval
│   │   └── subscription.service.ts
│   ├── models/
│   │   ├── user.model.ts        # Sequelize/Prisma models
│   │   ├── device.model.ts
│   │   ├── history.model.ts
│   │   └── subscription.model.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification
│   │   ├── rate-limiter.ts      # Rate limiting
│   │   ├── error-handler.ts     # Global error handler
│   │   └── validator.ts         # Input validation (Zod)
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── crypto.ts
│   │   └── s3.ts                # S3 client
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma            # Database schema
├── tests/
└── package.json
```

### 4.4 WebSocket Relay Server Architecture

```
relay-server/
├── src/
│   ├── server.ts                # WebSocket server entry
│   ├── rooms/
│   │   ├── room-manager.ts      # User room management
│   │   └── message-router.ts    # Device message routing
│   ├── auth/
│   │   └── ws-auth.ts           # WebSocket authentication
│   ├── middleware/
│   │   └── rate-limiter.ts
│   └── utils/
│       ├── logger.ts
│       └── metrics.ts           # Prometheus metrics
└── package.json
```

**Key Responsibilities:**
- WebSocket connection management
- Zero-knowledge message relay (encrypted pass-through)
- Room-based device grouping
- Device online/offline status
- Connection heartbeat/keepalive

---

## 5. Data Models & Database Schema

### 5.1 PostgreSQL Schema (Prisma)

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum SubscriptionTier {
  FREE
  PRO
  TEAM
}

enum DeviceType {
  DESKTOP
  LAPTOP
  SERVER
}

enum ClipboardItemType {
  TEXT
  IMAGE
  FILE
  HTML
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  passwordHash  String
  name          String?
  
  // Encryption keys (user-specific master key encrypted with password)
  masterKeyEncrypted String     // Used for E2E encryption
  publicKey     String         // For device pairing
  
  subscriptionTier SubscriptionTier @default(FREE)
  subscriptionId   String?
  subscriptionExpiresAt DateTime?
  
  devices       Device[]
  history       ClipboardHistory[]
  teams         TeamMembership[]
  
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  @@index([email])
}

model Device {
  id            String       @id @default(uuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  deviceName    String       // User-friendly name
  deviceType    DeviceType
  deviceFingerprint String   // Hardware-based unique ID
  
  publicKey     String       // Device-specific public key for E2E
  lastSeenAt    DateTime     @default(now())
  lastIpAddress String?
  
  isActive      Boolean      @default(true)
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  @@unique([userId, deviceFingerprint])
  @@index([userId, isActive])
}

model ClipboardHistory {
  id            String       @id @default(uuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Encrypted content (AES-256-GCM with user's master key)
  encryptedContent String    @db.Text
  contentType   ClipboardItemType
  
  // Metadata (not encrypted for search/filtering)
  contentSize   Int          // Bytes
  contentHash   String       // SHA-256 hash for deduplication
  
  // S3 reference for large items (images, files)
  s3Key         String?
  
  isPinned      Boolean      @default(false)
  
  sourceDeviceId String?
  
  createdAt     DateTime     @default(now())
  expiresAt     DateTime?    // For auto-cleanup
  
  @@index([userId, createdAt])
  @@index([contentHash])
}

model Team {
  id            String       @id @default(uuid())
  name          String
  ownerId       String
  
  subscriptionId String?
  subscriptionExpiresAt DateTime?
  
  members       TeamMembership[]
  clipboardRooms ClipboardRoom[]
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model TeamMembership {
  id            String       @id @default(uuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  teamId        String
  team          Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  role          String       // owner, admin, member
  
  createdAt     DateTime     @default(now())
  
  @@unique([userId, teamId])
}

model ClipboardRoom {
  id            String       @id @default(uuid())
  teamId        String
  team          Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  name          String
  description   String?
  
  // Shared room encryption key (encrypted for each team member)
  encryptedKeys Json         // { userId: encryptedRoomKey }
  
  isActive      Boolean      @default(true)
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  @@index([teamId, isActive])
}

model Subscription {
  id            String       @id @default(uuid())
  stripeCustomerId String    @unique
  stripeSubscriptionId String @unique
  
  tier          SubscriptionTier
  status        String       // active, canceled, past_due
  
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  @@index([stripeCustomerId])
}
```

### 5.2 Local SQLite Schema (Background Service)

```sql
-- Local clipboard history cache
CREATE TABLE clipboard_items (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  source_device TEXT,
  is_synced BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_created_at ON clipboard_items(created_at DESC);

-- Device pairing cache
CREATE TABLE paired_devices (
  device_id TEXT PRIMARY KEY,
  device_name TEXT,
  public_key TEXT,
  last_seen INTEGER,
  connection_type TEXT -- 'lan' or 'cloud'
);

-- Configuration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## 6. API Design

### 6.1 REST API Endpoints

#### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

#### Users
```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
DELETE /api/v1/users/account
GET    /api/v1/users/subscription
```

#### Devices
```
GET    /api/v1/devices              # List user's devices
POST   /api/v1/devices              # Register new device
GET    /api/v1/devices/:id
PUT    /api/v1/devices/:id          # Update device name
DELETE /api/v1/devices/:id          # Unpair device
POST   /api/v1/devices/:id/pair     # Initiate pairing
```

#### Clipboard History
```
GET    /api/v1/history              # List clipboard history
GET    /api/v1/history/:id
POST   /api/v1/history              # Save clipboard item
DELETE /api/v1/history/:id
PUT    /api/v1/history/:id/pin      # Pin/unpin item
GET    /api/v1/history/search       # Search history
```

#### Teams (B2B Feature)
```
GET    /api/v1/teams
POST   /api/v1/teams
GET    /api/v1/teams/:id
PUT    /api/v1/teams/:id
DELETE /api/v1/teams/:id

POST   /api/v1/teams/:id/members
DELETE /api/v1/teams/:id/members/:userId

GET    /api/v1/teams/:id/rooms
POST   /api/v1/teams/:id/rooms
```

#### Subscriptions
```
GET    /api/v1/subscriptions/plans
POST   /api/v1/subscriptions/checkout
POST   /api/v1/subscriptions/cancel
POST   /api/v1/webhooks/stripe      # Stripe webhooks
```

### 6.2 WebSocket Protocol

#### Connection
```javascript
// Client connects with JWT
ws://localhost:8765?token=<JWT>

// Or for cloud relay
wss://relay.lanclip.io?token=<JWT>
```

#### Message Types

```typescript
// Client → Server: Clipboard Update
{
  type: 'clipboard.update',
  payload: {
    id: string,
    encryptedContent: string,      // Base64 encoded encrypted data
    contentType: 'text' | 'image' | 'file',
    timestamp: number,
    sourceDeviceId: string,
    iv: string,                     // Initialization vector for AES
    authTag: string                 // GCM authentication tag
  }
}

// Server → Client: Clipboard Sync
{
  type: 'clipboard.sync',
  payload: {
    id: string,
    encryptedContent: string,
    contentType: 'text' | 'image' | 'file',
    timestamp: number,
    sourceDeviceId: string,
    iv: string,
    authTag: string
  }
}

// Client → Server: Device Discovery (LAN)
{
  type: 'device.announce',
  payload: {
    deviceId: string,
    deviceName: string,
    publicKey: string,
    networkType: 'lan'
  }
}

// Server → Client: Device List Update
{
  type: 'devices.update',
  payload: {
    devices: [
      { id: string, name: string, status: 'online' | 'offline', lastSeen: number }
    ]
  }
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

---

## 7. Security Architecture

### 7.1 Encryption Strategy

#### End-to-End Encryption Flow

```
Device A                         Cloud Server                    Device B
   |                                   |                             |
   | 1. Copy text "Hello"              |                             |
   |    ↓                               |                             |
   | 2. Generate random IV              |                             |
   | 3. Encrypt with AES-256-GCM        |                             |
   |    using User's Master Key         |                             |
   |    ↓                               |                             |
   | {encryptedContent, iv, authTag} →  |  → Pass-through (no decrypt) → Device B
   |                                    |                             |     ↓
   |                                    |                          4. Decrypt with
   |                                    |                             same Master Key
   |                                    |                             ↓
   |                                    |                          "Hello"
```

#### Key Management

1. **Master Key Derivation**
   ```javascript
   // On registration
   const masterKey = crypto.pbkdf2Sync(password, email, 100000, 32, 'sha256');
   
   // Master key is used to encrypt all clipboard data
   // Server stores PBKDF2(masterKey) for authentication, but cannot decrypt
   ```

2. **Device-Specific Keys**
   - Each device generates an RSA-2048 key pair
   - Public key stored on server
   - Private key never leaves device
   - Used for device pairing and key exchange

3. **Key Storage**
   - **Client Side:** Encrypted with OS keychain (macOS Keychain, Windows Credential Manager)
   - **Server Side:** Only stores public keys and encrypted metadata

### 7.2 Authentication & Authorization

#### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tier": "PRO",
  "iat": 1234567890,
  "exp": 1234567890,
  "deviceId": "device-uuid"
}
```

#### Token Lifecycle
- **Access Token:** 15 minutes expiry
- **Refresh Token:** 7 days expiry (stored in httpOnly cookie)
- **Device Token:** Unique per device, rotated on re-authentication

### 7.3 Threat Model & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Man-in-the-Middle** | TLS 1.3 for all connections, certificate pinning |
| **Server Compromise** | Zero-knowledge architecture, server cannot decrypt |
| **Device Theft** | OS-level keychain protection, device revocation |
| **Replay Attacks** | Timestamp validation, nonce in handshake |
| **Brute Force** | Rate limiting, account lockout, CAPTCHA |
| **XSS in Extension** | Content Security Policy, input sanitization |
| **Malicious Clipboard Data** | Size limits, content validation, sandbox execution |

### 7.4 Compliance

- **GDPR:** Right to deletion, data portability, consent management
- **SOC 2:** Logging, access controls, encryption at rest
- **Data Retention:** Auto-delete clipboard history after 90 days (configurable)

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Clipboard Sync Latency (LAN) | <300ms | <500ms |
| Clipboard Sync Latency (Cloud) | <800ms | <1500ms |
| Memory Usage (Local Service) | <50MB | <100MB |
| CPU Usage (Idle) | <3% | <5% |
| Extension Load Time | <500ms | <1s |
| API Response Time (p95) | <200ms | <500ms |
| WebSocket Message Throughput | 1000 msg/s per server | 500 msg/s |

### 8.2 Optimization Strategies

#### Frontend (Extension)
- **Lazy Loading:** Load clipboard history on demand
- **Virtual Scrolling:** For large history lists
- **Debouncing:** Clipboard change detection (100ms)
- **IndexedDB:** Local caching of recent items
- **Compression:** gzip large text content

#### Backend Service
- **Connection Pooling:** PostgreSQL (max 20 connections)
- **Redis Caching:** 
  - User sessions (TTL: 15 min)
  - Device status (TTL: 5 min)
  - Rate limit counters
- **Database Indexing:** See schema indexes above
- **Query Optimization:** Use prepared statements, limit/offset pagination

#### Local Background Service
- **Clipboard Polling:** 200ms interval (adaptive based on activity)
- **Debouncing:** Avoid duplicate syncs within 500ms
- **Batch Sync:** Queue multiple changes, send in single message
- **SQLite WAL Mode:** Better concurrent read/write performance

### 8.3 Scalability Architecture

#### Phase 1: Single Server (0-1K users)
```
Single DigitalOcean Droplet (4 vCPU, 8GB RAM)
├── API Server
├── WebSocket Relay
├── PostgreSQL
└── Redis
```

#### Phase 2: Horizontal Scaling (1K-10K users)
```
Load Balancer (NGINX)
├── API Server Pool (3 instances)
├── WebSocket Server Pool (3 instances)
├── PostgreSQL Primary-Replica
└── Redis Cluster
```

#### Phase 3: Global Distribution (10K+ users)
```
Multi-Region Deployment
├── CloudFlare CDN
├── Regional Load Balancers
├── API Servers (Auto-scaling)
├── WebSocket Servers (Sticky sessions)
├── PostgreSQL Multi-Region (CockroachDB)
└── Redis Sentinel (HA)
```

### 8.4 Database Optimization

- **Partitioning:** Partition `clipboard_history` by `created_at` (monthly)
- **Archival:** Move items >90 days to cold storage (S3 Glacier)
- **Vacuuming:** Auto-vacuum PostgreSQL
- **Connection Pooling:** PgBouncer for connection management

---

## 9. Deployment Architecture

### 9.1 Infrastructure as Code

```yaml
# docker-compose.yml (Development)
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/lanclip
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
  
  relay:
    build: ./relay-server
    ports:
      - "8080:8080"
    depends_on:
      - redis
  
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### 9.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          npm install
          npm run test
  
  build-extension:
    runs-on: ubuntu-latest
    steps:
      - name: Build extension
        run: npm run build:extension
      - name: Upload artifact
        uses: actions/upload-artifact@v3
  
  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to DigitalOcean
        run: |
          ssh deploy@server "cd /app && git pull && docker-compose up -d"
```

### 9.3 Monitoring & Observability

#### Metrics Collection
- **Application Metrics:** Prometheus + Grafana
  - Request rate, latency, error rate
  - WebSocket connection count
  - Clipboard sync success rate
  
- **System Metrics:** Node Exporter
  - CPU, memory, disk, network
  
- **Custom Metrics:**
  ```javascript
  // Example: Track clipboard sync latency
  const histogram = new promClient.Histogram({
    name: 'clipboard_sync_duration_seconds',
    help: 'Time to sync clipboard across devices',
    buckets: [0.1, 0.3, 0.5, 0.8, 1.0, 2.0]
  });
  ```

#### Logging Strategy
```javascript
// Structured logging with Winston
logger.info('Clipboard synced', {
  userId: 'uuid',
  deviceId: 'uuid',
  contentType: 'text',
  size: 1024,
  latency: 234,
  mode: 'cloud'
});
```

#### Alerting Rules
- API error rate >1% for 5 minutes
- WebSocket disconnection rate >5% 
- Database connection pool exhaustion
- Disk usage >85%
- Memory usage >90%

---

## 10. Development Phases

### Phase 1: MVP - Core Functionality (8-10 weeks)

#### Sprint 1-2: Foundation (2 weeks)
- [ ] Set up monorepo structure (pnpm workspaces)
- [ ] Initialize backend API (Express + TypeScript)
- [ ] Set up PostgreSQL + Prisma
- [ ] Implement authentication (JWT)
- [ ] Basic user registration/login
- [ ] Docker development environment

#### Sprint 3-4: Local Background Service (2 weeks)
- [ ] Node.js service with clipboard monitoring
- [ ] Local WebSocket server
- [ ] SQLite local storage
- [ ] OS-level service installer (macOS, Windows)
- [ ] Native messaging host setup

#### Sprint 5-6: Browser Extension (2 weeks)
- [ ] Chrome extension scaffold (Manifest V3)
- [ ] Popup UI with React + Tailwind
- [ ] Native messaging bridge
- [ ] Clipboard history display
- [ ] Device pairing UI

#### Sprint 7-8: LAN P2P Sync (2 weeks)
- [ ] mDNS device discovery
- [ ] Direct WebSocket P2P connection
- [ ] Symmetric encryption (AES-256-GCM)
- [ ] Real-time clipboard sync on LAN
- [ ] Connection status indicators

#### Sprint 9-10: Polish & Testing (2 weeks)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling & retry logic
- [ ] Installation wizard
- [ ] Documentation

**Deliverable:** Working LAN-only clipboard sync (Free Tier)

---

### Phase 2: Cloud Sync & Premium Features (6-8 weeks)

#### Sprint 11-12: Cloud Infrastructure (2 weeks)
- [ ] WebSocket relay server
- [ ] Room-based message routing
- [ ] Device registry
- [ ] Cloud deployment (DigitalOcean)
- [ ] SSL/TLS setup with Let's Encrypt

#### Sprint 13-14: Cloud Sync (2 weeks)
- [ ] Cloud WebSocket client in local service
- [ ] End-to-end encryption for cloud sync
- [ ] Fallback from LAN to cloud
- [ ] Sync status UI

#### Sprint 15-16: Clipboard History (2 weeks)
- [ ] Server-side history storage
- [ ] History API endpoints
- [ ] S3 integration for large items
- [ ] Search functionality
- [ ] Pin/unpin items

#### Sprint 17-18: Subscription & Payments (2 weeks)
- [ ] Stripe integration
- [ ] Subscription plans API
- [ ] Payment checkout flow
- [ ] Webhook handling
- [ ] Subscription status enforcement

**Deliverable:** Cloud sync + Premium features (Pro Tier)

---

### Phase 3: Advanced Features (4-6 weeks)

#### Sprint 19-20: File & Image Sync (2 weeks)
- [ ] Image clipboard detection
- [ ] File transfer protocol
- [ ] Progress indicators
- [ ] Size limit enforcement

#### Sprint 21-22: Team Features (2 weeks)
- [ ] Team management API
- [ ] Shared clipboard rooms
- [ ] Role-based access control
- [ ] Team invitation system

#### Sprint 23-24: Polish & Optimization (2 weeks)
- [ ] Performance tuning
- [ ] Advanced analytics
- [ ] Admin dashboard
- [ ] Marketing website

**Deliverable:** Full feature set (Team Tier)

---

## 11. Risk Assessment

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Cross-platform clipboard access issues** | High | High | Extensive testing, fallback mechanisms, native libraries |
| **Network firewall blocks WebSocket** | Medium | High | HTTP fallback, port 443 usage, documentation |
| **Encryption performance overhead** | Medium | Medium | Hardware acceleration (AES-NI), benchmarking |
| **Browser extension Manifest V3 limitations** | Medium | Medium | Early prototyping, alternative architectures |
| **mDNS blocked by corporate networks** | High | Medium | Manual IP entry option, QR code pairing |
| **Database scalability bottleneck** | Low | High | Early load testing, connection pooling, read replicas |

### 11.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Low user adoption** | Medium | High | Marketing, free tier, developer community |
| **Competing products** | High | Medium | Differentiation on privacy, pricing, performance |
| **Chrome Web Store rejection** | Low | High | Follow all guidelines, privacy policy, permissions justification |
| **Security vulnerability discovered** | Medium | Critical | Security audits, bug bounty, rapid patching |

### 11.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Insufficient revenue** | Medium | High | Freemium model, B2B focus, cost optimization |
| **Cloud infrastructure costs** | Medium | Medium | Usage-based scaling, cost monitoring |
| **GDPR/Privacy compliance issues** | Low | Critical | Legal review, privacy by design, data minimization |

---

## 12. Testing Strategy

### 12.1 Unit Testing
- **Target Coverage:** 80%
- **Framework:** Jest
- **Focus Areas:**
  - Encryption/decryption functions
  - API endpoints
  - Business logic services

### 12.2 Integration Testing
- **Framework:** Supertest (API), Playwright (Extension)
- **Scenarios:**
  - User registration → device pairing → clipboard sync
  - Authentication flow
  - WebSocket connection handling
  - Database operations

### 12.3 End-to-End Testing
- **Framework:** Playwright
- **Scenarios:**
  - Complete user journey: Install → Setup → Sync
  - Multi-device sync simulation
  - Network failure recovery
  - Payment flow

### 12.4 Performance Testing
- **Tools:** k6, Artillery
- **Tests:**
  - Load testing: 1K concurrent WebSocket connections
  - Stress testing: Peak load scenarios
  - Clipboard sync latency measurement
  - Memory leak detection

### 12.5 Security Testing
- **Penetration Testing:** Third-party security audit
- **Automated Scanning:** OWASP ZAP, Snyk
- **Code Review:** Focus on crypto implementation
- **Compliance Audit:** GDPR checklist

---

## 13. Success Criteria

### Technical KPIs
- ✅ Clipboard sync latency <300ms (LAN), <800ms (Cloud)
- ✅ 99.9% uptime
- ✅ <1% error rate
- ✅ Memory usage <50MB
- ✅ Zero critical security vulnerabilities

### Product KPIs
- 1,000 active users in first 3 months
- 5% free-to-paid conversion rate
- 4.5+ Chrome Web Store rating
- <5% churn rate

---

## 14. Open Questions for Review

1. **Encryption Strategy:**
   - Should we use PBKDF2 or Argon2 for key derivation? (Argon2 is more secure but less compatible)
   - Device key rotation policy?

2. **Network Discovery:**
   - mDNS may be blocked in enterprise networks. Should we prioritize cloud-only mode or invest in NAT traversal (STUN/TURN)?

3. **Local Storage:**
   - SQLite vs LevelDB for local clipboard history?
   - How to handle storage quota for free vs paid users?

4. **Monetization:**
   - Should we add a "Lifetime" plan alongside subscriptions?
   - Enterprise plan features (SSO, SAML)?

5. **Platform Priority:**
   - Start with Chrome only, or also Firefox from Phase 1?
   - Windows/macOS priority order for background service?

6. **Cloud Infrastructure:**
   - DigitalOcean vs AWS? (Cost vs features trade-off)
   - Self-hosted option for enterprises (Phase 3)?

---

## 15. Next Steps

1. **Review this Technical Design** with the team
2. **Prioritize open questions** and make architectural decisions
3. **Create detailed Development Roadmap** with sprint breakdown
4. **Set up development environment** (repos, CI/CD, staging)
5. **Begin Phase 1 Sprint 1** - Foundation work

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Draft - Awaiting Review  
**Reviewers:** Product Lead, Engineering Team, Security Advisor
