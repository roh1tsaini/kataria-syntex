/**
 * Members — the Android port of apps/app's MembersPage. Same roster,
 * permission editor (ALL_PERMISSIONS grouped), quick bundles, pending-invite
 * list with revoke, remove + transfer-ownership confirms, and the same gates
 * as web: the route requires "manage_members" (ProtectedRoute) while the
 * management UI itself is primary-admin only.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useAuth,
  usePermission,
  ALL_PERMISSIONS,
  friendlyError,
  toastError,
  toastSuccess,
  type Member,
  type Permission,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { cn } from "@/lib/cn";
import { confirm } from "@/ui/confirm";
import { Badge, Button, Card, Input, Screen, Skeleton } from "@/ui/kit";

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

const PERMISSION_LABELS: Record<Permission, string> = {
  create_challan: "Create Challans",
  edit_challan: "Edit Challans",
  delete_challan: "Delete Challans",
  create_return: "Create Returns",
  edit_return: "Edit Returns",
  create_raw_material: "Create Raw Material",
  edit_raw_material: "Edit Raw Material",
  create_packing: "Create Packing",
  edit_packing: "Edit Packing",
  manage_masters: "Manage Masters",
  view_stock: "View Stock",
  view_reports: "View Reports",
  manage_members: "Manage Members",
  manage_settings: "Manage Settings",
};

const permissionLabel = (perm: Permission): string =>
  PERMISSION_LABELS[perm] ?? perm;

function samePerms(a: Permission[], b: Permission[]): boolean {
  return a.length === b.length && b.every((p) => a.includes(p));
}

/** Card with zero padding — header rows and list cells bleed to the edges
 * (kit Card is always p-4; these sections need edge-to-edge rows). */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("rounded-xl border", className)}
      style={{ backgroundColor: p.card, borderColor: p.border }}
    >
      {children}
    </View>
  );
}

// ── Local primitives (palette-driven; the kit's Button has no style slot) ───

/** Small outline action — the web ghost/outline-sm button equivalent. */
function RowButton({
  label,
  onPress,
  disabled,
  color,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: "warning" | "destructive";
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const tint =
    color === "warning"
      ? p.warning
      : color === "destructive"
        ? p.destructive
        : p.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[44px] justify-center rounded-md border px-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
        borderColor: color ? tint : p.border,
        backgroundColor: color ? `${tint}14` : "transparent",
      })}
    >
      <Text className="text-[13px] font-semibold" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Quick-bundle chip — highlighted when the selection matches exactly. */
function BundleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-[44px] justify-center rounded-md border px-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        borderColor: active ? p.primary : p.border,
        backgroundColor: active ? p.accentSoft : "transparent",
      })}
    >
      <Text
        className="text-[13px] font-semibold"
        style={{ color: active ? p.accentInk : p.foreground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BundleRow({
  selected,
  onApply,
}: {
  selected: Permission[];
  onApply: (perms: Permission[]) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {BUNDLES.map((b) => (
        <BundleChip
          key={b.label}
          label={b.label}
          active={samePerms(selected, b.perms)}
          onPress={() => onApply([...b.perms])}
        />
      ))}
    </View>
  );
}

/** Permission checkbox row — 44px target, whole row toggles (web: label
 * wrapping a checkbox; here the row is the single toggle, no double-fire). */
function PermCheck({
  perm,
  checked,
  onToggle,
}: {
  perm: Permission;
  checked: boolean;
  onToggle: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      className="min-h-[44px] flex-row items-center gap-2.5 rounded-md px-2 py-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        className="h-[18px] w-[18px] items-center justify-center rounded-[4px] border"
        style={{
          borderColor: checked ? p.primary : p.input,
          backgroundColor: checked ? p.primary : "transparent",
        }}
      >
        {checked && (
          <Feather name="check" size={13} color={p.primaryForeground} />
        )}
      </View>
      <Text className="flex-1 text-[14px]" style={{ color: p.foreground }}>
        {permissionLabel(perm)}
      </Text>
    </Pressable>
  );
}

function PermGroupList({
  selected,
  onToggle,
}: {
  selected: Permission[];
  onToggle: (perm: Permission) => void;
}) {
  const p = usePalette();
  return (
    <View>
      {PERMISSION_GROUPS.map((group) => (
        <View key={group.label} className="mb-2">
          <Text
            className="px-0.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            {group.label}
          </Text>
          {group.perms.map((perm) => (
            <PermCheck
              key={perm}
              perm={perm}
              checked={selected.includes(perm)}
              onToggle={() => onToggle(perm)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Add member form ─────────────────────────────────────────────────────────

function AddMemberForm() {
  const addMember = useAuth((s) => s.addMember);
  const [identifier, setIdentifier] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([
    "create_packing",
    "edit_packing",
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = usePalette();

  const togglePerm = (perm: Permission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((x) => x !== perm) : [...prev, perm],
    );
  };

  const submit = async () => {
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
    <Card className="mt-4">
      <Text
        className="text-[15px] font-semibold"
        style={{ color: p.foreground }}
      >
        Add a member
      </Text>
      <Text className="mt-0.5 text-[13px]" style={{ color: p.mutedForeground }}>
        Enter their phone number or email to grant access.
      </Text>

      <View className="mt-4 gap-4">
        <View className="gap-1.5">
          <Text
            className="text-[13px] font-medium"
            style={{ color: p.foreground }}
          >
            Phone or email
          </Text>
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="98765 43210 or name@email.com"
            accessibilityLabel="Phone or email"
          />
        </View>

        <View className="gap-2">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Quick bundles
          </Text>
          <BundleRow
            selected={permissions}
            onApply={(perms) => setPermissions(perms)}
          />
        </View>

        <View className="gap-2">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Permissions ({permissions.length} selected)
          </Text>
          <PermGroupList selected={permissions} onToggle={togglePerm} />
        </View>

        <View className="gap-2 border-t pt-4" style={{ borderColor: p.border }}>
          <Button
            label="Add member"
            onPress={() => void submit()}
            disabled={
              busy || identifier.trim().length < 5 || permissions.length === 0
            }
            loading={busy}
          />
          {error ? (
            <Text className="text-[12px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ── Roster ──────────────────────────────────────────────────────────────────

function RoleBadge({ isPrimaryAdmin }: { isPrimaryAdmin: boolean }) {
  if (isPrimaryAdmin) return <Badge label="Primary Admin" tone="accent" />;
  return <Badge label="Member" tone="warning" />;
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
  const p = usePalette();

  const togglePerm = (perm: Permission) => {
    setDraftPerms((prev) =>
      prev.includes(perm) ? prev.filter((x) => x !== perm) : [...prev, perm],
    );
  };

  return (
    <View className="py-3">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              className="text-[14px] font-semibold"
              style={{ color: p.foreground }}
            >
              {member.name}
            </Text>
            <RoleBadge isPrimaryAdmin={member.isPrimaryAdmin} />
            {member.isCurrent ? (
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                (you)
              </Text>
            ) : null}
          </View>
          <Text className="mt-0.5 text-xs" style={{ color: p.mutedForeground }}>
            {member.phone ?? member.email ?? "—"}
          </Text>
          {!editing &&
          !member.isPrimaryAdmin &&
          member.permissions.length > 0 ? (
            <View className="mt-1.5 flex-row flex-wrap gap-1">
              {member.permissions.map((perm) => (
                <Badge key={perm} label={permissionLabel(perm)} />
              ))}
            </View>
          ) : null}
        </View>
        {canManage ? (
          <View className="shrink-0 flex-row items-center gap-1.5">
            {member.isPrimaryAdmin ? (
              isPrimaryAdmin ? (
                <RowButton
                  label="Transfer admin"
                  onPress={onTransfer}
                  disabled={busy}
                  color="warning"
                />
              ) : null
            ) : (
              <>
                <RowButton
                  label={editing ? "Cancel" : "Edit"}
                  onPress={() => {
                    setEditing(!editing);
                    setDraftPerms(member.permissions);
                  }}
                  disabled={busy}
                />
                <RowButton
                  label="Remove"
                  onPress={onRemove}
                  disabled={busy}
                  color="destructive"
                  accessibilityLabel={`Remove ${member.name}`}
                />
              </>
            )}
          </View>
        ) : null}
      </View>
      {editing ? (
        <View
          className="mt-3 gap-3 rounded-lg border p-4"
          style={{ borderColor: p.border, backgroundColor: p.muted }}
        >
          <BundleRow
            selected={draftPerms}
            onApply={(perms) => setDraftPerms(perms)}
          />
          <PermGroupList selected={draftPerms} onToggle={togglePerm} />
          <Button
            label="Save permissions"
            onPress={() => {
              onPermissionsChange(draftPerms);
              setEditing(false);
            }}
            disabled={busy || draftPerms.length === 0}
          />
        </View>
      ) : null}
    </View>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function MembersPage() {
  const workspace = useAuth((s) => s.workspace);
  const members = useAuth((s) => s.members);
  const pendingMembers = useAuth((s) => s.pendingMembers);
  const refreshMembers = useAuth((s) => s.refreshMembers);
  const updateMemberPermissions = useAuth((s) => s.updateMemberPermissions);
  const removeMember = useAuth((s) => s.removeMember);
  const removePendingMember = useAuth((s) => s.removePendingMember);
  const transferOwnership = useAuth((s) => s.transferOwnership);
  const bootstrap = useAuth((s) => s.bootstrap);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const p = usePalette();

  const isPrimaryAdmin = workspace?.isPrimaryAdmin ?? false;
  const canManage = isPrimaryAdmin;

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    void refreshMembers()
      .catch((err) => {
        if (!cancelled) setListError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
    <Screen
      title="Members"
      subtitle={
        canManage
          ? "Add your team and set what each member can do."
          : "Your workspace team."
      }
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-4 pb-8"
      >
        {error ? (
          <View
            className="mb-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
            accessibilityRole="alert"
          >
            <Text className="text-[13px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          </View>
        ) : null}

        <Panel>
          <View
            className="flex-row items-center justify-between border-b px-4 py-2.5"
            style={{
              borderColor: p.border,
              backgroundColor: p.muted,
            }}
          >
            <Text
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Roster
            </Text>
            <Badge
              label={`${members.length} ${members.length === 1 ? "member" : "members"}`}
            />
          </View>
          {listLoading && members.length === 0 ? (
            <View className="gap-2 px-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </View>
          ) : listError && members.length === 0 ? (
            <View className="gap-2 px-4 py-6">
              <Text
                className="text-center text-sm"
                style={{ color: p.destructive }}
              >
                {listError}
              </Text>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => {
                  setListError(null);
                  setListLoading(true);
                  void refreshMembers()
                    .catch((err) => setListError(friendlyError(err)))
                    .finally(() => setListLoading(false));
                }}
              />
            </View>
          ) : members.length === 0 ? (
            <View className="items-center gap-1 py-10">
              <Feather name="user-plus" size={24} color={p.mutedForeground} />
              <Text
                className="text-[15px] font-semibold"
                style={{ color: p.foreground }}
              >
                No members yet
              </Text>
              <Text
                className="text-center text-[13px]"
                style={{ color: p.mutedForeground }}
              >
                Invite your team with the form below.
              </Text>
            </View>
          ) : (
            members.map((m, i) => (
              <View
                key={m.id}
                className="px-4"
                style={{
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: withAlpha(p.border, 0.65),
                }}
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
                      // Web navigates "/" after the transfer — the gate
                      // re-routes by role.
                      router.replace("/");
                    })
                  }
                />
              </View>
            ))
          )}
        </Panel>

        {canManage && pendingMembers.length > 0 ? (
          <Panel className="mt-4">
            <View
              className="flex-row items-center justify-between border-b px-4 py-2.5"
              style={{ borderColor: p.border, backgroundColor: p.muted }}
            >
              <Text
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Waiting to join
              </Text>
              <Badge
                label={`${pendingMembers.length} ${pendingMembers.length === 1 ? "invite" : "invites"}`}
              />
            </View>
            <Text
              className="border-b px-4 py-2.5 text-xs"
              style={{
                color: p.mutedForeground,
                borderColor: withAlpha(p.border, 0.65),
              }}
            >
              Invited members who have not yet signed in.
            </Text>
            {pendingMembers.map((pm, i) => (
              <View
                key={pm.id}
                className="px-4"
                style={{
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: withAlpha(p.border, 0.65),
                }}
              >
                <View className="flex-row items-center gap-3 py-3">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[14px] font-medium"
                      style={{ color: p.foreground }}
                      numberOfLines={1}
                    >
                      {pm.identifier}
                    </Text>
                    {pm.invitedByName ? (
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: p.mutedForeground }}
                      >
                        Invited by {pm.invitedByName}
                      </Text>
                    ) : null}
                    <View className="mt-1.5 flex-row flex-wrap gap-1">
                      {pm.permissions.map((perm) => (
                        <Badge key={perm} label={permissionLabel(perm)} />
                      ))}
                    </View>
                  </View>
                  <RowButton
                    label="Remove"
                    onPress={() =>
                      void run(pm.id, async () => {
                        const ok = await confirm({
                          title: `Remove ${pm.identifier}?`,
                          description:
                            "They will no longer join this workspace automatically.",
                          confirmLabel: "Remove",
                          destructive: true,
                        });
                        if (!ok) return;
                        await removePendingMember(pm.id);
                        toastSuccess("Pre-add removed");
                      })
                    }
                    disabled={busyId === pm.id}
                    color="destructive"
                    accessibilityLabel={`Remove ${pm.identifier}`}
                  />
                </View>
              </View>
            ))}
          </Panel>
        ) : null}

        {canManage ? <AddMemberForm /> : null}
      </ScrollView>
    </Screen>
  );
}

export default function MembersRoute() {
  const status = useAuth((s) => s.status);
  const can = usePermission();
  const router = useRouter();
  const allowed = can("manage_members");

  // Same contract as web ProtectedRoute: guest → sign-in, permission miss →
  // home (the "/" gate routes packer-only accounts to packing).
  useEffect(() => {
    if (status === "guest") router.replace("/auth");
    else if (status === "authed" && !allowed) router.replace("/");
  }, [status, allowed, router]);

  if (status !== "authed" || !allowed) return null;
  return <MembersPage />;
}
