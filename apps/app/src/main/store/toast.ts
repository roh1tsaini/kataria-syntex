import { toast } from "sonner";

export function toastSuccess(title: string, description?: string): void {
  toast.success(title, { description, duration: 3800 });
}

export function toastError(title: string, description?: string): void {
  toast.error(title, { description, duration: 6500 });
}
