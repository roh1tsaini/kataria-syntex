/**
 * The one page-title system: eyebrow + clamp title + optional description.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
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
    </div>
  );
}
