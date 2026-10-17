"use client";

import { RouteError } from "@/components/section/RouteError";

export default function LinksError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      kicker="Unable to load links"
      title="Something went wrong."
      message="Please check your connection and try again."
      reset={reset}
      className="flex w-full max-w-[27rem] flex-1 flex-col justify-center px-4 py-16"
    />
  );
}
