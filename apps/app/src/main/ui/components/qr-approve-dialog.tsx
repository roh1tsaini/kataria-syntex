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
  const approveQrLoginByCode = useAuth((s) => s.approveQrLoginByCode);
  const approveQrLoginBySuffix = useAuth((s) => s.approveQrLoginBySuffix);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve a device</DialogTitle>
          <DialogDescription>
            Approving signs the other device in as you.
          </DialogDescription>
        </DialogHeader>
        <CodeEntryForm
          submitCode={approveQrLoginByCode}
          submitScanned={approveQrLoginBySuffix}
          label="Login code"
          description="Open the login page on the other device and scan its QR code, or type the full code shown below it."
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
