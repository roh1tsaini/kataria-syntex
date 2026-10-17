import { Input } from "@/ui/components/ui/input";

/** The last-4-characters input of a login code, shared by scan-approve and
 *  the approve dialog: uppercase alphanumerics only, clamped to 4. */
export function SuffixInput({
  id,
  value,
  onChange,
  error,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
  describedBy?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) =>
        onChange(
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
      autoComplete="off"
      spellCheck={false}
      autoFocus
      aria-invalid={!!error}
      aria-describedby={error ? describedBy : undefined}
    />
  );
}
