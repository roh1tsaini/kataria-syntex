import * as React from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Button } from "@/ui/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("unhandled_error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-[50vh] w-full max-w-xl items-center justify-center px-4 py-12">
          <Empty>
            <EmptyMedia>
              <AlertTriangle className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Something went wrong</EmptyTitle>
              <EmptyDescription>
                The page crashed. Tap below to reload this view.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </Button>
          </Empty>
        </div>
      );
    }
    return this.props.children;
  }
}
