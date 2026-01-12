import redisClient from '../config/redis';

const CACHE_KEY_PREFIX = 'rsvps:list';
const CACHE_TTL = 600;
const STALE_TTL = 300;
const LOCK_KEY = 'rsvps:lock';
const LOCK_TTL = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

const getCacheKey = (): string => CACHE_KEY_PREFIX;

const getStaleCacheKey = (): string => `${CACHE_KEY_PREFIX}:stale`;

const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map(item => {
      if (item && typeof item === 'object') {
        const { id, name, email, created_at } = item;
        return { id, name, email, created_at };
      }
      return item;
    });
  }
  return data;
};

const acquireLock = async (): Promise<boolean> => {
  try {
    const result = await redisClient.setNX(LOCK_KEY, '1');
    if (result) {
      await redisClient.expire(LOCK_KEY, LOCK_TTL);
    }
    return result;
  } catch (error) {
    console.error('Lock acquisition error:', error);
    return false;
  }
};

const releaseLock = async (): Promise<void> => {
  try {
    await redisClient.del(LOCK_KEY);
  } catch (error) {
    console.error('Lock release error:', error);
  }
};

export const getCachedRSVPs = async (): Promise<any | null> => {
  try {
    const cacheKey = getCacheKey();
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return sanitizeData(parsed);
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

const getStaleCachedRSVPs = async (): Promise<any | null> => {
  try {
    const staleKey = getStaleCacheKey();
    const cached = await redisClient.get(staleKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return sanitizeData(parsed);
    }
    return null;
  } catch (error) {
    console.error('Stale cache get error:', error);
    return null;
  }
};

export const setCachedRSVPs = async (data: any): Promise<void> => {
  try {
    const sanitized = sanitizeData(data);
    if (!sanitized) {
      return;
    }

    const cacheKey = getCacheKey();
    const staleKey = getStaleCacheKey();
    const serialized = JSON.stringify(sanitized);

    await Promise.all([
      redisClient.setEx(cacheKey, CACHE_TTL, serialized),
      redisClient.setEx(staleKey, CACHE_TTL + STALE_TTL, serialized),
    ]);
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const invalidateRSVPCache = async (): Promise<void> => {
  try {
    const cacheKey = getCacheKey();
    const staleKey = getStaleCacheKey();
    await Promise.all([
      redisClient.del(cacheKey),
      redisClient.del(staleKey),
    ]);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

export const getCachedRSVPsWithLock = async (
  fetchFunction: () => Promise<any>
): Promise<any> => {
  let attempt = 0;
  
  while (attempt < MAX_RETRY_ATTEMPTS) {
    const cached = await getCachedRSVPs();
    if (cached) {
      return cached;
    }

    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      attempt++;
      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      
      const staleData = await getStaleCachedRSVPs();
      if (staleData) {
        return staleData;
      }
      
      throw new Error('Failed to acquire cache lock after retries');
    }

    try {
      const doubleCheck = await getCachedRSVPs();
      if (doubleCheck) {
        return doubleCheck;
      }

      const data = await fetchFunction();
      await setCachedRSVPs(data);
      return data;
    } catch (error) {
      const staleData = await getStaleCachedRSVPs();
      if (staleData) {
        return staleData;
      }
      throw error;
    } finally {
      await releaseLock();
    }
  }

  throw new Error('Cache retrieval failed after all retries');
};

export const warmCache = async (fetchFunction: () => Promise<any>): Promise<void> => {
  try {
    const cached = await getCachedRSVPs();
    if (cached) {
      return;
    }

    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      return;
    }

    try {
      const doubleCheck = await getCachedRSVPs();
      if (doubleCheck) {
        return;
      }

      const data = await fetchFunction();
      await setCachedRSVPs(data);
    } finally {
      await releaseLock();
    }
  } catch (error) {
    console.error('Cache warming error:', error);
  }
};
