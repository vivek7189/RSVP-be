import { kafkaProducer } from '../config/kafka';
import { RSVPEvent, KAFKA_TOPICS } from './types';
import { v4 as uuidv4 } from 'uuid';

export class EventProducer {
  private static instance: EventProducer;

  private constructor() {}

  static getInstance(): EventProducer {
    if (!EventProducer.instance) {
      EventProducer.instance = new EventProducer();
    }
    return EventProducer.instance;
  }

  async publish(event: RSVPEvent): Promise<void> {
    try {
      const message = {
        key: event.data.email || event.data.rsvpId?.toString() || uuidv4(),
        value: JSON.stringify({
          ...event,
          eventId: event.eventId || uuidv4(),
          timestamp: event.timestamp || new Date().toISOString(),
        }),
        headers: {
          eventType: event.type,
          timestamp: new Date().toISOString(),
        },
      };

      await kafkaProducer.send({
        topic: KAFKA_TOPICS.RSVP_EVENTS,
        messages: [message],
      });

      console.log(`Published event: ${event.type} for RSVP ${event.data.rsvpId}`);
    } catch (error) {
      console.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  async publishBatch(events: RSVPEvent[]): Promise<void> {
    try {
      const messages = events.map(event => ({
        key: event.data.email || event.data.rsvpId?.toString() || uuidv4(),
        value: JSON.stringify({
          ...event,
          eventId: event.eventId || uuidv4(),
          timestamp: event.timestamp || new Date().toISOString(),
        }),
        headers: {
          eventType: event.type,
          timestamp: new Date().toISOString(),
        },
      }));

      await kafkaProducer.send({
        topic: KAFKA_TOPICS.RSVP_EVENTS,
        messages,
      });

      console.log(`Published batch of ${events.length} events`);
    } catch (error) {
      console.error('Failed to publish event batch:', error);
      throw error;
    }
  }
}

export const eventProducer = EventProducer.getInstance();
