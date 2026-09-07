import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Trash2, Crown, ShieldCheck } from "lucide-react";
import {
  useAuth,
  type Member,
  type Permission,
  ALL_PERMISSIONS,
} from "@/store/auth";
import { friendlyError } from "@/ui/lib/errors";
import { toastError, toastSuccess } from "@/store/toast";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { useConfirm } from "@/ui/components/confirm-dialog";
import { roleBadge, permissionLabel } from "@/ui/components/role-badge";
import { cn } from "@/ui/lib/cn";

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  {
    label: "Challans",
    perms: ["create_challan", "edit_challan", "delete_challan"],
  },
  {
    label: "Returns",
    perms: ["create_return", "edit_return"],
  },
  {
    label: "Raw Material",
    perms: ["create_raw_material", "edit_raw_material"],
  },
  {
    label: "Packing",
    perms: ["create_packing", "edit_packing"],
  },
  {
    label: "Other",
    perms: [
      "manage_masters",
      "view_stock",
      "view_reports",
      "manage_members",
      "manage_settings",
    ],
  },
];

const BUNDLES: { label: string; perms: Permission[] }[] = [
  { label: "Full Access", perms: [...ALL_PERMISSIONS] },
  {
    label: "Packer",
    perms: ["create_packing", "edit_packing"],
  },
  {
    label: "Challan Creator",
    perms: ["create_challan", "edit_challan", "view_stock", "view_reports"],
  },
  { label: "Stock Viewer", perms: ["view_stock", "view_reports"] },
];

function AddMemberForm() {
  const addMember = useAuth((s) => s.addMember);
  const [identifier, setIdentifier] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([
    "create_packing",
    "edit_packing",
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePerm = (perm: Permission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const applyBundle = (bundle: Permission[]) => {
    setPermissions([...bundle]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (permissions.length === 0) {
      setError("Select at least one permission");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await addMember(identifier.trim(), permissions);
      setIdentifier("");
      if (res.attached) toastSuccess("Member added to this workspace.");
      else toastSuccess("Member pre-added for first login.");
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not add member", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle>Add a member</CardTitle>
        <CardDescription>
          Enter their phone number or email to grant access.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={submit} className="space-y-5">
          <FieldGroup>
            <Field data-invalid={!!error} className="max-w-xs">
              <FieldLabel htmlFor="add-member">Phone or email</FieldLabel>
              <Input
                id="add-member"
                type="text"
                inputMode="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="98765 43210 or name@email.com"
                aria-invalid={!!error}
                aria-describedby={error ? "member-error" : undefined}
                required
              />
            </Field>
          </FieldGroup>

          <div>
            <p className="micro-label">Quick bundles</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {BUNDLES.map((b) => (
                <Button
                  key={b.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyBundle(b.perms)}
                  className={cn(
                    permissions.length === b.perms.length &&
                      b.perms.every((p) => permissions.includes(p)) &&
                      "border-primary/30 bg-accent text-accent-foreground",
                  )}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>

          <fieldset aria-describedby={error ? "member-error" : undefined}>
            <legend className="micro-label">
              Permissions ({permissions.length} selected)
            </legend>
            <div className="mt-2.5 grid gap-4 sm:grid-cols-2 sm:gap-6">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <p className="px-0.5 pb-1 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </p>
                  {group.perms.map((perm) => (
                    <label
                      key={perm}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50 sm:min-h-10"
                    >
                      <Checkbox
                        checked={permissions.includes(perm)}
                        onCheckedChange={() => togglePerm(perm)}
                      />
                      <span>{permissionLabel(perm)}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="border-t border-border pt-4">
            <Button
              type="submit"
              disabled={
                busy || identifier.trim().length < 5 || permissions.length === 0
              }
              loading={busy}
            >
              <UserPlus aria-hidden />
              Add member
            </Button>
            {error && (
              <FieldError id="member-error" className="mt-2">
                {error}
              </FieldError>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  canManage,
  isPrimaryAdmin,
  busy,
  onPermissionsChange,
  onRemove,
  onTransfer,
}: {
  member: Member;
  canManage: boolean;
  isPrimaryAdmin: boolean;
  busy: boolean;
  onPermissionsChange: (perms: Permission[]) => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftPerms, setDraftPerms] = useState<Permission[]>(
    member.permissions,
  );

  const togglePerm = (perm: Permission) => {
    setDraftPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{member.name}</span>
            {roleBadge(member.isPrimaryAdmin)}
            {member.isCurrent && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {member.phone ?? member.email ?? "—"}
          </div>
          {!editing &&
            !member.isPrimaryAdmin &&
            member.permissions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {member.permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="font-medium">
                    {permissionLabel(p)}
                  </Badge>
                ))}
              </div>
            )}
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            {member.isPrimaryAdmin ? (
              isPrimaryAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onTransfer()}
                  disabled={busy}
                  className="text-warning"
                >
                  <Crown aria-hidden />
                  Transfer admin
                </Button>
              )
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(!editing);
                    setDraftPerms(member.permissions);
                  }}
                  disabled={busy}
                >
                  <ShieldCheck aria-hidden />
                  {editing ? "Cancel" : "Edit"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onRemove()}
                  disabled={busy}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${member.name}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex flex-wrap gap-1.5">
            {BUNDLES.map((b) => (
              <Button
                key={b.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraftPerms([...b.perms])}
              >
                {b.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label} className="space-y-0.5">
                <p className="px-0.5 pb-1 micro-label">{group.label}</p>
                {group.perms.map((perm) => (
                  <label
                    key={perm}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-0.5 text-[13px] transition-colors hover:bg-card/60"
                    onClick={(e) => {
                      // Custom Checkbox is a button — row taps toggle it,
                      // direct button taps must not double-fire.
                      if ((e.target as HTMLElement).closest("button")) {
                        return;
                      }
                      togglePerm(perm);
                    }}
                  >
                    <Checkbox
                      checked={draftPerms.includes(perm)}
                      onCheckedChange={() => togglePerm(perm)}
                    />
                    <span>{permissionLabel(perm)}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              onPermissionsChange(draftPerms);
              setEditing(false);
            }}
            disabled={busy || draftPerms.length === 0}
          >
            Save permissions
          </Button>
        </div>
      )}
    </div>
  );
}

export function MembersPage() {
  const workspace = useAuth((s) => s.workspace);
  const members = useAuth((s) => s.members);
  const pendingMembers = useAuth((s) => s.pendingMembers);
  const refreshMembers = useAuth((s) => s.refreshMembers);
  const updateMemberPermissions = useAuth((s) => s.updateMemberPermissions);
  const removeMember = useAuth((s) => s.removeMember);
  const removePendingMember = useAuth((s) => s.removePendingMember);
  const transferOwnership = useAuth((s) => s.transferOwnership);
  const bootstrap = useAuth((s) => s.bootstrap);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const isPrimaryAdmin = workspace?.isPrimaryAdmin ?? false;
  const canManage = isPrimaryAdmin;

  useEffect(() => {
    void refreshMembers().catch(() => {});
  }, [refreshMembers]);

  const run = async (
    memberId: string,
    fn: () => Promise<void>,
    success?: string,
  ) => {
    setError(null);
    setBusyId(memberId);
    try {
      await fn();
      if (success) toastSuccess(success);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Action failed", msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace & permissions"
        title="Members"
        description={
          canManage
            ? "Add your team and set what each member can do."
            : "Your workspace team."
        }
      />

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">Roster</span>
          <Badge
            variant="secondary"
            className="font-medium tabular-nums whitespace-nowrap"
          >
            {members.length} {members.length === 1 ? "member" : "members"}
          </Badge>
        </div>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <Empty className="px-4 py-10">
              <EmptyMedia variant="icon">
                <UserPlus aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No members yet</EmptyTitle>
                <EmptyDescription>
                  Invite your team with the form above.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="border-b border-border/65 px-4 transition-colors last:border-b-0 hover:bg-muted/40 sm:px-5"
                >
                  <MemberRow
                    member={m}
                    canManage={canManage}
                    isPrimaryAdmin={isPrimaryAdmin}
                    busy={busyId === m.id}
                    onPermissionsChange={(perms) =>
                      void run(
                        m.id,
                        () => updateMemberPermissions(m.id, perms),
                        `${m.name}'s permissions updated.`,
                      )
                    }
                    onRemove={() =>
                      void run(m.id, async () => {
                        const ok = await confirm({
                          title: `Remove ${m.name}?`,
                          description:
                            "Their sessions will be ended immediately and they will lose access to this workspace.",
                          confirmLabel: "Remove",
                          destructive: true,
                        });
                        if (!ok) return;
                        await removeMember(m.id);
                        toastSuccess(`${m.name} removed`);
                      })
                    }
                    onTransfer={() =>
                      void run(m.id, async () => {
                        const ok = await confirm({
                          title: `Transfer primary admin to ${m.name}?`,
                          description:
                            "You will become a regular member, and this cannot be undone.",
                          confirmLabel: "Transfer",
                          destructive: true,
                        });
                        if (!ok) return;
                        await transferOwnership(m.id);
                        await bootstrap();
                        navigate("/", { replace: true });
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && pendingMembers.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
            <span className="micro-label">Waiting to join</span>
            <Badge
              variant="secondary"
              className="font-medium tabular-nums whitespace-nowrap"
            >
              {pendingMembers.length}{" "}
              {pendingMembers.length === 1 ? "invite" : "invites"}
            </Badge>
          </div>
          <p className="border-b border-border/65 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            Invited members who have not yet signed in.
          </p>
          <CardContent className="p-0">
            <div>
              {pendingMembers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 border-b border-border/65 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.identifier}
                    </div>
                    {p.invitedByName && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Invited by {p.invitedByName}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.permissions.map((perm) => (
                        <Badge
                          key={perm}
                          variant="secondary"
                          className="font-medium"
                        >
                          {permissionLabel(perm)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busyId === p.id}
                    onClick={() =>
                      void run(p.id, async () => {
                        const ok = await confirm({
                          title: `Remove ${p.identifier}?`,
                          description:
                            "They will no longer join this workspace automatically.",
                          confirmLabel: "Remove",
                          destructive: true,
                        });
                        if (!ok) return;
                        await removePendingMember(p.id);
                        toastSuccess("Pre-add removed");
                      })
                    }
                    aria-label={`Remove ${p.identifier}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dialog}

      {canManage && <AddMemberForm />}
    </>
  );
}
