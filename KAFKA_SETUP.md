# Kafka Setup Guide

## Prerequisites

1. **Install Kafka** (if not already installed):
   ```bash
   # Using Docker (recommended)
   docker-compose up -d kafka zookeeper
   
   # Or download from https://kafka.apache.org/downloads
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Environment Variables

Add to your `.env` file:

```env
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
# For multiple brokers: KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094
```

## Architecture

### Event-Driven Flow

```
User Request → API → Database → Kafka Event → Response (fast!)
                              ↓
                        Background Workers
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
            Cache Consumer      Analytics Consumer
                    │                   │
                    ↓                   ↓
                Redis Cache        Analytics DB
```

### Components

1. **Producer** (`src/events/producer.ts`)
   - Publishes events to Kafka
   - Used by controllers after DB operations

2. **Cache Consumer** (`src/consumers/cacheConsumer.ts`)
   - Listens for RSVP events
   - Invalidates Redis cache asynchronously
   - Group: `cache-invalidation-group`

3. **Analytics Consumer** (`src/consumers/analyticsConsumer.ts`)
   - Tracks event statistics
   - Example consumer for extensibility
   - Group: `analytics-group`

## Running the Application

### Development

```bash
npm run dev
```

This starts:
- Express API server
- Kafka producer
- All consumers (cache, analytics)

### Production

```bash
npm run build
npm start
```

## Event Types

- `RSVP_CREATED` - When new RSVP is created
- `RSVP_UPDATED` - When RSVP is updated
- `RSVP_DELETED` - When RSVP is deleted via API
- `RSVP_CANCELLED` - When RSVP is cancelled via token

## Benefits

1. **Fast API Responses**: Cache invalidation happens asynchronously
2. **Scalability**: Handles high write volume (10k+ writes/sec)
3. **Resilience**: Events are persisted, can be reprocessed
4. **Extensibility**: Easy to add new consumers (notifications, search index, etc.)

## Monitoring

Check Kafka topics:
```bash
kafka-console-consumer --bootstrap-server localhost:9092 --topic rsvp-events --from-beginning
```

## Troubleshooting

1. **Kafka not connecting**: Check `KAFKA_BROKERS` in `.env`
2. **Consumers not processing**: Check Kafka logs and consumer group status
3. **Events not publishing**: Check producer connection and topic exists
