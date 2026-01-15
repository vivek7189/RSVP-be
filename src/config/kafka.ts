import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'rsvp-backend',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8,
    multiplier: 2,
    maxRetryTime: 30000,
  },
  requestTimeout: 30000,
  connectionTimeout: 3000,
});

export const kafkaProducer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
});

export const kafkaConsumer = (groupId: string) => kafka.consumer({
  groupId,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576,
  minBytes: 1,
  maxBytes: 10485760,
  maxWaitTimeInMs: 5000,
});

export const connectKafka = async () => {
  try {
    await kafkaProducer.connect();
    console.log('Kafka producer connected');
  } catch (error) {
    console.error('Failed to connect Kafka producer:', error);
    throw error;
  }
};

export const disconnectKafka = async () => {
  try {
    await kafkaProducer.disconnect();
    console.log('Kafka producer disconnected');
  } catch (error) {
    console.error('Failed to disconnect Kafka producer:', error);
  }
};

export default kafka;
