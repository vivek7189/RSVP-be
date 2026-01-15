import { cacheConsumer } from '../consumers/cacheConsumer';
import { analyticsConsumer } from '../consumers/analyticsConsumer';

export const startWorkers = async (): Promise<void> => {
  try {
    console.log('Starting Kafka consumers...');

    await Promise.all([
      cacheConsumer.start(),
      analyticsConsumer.start(),
    ]);

    console.log('All Kafka consumers started successfully');

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down workers...');
      await Promise.all([
        cacheConsumer.stop(),
        analyticsConsumer.stop(),
      ]);
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down workers...');
      await Promise.all([
        cacheConsumer.stop(),
        analyticsConsumer.stop(),
      ]);
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start workers:', error);
    throw error;
  }
};
