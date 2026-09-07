import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useChallans } from "@/store/challans";

import { printPage } from "@/lib/platform";
import { loadChallanFonts } from "@/lib/challan-pdf";
import {
  SHEET_H_MM,
  SHEET_W_MM,
  buildChallanSheets,
} from "../../../shared/challan-html";

import { Button } from "@/ui/components/ui/button";
import { Skeleton } from "@/ui/components/motion";

import { type ChallanKind } from "./challans-shared";

/** The print view renders the SAME sheets the PDF pipelines consume. */
function useChallanSheets(
  id: string | undefined,
  type: ChallanKind["type"],
): { markup: string | null; failed: boolean } {
  const { detail, load, clearDetail } = useChallans();
  const company = useAuth((s) => s.company);
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    setFailed(false);
    void load(id).catch(() => setFailed(true));
  }, [id, load]);

  useEffect(() => clearDetail, [clearDetail]);

  useEffect(() => {
    if (!detail) return;
    let alive = true;
    void (async () => {
      const fonts = await loadChallanFonts();
      const { css, body } = buildChallanSheets({
        detail,
        company,
        type,
        fonts,
      });
      if (alive) setMarkup(`<style>${css}</style>${body}`);
    })().catch(() => {
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [detail, company, type]);

  return { markup, failed };
}

export function ChallanPrintRoute({ kind }: { kind: ChallanKind }) {
  const { id } = useParams();
  const { detail } = useChallans();
  const { markup, failed } = useChallanSheets(id, kind.type);
  const printed = useRef(false);

  useEffect(() => {
    if (markup && !printed.current) {
      printed.current = true;
      const t = setTimeout(() => void printPage(kind.singular), 350);
      return () => clearTimeout(t);
    }
  }, [markup, kind.singular]);

  if (failed) {
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

  if (!detail || !markup) {
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
      <style>{`@page { size:${SHEET_W_MM}mm ${SHEET_H_MM}mm; margin:0; }`}</style>
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

      <div className="flex flex-col items-center gap-6 print:gap-0 overflow-x-auto">
        <div dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </div>
  );
}
