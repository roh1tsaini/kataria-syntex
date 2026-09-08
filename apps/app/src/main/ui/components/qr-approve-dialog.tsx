import { CodeEntryForm } from "@/ui/components/code-entry-form";
import { useAuth } from "@kataria-syntex/app-core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";

export function QrApproveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const approveQrLogin = useAuth((s) => s.approveQrLogin);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve a device</DialogTitle>
          <DialogDescription>
            Make sure the code matches the other device, then approve.
          </DialogDescription>
        </DialogHeader>
        <CodeEntryForm
          submit={approveQrLogin}
          label="Login code"
          description="Open the login page on the other device and scan its QR code, or enter the code shown below it."
          scanHint="Point the camera at the QR code on the other device"
          buttonLabel="Approve login"
          success={
            <>
              <p className="text-sm font-medium">
                Approved. The other device is now logged in.
              </p>
              <p className="text-xs text-muted-foreground">
                You can close this dialog.
              </p>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
