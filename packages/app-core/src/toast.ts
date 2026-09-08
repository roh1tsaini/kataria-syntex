/** Toast sink — each shell plugs its own UI (sonner on web, a native toast
 * host on Android). app-core only raises events; it never renders. */

export type ToastSink = {
  success(title: string, description?: string): void;
  error(title: string, description?: string): void;
};

let sink: ToastSink | null = null;

export function configureToasts(next: ToastSink): void {
  sink = next;
}

export function toastSuccess(title: string, description?: string): void {
  sink?.success(title, description);
}

export function toastError(title: string, description?: string): void {
  sink?.error(title, description);
}
