import { useSyncExternalStore } from "react";
import { configureToasts } from "@kataria-syntex/app-core";

export type ToastItem = { id: number; title: string };

/** Web sonner auto-dismisses after ~4s — one shared dwell here. */
const TOAST_DURATION_MS = 4000;
/** Sonner shows at most 3 toasts (its visibleToasts default). */
const MAX_VISIBLE = 3;

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = items.filter((toast) => toast.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

function push(title: string): void {
  seq += 1;
  // Beyond 3 the oldest drops unseen — sonner hides overflow the same way.
  items = [...items.slice(-(MAX_VISIBLE - 1)), { id: seq, title }];
  timers.set(
    seq,
    setTimeout(() => dismissToast(seq), TOAST_DURATION_MS),
  );
  emit();
}

function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getToastsSnapshot(): ToastItem[] {
  return items;
}

/** The live toast list, oldest first — the overlay renders in order so the
 * newest lands at the bottom, exactly as sonner stacks bottom-center. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsSnapshot,
  );
}

/** Android sink for app-core's toast events — feeds the overlay instead of
 * the platform toast, so toasts match the web sonner cards. Title only: one
 * line per toast (design.md §3). */
export function configureAndroidToasts(): void {
  configureToasts({
    success: (title) => push(title),
    error: (title) => push(title),
  });
}
