import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeft, Printer, Save } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useChallans } from "@/store/challans";
import { ChallanDocument } from "@/ui/components/challan-document";

import { printPage } from "@/lib/platform";

import { Button } from "@/ui/components/ui/button";
import { Skeleton } from "@/ui/components/motion";

import { type ChallanKind } from "./challans-shared";

export function ChallanPrintRoute({ kind }: { kind: ChallanKind }) {
  const { id } = useParams();
  const { detail, load, clearDetail } = useChallans();
  const company = useAuth((s) => s.company);
  const printed = useRef(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadError(false);
    void load(id).catch(() => setLoadError(true));
  }, [id, load]);

  useEffect(() => clearDetail, [clearDetail]);

  useEffect(() => {
    if (detail && !printed.current) {
      printed.current = true;
      const t = setTimeout(() => void printPage(kind.singular), 350);
      return () => clearTimeout(t);
    }
  }, [detail, kind.singular]);

  if (loadError) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        Couldn't load the challan. Check your connection.
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] flex-col items-center gap-3 bg-muted p-4">
        <span className="sr-only">Loading challan</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  const { challan } = detail;

  return (
    <div className="min-h-[calc(100dvh-var(--titlebar-h))] bg-muted p-4 print:bg-white print:p-0">
      <style>{`@page { size: 210mm 148mm; margin: 0; }
.challan-sheet { page-break-after: always; }
.challan-sheet:last-child { page-break-after: auto; }`}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to={`${kind.listPath}/${challan.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <Button onClick={() => void printPage(kind.singular)}>
          <Printer className="size-4" aria-hidden />
          Print / Save as PDF
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6 print:gap-0">
        <ChallanDocument detail={detail} company={company} type={kind.type} />
      </div>
    </div>
  );
}
