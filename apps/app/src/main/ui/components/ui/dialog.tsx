import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/ui/lib/cn";

export const Dialog = DialogPrimitive.Root;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[4px] transition-opacity duration-200 ease-[var(--ease-out)] data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Desktop: centered modal, 16px radius, scale-fade from 0.96.
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-6 shadow-overlay origin-[--radix-dialog-content-transform-origin] transition-[opacity,transform] duration-200 ease-[var(--ease-out)] data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.96]",
        // Mobile: iOS bottom sheet — same enter/exit path (from/to below).
        "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0))] max-sm:data-[state=closed]:translate-y-full max-sm:data-[state=closed]:scale-100",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring max-sm:-m-3.5 max-sm:p-3.5">
        <X className="size-4" aria-hidden />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
