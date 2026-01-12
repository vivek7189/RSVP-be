# RSVP Manager - Backend API

Express.js backend API for secure event RSVP management with advanced caching and security features.

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

**Advanced Redis Caching with Distributed Locking:**

**Cache-Aside Pattern with Locking:**
- Primary cache: 10 minutes TTL
- Stale cache: 15 minutes TTL (stale-while-revalidate)
- Distributed locking prevents cache stampede
- Double-check locking reduces redundant queries

**Cache Operations:**
1. **Read:** Check cache → Lock if miss → Fetch from DB → Cache → Return
2. **Write:** Invalidate cache → Update DB → Cache auto-warms on next read
3. **Stale Fallback:** Serve stale data if lock acquisition fails

**Key Features:**
- **Distributed Locking:** Redis SETNX prevents multiple servers from refreshing simultaneously
- **Stale-While-Revalidate:** Serves stale cache during refresh to maintain availability
- **Data Sanitization:** Only whitelisted fields cached (id, name, email, created_at)
- **Retry Mechanism:** Up to 3 retries with exponential backoff
- **Pattern-Based Invalidation:** Invalidates both primary and stale cache keys

**Cache Keys:**
- Primary: `rsvps:list` (10 min TTL)
- Stale: `rsvps:list:stale` (15 min TTL)
- Lock: `rsvps:lock` (10 sec TTL)

**Scalability Benefits:**
- Prevents cache stampede in multi-server deployments
- Reduces database load by 90%+ for read operations
- Maintains data consistency with immediate invalidation
- Graceful degradation if Redis fails

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
- **Cache:** Invalidates cache after creation

### `GET /api/rsvps`
Get all RSVPs
- **Returns:** Array of RSVP objects
- **Cache:** Redis cached (10 min TTL, stale fallback)
- **Security:** Public endpoint, data sanitized before caching

### `PUT /api/rsvps/:id`
Update RSVP
- **Auth:** Bearer token required
- **Body:** `{ name?: string, email?: string }`
- **Security:** Token validation, email authorization, input sanitization
- **Cache:** Invalidates cache after update

### `DELETE /api/rsvps/:id`
Delete RSVP
- **Auth:** Bearer token required
- **Security:** Token validation, email authorization, expiry check
- **Cache:** Invalidates cache after deletion
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
- **Cache:** Invalidates cache after cancellation

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

- Use Redis Cluster for high availability
- Enable Redis persistence (RDB/AOF)
- Configure Redis authentication
- Use connection pooling for PostgreSQL
- Enable SSL for database connections
- Set strong JWT_SECRET
- Configure production CORS origins
- Monitor cache hit/miss ratios
- Set up error tracking (Sentry)
- Enable request logging

## License

MIT


