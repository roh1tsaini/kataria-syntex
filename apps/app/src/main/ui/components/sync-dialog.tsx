import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Input } from "@/ui/components/ui/input";
import { useSync } from "@/lib/offline/sync";
import { listPending, type PendingChallan } from "@/lib/offline/core";
import { resubmitWithNumber, retryErrored } from "@/lib/offline/sync";
import { toastSuccess } from "@/store/toast";
import { EASE_OUT } from "@/ui/lib/motion";
import { cn } from "@/ui/lib/cn";

/**
 * Sync status: a slim banner under the header while offline or while anything
 * is queued, and a dialog listing waiting / clashing / failed challans with
 * one-tap fixes.
 */

export function SyncBanner({ onOpen }: { onOpen: () => void }) {
  const { online, syncing, pendingCount, conflictCount, errorCount } =
    useSync();
  const reduceMotion = useReducedMotion();
  const issues = conflictCount + errorCount;
  if (online && pendingCount === 0 && issues === 0) return null;

  const tone = issues
    ? "border-destructive/25 bg-destructive/10 text-destructive"
    : online
      ? "border-primary/25 bg-primary/10 text-primary"
      : "border-border bg-muted text-muted-foreground";

  const label = issues
    ? `${issues} challan${issues === 1 ? "" : "s"} need${issues === 1 ? "s" : ""} attention — tap to fix`
    : online
      ? syncing
        ? `Syncing ${pendingCount} challan${pendingCount === 1 ? "" : "s"}…`
        : `${pendingCount} waiting to sync`
      : pendingCount > 0
        ? `Offline — ${pendingCount} challan${pendingCount === 1 ? "" : "s"} saved on this device`
        : "Offline — you can keep working; saves stay on this device";

  const Icon = issues ? AlertTriangle : online ? RefreshCw : CloudOff;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }
      }
      className={cn(
        "flex w-full items-center gap-2.5 border-b px-4 py-2 text-left text-xs font-semibold sm:px-6",
        tone,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {online && !issues && !syncing && (
        <CheckCircle2 className="size-3.5 shrink-0 opacity-60" aria-hidden />
      )}
    </motion.button>
  );
}

function StatusChip({ status }: { status: PendingChallan["status"] }) {
  if (status === "pending")
    return (
      <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Waiting
      </span>
    );
  if (status === "conflict")
    return (
      <span className="rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-destructive">
        Number clash
      </span>
    );
  return (
    <span className="rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-destructive">
      Failed
    </span>
  );
}

function ConflictRow({
  p,
  onResolved,
}: {
  p: PendingChallan;
  onResolved: () => void;
}) {
  const [value, setValue] = useState(p.suggestion ?? p.challanNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await resubmitWithNumber(p.clientRef, value.trim());
      if (!res.ok) {
        setError(res.error ?? "Could not fix");
        return;
      }
      // The conflict row remounts once restored to pending; tell the sheet to
      // re-read the queue so this entry disappears.
      onResolved();
      toastSuccess(`Challan ${value.trim()} resolved`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums">{p.challanNumber}</span>
        <StatusChip status={p.status} />
        <span className="text-xs text-muted-foreground">
          {p.local.date} · {p.local.customerName ?? p.local.jobWorkerName}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Another device already used this number. Suggested:{" "}
        <span className="font-semibold text-foreground">{p.suggestion}</span>
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && value.trim()) void apply();
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-44 font-semibold tabular-nums"
          aria-label="New challan number"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${p.clientRef}-resolver-error` : undefined}
          disabled={busy}
        />
        <Button type="submit" loading={busy}>
          Use this number
        </Button>
      </form>
      {error && (
        <p
          id={`${p.clientRef}-resolver-error`}
          className="mt-1.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ErrorRow({ p }: { p: PendingChallan }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <span className="font-semibold tabular-nums">{p.challanNumber}</span>
      <StatusChip status={p.status} />
      <span className="flex-1 text-xs text-muted-foreground">
        {p.errorCode === "invalid_customer" ||
        p.errorCode === "invalid_job_worker"
          ? "The party no longer exists on the server"
          : p.errorCode === "fy_mismatch"
            ? "The financial year changed for this date"
            : `Server rejected it (${p.errorCode ?? "unknown"})`}
      </span>
      <Button
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await retryErrored(p.clientRef);
          } finally {
            setBusy(false);
          }
        }}
      >
        Retry
      </Button>
    </div>
  );
}

export function SyncDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { online, syncing } = useSync();
  const [, setTick] = useState(0);
  // listPending() reads the live queue — call each render so background
  // sync changes appear without reopening; bump tick to force a re-render
  // after a successful resolve.
  const pending = listPending();
  const waiting = pending.filter((p) => p.status === "pending");
  const conflicts = pending.filter((p) => p.status === "conflict");
  const errors = pending.filter((p) => p.status === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync status</DialogTitle>
          <DialogDescription>
            {online
              ? "Connected — queued challans send automatically."
              : "Offline — challans made on this device send automatically once the server is back."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {pending.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nothing queued. Everything is saved on the server.
            </p>
          )}

          {conflicts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Number clashes
              </h4>
              {conflicts.map((p) => (
                <ConflictRow
                  key={p.clientRef}
                  p={p}
                  onResolved={() => setTick((t) => t + 1)}
                />
              ))}
            </section>
          )}

          {errors.length > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Failed to sync
              </h4>
              {errors.map((p) => (
                <ErrorRow key={p.clientRef} p={p} />
              ))}
            </section>
          )}

          {waiting.length > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Waiting to sync {syncing ? "— sending now…" : ""}
              </h4>
              {waiting.map((p) => (
                <div
                  key={p.clientRef}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3"
                >
                  <span className="font-semibold tabular-nums">
                    {p.challanNumber}
                  </span>
                  <StatusChip status={p.status} />
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {p.local.date} ·{" "}
                    {p.local.customerName ?? p.local.jobWorkerName}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
