import redisClient from '../config/redis';

const CACHE_KEY_PREFIX = 'rsvps';
const ATTENDEE_PAGE_TTL = 60;
const COUNT_TTL = 3600;
const USER_RSVP_TTL = 600;
const LOCK_KEY_PREFIX = 'rsvps:lock';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const getPageCacheKey = (page: number, limit: number): string => {
  return `${CACHE_KEY_PREFIX}:attendees:page:${page}:limit:${limit}`;
};

const getCountCacheKey = (): string => {
  return `${CACHE_KEY_PREFIX}:count`;
};

const getCountLockKey = (): string => {
  return `${LOCK_KEY_PREFIX}:count`;
};

const getUserRSVPCacheKey = (email: string): string => {
  const normalizedEmail = email.toLowerCase().trim();
  return `${CACHE_KEY_PREFIX}:user:${normalizedEmail}`;
};

const getPageLockKey = (page: number, limit: number): string => {
  return `${LOCK_KEY_PREFIX}:page:${page}:limit:${limit}`;
};

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

const acquireLock = async (key: string, ttl: number = 10): Promise<boolean> => {
  try {
    const result = await redisClient.setNX(key, '1');
    if (result) {
      await redisClient.expire(key, ttl);
    }
    return result;
  } catch (error) {
    console.error('Lock acquisition error:', error);
    return false;
  }
};

const releaseLock = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Lock release error:', error);
  }
};

export const getCachedPage = async (page: number, limit: number): Promise<any | null> => {
  try {
    const cacheKey = getPageCacheKey(page, limit);
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

export const setCachedPage = async (page: number, limit: number, data: any): Promise<void> => {
  try {
    const sanitized = sanitizeData(data);
    if (!sanitized) {
      return;
    }

    const cacheKey = getPageCacheKey(page, limit);
    const serialized = JSON.stringify(sanitized);
    await redisClient.setEx(cacheKey, ATTENDEE_PAGE_TTL, serialized);
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const getAtomicCount = async (): Promise<number | null> => {
  try {
    const countKey = getCountCacheKey();
    const count = await redisClient.get(countKey);
    return count ? parseInt(count, 10) : null;
  } catch (error) {
    console.error('Atomic count get error:', error);
    return null;
  }
};

export const incrementCount = async (): Promise<number> => {
  try {
    const countKey = getCountCacheKey();
    const newCount = await redisClient.incr(countKey);
    await redisClient.expire(countKey, COUNT_TTL);
    return newCount;
  } catch (error) {
    console.error('Count increment error:', error);
    throw error;
  }
};

export const decrementCount = async (): Promise<number> => {
  try {
    const countKey = getCountCacheKey();
    const newCount = await redisClient.decr(countKey);
    if (newCount < 0) {
      await redisClient.set(countKey, '0');
      return 0;
    }
    await redisClient.expire(countKey, COUNT_TTL);
    return newCount;
  } catch (error) {
    console.error('Count decrement error:', error);
    throw error;
  }
};

export const setAtomicCount = async (count: number): Promise<void> => {
  try {
    const countKey = getCountCacheKey();
    await redisClient.setEx(countKey, COUNT_TTL, count.toString());
  } catch (error) {
    console.error('Count set error:', error);
  }
};

export const invalidateCount = async (): Promise<void> => {
  try {
    const countKey = getCountCacheKey();
    await redisClient.del(countKey);
  } catch (error) {
    console.error('Count invalidation error:', error);
  }
};

export const invalidatePage = async (page: number, limit: number): Promise<void> => {
  try {
    const cacheKey = getPageCacheKey(page, limit);
    await redisClient.del(cacheKey);
  } catch (error) {
    console.error('Page invalidation error:', error);
  }
};

export const invalidateFirstPage = async (limit: number = DEFAULT_PAGE_SIZE): Promise<void> => {
  await invalidatePage(1, limit);
};

export const invalidateFirstPageAllLimits = async (): Promise<void> => {
  const commonLimits = [20, 50, 100];
  await Promise.all(commonLimits.map(limit => invalidatePage(1, limit)));
};

export const getUserRSVP = async (email: string): Promise<any | null> => {
  try {
    const cacheKey = getUserRSVPCacheKey(email);
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('User RSVP cache get error:', error);
    return null;
  }
};

export const setUserRSVP = async (email: string, rsvpData: any): Promise<void> => {
  try {
    const cacheKey = getUserRSVPCacheKey(email);
    const serialized = JSON.stringify(rsvpData);
    await redisClient.setEx(cacheKey, USER_RSVP_TTL, serialized);
  } catch (error) {
    console.error('User RSVP cache set error:', error);
  }
};

export const invalidateUserRSVP = async (email: string): Promise<void> => {
  try {
    const cacheKey = getUserRSVPCacheKey(email);
    await redisClient.del(cacheKey);
  } catch (error) {
    console.error('User RSVP invalidation error:', error);
  }
};

export const getCachedPageWithLock = async (
  page: number,
  limit: number,
  fetchFunction: () => Promise<any>
): Promise<any> => {
  let attempt = 0;
  const lockKey = getPageLockKey(page, limit);
  
  while (attempt < MAX_RETRY_ATTEMPTS) {
    const cached = await getCachedPage(page, limit);
    if (cached) {
      return cached;
    }

    const lockAcquired = await acquireLock(lockKey);
    if (!lockAcquired) {
      attempt++;
      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      
      const staleData = await getCachedPage(page, limit);
      if (staleData) {
        return staleData;
      }
      
      throw new Error('Failed to acquire cache lock after retries');
    }

    try {
      const doubleCheck = await getCachedPage(page, limit);
      if (doubleCheck) {
        return doubleCheck;
      }

      const data = await fetchFunction();
      await setCachedPage(page, limit, data);
      return data;
    } catch (error) {
      const staleData = await getCachedPage(page, limit);
      if (staleData) {
        return staleData;
      }
      throw error;
    } finally {
      await releaseLock(lockKey);
    }
  }

  throw new Error('Cache retrieval failed after all retries');
};

export const getCachedCountWithLock = async (
  fetchFunction: () => Promise<number>
): Promise<number> => {
  const cached = await getAtomicCount();
  if (cached !== null && cached > 0) {
    return cached;
  }

  const lockKey = getCountLockKey();
  const lockAcquired = await acquireLock(lockKey, 5);
  
  if (!lockAcquired) {
    const staleCount = await getAtomicCount();
    if (staleCount !== null && staleCount > 0) {
      return staleCount;
    }
    throw new Error('Failed to acquire count lock');
  }

  try {
    const doubleCheck = await getAtomicCount();
    if (doubleCheck !== null && doubleCheck > 0) {
      return doubleCheck;
    }

    const count = await fetchFunction();
    await setAtomicCount(count);
    return count;
  } finally {
    await releaseLock(lockKey);
  }
};

export const syncCountFromDB = async (fetchFunction: () => Promise<number>): Promise<void> => {
  try {
    const dbCount = await fetchFunction();
    await setAtomicCount(dbCount);
  } catch (error) {
    console.error('Count sync error:', error);
  }
};
