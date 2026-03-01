# LANClip REST API Server - Product Requirements Document

**Version:** 1.0  
**Date:** January 2026  
**Target Implementation:** Java / Go  
**Status:** Ready for Backend Team

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technical Requirements](#2-technical-requirements)
3. [API Specifications](#3-api-specifications)
4. [Database Schema](#4-database-schema)
5. [Authentication & Security](#5-authentication--security)
6. [Integration Points](#6-integration-points)
7. [Performance Requirements](#7-performance-requirements)
8. [Deployment](#8-deployment)

---

## 1. Overview

### 1.1 Purpose
The REST API Server provides backend services for LANClip including:
- User authentication and authorization
- Device management
- Clipboard history storage
- Subscription management
- User profile management

### 1.2 Tech Stack Requirements
- **Language:** Java (Spring Boot) OR Go (Gin/Echo framework)
- **Database:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Storage:** S3-compatible object storage
- **Authentication:** JWT with refresh tokens

### 1.3 Key Responsibilities
✅ User registration, login, authentication  
✅ Device registration and management  
✅ Clipboard history CRUD operations  
✅ Subscription plan management  
✅ Payment webhook handling (Stripe)  
✅ Rate limiting and API security  

---

## 2. Technical Requirements

### 2.1 Framework Choice

#### Option A: Java (Spring Boot)
```
Spring Boot 3.x
- Spring Security (JWT)
- Spring Data JPA (PostgreSQL)
- Spring Data Redis
- Spring Validation
- Lombok
- MapStruct
```

#### Option B: Go
```
Go 1.21+
- Gin/Echo (HTTP framework)
- GORM (ORM)
- go-redis
- jwt-go
- validator
```

### 2.2 Database
- **Primary Database:** PostgreSQL 15+
- **Connection Pooling:** HikariCP (Java) / pgx (Go)
- **Migrations:** Flyway (Java) / golang-migrate (Go)
- **Schema:** See Section 4

### 2.3 Caching Strategy
- **Redis 7+** for:
  - Session management (JWT refresh tokens)
  - Rate limiting counters
  - Device online status
  - Temporary data (password reset tokens)

### 2.4 Object Storage
- **AWS S3 / DigitalOcean Spaces** for:
  - Encrypted clipboard history (large items >10KB)
  - File attachments
  - Image clipboard content

---

## 3. API Specifications

### 3.1 Base URL
```
Production: https://api.lanclip.io/v1
Staging: https://api-staging.lanclip.io/v1
```

### 3.2 Authentication Endpoints

#### POST `/auth/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Validation:**
- Email: Valid format, unique
- Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
- Name: Optional, max 100 chars

---

#### POST `/auth/login`
User login.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "PRO",
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

#### POST `/auth/refresh`
Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

---

#### POST `/auth/logout`
Invalidate refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### POST `/auth/forgot-password`
Request password reset.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Implementation:**
- Generate reset token (6-digit code or UUID)
- Store in Redis with 15-min expiry
- Send email via SendGrid/SES

---

#### POST `/auth/reset-password`
Reset password with token.

**Request:**
```json
{
  "token": "abc123",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### 3.3 User Management Endpoints

#### GET `/users/profile`
Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "PRO",
    "subscriptionExpiresAt": "2026-02-01T00:00:00Z",
    "deviceCount": 3,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

#### PUT `/users/profile`
Update user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "John Smith"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-v4",
    "email": "user@example.com",
    "name": "John Smith",
    "updatedAt": "2026-01-03T00:00:00Z"
  }
}
```

---

#### DELETE `/users/account`
Delete user account (soft delete).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "password": "SecurePass123!",
  "confirmation": "DELETE"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Implementation:**
- Soft delete: Set `deleted_at` timestamp
- Schedule hard delete after 30 days
- Revoke all devices
- Delete clipboard history

---

### 3.4 Device Management Endpoints

#### GET `/devices`
List user's registered devices.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional, default: 20, max: 100)
- `offset` (optional, default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "uuid-v4",
        "deviceName": "MacBook Pro",
        "deviceType": "LAPTOP",
        "deviceFingerprint": "sha256-hash",
        "lastSeenAt": "2026-01-03T12:00:00Z",
        "lastIpAddress": "192.168.1.100",
        "isActive": true,
        "createdAt": "2025-12-01T00:00:00Z"
      }
    ],
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### POST `/devices`
Register a new device.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "deviceName": "MacBook Pro",
  "deviceType": "LAPTOP",
  "deviceFingerprint": "sha256-hash-of-hardware-id",
  "publicKey": "RSA-2048-public-key"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid-v4",
    "deviceName": "MacBook Pro",
    "deviceType": "LAPTOP",
    "createdAt": "2026-01-03T12:00:00Z"
  }
}
```

**Business Logic:**
- Free tier: Max 1 device
- Pro tier: Unlimited devices
- Return 403 if limit exceeded

---

#### GET `/devices/:deviceId`
Get device details.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid-v4",
    "deviceName": "MacBook Pro",
    "deviceType": "LAPTOP",
    "lastSeenAt": "2026-01-03T12:00:00Z",
    "isActive": true,
    "createdAt": "2025-12-01T00:00:00Z"
  }
}
```

---

#### PUT `/devices/:deviceId`
Update device (rename only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "deviceName": "Work MacBook"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid-v4",
    "deviceName": "Work MacBook",
    "updatedAt": "2026-01-03T12:30:00Z"
  }
}
```

---

#### DELETE `/devices/:deviceId`
Unpair/remove device.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device removed successfully"
}
```

**Implementation:**
- Set `isActive = false`
- Disconnect from WebSocket relay
- Invalidate device sessions

---

### 3.5 Clipboard History Endpoints

#### GET `/history`
List clipboard history.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional, default: 50, max: 500)
- `offset` (optional, default: 0)
- `type` (optional: TEXT, IMAGE, FILE, HTML)
- `pinned` (optional: true/false)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-v4",
        "encryptedContent": "base64-encrypted-data",
        "contentType": "TEXT",
        "contentSize": 1024,
        "contentHash": "sha256-hash",
        "s3Key": null,
        "isPinned": false,
        "sourceDeviceId": "uuid-v4",
        "createdAt": "2026-01-03T12:00:00Z"
      }
    ],
    "total": 123,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### POST `/history`
Save clipboard item.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "encryptedContent": "base64-encrypted-data",
  "contentType": "TEXT",
  "contentSize": 1024,
  "contentHash": "sha256-hash",
  "sourceDeviceId": "uuid-v4"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "createdAt": "2026-01-03T12:00:00Z"
  }
}
```

**Business Logic:**
- Free tier: Max 20 items (auto-delete oldest)
- Pro tier: Max 500 items
- Items >10KB → Upload to S3, store S3 key
- Check contentHash for deduplication

---

#### GET `/history/:id`
Get specific clipboard item.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "encryptedContent": "base64-encrypted-data",
    "contentType": "TEXT",
    "s3Url": "https://s3.../presigned-url",
    "createdAt": "2026-01-03T12:00:00Z"
  }
}
```

**Implementation:**
- If s3Key exists, generate presigned URL (5-min expiry)

---

#### DELETE `/history/:id`
Delete clipboard item.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

---

#### PUT `/history/:id/pin`
Pin/unpin clipboard item.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "isPinned": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "isPinned": true
  }
}
```

---

#### GET `/history/search`
Search clipboard history.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q` (required: search query)
- `limit` (optional, default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid-v4",
        "encryptedContent": "...",
        "contentType": "TEXT",
        "createdAt": "2026-01-03T12:00:00Z"
      }
    ],
    "total": 5
  }
}
```

**Note:** Search on contentHash only (metadata search, not content)

---

### 3.6 Subscription Endpoints

#### GET `/subscriptions/plans`
Get available subscription plans.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "tier": "FREE",
        "price": 0,
        "features": {
          "lanSync": true,
          "cloudSync": false,
          "maxDevices": 1,
          "historyLimit": 20
        }
      },
      {
        "tier": "PRO",
        "price": 5,
        "currency": "USD",
        "interval": "month",
        "stripePriceId": "price_xxx",
        "features": {
          "lanSync": true,
          "cloudSync": true,
          "maxDevices": -1,
          "historyLimit": 500,
          "fileSync": true
        }
      }
    ]
  }
}
```

---

#### POST `/subscriptions/checkout`
Create Stripe checkout session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "tier": "PRO",
  "successUrl": "https://lanclip.io/success",
  "cancelUrl": "https://lanclip.io/pricing"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "sessionId": "cs_xxx"
  }
}
```

---

#### POST `/subscriptions/cancel`
Cancel subscription.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Subscription will cancel at period end",
  "data": {
    "cancelAt": "2026-02-01T00:00:00Z"
  }
}
```

---

#### POST `/webhooks/stripe`
Handle Stripe webhooks.

**Headers:**
```
Stripe-Signature: xxx
```

**Request:** (Stripe webhook payload)

**Events to Handle:**
- `checkout.session.completed` → Activate subscription
- `invoice.paid` → Extend subscription
- `invoice.payment_failed` → Send notification
- `customer.subscription.deleted` → Downgrade to FREE

**Response (200 OK):**
```json
{
  "received": true
}
```

---

## 4. Database Schema

### 4.1 PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    
    subscription_tier VARCHAR(20) DEFAULT 'FREE',
    subscription_id VARCHAR(100),
    subscription_expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT valid_tier CHECK (subscription_tier IN ('FREE', 'PRO', 'TEAM'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    
    public_key TEXT NOT NULL,
    last_seen_at TIMESTAMP DEFAULT NOW(),
    last_ip_address VARCHAR(45),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_device_type CHECK (device_type IN ('DESKTOP', 'LAPTOP', 'SERVER')),
    UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX idx_devices_user ON devices(user_id, is_active);
CREATE INDEX idx_devices_fingerprint ON devices(device_fingerprint);

-- Clipboard history table
CREATE TABLE clipboard_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    encrypted_content TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    
    content_size INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    
    s3_key VARCHAR(500),
    
    is_pinned BOOLEAN DEFAULT false,
    source_device_id UUID,
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    CONSTRAINT valid_content_type CHECK (content_type IN ('TEXT', 'IMAGE', 'FILE', 'HTML'))
);

CREATE INDEX idx_history_user_created ON clipboard_history(user_id, created_at DESC);
CREATE INDEX idx_history_hash ON clipboard_history(content_hash);
CREATE INDEX idx_history_pinned ON clipboard_history(user_id, is_pinned) WHERE is_pinned = true;

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    stripe_customer_id VARCHAR(100) UNIQUE NOT NULL,
    stripe_subscription_id VARCHAR(100) UNIQUE NOT NULL,
    
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_tier CHECK (tier IN ('FREE', 'PRO', 'TEAM')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete'))
);

CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Refresh tokens table (or use Redis)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    device_id UUID,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

---

## 5. Authentication & Security

### 5.1 JWT Configuration

**Access Token:**
- Algorithm: HS256 or RS256
- Expiry: 15 minutes
- Claims: `userId`, `email`, `tier`, `iat`, `exp`

**Refresh Token:**
- Algorithm: HS256 or RS256
- Expiry: 7 days
- Store hash in Redis or database
- One refresh token per device

### 5.2 Password Hashing
- Algorithm: **bcrypt** (cost factor: 12)
- Validate: Min 8 chars, mixed case, number

### 5.3 Rate Limiting
```
/auth/login: 5 requests per 15 minutes per IP
/auth/register: 3 requests per hour per IP
/auth/forgot-password: 3 requests per hour per email
API calls: 1000 requests per hour per user
```

**Implementation:** Redis-based sliding window

### 5.4 CORS Configuration
```
Allowed Origins: 
  - https://lanclip.io
  - https://*.lanclip.io
  - chrome-extension://*
```

### 5.5 Security Headers
```
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

---

## 6. Integration Points

### 6.1 Client Integration
**LANClip Extension/Service will call:**
- POST `/auth/login` on user login
- GET `/devices` to list devices
- POST `/devices` to register new device
- POST `/history` to save clipboard items
- GET `/history` to retrieve history

### 6.2 WebSocket Relay Integration
**After authentication:**
- Client gets JWT from REST API
- Client connects to WebSocket relay with JWT
- Relay validates JWT by calling REST API (or using shared secret)

### 6.3 Payment Integration
**Stripe:**
- Use Stripe Checkout for subscriptions
- Handle webhooks for payment events
- Store subscription status in database

---

## 7. Performance Requirements

### 7.1 Response Times
- Authentication endpoints: <200ms (p95)
- CRUD operations: <150ms (p95)
- History list: <300ms (p95)
- Stripe webhooks: <100ms (p95)

### 7.2 Throughput
- Support 1,000+ concurrent users
- Handle 10,000+ API requests per minute

### 7.3 Database
- Connection pool: 20-50 connections
- Query timeout: 5 seconds
- Use prepared statements

### 7.4 Caching
- Cache user profiles (5 min TTL)
- Cache subscription status (5 min TTL)
- Cache device lists (1 min TTL)

---

## 8. Deployment

### 8.1 Environment Variables
```bash
# Server
PORT=3000
ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/lanclip

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=900
JWT_REFRESH_EXPIRY=604800

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=lanclip-storage
AWS_REGION=us-east-1

# Stripe
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email
SENDGRID_API_KEY=xxx
FROM_EMAIL=noreply@lanclip.io
```

### 8.2 Health Checks
```
GET /health
Response: { "status": "ok", "timestamp": "..." }

GET /health/db
Response: { "database": "connected", "latency": "5ms" }

GET /health/redis
Response: { "redis": "connected", "latency": "2ms" }
```

### 8.3 Logging
- **Format:** JSON structured logs
- **Levels:** ERROR, WARN, INFO, DEBUG
- **Log:** All API requests/responses, errors, auth attempts

**Example:**
```json
{
  "timestamp": "2026-01-03T12:00:00Z",
  "level": "INFO",
  "method": "POST",
  "path": "/auth/login",
  "status": 200,
  "duration": 45,
  "userId": "uuid",
  "ip": "1.2.3.4"
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests
- All service/business logic functions
- Target coverage: >80%

### 9.2 Integration Tests
- All API endpoints
- Database operations
- Redis operations
- S3 uploads

### 9.3 Load Testing
- 1,000 concurrent users
- 10,000 requests/minute sustained load

---

## 10. Deliverables

### Backend Team Must Provide:
1. ✅ Working REST API matching this specification
2. ✅ Database migrations (Flyway/golang-migrate)
3. ✅ API documentation (Swagger/OpenAPI)
4. ✅ Docker image for deployment
5. ✅ Health check endpoints
6. ✅ Integration test suite
7. ✅ Environment setup guide

---

**Contact for Questions:**  
Frontend Team Lead: [Email/Slack]

**Timeline:**  
Target completion: 4-6 weeks

**Document Status:** Ready for Implementation
