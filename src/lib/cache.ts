type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE_TTL = 60 * 1000; // 1 minute

const store = new Map<string, CacheEntry<any>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    store.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCache<T>(key: string, data: T) {
  store.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache(key: string) {
  store.delete(key);
}