import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The 1180px content band every page section sits in. */
export function Section({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[1180px] px-4 py-14 sm:px-6 md:py-21 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
