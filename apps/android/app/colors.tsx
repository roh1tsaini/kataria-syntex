/**
 * Color Organiser — the phone port of apps/app's pages/colors.tsx plus its
 * recipe-detail component. Same data flows via app-core stores:
 * colors register (create/edit/delete, stockType, code, manage_masters
 * gate), recipes per color+denier (ingredient rows, process temp/time,
 * notes, version history with view + restore), and the lookup-recipe
 * affordance. Web's dialogs become full-screen Modals (phone grammar);
 * the master-detail split becomes list → recipes section.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MorphSheet } from "@/ui/morph-sheet";
import {
  friendlyError,
  toastError,
  toastSuccess,
  useMasters,
  usePermission,
  useRecipes,
  type Color,
  type ColorInput,
  type Denier,
  type RecipeDetail,
  type RecipeInput,
  type RecipeListItem,
  type RecipeVersionPayload,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Field, Input, Skeleton } from "@/ui/kit";
import { IconButton, Select, Textarea } from "@/ui/controls";
import { confirm, requestDiscard } from "@/ui/confirm";
import { fmtDate } from "@/lib/format";

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

const stripIngredientKeys = (rows: IngredientDraft[]) =>
  rows.map((r) => ({
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    custom: r.custom,
  }));

/** "60°C · 1 hr 30 min" — parts omit what the recipe doesn't set. */
function processSummary(r: {
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

// ── Color add/edit modal ────────────────────────────────────────────────────

function ColorFormModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Color | null;
  onClose: () => void;
}) {
  const p = usePalette();
  const createColor = useMasters((s) => s.createColor);
  const updateColor = useMasters((s) => s.updateColor);
  // Remounted per open (parent keys by item + open state), so the initial
  // draft is stable for the modal's lifetime — dirty is a shape compare.
  const [initial] = useState(() => ({
    name: editing?.name ?? "",
    code: editing?.code ?? "",
    stockType: editing?.stockType ?? "dyed",
  }));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const submit = async () => {
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
      onClose();
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MorphSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) requestDiscard(dirty, busy, onClose);
      }}
      title={editing ? "Edit color" : "Add color"}
    >
      <View>
        <Text className="px-4 text-[13px]" style={{ color: p.mutedForeground }}>
          Colors are shared with every picker in the app.
        </Text>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
          <Field label="Name">
            <Input
              value={draft.name}
              maxLength={60}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="Color name"
              accessibilityLabel="Color name"
              aria-invalid={!!error}
            />
          </Field>
          <Field label="Code">
            <Input
              value={draft.code}
              maxLength={20}
              onChangeText={(code) => setDraft((d) => ({ ...d, code }))}
              placeholder="Short code, e.g. NV"
              accessibilityLabel="Color code"
              aria-invalid={!!error}
            />
          </Field>
          <Field label="Stock type">
            <Select
              label="Stock type"
              value={draft.stockType}
              onChange={(stockType) => setDraft((d) => ({ ...d, stockType }))}
              options={[
                { value: "dyed", label: "Dyed (finished yarn)" },
                { value: "raw", label: "Raw (grey yarn)" },
              ]}
              invalid={!!error}
            />
          </Field>
          {error ? (
            <Text className="text-[12px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          ) : null}
          <View className="mt-2 flex-row justify-end gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => requestDiscard(dirty, busy, onClose)}
              disabled={busy}
            />
            <Button
              label={editing ? "Save changes" : "Add"}
              loading={busy}
              disabled={!draft.name.trim()}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </View>
    </MorphSheet>
  );
}

// ── Recipe add/edit modal ───────────────────────────────────────────────────

type RecipeBaseline = {
  denierId: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
    custom: boolean;
  }>;
  temp: string;
  hrs: string;
  min: string;
  sec: string;
  notes: string;
};

function RecipeEditorModal({
  open,
  onClose,
  color,
  editing,
  deniers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  color: Color;
  editing: RecipeListItem | null;
  deniers: Denier[];
  onSaved: () => void;
}) {
  const p = usePalette();
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

  // Snapshot of the loaded (or blank) form — remounted per open, so the ref
  // only ever holds this session's baseline. Null until the load settles.
  const baselineRef = useRef<RecipeBaseline | null>(null);
  const current: RecipeBaseline = {
    denierId,
    ingredients: stripIngredientKeys(ingredients),
    temp,
    hrs,
    min,
    sec,
    notes,
  };
  const dirty =
    baselineRef.current !== null &&
    JSON.stringify(current) !== JSON.stringify(baselineRef.current);

  // Editing loads the current recipe; adding starts from a blank row.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setDenierId(editing.denierId);
      setLoading(true);
      fetchRecipe(editing.id)
        .then((detail) => {
          const loaded = detail.ingredients.map((i) => ({
            key: newKey(),
            name: i.name,
            quantity: String(i.quantity),
            ...draftFromUnit(i.unit),
          }));
          const snap: RecipeBaseline = {
            denierId: editing.denierId,
            ingredients: stripIngredientKeys(loaded),
            temp: editing.processTempC?.toString() ?? "",
            hrs: editing.processTimeHrs?.toString() ?? "",
            min: editing.processTimeMin?.toString() ?? "",
            sec: editing.processTimeSec?.toString() ?? "",
            notes: editing.notes ?? "",
          };
          setIngredients(loaded);
          setTemp(snap.temp);
          setHrs(snap.hrs);
          setMin(snap.min);
          setSec(snap.sec);
          setNotes(snap.notes);
          baselineRef.current = snap;
        })
        .catch((err) => setError(friendlyError(err)))
        .finally(() => setLoading(false));
    } else {
      const blank: RecipeBaseline = {
        denierId: "",
        ingredients: [{ name: "", quantity: "", unit: "g", custom: false }],
        temp: "",
        hrs: "",
        min: "",
        sec: "",
        notes: "",
      };
      setDenierId("");
      setIngredients([
        { key: newKey(), name: "", quantity: "", unit: "g", custom: false },
      ]);
      setTemp("");
      setHrs("");
      setMin("");
      setSec("");
      setNotes("");
      baselineRef.current = blank;
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

  const submit = async () => {
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
      onSaved();
      onClose();
    } catch (err) {
      // recipe_version_conflict and friends arrive with friendly copy.
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  const intField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    max: number,
  ) => (
    <View className="min-w-[72px] flex-1 gap-1">
      <Text
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: p.mutedForeground }}
      >
        {label}
      </Text>
      <Input
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        maxLength={String(max).length}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <MorphSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) requestDiscard(dirty, busy || loading, onClose);
      }}
      title={
        editing ? `Edit recipe — ${color.name}` : `New recipe — ${color.name}`
      }
    >
      <View>
        <Text className="px-4 text-[13px]" style={{ color: p.mutedForeground }}>
          {editing
            ? "Saving keeps the last 5 versions; the newest becomes current."
            : "One recipe per color and denier."}
        </Text>
        {loading ? (
          <View className="gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="gap-5 p-4 pb-8"
            keyboardShouldPersistTaps="handled"
          >
            {!editing ? (
              <Field
                label="Denier"
                error={deniers.length === 0 ? undefined : null}
              >
                <Select
                  label="Denier"
                  value={denierId}
                  onChange={setDenierId}
                  placeholder="Pick a denier"
                  options={deniers.map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
                  invalid={!!error}
                />
                {deniers.length === 0 ? (
                  <Text
                    className="text-xs"
                    style={{ color: p.mutedForeground }}
                  >
                    Add deniers in Master Data first.
                  </Text>
                ) : null}
              </Field>
            ) : null}

            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  Ingredients
                </Text>
                <Button
                  label="Add ingredient"
                  variant="secondary"
                  onPress={() =>
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
                />
              </View>
              {ingredients.map((row) => (
                <View
                  key={row.key}
                  className="gap-2 rounded-lg border p-2.5"
                  style={{ borderColor: p.border }}
                >
                  <Field label="Name">
                    <Input
                      maxLength={120}
                      value={row.name}
                      onChangeText={(name) => setIngredient(row.key, { name })}
                      placeholder="Dye or chemical"
                      accessibilityLabel="Ingredient name"
                    />
                  </Field>
                  <View className="flex-row items-end gap-2">
                    <View className="w-24 gap-1">
                      <Text
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: p.mutedForeground }}
                      >
                        Qty
                      </Text>
                      <Input
                        keyboardType="decimal-pad"
                        value={row.quantity}
                        onChangeText={(quantity) =>
                          setIngredient(row.key, { quantity })
                        }
                        placeholder="0"
                        accessibilityLabel="Ingredient quantity"
                      />
                    </View>
                    <View className="min-w-[100px] flex-1 gap-1">
                      <Text
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: p.mutedForeground }}
                      >
                        Unit
                      </Text>
                      {row.custom ? (
                        <Input
                          maxLength={20}
                          value={row.unit}
                          onChangeText={(unit) =>
                            setIngredient(row.key, { unit })
                          }
                          placeholder="Custom unit"
                          accessibilityLabel="Custom unit"
                        />
                      ) : (
                        <Select
                          label="Unit"
                          value={row.unit}
                          onChange={(v) => {
                            if (v === "__custom") {
                              setIngredient(row.key, {
                                unit: "",
                                custom: true,
                              });
                            } else {
                              setIngredient(row.key, { unit: v });
                            }
                          }}
                          options={[
                            ...UNIT_PRESETS.map((u) => ({
                              value: u,
                              label: u,
                            })),
                            { value: "__custom", label: "Custom…" },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                  <View className="flex-row justify-end">
                    <IconButton
                      icon="trash-2"
                      label={`Remove ${row.name || "ingredient"}`}
                      disabled={ingredients.length === 1}
                      destructive
                      onPress={() =>
                        setIngredients((rows) =>
                          rows.filter((r) => r.key !== row.key),
                        )
                      }
                    />
                  </View>
                </View>
              ))}
            </View>

            <View className="gap-2">
              <Text
                className="text-[13px] font-semibold"
                style={{ color: p.foreground }}
              >
                Process conditions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {intField("Temp (°C)", temp, setTemp, 300)}
                {intField("Hours", hrs, setHrs, 720)}
                {intField("Minutes", min, setMin, 59)}
                {intField("Seconds", sec, setSec, 59)}
              </View>
            </View>

            <Field label="Notes">
              <Textarea
                maxLength={2000}
                value={notes}
                onChangeText={setNotes}
                placeholder="Corrections, lab-dip results, remarks…"
                accessibilityLabel="Recipe notes"
                aria-invalid={!!error}
              />
            </Field>

            {error ? (
              <Text className="text-[12px]" style={{ color: p.destructive }}>
                {error}
              </Text>
            ) : null}

            <View className="mt-2 flex-row justify-end gap-2">
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => requestDiscard(dirty, busy || loading, onClose)}
                disabled={busy}
              />
              <Button
                label={editing ? "Save as new version" : "Create recipe"}
                loading={busy}
                disabled={!ingredientsValid || !denierValid}
                onPress={() => void submit()}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </MorphSheet>
  );
}

// ── Recipe detail modal (version history + restore) ─────────────────────────

function VersionViewModal({
  open,
  onClose,
  recipeId,
  version,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: string | null;
  version: number | null;
}) {
  const p = usePalette();
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
    <MorphSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={`Version ${version ?? "—"}`}
    >
      <View>
        <Text className="px-4 text-[13px]" style={{ color: p.mutedForeground }}>
          Read-only snapshot; restore it from the recipe details.
        </Text>
        {error ? (
          <Text className="p-4 text-[12px]" style={{ color: p.destructive }}>
            {error}
          </Text>
        ) : !payload ? (
          <View className="gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="gap-4 p-4"
            style={{ maxHeight: 420 }}
          >
            <View className="gap-1.5">
              {payload.ingredients.map((i, idx) => (
                <View
                  key={idx}
                  className="flex-row items-baseline justify-between gap-3"
                >
                  <Text
                    className="min-w-0 flex-1 text-sm"
                    style={{ color: p.foreground }}
                    numberOfLines={1}
                  >
                    {i.name}
                  </Text>
                  <Text
                    className="text-sm font-medium tabular-nums"
                    style={{ color: p.foreground }}
                  >
                    {i.quantity} {i.unit}
                  </Text>
                </View>
              ))}
            </View>
            {processSummary(payload) ? (
              <Text className="text-sm" style={{ color: p.mutedForeground }}>
                {processSummary(payload)}
              </Text>
            ) : null}
            {payload.notes ? (
              <Text className="text-sm" style={{ color: p.mutedForeground }}>
                {payload.notes}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    </MorphSheet>
  );
}

function RecipeDetailModal({
  open,
  onClose,
  recipeId,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: string | null;
  onRestored: () => void;
}) {
  const p = usePalette();
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
      onRestored();
    } catch (err) {
      toastError("Could not restore", friendlyError(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <MorphSheet
        open={open}
        onOpenChange={(v) => !v && onClose()}
        title="Recipe details"
      >
        <View>
          <Text
            className="px-4 text-[13px]"
            style={{ color: p.mutedForeground }}
          >
            Current version plus the last 5 saves.
          </Text>
          {error ? (
            <Text className="p-4 text-[12px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          ) : !detail ? (
            <View className="gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </View>
          ) : (
            <ScrollView
              contentContainerClassName="gap-5 p-4"
              style={{ maxHeight: 480 }}
            >
              <View className="gap-1.5">
                {detail.ingredients.map((i) => (
                  <View
                    key={i.id}
                    className="flex-row items-baseline justify-between gap-3"
                  >
                    <Text
                      className="min-w-0 flex-1 text-sm"
                      style={{ color: p.foreground }}
                      numberOfLines={1}
                    >
                      {i.name}
                    </Text>
                    <Text
                      className="text-sm font-medium tabular-nums"
                      style={{ color: p.foreground }}
                    >
                      {i.quantity} {i.unit}
                    </Text>
                  </View>
                ))}
              </View>
              {processSummary(detail.recipe) ? (
                <Text className="text-sm" style={{ color: p.mutedForeground }}>
                  {processSummary(detail.recipe)}
                </Text>
              ) : null}
              {detail.recipe.notes ? (
                <Text className="text-sm" style={{ color: p.mutedForeground }}>
                  {detail.recipe.notes}
                </Text>
              ) : null}
              <View
                className="gap-1 border-t pt-3"
                style={{ borderColor: p.border }}
              >
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Version history
                </Text>
                {detail.versions.map((v) => (
                  <View
                    key={v.version}
                    className="flex-row items-center gap-2 py-1"
                  >
                    <Text
                      className="w-9 shrink-0 text-sm font-medium tabular-nums"
                      style={{ color: p.foreground }}
                    >
                      v{v.version}
                    </Text>
                    <Text
                      className="min-w-0 flex-1 text-xs"
                      style={{ color: p.mutedForeground }}
                      numberOfLines={1}
                    >
                      {v.restoredFrom != null
                        ? `restored from v${v.restoredFrom} · `
                        : ""}
                      {fmtDate(v.createdAt)}
                      {v.savedByName ? ` · ${v.savedByName}` : ""}
                    </Text>
                    {v.version === detail.recipe.version ? (
                      <Badge label="current" tone="accent" />
                    ) : (
                      <View className="flex-row shrink-0 items-center gap-1">
                        <Button
                          label="View"
                          variant="ghost"
                          onPress={() => setVersionView(v.version)}
                        />
                        <Button
                          label="Restore"
                          variant="ghost"
                          disabled={restoring}
                          loading={restoring}
                          onPress={() => void onRestore(v.version)}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </MorphSheet>
      <VersionViewModal
        open={versionView != null}
        onClose={() => setVersionView(null)}
        recipeId={recipeId}
        version={versionView}
      />
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ColorsRoute() {
  const p = usePalette();
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
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [recipeEditorOpen, setRecipeEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeListItem | null>(
    null,
  );
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setColorModalOpen(true);
  };

  const onDeleteColor = async (color: Color) => {
    const ok = await confirm({
      title: `Delete "${color.name}"?`,
      description: "This cannot be undone, but challans keep their own copy.",
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
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <View className="flex-row items-end justify-between px-4 pt-4">
        <View className="min-w-0 flex-1">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Reference data
          </Text>
          <Text
            className="text-[22px] font-bold"
            style={{ color: p.foreground }}
          >
            Color Organiser
          </Text>
          <Text className="text-[13px]" style={{ color: p.mutedForeground }}>
            Colors and their dyeing recipes — one recipe per color and denier.
          </Text>
        </View>
        {canManage ? <Button label="Add color" onPress={openAddColor} /> : null}
      </View>

      {/* Colors list */}
      <View className="gap-2.5 px-4 pt-4">
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Search colors…"
          accessibilityLabel="Search colors"
          autoCapitalize="none"
        />
        <Badge
          label={
            colorsLoading && colors.length === 0
              ? "Loading…"
              : `${colors.length} ${colors.length === 1 ? "color" : "colors"}`
          }
        />
      </View>

      <FlatList
        className="flex-1 px-4 pt-2"
        data={filteredColors}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 pb-8"
        ListEmptyComponent={
          colorsLoading && colors.length === 0 ? (
            <View className="gap-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </View>
          ) : colors.length === 0 ? (
            <View className="gap-3">
              <EmptyState
                title="No colors yet"
                message="Add your first color to start writing recipes."
              />
              {canManage ? (
                <Button label="Add color" onPress={openAddColor} />
              ) : null}
            </View>
          ) : (
            <EmptyState
              title={`Nothing matches “${q}”`}
              message="Try a different name or clear the search."
            />
          )
        }
        renderItem={({ item: color }) => (
          <View
            className="flex-row items-center gap-1 rounded-xl border p-2"
            style={{
              backgroundColor:
                selectedColor?.id === color.id ? p.accentSoft : p.card,
              borderColor: p.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selectedColor?.id === color.id }}
              onPress={() => setSelectedColorId(color.id)}
              className="min-h-[44px] min-w-0 flex-1 rounded-md px-2 py-1"
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: p.foreground }}
                numberOfLines={1}
              >
                {color.name}
              </Text>
              {color.code ? (
                <Text
                  className="text-xs"
                  style={{ color: p.mutedForeground }}
                  numberOfLines={1}
                >
                  {color.code}
                </Text>
              ) : null}
            </Pressable>
            {canManage ? (
              <View className="flex-row shrink-0 items-center">
                <IconButton
                  icon="edit-2"
                  label={`Edit ${color.name}`}
                  onPress={() => {
                    setEditingColor(color);
                    setColorModalOpen(true);
                  }}
                />
                <IconButton
                  icon="trash-2"
                  label={`Delete ${color.name}`}
                  disabled={deletingId === color.id}
                  destructive
                  onPress={() => void onDeleteColor(color)}
                />
              </View>
            ) : null}
          </View>
        )}
      />

      {/* Recipes for the selected color */}
      <View
        className="border-t px-4 pt-3"
        style={{ borderColor: p.border, backgroundColor: p.card }}
      >
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
            numberOfLines={1}
          >
            {selectedColor ? `Recipes — ${selectedColor.name}` : "Recipes"}
          </Text>
          {selectedColor && canManage ? (
            <Button
              label="Add recipe"
              variant="secondary"
              onPress={() => {
                setEditingRecipe(null);
                setRecipeEditorOpen(true);
              }}
            />
          ) : null}
        </View>
      </View>
      <View
        className="flex-1 border-t px-4 pt-2"
        style={{ borderColor: p.border }}
      >
        {!selectedColor ? (
          <EmptyState
            title="Pick a color"
            message="Select a color above to see its recipes."
          />
        ) : recipesLoading && recipes.length === 0 ? (
          <View className="gap-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className="gap-2 px-1 py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-52" />
              </View>
            ))}
          </View>
        ) : recipesError ? (
          <View className="py-2">
            <Text
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                color: p.destructive,
                borderColor: `${p.destructive}33`,
                backgroundColor: `${p.destructive}14`,
              }}
            >
              {recipesError}
            </Text>
            <View className="mt-3">
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => void refreshRecipes()}
              />
            </View>
          </View>
        ) : colorRecipes.length === 0 ? (
          <View className="gap-3">
            <EmptyState
              title="No recipes yet"
              message="Record how this color is dyed, per denier."
            />
            {canManage ? (
              <Button
                label="Add recipe"
                onPress={() => {
                  setEditingRecipe(null);
                  setRecipeEditorOpen(true);
                }}
              />
            ) : null}
          </View>
        ) : (
          <FlatList
            data={colorRecipes}
            keyExtractor={(r) => r.id}
            contentContainerClassName="gap-2 pb-8"
            renderItem={({ item: recipe }) => (
              <View
                className="flex-row items-center gap-1 rounded-xl border p-2"
                style={{ backgroundColor: p.card, borderColor: p.border }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open recipe for ${recipe.denierName}`}
                  onPress={() => setDetailRecipeId(recipe.id)}
                  className="min-h-[44px] min-w-0 flex-1 rounded-md px-2 py-1"
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: p.foreground }}
                    numberOfLines={1}
                  >
                    {recipe.denierName}
                  </Text>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: p.mutedForeground }}
                    numberOfLines={1}
                  >
                    v{recipe.version} · {recipe.ingredientCount}{" "}
                    {recipe.ingredientCount === 1
                      ? "ingredient"
                      : "ingredients"}
                    {processSummary(recipe)
                      ? ` · ${processSummary(recipe)}`
                      : ""}
                  </Text>
                </Pressable>
                {canManage ? (
                  <View className="flex-row shrink-0 items-center">
                    <IconButton
                      icon="edit-2"
                      label={`Edit ${recipe.denierName} recipe`}
                      onPress={() => {
                        setEditingRecipe(recipe);
                        setRecipeEditorOpen(true);
                      }}
                    />
                    <IconButton
                      icon="trash-2"
                      label={`Delete ${recipe.denierName} recipe`}
                      disabled={deletingId === recipe.id}
                      destructive
                      onPress={() => void onDeleteRecipe(recipe)}
                    />
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>

      <ColorFormModal
        key={`${editingColor?.id ?? "new"}-${colorModalOpen}`}
        open={colorModalOpen}
        editing={editingColor}
        onClose={() => setColorModalOpen(false)}
      />
      {selectedColor ? (
        <RecipeEditorModal
          key={`${editingRecipe?.id ?? "new"}-${recipeEditorOpen}`}
          open={recipeEditorOpen}
          onClose={() => setRecipeEditorOpen(false)}
          color={selectedColor}
          editing={editingRecipe}
          deniers={deniers}
          onSaved={() => void refreshRecipes()}
        />
      ) : null}
      <RecipeDetailModal
        open={detailRecipeId != null}
        onClose={() => setDetailRecipeId(null)}
        recipeId={detailRecipeId}
        onRestored={() => void refreshRecipes()}
      />
    </View>
  );
}

/** Lookup-and-view affordance for a color+denier pair — the RN counterpart
 * of the web's RecipeLinkButton: resolves the recipe via lookupRecipe and
 * opens the detail modal, or explains that none exists. */
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
  const p = usePalette();

  if (!colorId || !denierId) return null;

  const onPress = async () => {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View dyeing recipe"
        onPress={() => void onPress()}
        disabled={busy}
        className="min-h-[44px] w-[44px] items-center justify-center rounded-lg"
        style={({ pressed }) => ({ opacity: pressed || busy ? 0.6 : 1 })}
      >
        <Feather name="droplet" size={18} color={p.foreground} />
      </Pressable>
      <RecipeDetailModal
        open={open}
        onClose={() => setOpen(false)}
        recipeId={recipeId}
        onRestored={() => undefined}
      />
    </>
  );
}
