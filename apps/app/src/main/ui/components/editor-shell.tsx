import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Save } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";

/**
 * Hook for temporary inline confirmation state on triggering action buttons
 * (e.g. Save button showing "Saved" for 2 seconds beside toast confirmation).
 */
export function useInlineSaved(durationMs = 2000) {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSaved = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaved(true);
    timerRef.current = setTimeout(() => {
      setSaved(false);
    }, durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [saved, triggerSaved] as const;
}

/**
 * Standard card section header used across packing, raw material, and returns forms.
 */
export function EditorSectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={className}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </CardHeader>
  );
}

/**
 * Standard error banner for editor load failures (masters, record prefill).
 */
export function EditorErrorBanner({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
      <span>{message}</span>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="text-xs"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Standard action footer for document editor forms with Cancel, Save/Update,
 * inline save feedback (Material 3 snackbar alignment), and inline error callout.
 */
export function EditorFormFooter({
  onCancel,
  onSave,
  busy = false,
  disabled = false,
  saved = false,
  isEditing = false,
  error,
  saveLabel,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
  disabled?: boolean;
  saved?: boolean;
  isEditing?: boolean;
  error?: string | null;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  const label = saveLabel ?? (isEditing ? "Update" : "Save");
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={busy}
      >
        {cancelLabel}
      </Button>
      <div className="flex items-center gap-3">
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button
          type="button"
          onClick={onSave}
          disabled={busy || disabled}
          className="gap-2"
        >
          {busy ? (
            <span className="animate-pulse">Saving...</span>
          ) : saved ? (
            <>
              <Check className="size-4" aria-hidden />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden />
              <span>{label}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
