import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = Readonly<{ correlationId: string }>;

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Reads the current request's correlation ID.
 * @returns The correlation ID, or undefined outside a request context.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Runs downstream work with the request's correlation ID.
 * @param context - The resolved request context.
 * @param callback - Work to run within the context.
 * @returns The callback's result.
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}
