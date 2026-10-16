import { type ReactNode, useState } from "react";
import { Camera, CameraOff, CheckCircle2 } from "lucide-react";
import { friendlyError } from "@kataria-syntex/app-core";
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
  submitCode: (code: string) => Promise<unknown>;
  submitScanned: (id: string, suffix: string) => Promise<unknown>;
  onDone?: () => void;
  label: string;
  description: string;
  scanHint: string;
  buttonLabel: string;
  success?: ReactNode;
};

/** Uppercase alphanumerics regrouped into 4s with dashes — the exact stored shape. */
function canonicalCode(value: string): string {
  const alnum = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (alnum.match(/.{1,4}/g) ?? []).join("-");
}

export function CodeEntryForm({
  submitCode,
  submitScanned,
  onDone,
  label,
  description,
  scanHint,
  buttonLabel,
  success,
}: CodeEntryFormProps) {
  const [code, setCode] = useState("");
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [suffix, setSuffix] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { videoRef, scanError } = useCameraScanner((id) => {
    // A scan carries the request id only — the approver must still type the
    // code's last 4 characters from the waiting screen before approving.
    setScanning(false);
    setScannedId(id);
    setSuffix("");
    setError(null);
  }, scanning);

  // Login codes are the 16-char unambiguous alphabet grouped
  // "XXXX-XXXX-XXXX-XXXX" (server/lib/token.ts). Accept typed input with or
  // without dashes and always submit the canonical dashed form — the server
  // matches codes exactly as stored.
  const run = async (c: string) => {
    setError(null);
    setBusy(true);
    try {
      await submitCode(canonicalCode(c));
      if (success) setApproved(true);
      else onDone?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const runScanned = async () => {
    if (!scannedId) return;
    setError(null);
    setBusy(true);
    try {
      await submitScanned(scannedId, suffix);
      if (success) setApproved(true);
      else onDone?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const scanned = scannedId !== null;
  const canSubmit = scanned
    ? suffix.length === 4
    : code.replace(/[^A-Z0-9]/g, "").length >= 4;

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
        if (!canSubmit || busy) return;
        if (scanned) void runScanned();
        else void run(code);
      }}
    >
      <FieldGroup className="gap-4">
        {scanned ? (
          <Field>
            <FieldLabel htmlFor="code-suffix">Code ends in</FieldLabel>
            <Input
              id="code-suffix"
              value={suffix}
              onChange={(e) =>
                setSuffix(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 4),
                )
              }
              placeholder="XXXX"
              className="font-mono tracking-[0.18em]"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "code-entry-error" : undefined}
            />
            <FieldDescription>
              QR scanned. Type the last 4 characters of the code shown on the
              other device.
            </FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="code-entry">{label}</FieldLabel>
            <Input
              id="code-entry"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
              }
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? "code-entry-error" : undefined}
            />
            <FieldDescription>{description}</FieldDescription>
          </Field>
        )}
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
        {!scanned && (
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
        )}
      </div>
      {scanned && (
        <Button
          type="button"
          variant="link"
          className="self-start px-0"
          onClick={() => {
            setScannedId(null);
            setSuffix("");
            setError(null);
          }}
        >
          Enter the full code instead
        </Button>
      )}
    </form>
  );
}
