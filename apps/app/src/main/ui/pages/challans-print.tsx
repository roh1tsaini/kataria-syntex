import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeft, Printer } from "lucide-react";
import {
  apiBlob,
  useAuth,
  useChallans,
  friendlyError,
  toastError,
} from "@kataria-syntex/app-core";
import { isAndroidShell, printPage, sharePdfOnAndroid } from "@/lib/platform";
import { loadChallanFonts, safeFilename } from "@/lib/challan-pdf";
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
  const [printing, setPrinting] = useState(false);

  const printChallan = useCallback(() => {
    if (!id || !detail) return;
    if (isAndroidShell()) {
      // The WebView can't print the page, and no maintained Capacitor plugin
      // prints a file — so Android gets the share sheet over the same server
      // PDF the download path uses. The user picks Drive, a print app, or
      // Save from there.
      setPrinting(true);
      void apiBlob(`/challans/${id}/pdf`)
        .then(async (blob) => {
          await sharePdfOnAndroid(
            new Uint8Array(await blob.arrayBuffer()),
            safeFilename(detail.challan.challanNumber),
          );
        })
        .catch((err: unknown) => {
          toastError(
            "Could not share",
            friendlyError(err, "Something went wrong."),
          );
        })
        .finally(() => setPrinting(false));
      return;
    }
    void printPage();
  }, [id, detail, kind.singular]);

  useEffect(() => {
    if (markup && !printed.current) {
      printed.current = true;
      // Web/desktop: open the print preview immediately. Android is skipped —
      // its flow starts from the button, not from a sheet opened on load.
      if (!isAndroidShell()) {
        const t = setTimeout(() => void printPage(), 350);
        return () => clearTimeout(t);
      }
    }
  }, [markup, kind.singular]);

  if (failed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
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
      <div className="flex min-h-dvh flex-col items-center gap-3 bg-muted p-4">
        <span className="sr-only">Loading challan</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  const { challan } = detail;

  return (
    <div className="min-h-dvh bg-muted p-4 print:bg-white print:p-0">
      <style>{`@page { size:${SHEET_W_MM}mm ${SHEET_H_MM}mm; margin:0; }`}</style>
      {/* The action bar sits inside the Electron title-bar drag strip
          (design.md §2.7.1) — it must subtract itself or its controls are
          not clickable in the desktop shell. */}
      <div
        className="mb-4 flex items-center justify-between print:hidden"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <Link
          to={`${kind.listPath}/${challan.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <Button onClick={printChallan} disabled={printing} loading={printing}>
          <Printer className="size-4" aria-hidden />
          {isAndroidShell()
            ? printing
              ? "Opening share…"
              : "Share / Save PDF"
            : printing
              ? "Opening print…"
              : "Print / Save as PDF"}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6 print:gap-0 overflow-x-auto">
        <div dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </div>
  );
}
