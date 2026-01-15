import { kafkaConsumer } from '../config/kafka';
import { KAFKA_TOPICS, EventType, RSVPEvent } from '../events/types';
import {
  incrementCount,
  decrementCount,
  invalidateCount,
  invalidateAllPageCaches,
  setUserRSVP,
  invalidateUserRSVP,
} from '../utils/cache';

export class CacheConsumer {
  private consumer = kafkaConsumer('cache-invalidation-group');
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Cache consumer already running');
      return;
    }

    try {
      await this.consumer.connect();
      console.log('Cache consumer connected');

      await this.consumer.subscribe({
        topic: KAFKA_TOPICS.RSVP_EVENTS,
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            if (!message.value) {
              console.warn('Received message with no value');
              return;
            }

            const event: RSVPEvent = JSON.parse(message.value.toString());
            await this.handleEvent(event);

            console.log(`Processed event: ${event.type} from partition ${partition}`);
          } catch (error) {
            console.error('Error processing cache invalidation event:', error);
          }
        },
      });

      this.isRunning = true;
      console.log('Cache consumer started and listening for events');
    } catch (error) {
      console.error('Failed to start cache consumer:', error);
      throw error;
    }
  }

  private async handleEvent(event: RSVPEvent): Promise<void> {
    switch (event.type) {
      case EventType.RSVP_CREATED:
        await this.handleRSVPCreated(event);
        break;
      case EventType.RSVP_UPDATED:
        await this.handleRSVPUpdated(event);
        break;
      case EventType.RSVP_DELETED:
      case EventType.RSVP_CANCELLED:
        await this.handleRSVPDeleted(event);
        break;
      default:
        console.warn(`Unknown event type: ${(event as any).type}`);
    }
  }

  private async handleRSVPCreated(event: any): Promise<void> {
    try {
      await incrementCount();
      await invalidateCount();
      await invalidateAllPageCaches();
      
      if (event.data.email && event.data.rsvpId) {
        await setUserRSVP(event.data.email, {
          id: event.data.rsvpId,
          name: event.data.name,
          email: event.data.email,
          created_at: event.data.createdAt,
        });
      }

      console.log(`Cache invalidated for RSVP created: ${event.data.rsvpId}`);
    } catch (error) {
      console.error('Error handling RSVP created event:', error);
      throw error;
    }
  }

  private async handleRSVPUpdated(event: any): Promise<void> {
    try {
      await invalidateCount();
      await invalidateAllPageCaches();

      if (event.data.oldEmail) {
        await invalidateUserRSVP(event.data.oldEmail);
      }

      if (event.data.email && event.data.rsvpId) {
        await setUserRSVP(event.data.email, {
          id: event.data.rsvpId,
          name: event.data.name,
          email: event.data.email,
          created_at: event.data.createdAt || new Date().toISOString(),
        });
      }

      console.log(`Cache invalidated for RSVP updated: ${event.data.rsvpId}`);
    } catch (error) {
      console.error('Error handling RSVP updated event:', error);
      throw error;
    }
  }

  private async handleRSVPDeleted(event: any): Promise<void> {
    try {
      await decrementCount();
      await invalidateCount();
      await invalidateAllPageCaches();

      if (event.data.email) {
        await invalidateUserRSVP(event.data.email);
      }

      console.log(`Cache invalidated for RSVP deleted: ${event.data.rsvpId}`);
    } catch (error) {
      console.error('Error handling RSVP deleted event:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      console.log('Cache consumer stopped');
    } catch (error) {
      console.error('Error stopping cache consumer:', error);
      throw error;
    }
  }
}

export const cacheConsumer = new CacheConsumer();
