const entries = new Map<string, unknown>();
const maxEntries = 30;

export function readAdminCache<T>(key: string): T | undefined {
  return entries.get(key) as T | undefined;
}

export function writeAdminCache<T>(key: string, value: T) {
  if (!entries.has(key) && entries.size >= maxEntries) {
    const oldest = entries.keys().next().value as string | undefined;
    if (oldest) entries.delete(oldest);
  }
  entries.delete(key);
  entries.set(key, value);
}

export function clearAdminCache() {
  entries.clear();
}

export function adminSearchDelay(query: string) {
  return query.trim() ? 200 : 0;
}
