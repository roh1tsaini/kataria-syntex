/**
 * Offline challan creation: issues a number from the cached FY counter,
 * snapshots master names from the local cache, and queues the record for
 * sync. The local projection is a full Challan DTO so list/detail/print pages
 * render pending challans exactly like synced ones.
 */

import type { Challan, ChallanInput, ChallanItem } from "@/store/challans";
import {
  addPending,
  bumpCounter,
  deviceIdentity,
  nextSeq,
  readCompany,
  readMasters,
} from "./core";
import {
  DEFAULT_NUMBERING,
  challanTotals,
  fyLabelForDateString,
  formatNumberForType,
  round3,
} from "@kataria-syntex/shared";

/** Creates a challan entirely on-device and queues it for sync.
 * `existingClientRef` reuses the clientRef the online attempt already sent,
 * so the server's dedupe covers the lost-response case. */
export function createOfflineChallan(
  input: ChallanInput,
  existingClientRef?: string,
): Challan {
  const device = deviceIdentity();
  const fyLabel = fyLabelForDateString(input.date);
  const numbering = readCompany()?.numbering ?? DEFAULT_NUMBERING;
  const seq = nextSeq(fyLabel, input.type);
  const challanNumber = formatNumberForType(
    numbering,
    input.type,
    seq,
    fyLabel,
  );
  const clientRef =
    existingClientRef ??
    `ofl-${device.ref.replace(/-/g, "").slice(0, 12)}-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();
  const masters = readMasters();

  const customer = masters?.customers.find((c) => c.id === input.customerId);
  const partyName =
    input.type === "sales"
      ? (customer?.name ?? "Unknown customer")
      : (masters?.jobWorkers.find((w) => w.id === input.jobWorkerId)?.name ??
        "Unknown job worker");

  const items: ChallanItem[] = input.items.map((i, idx) => {
    const denier = masters?.deniers.find((d) => d.id === i.denierId);
    const color = masters?.colors.find((c) => c.id === i.colorId);
    const netWt = round3(i.netWt);
    return {
      id: `${clientRef}-i${idx}`,
      challanId: clientRef,
      seq: idx + 1,
      denierId: i.denierId,
      denierName: denier?.name ?? "Unknown denier",
      colorId: i.colorId,
      colorName: color?.name ?? "Unknown colour",
      colorCode: color?.code ?? null,
      boxNo: i.boxNo,
      lotNo: i.lotNo,
      cheese: i.cheese,
      grossWt: round3(i.grossWt),
      tareWt: round3(i.tareWt),
      remarks: i.remarks,
      boxes: i.boxes,
      netWt,
      createdAt: nowIso,
    };
  });

  const totals = challanTotals(items);

  const local: Challan = {
    id: clientRef,
    financialYearId: clientRef,
    type: input.type,
    challanNumber,
    date: input.date,
    customerId: input.customerId ?? null,
    customerName: input.type === "sales" ? partyName : null,
    customerGstin: customer?.gstin ?? null,
    jobWorkerId: input.jobWorkerId ?? null,
    jobWorkerName: input.type === "outward" ? partyName : null,
    notes: input.notes || null,
    ...totals,
    createdBy: "this-device",
    createdAt: nowIso,
    updatedAt: nowIso,
    fyLabel,
    pendingSync: true,
  };

  addPending({
    clientRef,
    originDevice: device.label,
    status: "pending",
    createdAt: nowIso,
    input,
    challanNumber,
    seq,
    fyLabel,
    local,
    items,
  });
  bumpCounter(fyLabel, input.type, seq);

  return local;
}
