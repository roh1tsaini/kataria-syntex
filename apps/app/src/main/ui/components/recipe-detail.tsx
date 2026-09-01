import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useRecipes, type RecipeDetail } from "@/store/recipes";
import type { RecipeVersionPayload } from "@/store/recipes";
import { friendlyError } from "@/ui/lib/errors";
import { toastError, toastSuccess } from "@/store/toast";
import { fmtDate } from "@/ui/lib/format";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { FieldError } from "@/ui/components/ui/field";
import { Skeleton } from "@/ui/components/motion";

/** "60°C · 1 hr 30 min" — parts omit what the recipe doesn't set. */
export function processSummary(r: {
  processTempC: number | null;
  processTimeHrs: number | null;
  processTimeMin: number | null;
  processTimeSec: number | null;
}): string {
  const time = [
    r.processTimeHrs ? `${r.processTimeHrs} hr` : null,
    r.processTimeMin ? `${r.processTimeMin} min` : null,
    r.processTimeSec ? `${r.processTimeSec} sec` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return [r.processTempC != null ? `${r.processTempC}°C` : null, time]
    .filter(Boolean)
    .join(" · ");
}

function VersionViewDialog({
  open,
  onOpenChange,
  recipeId,
  version,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string | null;
  version: number | null;
}) {
  const fetchVersion = useRecipes((s) => s.fetchVersion);
  const [payload, setPayload] = useState<RecipeVersionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !recipeId || version == null) return;
    setPayload(null);
    setError(null);
    fetchVersion(recipeId, version)
      .then(setPayload)
      .catch((err) => setError(friendlyError(err)));
  }, [open, recipeId, version, fetchVersion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Version {version ?? "—"}</DialogTitle>
          <DialogDescription>
            Saved snapshot — read-only. Restore it from the recipe details.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : !payload ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-1.5">
              {payload.ingredients.map((i, idx) => (
                <li
                  key={idx}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{i.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
            {processSummary(payload) && (
              <p className="text-sm text-muted-foreground">
                {processSummary(payload)}
              </p>
            )}
            {payload.notes && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {payload.notes}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RecipeDetailDialog({
  open,
  onOpenChange,
  recipeId,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string | null;
  onRestored?: () => void;
}) {
  const fetchRecipe = useRecipes((s) => s.fetchRecipe);
  const restoreRecipe = useRecipes((s) => s.restoreRecipe);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [versionView, setVersionView] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !recipeId) return;
    setDetail(null);
    setError(null);
    fetchRecipe(recipeId)
      .then(setDetail)
      .catch((err) => setError(friendlyError(err)));
  }, [open, recipeId, fetchRecipe]);

  const onRestore = async (version: number) => {
    if (!recipeId) return;
    setRestoring(true);
    try {
      await restoreRecipe(recipeId, version);
      const fresh = await fetchRecipe(recipeId);
      setDetail(fresh);
      toastSuccess(`Restored from version ${version}`);
      onRestored?.();
    } catch (err) {
      toastError("Could not restore", friendlyError(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recipe details</DialogTitle>
            <DialogDescription>
              Current version plus the last 5 saves.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <FieldError>{error}</FieldError>
          ) : !detail ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                {detail.ingredients.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{i.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {i.quantity} {i.unit}
                    </span>
                  </div>
                ))}
              </div>
              {processSummary(detail.recipe) && (
                <p className="text-sm text-muted-foreground">
                  {processSummary(detail.recipe)}
                </p>
              )}
              {detail.recipe.notes && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {detail.recipe.notes}
                </p>
              )}
              <section className="space-y-1 border-t border-border pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Version history
                </h4>
                {detail.versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <span className="w-9 shrink-0 font-medium tabular-nums">
                      v{v.version}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {v.restoredFrom != null
                        ? `restored from v${v.restoredFrom} · `
                        : ""}
                      {fmtDate(v.createdAt)}
                      {v.savedByName ? ` · ${v.savedByName}` : ""}
                    </span>
                    {v.version === detail.recipe.version ? (
                      <Badge variant="secondary">current</Badge>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVersionView(v.version)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={restoring}
                          onClick={() => void onRestore(v.version)}
                        >
                          Restore
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <VersionViewDialog
        open={versionView != null}
        onOpenChange={(o) => {
          if (!o) setVersionView(null);
        }}
        recipeId={recipeId}
        version={versionView}
      />
    </>
  );
}

/** Per-item "Recipe" affordance: opens the recipe for this color+denier,
 * or says plainly when none is recorded. */
export function RecipeLinkButton({
  colorId,
  denierId,
}: {
  colorId: string | null | undefined;
  denierId: string | null | undefined;
}) {
  const lookupRecipe = useRecipes((s) => s.lookupRecipe);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!colorId || !denierId) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const found = await lookupRecipe(colorId, denierId);
      if (found) {
        setRecipeId(found);
        setOpen(true);
      } else {
        toastSuccess("No recipe saved for this color and denier yet.");
      }
    } catch (err) {
      toastError("Could not look up the recipe", friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label="View dyeing recipe"
        title="View dyeing recipe"
        onClick={() => void onClick()}
      >
        <FlaskConical className="size-4" aria-hidden />
      </Button>
      <RecipeDetailDialog
        open={open}
        onOpenChange={setOpen}
        recipeId={recipeId}
      />
    </>
  );
}
