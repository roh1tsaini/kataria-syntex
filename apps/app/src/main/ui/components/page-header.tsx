import type { ReactNode } from "react";

/**
 * The one page-title system: eyebrow + clamp title + optional description.
 * Replaces three competing ad-hoc patterns across pages (audit finding).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title mt-1.5">{title}</h1>
        {description && (
          <p className="page-desc mt-2 max-w-[48ch]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:pb-1">
          {actions}
        </div>
      )}
    </div>
  );
}
