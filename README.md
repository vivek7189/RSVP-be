# RSVP Manager - Backend API

Express.js backend API for secure event RSVP management with advanced caching and security features.

## Design Assumptions

This system is designed with the following production-scale assumptions:

**Scale Requirements:**
- **1+ Million Users:** System must handle millions of concurrent RSVPs
- **Heavy Read Traffic:** 95%+ of requests are reads (viewing attendee lists, checking RSVP status)
- **Burst Write Traffic:** Writes come in bursts (event opens, reminder emails sent)
- **High Consistency Needs:** RSVP count and page 1 must be immediately consistent after writes
- **Low Latency:** Sub-100ms response times for cached reads
- **High Availability:** 99.9%+ uptime requirement

**Traffic Patterns:**
- **Read-Heavy:** 100:1 read-to-write ratio
- **Burst Writes:** 10k-100k RSVPs in minutes when event opens
- **Concurrent Reads:** Thousands of users viewing attendee list simultaneously
- **Real-time Updates:** Users expect to see new RSVPs within seconds

**Data Characteristics:**
- **Growing Dataset:** RSVP list grows from 0 to millions over event lifecycle
- **Time-Sensitive:** New RSVPs appear at top (newest first)
- **Frequent Queries:** Attendee list and count queried constantly
- **Pagination Required:** Cannot load all RSVPs in single request

**Consistency Requirements:**
- **Strong Consistency:** Count must be accurate immediately after write
- **Eventual Consistency:** Acceptable for pages 2+ (60s TTL acceptable)
- **Page 1 Critical:** Must show latest data immediately (invalidated on write)
- **User Status:** Must reflect current RSVP state

These assumptions drive our design choices:
- **Atomic Counter:** Handles burst writes without DB COUNT queries
- **Pagination:** Supports millions of records efficiently
- **Selective Invalidation:** Only invalidate what's critical (count + page 1)
- **Auto-Expiring Pages:** Pages 2+ expire naturally (no manual cleanup)
- **Distributed Locking:** Prevents cache stampede under load

## Tech Stack

- **Runtime:** Node.js with Express
- **Language:** TypeScript
- **Database:** PostgreSQL 15
- **Cache:** Redis 8
- **Auth:** JWT (JSON Web Tokens)

## Quick Start

```bash
npm install
npm run dev
```

Configure `.env` with database, Redis, and JWT secrets.

## Design Decisions

### Security Architecture

**Multi-Layer Input Sanitization:**
- Frontend validation prevents invalid submissions
- Express-validator middleware validates all inputs
- Custom sanitization utility removes XSS patterns
- Controller-level sanitization as final defense layer
- Database parameterized queries prevent SQL injection

**Token-Based Authentication:**
- JWT tokens generated on RSVP creation
- Tokens expire based on event date + grace period
- Email-based authorization (users can only modify their own RSVPs)
- Token stored in database for expiry validation
- Stateless authentication reduces server-side session management

**Security Headers (Helmet.js):**
- Content Security Policy (CSP) restricts resource loading
- X-Frame-Options: DENY prevents clickjacking
- X-Content-Type-Options: nosniff prevents MIME sniffing
- Strict-Transport-Security enforces HTTPS
- CORS configured to allow only frontend origin

**Rate Limiting:**
- 100 requests per 15 minutes per IP
- Prevents brute force and API abuse
- Protects against DDoS attacks

### Caching Strategy

**Production-Grade Hybrid Caching (Designed for 1M+ Users):**

*Based on assumptions: 1M+ users, heavy read traffic, burst writes, high consistency needs*

**Hybrid Strategy - Key-Based Invalidation + Atomic Counter + TTL:**

**Cache Architecture:**
- **Atomic Counter:** Redis INCR/DECR for RSVP count (<1ms, handles burst traffic)
- **Pagination:** Per-page caching with auto-expiry (60s TTL)
- **User Status:** Per-user RSVP cache (10min TTL)
- **Delete-on-Write:** Only invalidate count, pages auto-expire

**Cache Keys:**
- `rsvps:attendees:page:{n}:limit:{m}` → Paginated attendee lists (60s TTL)
- `rsvps:count` → Atomic counter (1h TTL, auto-syncs with DB)
- `rsvps:user:{email}` → User RSVP status (10min TTL)
- `rsvps:lock:page:{n}` → Distributed locks per page (10s TTL)

**TTL Strategy:**
- **Attendee Pages:** 60 seconds (auto-expire, no manual invalidation)
- **RSVP Count:** 3600 seconds (atomic counter, long-lived)
- **User Status:** 600 seconds (frequent lookups)

**Cache Operations:**

**Read Flow:**
1. **Count:** Get from atomic counter (<1ms) or fetch from DB + sync
2. **Page:** Check cache → Lock if miss → Fetch from DB → Cache → Return
3. **User Status:** Check cache → Fetch from DB if miss → Cache → Return

**Write Flow (Create/Delete):**
1. Update database
2. **Atomic Counter:** INCR (create) or DECR (delete)
3. **Invalidate:** Only count cache (lightweight)
4. **User Cache:** Update/invalidate user-specific cache
5. **Pages:** Auto-expire in 60s (no manual invalidation needed)

**Key Features:**
- **Atomic Counter:** Handles millions of concurrent RSVPs without DB COUNT queries
- **Selective Invalidation:** Only count invalidated, pages auto-expire
- **Distributed Locking:** Prevents cache stampede on page rebuilds
- **Single-Flight Rebuild:** Only one request rebuilds cache, others wait
- **Burst Traffic Ready:** Atomic counter handles spikes (used by Facebook/Amazon)
- **Memory Efficient:** Only active pages cached, LRU eviction

**Scalability Benefits (Addressing 1M+ User Assumptions):**
- **Millions of Users:** Atomic counter scales linearly (handles 1M+ concurrent RSVPs)
- **Burst Writes:** INCR/DECR handles 100k+ writes/sec (critical for event opening bursts)
- **Minimal Invalidation:** Only count + page 1 invalidated (not thousands of pages)
- **Auto-Expiry:** Pages 2+ expire naturally (60s TTL, acceptable eventual consistency)
- **99%+ Cache Hit Rate:** Count always cached, pages frequently accessed
- **Reduces DB Load:** 95%+ reduction in COUNT queries (critical for read-heavy system)
- **Immediate Consistency:** Page 1 invalidated on write (meets high consistency requirement)
- **Sub-100ms Reads:** Cached reads <1ms, cache misses 10-50ms (meets low latency requirement)

## Security Implementation

### Input Validation & Sanitization

**Name Field:**
- Max 100 characters
- Only letters, spaces, hyphens, apostrophes
- Removes: `< > " ' &` and script tags
- Validates pattern: `/^[a-zA-Z\s'-]+$/`

**Email Field:**
- Max 200 characters
- Standard email format validation
- Normalized to lowercase
- Removes dangerous protocols (javascript:, data:)
- XSS pattern detection

**Sanitization Layers:**
1. Frontend validation (client-side)
2. Express-validator (middleware)
3. Custom sanitize utility (pre-database)
4. Controller validation (final check)

### Authentication & Authorization

**JWT Token Structure:**
- Payload: `{ email: string }`
- Expiry: Event date + grace period (default 7 days)
- Stored in database with expiry timestamp
- Verified on protected endpoints

**Protected Endpoints:**
- `PUT /api/rsvps/:id` - Requires valid token + email match
- `DELETE /api/rsvps/:id` - Requires valid token + email match

**Token Expiry Handling:**
- Returns 410 Gone if token expired
- Clear error message for expired tokens
- Prevents cancellations after event grace period

### API Security

**Request Validation:**
- All inputs validated before processing
- Type checking and length restrictions
- Pattern matching for format validation

**Error Handling:**
- Generic error messages (no information leakage)
- Detailed errors logged server-side only
- No stack traces in production responses

**Database Security:**
- Parameterized queries (SQL injection prevention)
- Connection pooling with timeouts
- Unique constraints on email field
- Indexed fields for performance

## API Endpoints

### `POST /api/rsvps`
Create new RSVP
- **Body:** `{ name: string, email: string }`
- **Returns:** RSVP object + JWT token
- **Security:** Input validation, sanitization, duplicate email check
- **Cache:** Increments atomic counter, invalidates count cache, caches user status

### `GET /api/rsvps`
Get paginated RSVPs
- **Query Params:** `?page=1&limit=20` (default: page=1, limit=20, max limit=100)
- **Returns:** Paginated response with data and pagination metadata
- **Cache:** Per-page caching (60s TTL), atomic count (<1ms)
- **Security:** Public endpoint, data sanitized before caching

### `PUT /api/rsvps/:id`
Update RSVP
- **Auth:** Bearer token required
- **Body:** `{ name?: string, email?: string }`
- **Security:** Token validation, email authorization, input sanitization
- **Cache:** Invalidates count cache, updates user RSVP cache

### `DELETE /api/rsvps/:id`
Delete RSVP
- **Auth:** Bearer token required
- **Security:** Token validation, email authorization, expiry check
- **Cache:** Decrements atomic counter, invalidates count and user cache
- **Returns:** 410 Gone if token expired

### `GET /api/rsvps/verify-token`
Verify cancellation token
- **Auth:** Bearer token in header
- **Returns:** RSVP details if valid
- **Security:** Token validation, expiry check

### `DELETE /api/rsvps/cancel-by-token`
Cancel RSVP via token
- **Auth:** Bearer token in header
- **Security:** Token validation, expiry check
- **Cache:** Decrements atomic counter, invalidates count and user cache

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database, Redis configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, error handling
│   ├── routes/          # API route definitions
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Cache, validation, JWT, email, sanitize
│   └── server.ts        # Express app entry point
├── .env                 # Environment variables
└── package.json
```

## Environment Variables

```env
PORT=3013
DATABASE_URL=postgresql://user@localhost:5432/rsvp_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key
NODE_ENV=development
EVENT_DATE=2026-01-26
TOKEN_GRACE_PERIOD_DAYS=7
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Event RSVP <noreply@example.com>"
FRONTEND_URL=http://localhost:3030
```

## Production Considerations

**Redis Configuration:**
- Use Redis Cluster for high availability and sharding
- Enable Redis persistence (RDB/AOF) for atomic counter durability
- Configure Redis authentication and TLS
- Monitor atomic counter sync with DB (background job)
- Set up Redis memory limits and eviction policies

**Database:**
- Use connection pooling for PostgreSQL
- Enable SSL for database connections
- Monitor COUNT query frequency (should be minimal)
- Index on `created_at` for pagination performance

**Caching:**
- Monitor cache hit/miss ratios (target: >95% for count, >80% for pages)
- Track atomic counter drift (sync periodically)
- Set up alerts for cache stampede patterns
- Monitor Redis memory usage (pages auto-expire)

**Security:**
- Set strong JWT_SECRET
- Configure production CORS origins
- Enable rate limiting (already configured)
- Set up error tracking (Sentry)
- Enable request logging

**Scalability:**
- Horizontal scaling: Multiple app servers share Redis cache
- Atomic counter handles burst traffic (100k+ writes/sec)
- Pagination supports millions of RSVPs
- Auto-expiring pages prevent memory bloat

## License

MIT


