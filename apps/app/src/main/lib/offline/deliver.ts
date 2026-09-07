/**
 * Single pending-challan delivery. Split from sync.ts — pure attempt
 * mapping (server keys on client_ref, so retrying is always safe).
 */
import { api, ApiError } from "@/lib/api";
import type { PendingChallan } from "./core";

export type DeliverResult =
  | { synced: true }
  | { synced: false; reason: "network" | "conflict"; suggestion?: string }
  | { synced: false; reason: "rejected"; code: string };

export async function deliver(p: PendingChallan): Promise<DeliverResult> {
  try {
    await api("/challans", {
      method: "POST",
      body: {
        ...p.input,
        offline: {
          clientRef: p.clientRef,
          originDevice: p.originDevice,
          challanNumber: p.challanNumber,
          seq: p.seq,
          fyLabel: p.fyLabel,
        },
      },
    });
    return { synced: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const data: unknown = err.data;
      const suggestion =
        data !== null &&
        typeof data === "object" &&
        "suggestion" in data &&
        typeof (data as { suggestion: unknown }).suggestion === "string"
          ? (data as { suggestion: string }).suggestion
          : undefined;
      return { synced: false, reason: "conflict", suggestion };
    }
    if (err instanceof ApiError && err.isNetworkError)
      return { synced: false, reason: "network" };
    return {
      synced: false,
      reason: "rejected",
      code: err instanceof ApiError ? err.code : "unknown",
    };
  }
}
