/**
 * Loads master data for an editor form, collapsing failures into one retry
 * state — the RN counterpart of apps/app's ui/hooks/use-masters-load.
 *
 * The challan editor, packing and returns forms share the exact
 * load → disable save on failure → nonce-retry shape; this hook keeps that
 * behavior identical by construction instead of by three copies.
 */

import { useEffect, useRef, useState } from "react";

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
