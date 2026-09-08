import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CloudOff,
  Download,
  Pencil,
  Printer,
  SearchX,
  Trash2,
} from "lucide-react";
import { RecipeLinkButton } from "@/ui/components/recipe-detail";
import {
  useAuth,
  useChallans,
  type Challan,
  type ChallanItem,
  friendlyError,
  ApiError,
  toastError,
  toastSuccess,
} from "@kataria-syntex/app-core";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";

import { Badge } from "@/ui/components/ui/badge";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Skeleton } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";

import { fmtBoxes, fmtWt } from "@/ui/lib/format";
import { type ChallanKind } from "./challans-shared";

export function ChallanDetailRoute({ kind }: { kind: ChallanKind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { detail, load, remove, clearDetail } = useChallans();
  const company = useAuth((s) => s.company);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (id)
      void load(id).catch((err) => {
        if (err instanceof ApiError && err.code === "not_found") {
          setNotFound(true);
          return;
        }
        setError(friendlyError(err, "Something went wrong."));
      });
  }, [id, load]);

  // Never let a previously-loaded challan leak into this (or another) route.
  useEffect(() => clearDetail, [clearDetail]);

  if (notFound) {
    return (
      <>
        <Empty className="mt-6">
          <EmptyMedia variant="icon">
            <SearchX className="size-5" aria-hidden />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Challan not found</EmptyTitle>
            <EmptyDescription>
              This {kind.singular} was deleted from another device, or the link
              you opened is stale.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link to={kind.listPath}>
                <ArrowLeft className="size-4" aria-hidden />
                Back to{" "}
                {kind.type === "sales" ? "sales challans" : "job-work challans"}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    );
  }

  if (error) {
    return (
      <>
        <p className="text-sm text-destructive">{error}</p>
        <Link
          to={kind.listPath}
          className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-3 w-36" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="mt-6 h-64 rounded-lg" />
      </>
    );
  }

  const { challan, items } = detail;
  const party = kind.type === "sales" ? detail.customer : detail.jobWorker;
  const partyName =
    kind.type === "sales" ? challan.customerName : challan.jobWorkerName;

  const onDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: `Delete ${kind.singular} ${challan.challanNumber}?`,
      description: "This permanently removes the challan and its lines.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await remove(id);
      navigate(kind.listPath);
    } catch (err) {
      // Toast only — a failed delete must not tear down the detail view.
      toastError(
        "Could not delete",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDeleting(false);
    }
  };

  const onDownload = async () => {
    if (!id || !detail) return;
    setDownloading(true);
    try {
      const { downloadChallanPdf } = await import("@/lib/challan-pdf");
      const res = await downloadChallanPdf(id, detail, company, kind.type);
      if (res.via === "local")
        toastSuccess("PDF made on this device", "Rendered locally.");
    } catch (err) {
      toastError(
        "Could not download PDF",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            to={kind.listPath}
            className="hidden sm:inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="sr-only">Back</span>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title font-mono tabular-nums">
                {challan.challanNumber}
              </h1>
              <Badge variant="secondary" className="font-medium tabular-nums">
                FY {challan.fyLabel}
              </Badge>
              {challan.conflict ? (
                <Badge
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive gap-1"
                >
                  <AlertTriangle className="size-3" aria-hidden />
                  Clash
                </Badge>
              ) : challan.pendingSync ? (
                <Badge variant="outline" className="gap-1">
                  <CloudOff className="size-3" aria-hidden />
                  Waiting to sync
                </Badge>
              ) : null}
            </div>
            <p className="page-desc mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                {challan.date}
              </span>
              <span
                className="hidden sm:inline size-1 rounded-full bg-border"
                aria-hidden
              />
              <span className="truncate">{company?.name ?? "This device"}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            asChild
            variant="outline"
            className="flex-1 sm:flex-none sm:hidden"
          >
            <Link to={kind.listPath}>
              <ArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
          <Button
            variant="outline"
            loading={downloading}
            onClick={() => void onDownload()}
            className="flex-1 sm:flex-none"
          >
            <Download aria-hidden />
            <span>PDF</span>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link to={`${kind.listPath}/${challan.id}/print`}>
              <Printer aria-hidden />
              <span className="hidden sm:inline">Print</span>
            </Link>
          </Button>
          {!challan.pendingSync && (
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link to={`${kind.listPath}/${challan.id}/edit`}>
                <Pencil aria-hidden />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => void onDelete()}
            loading={deleting}
            className="flex-1 sm:flex-none"
          >
            <Trash2 aria-hidden />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      {dialog}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="micro-label">{kind.party}</div>
            <div className="mt-2 text-[15px] font-bold tracking-tight">
              {partyName}
            </div>
            {kind.type === "sales" && challan.customerGstin && (
              <div className="mt-1 inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs font-medium">
                GSTIN {challan.customerGstin}
              </div>
            )}
            {party?.address && (
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {party.address}
              </div>
            )}
            {party?.phone && (
              <div className="mt-1 text-sm font-medium text-muted-foreground">
                {party.phone}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:text-right">
            <div className="micro-label">Summary</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2 sm:justify-end">
              <span className="page-title tabular-nums">
                {fmtBoxes(challan.totalBoxes)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                boxes
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="page-title tabular-nums text-primary">
                {fmtWt(challan.totalNetWt)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                kg
              </span>
            </div>
            <div className="mt-2 text-xs tabular-nums text-muted-foreground">
              {items.length} {items.length === 1 ? "line" : "lines"} • FY{" "}
              {challan.fyLabel}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
          <span className="micro-label">Line items</span>
          <Badge variant="secondary" className="font-semibold tabular-nums">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        </div>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card">
                <tr className="border-b border-border micro-label">
                  <th className="py-3 pl-5 pr-3">#</th>
                  <th className="py-3 pr-3">Denier</th>
                  <th className="py-3 pr-3">Colour</th>
                  <th className="py-3 pr-3 text-right">Boxes</th>
                  <th className="py-3 pr-3 text-right">Net wt (kg)</th>
                  <th className="py-3 pr-5 text-right">Lot</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: ChallanItem, idx: number) => (
                  <tr
                    key={i.id}
                    className="border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-2.5 pl-5 pr-3 text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{i.denierName}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block size-3.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: i.colorCode || undefined }}
                        />
                        {i.colorName}
                      </span>
                      <RecipeLinkButton
                        colorId={i.colorId}
                        denierId={i.denierId}
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium">
                      {fmtBoxes(i.boxes)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">
                      {fmtWt(i.netWt)}
                    </td>
                    <td className="py-2.5 pr-5 text-right tabular-nums text-muted-foreground">
                      {i.lotNo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={3} className="py-3.5 pl-5 pr-3">
                    Total
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums">
                    {fmtBoxes(challan.totalBoxes)}
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums text-primary">
                    {fmtWt(challan.totalNetWt)}
                  </td>
                  <td className="py-3.5 pr-5" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden p-3 space-y-3">
            {items.map((i: ChallanItem, idx: number) => (
              <div
                key={i.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-muted text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold leading-none">
                        {i.denierName}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="size-2.5 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: i.colorCode || undefined }}
                          aria-hidden
                        />
                        {i.colorName} {i.lotNo ? `• Lot ${i.lotNo}` : ""}
                      </div>
                    </div>
                  </div>
                  <RecipeLinkButton colorId={i.colorId} denierId={i.denierId} />
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {fmtWt(i.netWt)}{" "}
                      <span className="text-xs font-medium text-muted-foreground">
                        kg
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {fmtBoxes(i.boxes)} {i.boxes === 1 ? "box" : "boxes"}
                    </div>
                  </div>
                </div>
                {i.boxNo || i.remarks ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {i.boxNo && (
                      <span className="rounded-sm bg-secondary px-2 py-1 font-medium">
                        Box {i.boxNo}
                      </span>
                    )}
                    {i.remarks && (
                      <span className="rounded-sm bg-muted px-2 py-1 text-muted-foreground">
                        {i.remarks}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="rounded-lg bg-muted p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold tabular-nums">
                {fmtBoxes(challan.totalBoxes)} boxes •{" "}
                {fmtWt(challan.totalNetWt)} kg
              </span>
            </div>
          </div>

          {challan.notes && (
            <div className="mx-3 sm:mx-5 mb-3 sm:mb-5 mt-3 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
              <span className="font-semibold text-foreground">Notes: </span>
              <span className="text-muted-foreground">{challan.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
