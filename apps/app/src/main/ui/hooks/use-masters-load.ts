import { useEffect, useRef, useState } from "react";

/**
 * Loads master data for an editor form, collapsing failures into one retry
 * state. The packing / returns / raw-material forms share the exact
 * load → disable save on failure → nonce-retry shape; this hook keeps that
 * behavior identical by construction.
 */
export function useMastersLoad(load: () => Promise<unknown>): {
  /** True when the last load attempt failed — callers must block submit. */
  failed: boolean;
  retry: () => void;
} {
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setFailed(false);
    void loadRef.current().catch(() => setFailed(true));
  }, [nonce]);

  return { failed, retry: () => setNonce((n) => n + 1) };
}
