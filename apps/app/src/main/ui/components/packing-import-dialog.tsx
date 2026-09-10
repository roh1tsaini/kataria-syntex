import { useEffect, useState } from "react";
import { api } from "@kataria-syntex/app-core";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Skeleton } from "@/ui/components/motion";

export type PackingItem = {
  id: string;
  entryNumber: string;
  date: string;
  denierId: string | null;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  netWt: number;
  lotNo: string | null;
  boxNo: string | null;
  cones: number | null;
};

type PackingEntry = {
  id: string;
  entryNumber: string;
  date: string;
  items: PackingItem[];
};

/**
 * Import packed sale items as challan rows. Owns its list load / error /
 * retry state so the challan editor stays a form, not a data loader.
 */
export function PackingImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: PackingItem[]) => void;
}) {
  const [entries, setEntries] = useState<PackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Bumped by Retry — re-runs the fetch without closing the dialog. */
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await api<{ items: PackingEntry[] }>("/packing?type=sale");
        setEntries(res.items);
      } catch {
        setEntries([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reloadNonce]);

  const toggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Closing by any path (Cancel, Escape, overlay, import) drops the stale
  // selection — reopening starts clean instead of pre-checking old rows.
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setSelected(new Set());
  };

  const importSelected = () => {
    const items: PackingItem[] = [];
    for (const entry of entries) {
      for (const item of entry.items) {
        if (selected.has(item.id)) items.push(item);
      }
    }
    onImport(items);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Packing</DialogTitle>
          <DialogDescription>
            Select packed items to add as challan rows.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-sm text-destructive">
                Couldn't load packing entries.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No packing entries available for import
            </p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-border/40 bg-muted px-3 py-2">
                    <span className="font-mono text-xs font-semibold">
                      {entry.entryNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.date}
                    </span>
                  </div>
                  {entry.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                    >
                      {/* Keyboard toggling goes through the checkbox itself;
                          stop pointer clicks here so the row's onClick doesn't
                          double-toggle. */}
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggle(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {item.denierName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.colorName}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.netWt.toFixed(3)} kg
                          {item.lotNo ? ` · Lot: ${item.lotNo}` : ""}
                          {item.boxNo ? ` · Box: ${item.boxNo}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={importSelected} disabled={selected.size === 0}>
            Import {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
