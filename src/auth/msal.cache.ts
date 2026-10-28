import config from "#/config.js";
import { getRedisClient } from "#/lib/redis.js";

const CACHE_KEY_PREFIX = "msal:";

/**
 * Deletes the MSAL token cache associated with a session.
 * @param sessionId - The Express session identifier.
 */
export async function deleteMsalCache(sessionId: string): Promise<void> {
  if (!config.redis.enabled) return;

  await getRedisClient().del(getMsalCacheKey(sessionId));
}

/**
 * Builds the Redis key used to persist an MSAL cache blob for a session.
 * @param sessionId - The express-session ID.
 * @returns Redis key for this session's MSAL token cache.
 */
export function getMsalCacheKey(sessionId: string): string {
  return `${CACHE_KEY_PREFIX}${sessionId}`;
}

/**
 * Sets the MSAL token cache expiry to the session's absolute deadline.
 * @param sessionId - The Express session identifier.
 * @param expiresAt - The absolute expiry time in milliseconds.
 */
export async function setMsalCacheExpiry(
  sessionId: string,
  expiresAt: number,
): Promise<void> {
  if (!config.redis.enabled) return;

  await getRedisClient().pExpireAt(getMsalCacheKey(sessionId), expiresAt);
}
