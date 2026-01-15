import { kafkaConsumer } from '../config/kafka';
import { KAFKA_TOPICS, EventType, RSVPEvent } from '../events/types';

export class AnalyticsConsumer {
  private consumer = kafkaConsumer('analytics-group');
  private isRunning = false;
  private eventCounts = {
    created: 0,
    updated: 0,
    deleted: 0,
    cancelled: 0,
  };

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Analytics consumer already running');
      return;
    }

    try {
      await this.consumer.connect();
      console.log('Analytics consumer connected');

      await this.consumer.subscribe({
        topic: KAFKA_TOPICS.RSVP_EVENTS,
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            if (!message.value) {
              return;
            }

            const event: RSVPEvent = JSON.parse(message.value.toString());
            await this.handleEvent(event);

            console.log(`Analytics processed: ${event.type} from partition ${partition}`);
          } catch (error) {
            console.error('Error processing analytics event:', error);
          }
        },
      });

      this.isRunning = true;
      console.log('Analytics consumer started');

      setInterval(() => {
        this.logStats();
      }, 60000);
    } catch (error) {
      console.error('Failed to start analytics consumer:', error);
      throw error;
    }
  }

  private async handleEvent(event: RSVPEvent): Promise<void> {
    switch (event.type) {
      case EventType.RSVP_CREATED:
        this.eventCounts.created++;
        break;
      case EventType.RSVP_UPDATED:
        this.eventCounts.updated++;
        break;
      case EventType.RSVP_DELETED:
        this.eventCounts.deleted++;
        break;
      case EventType.RSVP_CANCELLED:
        this.eventCounts.cancelled++;
        break;
    }
  }

  private logStats(): void {
    console.log('Analytics Stats (last minute):', {
      created: this.eventCounts.created,
      updated: this.eventCounts.updated,
      deleted: this.eventCounts.deleted,
      cancelled: this.eventCounts.cancelled,
      total: Object.values(this.eventCounts).reduce((a, b) => a + b, 0),
    });

    this.eventCounts = {
      created: 0,
      updated: 0,
      deleted: 0,
      cancelled: 0,
    };
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      console.log('Analytics consumer stopped');
    } catch (error) {
      console.error('Error stopping analytics consumer:', error);
      throw error;
    }
  }
}

export const analyticsConsumer = new AnalyticsConsumer();
