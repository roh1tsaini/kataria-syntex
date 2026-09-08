/**
 * Human-path conflict settlement: renumber-and-resync plus error retry.
 * Split from sync.ts — imports the orchestrator's settle loop, never the
 * reverse, so the module graph stays acyclic.
 */
import { parseSeqFromNumber } from "@kataria-syntex/shared";
import { listPending, readCompany, updatePending } from "./core";
import { recountPending } from "./sync-state";
import { syncUntilSettled } from "./sync";

/** Clash fix: adopt the suggested (or manually entered) number and resync. */
export async function resubmitWithNumber(
  clientRef: string,
  newNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  const p = listPending().find((x) => x.clientRef === clientRef);
  if (!p) return { ok: false, error: "Not found" };
  const numbering = readCompany()?.numbering;
  if (!numbering)
    return { ok: false, error: "Numbering config unavailable offline" };
  const seq = parseSeqFromNumber(numbering, p.input.type, newNumber, p.fyLabel);
  if (seq == null)
    return {
      ok: false,
      error: "Number doesn't match the configured format",
    };
  updatePending(clientRef, {
    challanNumber: newNumber,
    seq,
    status: "pending",
    suggestion: undefined,
    errorCode: undefined,
    local: { ...p.local, challanNumber: newNumber, suggestion: undefined },
  });
  recountPending();
  const after = await syncUntilSettled(clientRef);
  if (!after) return { ok: true };
  if (after.status === "pending")
    return { ok: false, error: "Still waiting to sync — try again" };
  if (after.status === "conflict")
    return { ok: false, error: "That number is also taken" };
  return { ok: false, error: after.errorCode ?? "Rejected" };
}

/** Retry a challan the server rejected (e.g. after fixing the cause online). */
export async function retryErrored(clientRef: string): Promise<void> {
  updatePending(clientRef, { status: "pending", errorCode: undefined });
  recountPending();
  await syncUntilSettled(clientRef);
}
