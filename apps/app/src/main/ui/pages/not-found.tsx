import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Button } from "@/ui/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] w-full items-center justify-center p-4">
      <Empty className="max-w-md">
        <EmptyMedia variant="icon">
          <FileQuestion className="size-5" aria-hidden />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you are looking for does not exist.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
