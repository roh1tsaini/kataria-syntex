import { PageHeader } from "@/ui/components/page-header";
import { DevicesPanel } from "@/ui/components/devices-panel";

export function DevicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Devices"
        description="Every device signed in to this account. Revoke one you do not recognize."
      />

      <div className="mt-6">
        <DevicesPanel />
      </div>
    </>
  );
}
