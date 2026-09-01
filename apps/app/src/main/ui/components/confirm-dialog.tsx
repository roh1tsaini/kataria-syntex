import { useCallback, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type ConfirmRequest = {
  id: number;
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
};

export function useConfirm() {
  // FIFO queue — concurrent confirm() calls line up instead of overwriting
  // each other (which would leave the first promise unresolved forever).
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = nextId.current++;
      setQueue((prev) => [...prev, { id, options, resolve }]);
    });
  }, []);

  const current = queue[0] ?? null;

  const dialog = current ? (
    <ConfirmDialog
      key={current.id}
      options={current.options}
      onResolve={(v) => {
        current.resolve(v);
        setQueue((prev) => prev.slice(1));
      }}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  options,
  onResolve,
}: {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open onOpenChange={(open) => !open && onResolve(false)}>
      <DialogContent
        className="max-w-sm"
        onOpenAutoFocus={(e) => {
          // Announce the title first — keyboard/AT focus lands on the heading,
          // not a random action button.
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${
              options.destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <DialogHeader className="gap-1">
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              {options.title}
            </DialogTitle>
            {options.description && (
              <DialogDescription>{options.description}</DialogDescription>
            )}
          </DialogHeader>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onResolve(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={options.destructive ? "destructive" : "default"}
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
