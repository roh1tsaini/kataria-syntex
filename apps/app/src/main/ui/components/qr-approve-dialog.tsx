import { CodeEntryForm } from "@/ui/components/code-entry-form";
import { useAuth } from "@/store/auth";
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
            Scan the QR shown on the other device, or type the code under it. If
            that device named a person, they'll be logged in — otherwise it logs
            in as you.
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
