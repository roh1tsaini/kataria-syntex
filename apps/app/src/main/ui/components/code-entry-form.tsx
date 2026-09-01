import { type ReactNode, useState } from "react";
import { Camera, CameraOff, CheckCircle2 } from "lucide-react";
import { friendlyError } from "@/ui/lib/errors";
import { useCameraScanner } from "@/ui/hooks/use-camera-scanner";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";

type CodeEntryFormProps = {
  submit: (code: string) => Promise<unknown>;
  onDone?: () => void;
  label: string;
  description: string;
  scanHint: string;
  buttonLabel: string;
  success?: ReactNode;
};

export function CodeEntryForm({
  submit,
  onDone,
  label,
  description,
  scanHint,
  buttonLabel,
  success,
}: CodeEntryFormProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { videoRef, scanError } = useCameraScanner(async (c) => {
    setScanning(false);
    await run(c);
  }, scanning);

  // Codes are the 8-char unambiguous alphabet grouped "XXXX-XXXX". Accept any
  // length >= 4 (the scanner's threshold) so a scanned/dashed/dev code can be
  // typed back in, and always submit the dash-free canonical form.
  const run = async (c: string) => {
    setError(null);
    setBusy(true);
    try {
      await submit(c.replace(/[^A-Z0-9]/g, ""));
      if (success) setApproved(true);
      else onDone?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = code.replace(/[^A-Z0-9]/g, "").length >= 4;

  if (approved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="size-10 text-primary" aria-hidden />
        {success}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) void run(code);
      }}
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="code-entry">{label}</FieldLabel>
          <Input
            id="code-entry"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
            }
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "code-entry-error" : undefined}
          />
          <FieldDescription>{description}</FieldDescription>
        </Field>
      </FieldGroup>

      {scanning && (
        <div className="relative overflow-hidden rounded-lg border border-border bg-foreground">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full object-cover"
          />
          <span className="absolute inset-x-0 top-2 text-center text-xs text-background/80">
            {scanHint}
          </span>
        </div>
      )}
      {scanError && (
        <p className="text-xs text-muted-foreground">{scanError}</p>
      )}

      {error && <FieldError id="code-entry-error">{error}</FieldError>}

      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={!canSubmit}
          loading={busy}
        >
          {buttonLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setScanning((s) => !s)}
          disabled={busy}
          aria-label={scanning ? "Stop camera" : "Scan QR with camera"}
          title={scanning ? "Stop camera" : "Scan QR with camera"}
        >
          {scanning ? (
            <CameraOff className="size-4" />
          ) : (
            <Camera className="size-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
