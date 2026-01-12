import redisClient from '../config/redis';

const CACHE_KEY = 'rsvps:list';
const CACHE_TTL = 300;

export const getCachedRSVPs = async (): Promise<any | null> => {
  try {
    const cached = await redisClient.get(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const setCachedRSVPs = async (data: any): Promise<void> => {
  try {
    await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const invalidateRSVPCache = async (): Promise<void> => {
  try {
    await redisClient.del(CACHE_KEY);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};
