export default function LinksLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center px-4 py-12 xs:py-16">
      <div className="mb-5 h-4 w-32 animate-pulse rounded bg-line" />
      <div className="aspect-[7/4] w-full animate-pulse rounded-card bg-navy/20" />
      <div className="mt-4 h-24 w-full animate-pulse rounded-card bg-line/40" />
      <div className="mt-10 space-y-3">
        <div className="h-12 w-full animate-pulse rounded-card bg-line/30" />
        <div className="h-12 w-full animate-pulse rounded-card bg-line/30" />
        <div className="h-12 w-full animate-pulse rounded-card bg-line/30" />
      </div>
    </div>
  );
}
