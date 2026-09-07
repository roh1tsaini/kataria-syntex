/**
 * Promise cache with reset-on-error: concurrent callers share one in-flight
 * load, and a rejection clears the slot so the next call retries instead of
 * replaying the same failure forever. Shared by the server and desktop font
 * loaders (same ChallanFonts template, different byte sources).
 */
export function createCached<T>(load: () => Promise<T>): () => Promise<T> {
  let cache: Promise<T> | null = null;
  return () => {
    cache ??= load().catch((e) => {
      cache = null;
      throw e;
    });
    return cache;
  };
}
