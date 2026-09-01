import { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Palette,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { usePermission } from "@/store/auth";
import {
  useMasters,
  type Color,
  type ColorInput,
  type Denier,
} from "@/store/masters";
import {
  useRecipes,
  type RecipeInput,
  type RecipeListItem,
} from "@/store/recipes";
import { friendlyError } from "@/ui/lib/errors";
import { toastError, toastSuccess } from "@/store/toast";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import {
  RecipeDetailDialog,
  processSummary,
} from "@/ui/components/recipe-detail";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Textarea } from "@/ui/components/ui/textarea";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Skeleton } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";
import { cn } from "@/ui/lib/cn";

const UNIT_PRESETS = ["g", "mg", "kg", "mL", "L", "%"] as const;

type IngredientDraft = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  custom: boolean;
};

const newKey = () => Math.random().toString(36).slice(2);

function draftFromUnit(unit: string): { unit: string; custom: boolean } {
  return (UNIT_PRESETS as readonly string[]).includes(unit)
    ? { unit, custom: false }
    : { unit, custom: true };
}

// ── Color add/edit dialog ───────────────────────────────────────────────────

function ColorFormDialog({
  open,
  editing,
  onOpenChange,
}: {
  open: boolean;
  editing: Color | null;
  onOpenChange: (open: boolean) => void;
}) {
  const createColor = useMasters((s) => s.createColor);
  const updateColor = useMasters((s) => s.updateColor);
  const [draft, setDraft] = useState(() => ({
    name: editing?.name ?? "",
    code: editing?.code ?? "",
    stockType: editing?.stockType ?? "dyed",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const input: ColorInput = {
      name: draft.name.trim(),
      code: draft.code,
      stockType: draft.stockType,
    };
    try {
      if (editing) {
        await updateColor(editing.id, input);
        toastSuccess("Color updated");
      } else {
        await createColor(input);
        toastSuccess("Color added");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit color" : "Add color"}</DialogTitle>
          <DialogDescription>
            Colors are shared with every picker in the app.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="color-name">Name</FieldLabel>
              <Input
                id="color-name"
                required
                maxLength={60}
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="Color name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="color-code">Code</FieldLabel>
              <Input
                id="color-code"
                maxLength={20}
                value={draft.code}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, code: e.target.value }))
                }
                placeholder="Short code, e.g. NV"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="color-stocktype">Stock type</FieldLabel>
              <Select
                value={draft.stockType}
                onValueChange={(v) => setDraft((d) => ({ ...d, stockType: v }))}
              >
                <SelectTrigger id="color-stocktype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dyed">Dyed (finished yarn)</SelectItem>
                  <SelectItem value="raw">Raw (grey yarn)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!draft.name.trim()}>
              {editing ? "Save changes" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Recipe add/edit dialog ──────────────────────────────────────────────────

function RecipeEditorDialog({
  open,
  onOpenChange,
  color,
  editing,
  deniers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  color: Color;
  editing: RecipeListItem | null;
  deniers: Denier[];
}) {
  const createRecipe = useRecipes((s) => s.createRecipe);
  const updateRecipe = useRecipes((s) => s.updateRecipe);
  const fetchRecipe = useRecipes((s) => s.fetchRecipe);

  const [denierId, setDenierId] = useState(editing?.denierId ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { key: newKey(), name: "", quantity: "", unit: "g", custom: false },
  ]);
  const [temp, setTemp] = useState("");
  const [hrs, setHrs] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing loads the current recipe; adding starts from a blank row.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setDenierId(editing.denierId);
      setLoading(true);
      fetchRecipe(editing.id)
        .then((detail) => {
          setIngredients(
            detail.ingredients.map((i) => ({
              key: newKey(),
              name: i.name,
              quantity: String(i.quantity),
              ...draftFromUnit(i.unit),
            })),
          );
          setTemp(editing.processTempC?.toString() ?? "");
          setHrs(editing.processTimeHrs?.toString() ?? "");
          setMin(editing.processTimeMin?.toString() ?? "");
          setSec(editing.processTimeSec?.toString() ?? "");
          setNotes(editing.notes ?? "");
        })
        .catch((err) => setError(friendlyError(err)))
        .finally(() => setLoading(false));
    } else {
      setDenierId("");
      setIngredients([
        { key: newKey(), name: "", quantity: "", unit: "g", custom: false },
      ]);
      setTemp("");
      setHrs("");
      setMin("");
      setSec("");
      setNotes("");
    }
  }, [open, editing, fetchRecipe]);

  const setIngredient = (key: string, patch: Partial<IngredientDraft>) =>
    setIngredients((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const parsedIngredients = ingredients
    .filter((r) => r.name.trim() && r.quantity.trim())
    .map((r) => ({
      name: r.name.trim(),
      quantity: Number(r.quantity),
      unit: r.unit.trim(),
    }));
  const ingredientsValid =
    parsedIngredients.length > 0 &&
    parsedIngredients.every(
      (i) => Number.isFinite(i.quantity) && i.quantity > 0,
    );
  const denierValid = editing != null || denierId !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientsValid || !denierValid) return;
    setError(null);
    setBusy(true);
    const input: RecipeInput = {
      colorId: color.id,
      denierId: editing?.denierId ?? denierId,
      ingredients: parsedIngredients,
      processTempC: temp.trim() ? Number(temp) : null,
      processTimeHrs: hrs.trim() ? Number(hrs) : null,
      processTimeMin: min.trim() ? Number(min) : null,
      processTimeSec: sec.trim() ? Number(sec) : null,
      notes: notes.trim() || null,
    };
    try {
      if (editing) {
        await updateRecipe(editing.id, input);
        toastSuccess("Recipe saved as a new version");
      } else {
        await createRecipe(input);
        toastSuccess("Recipe created");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  const intField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    max: number,
  ) => (
    <Field className="w-24 flex-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Edit recipe — ${color.name}`
              : `New recipe — ${color.name}`}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Saving keeps the last 5 versions; the newest becomes current."
              : "One recipe per color and denier."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            {!editing && (
              <Field>
                <FieldLabel htmlFor="recipe-denier">Denier</FieldLabel>
                <Select value={denierId} onValueChange={setDenierId}>
                  <SelectTrigger id="recipe-denier">
                    <SelectValue placeholder="Pick a denier" />
                  </SelectTrigger>
                  <SelectContent>
                    {deniers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {deniers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add deniers in Master Data first.
                  </p>
                )}
              </Field>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Ingredients</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setIngredients((rows) => [
                      ...rows,
                      {
                        key: newKey(),
                        name: "",
                        quantity: "",
                        unit: "g",
                        custom: false,
                      },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Add ingredient
                </Button>
              </div>
              <div className="space-y-2">
                {ingredients.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-end gap-2">
                    <Field className="min-w-[140px] flex-1">
                      <FieldLabel htmlFor={`ing-name-${row.key}`}>
                        Name
                      </FieldLabel>
                      <Input
                        id={`ing-name-${row.key}`}
                        maxLength={120}
                        value={row.name}
                        onChange={(e) =>
                          setIngredient(row.key, { name: e.target.value })
                        }
                        placeholder="Dye or chemical"
                      />
                    </Field>
                    <Field className="w-24">
                      <FieldLabel htmlFor={`ing-qty-${row.key}`}>
                        Qty
                      </FieldLabel>
                      <Input
                        id={`ing-qty-${row.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.quantity}
                        onChange={(e) =>
                          setIngredient(row.key, { quantity: e.target.value })
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field className="w-28">
                      <FieldLabel htmlFor={`ing-unit-${row.key}`}>
                        Unit
                      </FieldLabel>
                      {row.custom ? (
                        <Input
                          id={`ing-unit-${row.key}`}
                          maxLength={20}
                          value={row.unit}
                          onChange={(e) =>
                            setIngredient(row.key, { unit: e.target.value })
                          }
                          placeholder="Custom unit"
                        />
                      ) : (
                        <Select
                          value={row.unit}
                          onValueChange={(v) => {
                            if (v === "__custom") {
                              setIngredient(row.key, {
                                unit: "",
                                custom: true,
                              });
                            } else {
                              setIngredient(row.key, { unit: v });
                            }
                          }}
                        >
                          <SelectTrigger id={`ing-unit-${row.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_PRESETS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom">Custom…</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${row.name || "ingredient"}`}
                      disabled={ingredients.length === 1}
                      onClick={() =>
                        setIngredients((rows) =>
                          rows.filter((r) => r.key !== row.key),
                        )
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-[13px] font-semibold">Process conditions</h4>
              <div className="flex flex-wrap gap-2">
                {intField("proc-temp", "Temp (°C)", temp, setTemp, 300)}
                {intField("proc-hrs", "Hours", hrs, setHrs, 720)}
                {intField("proc-min", "Minutes", min, setMin, 59)}
                {intField("proc-sec", "Seconds", sec, setSec, 59)}
              </div>
            </section>

            <Field>
              <FieldLabel htmlFor="recipe-notes">Notes</FieldLabel>
              <Textarea
                id="recipe-notes"
                maxLength={2000}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Corrections, lab-dip results, remarks…"
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={!ingredientsValid || !denierValid}
              >
                {editing ? "Save as new version" : "Create recipe"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function ColorsPage() {
  const canManage = usePermission()("manage_masters");

  const colors = useMasters((s) => s.colors);
  const colorsLoading = useMasters((s) => s.colorsLoading);
  const deniers = useMasters((s) => s.deniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const deleteColor = useMasters((s) => s.deleteColor);

  const recipes = useRecipes((s) => s.recipes);
  const recipesLoading = useRecipes((s) => s.recipesLoading);
  const recipesError = useRecipes((s) => s.recipesError);
  const refreshRecipes = useRecipes((s) => s.refreshRecipes);
  const deleteRecipe = useRecipes((s) => s.deleteRecipe);

  const [q, setQ] = useState("");
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [recipeEditorOpen, setRecipeEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeListItem | null>(
    null,
  );
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    refreshColors().catch(() => {});
    refreshDeniers().catch(() => {});
    refreshRecipes().catch(() => {});
  }, [refreshColors, refreshDeniers, refreshRecipes]);

  const filteredColors = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return colors;
    return colors.filter((c) =>
      `${c.name} ${c.code ?? ""}`.toLowerCase().includes(needle),
    );
  }, [colors, q]);

  const selectedColor =
    colors.find((c) => c.id === selectedColorId) ?? filteredColors[0] ?? null;
  const colorRecipes = useMemo(
    () => recipes.filter((r) => r.colorId === selectedColor?.id),
    [recipes, selectedColor?.id],
  );

  const openAddColor = () => {
    setEditingColor(null);
    setColorDialogOpen(true);
  };

  const onDeleteColor = async (color: Color) => {
    const ok = await confirm({
      title: `Delete "${color.name}"?`,
      description:
        "This cannot be undone. Existing challans keep their own copy of the name.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(color.id);
    try {
      await deleteColor(color.id);
      toastSuccess(`${color.name} deleted`);
    } catch (err) {
      toastError("Could not delete", friendlyError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const onDeleteRecipe = async (recipe: RecipeListItem) => {
    const ok = await confirm({
      title: `Delete the ${recipe.denierName} recipe?`,
      description: "The recipe and its version history are removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(recipe.id);
    try {
      await deleteRecipe(recipe.id);
      toastSuccess("Recipe deleted");
    } catch (err) {
      toastError("Could not delete", friendlyError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reference data"
        title="Color Organiser"
        description="Colors and their dyeing recipes — one recipe per color and denier."
        actions={
          canManage ? (
            <Button onClick={openAddColor}>
              <Plus aria-hidden />
              Add color
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Colors list */}
        <Card className="h-fit overflow-hidden">
          <div className="space-y-2.5 border-b border-border p-3">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Search className="size-4 text-muted-foreground" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search colors…"
                aria-label="Search colors"
              />
            </InputGroup>
            <Badge
              variant="secondary"
              className="font-medium tabular-nums whitespace-nowrap"
            >
              {colorsLoading && colors.length === 0
                ? "Loading…"
                : `${colors.length} ${colors.length === 1 ? "color" : "colors"}`}
            </Badge>
          </div>
          <CardContent className="p-0">
            {colorsLoading && colors.length === 0 ? (
              <div aria-hidden className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : colors.length === 0 ? (
              <Empty className="p-6">
                <EmptyMedia variant="icon">
                  <Palette className="size-5" aria-hidden />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No colors yet</EmptyTitle>
                  <EmptyDescription>
                    Add your first color to start writing recipes.
                  </EmptyDescription>
                </EmptyHeader>
                {canManage && (
                  <EmptyContent>
                    <Button onClick={openAddColor}>
                      <Plus aria-hidden />
                      Add color
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : filteredColors.length === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing matches “{q}”</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="max-h-[60dvh] overflow-y-auto">
                {filteredColors.map((color) => (
                  <div
                    key={color.id}
                    className={cn(
                      "flex items-center gap-2 border-b border-border/65 px-3 py-2 transition-colors last:border-b-0",
                      selectedColor?.id === color.id
                        ? "bg-accent"
                        : "[@media(hover:hover)]:hover:bg-muted/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedColorId(color.id)}
                      className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-pressed={selectedColor?.id === color.id}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {color.name}
                      </span>
                      {color.code && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {color.code}
                        </span>
                      )}
                    </button>
                    {canManage && (
                      <div className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${color.name}`}
                          onClick={() => {
                            setEditingColor(color);
                            setColorDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${color.name}`}
                          disabled={deletingId === color.id}
                          onClick={() => void onDeleteColor(color)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipes for the selected color */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {selectedColor ? `Recipes — ${selectedColor.name}` : "Recipes"}
            </span>
            {selectedColor && canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingRecipe(null);
                  setRecipeEditorOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Add recipe
              </Button>
            )}
          </div>
          <CardContent className="p-0">
            {!selectedColor ? (
              <Empty className="px-4 py-10">
                <EmptyMedia variant="icon">
                  <Palette className="size-5" aria-hidden />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Pick a color</EmptyTitle>
                  <EmptyDescription>
                    Select a color on the left to see its recipes.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : recipesLoading && recipes.length === 0 ? (
              <div aria-hidden className="divide-y divide-border/60">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-52" />
                  </div>
                ))}
              </div>
            ) : recipesError ? (
              <div className="p-4">
                <p className="rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {recipesError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void refreshRecipes()}
                >
                  Retry
                </Button>
              </div>
            ) : colorRecipes.length === 0 ? (
              <Empty className="px-4 py-10">
                <EmptyMedia variant="icon">
                  <FlaskConical className="size-5" aria-hidden />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No recipes yet</EmptyTitle>
                  <EmptyDescription>
                    Record how this color is dyed, per denier.
                  </EmptyDescription>
                </EmptyHeader>
                {canManage && (
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        setEditingRecipe(null);
                        setRecipeEditorOpen(true);
                      }}
                    >
                      <Plus aria-hidden />
                      Add recipe
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div>
                {colorRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="flex items-center gap-3 border-b border-border/65 px-4 py-2.5 transition-colors last:border-b-0 [@media(hover:hover)]:hover:bg-muted/40 sm:px-5"
                  >
                    <button
                      type="button"
                      onClick={() => setDetailRecipeId(recipe.id)}
                      className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open recipe for ${recipe.denierName}`}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {recipe.denierName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        v{recipe.version} · {recipe.ingredientCount}{" "}
                        {recipe.ingredientCount === 1
                          ? "ingredient"
                          : "ingredients"}
                        {processSummary(recipe)
                          ? ` · ${processSummary(recipe)}`
                          : ""}
                      </span>
                    </button>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRecipe(recipe);
                            setRecipeEditorOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingId === recipe.id}
                          aria-label={`Delete ${recipe.denierName} recipe`}
                          onClick={() => void onDeleteRecipe(recipe)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog}

      <ColorFormDialog
        key={`${editingColor?.id ?? "new"}-${colorDialogOpen}`}
        open={colorDialogOpen}
        editing={editingColor}
        onOpenChange={setColorDialogOpen}
      />
      {selectedColor && (
        <RecipeEditorDialog
          key={`${editingRecipe?.id ?? "new"}-${recipeEditorOpen}`}
          open={recipeEditorOpen}
          onOpenChange={setRecipeEditorOpen}
          color={selectedColor}
          editing={editingRecipe}
          deniers={deniers}
        />
      )}
      <RecipeDetailDialog
        open={detailRecipeId != null}
        onOpenChange={(o) => {
          if (!o) setDetailRecipeId(null);
        }}
        recipeId={detailRecipeId}
        onRestored={() => void refreshRecipes()}
      />
    </AppShell>
  );
}
