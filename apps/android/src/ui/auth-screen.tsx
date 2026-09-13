/**
 * Auth screen — the phone-first port of apps/app's AuthPage. Same step
 * machine (home → otp → create → password), same store calls, same error
 * copy; the QR method panel replaces the desktop's always-visible panel
 * (a phone IS the QR scanner target, so pairing is shown via the panel or
 * scanned with another device).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { useAuth, friendlyError } from "@kataria-syntex/app-core";
import { useRouter } from "expo-router";
import { usePalette, withAlpha } from "@/theme";
import { Button, Field, Input, Card } from "@/ui/kit";
import { Feather } from "@/ui/feather";
import { OtpInput } from "@/ui/otp-input";
import { QrLoginPanel } from "@/ui/qr-login-panel";

type Step = "home" | "otp" | "create" | "password";

type Draft = {
  identifier: string;
  name?: string;
  workspaceName?: string;
  password?: string;
};

/** Small muted underlined text action — the web `variant="link"` button
 *  (auth uses it for "Use password instead"). */
function LinkButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[44px] w-full items-center justify-center"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text className="text-xs underline" style={{ color: p.mutedForeground }}>
        {label}
      </Text>
    </Pressable>
  );
}

function IdentifierStep({
  busy,
  error,
  onNext,
}: {
  busy: boolean;
  error: string | null;
  onNext: (identifier: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const filled = identifier.trim().length >= 5;
  const submit = () => {
    if (!busy && filled) onNext(identifier.trim());
  };
  return (
    <View className="gap-4">
      <Field label="Phone number or email" error={error}>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="username"
          autoFocus
          placeholder="+91 98765 43210 or you@gmail.com"
          value={identifier}
          onChangeText={setIdentifier}
          onSubmitEditing={submit}
          returnKeyType="next"
        />
      </Field>
      <Button
        label="Continue"
        onPress={submit}
        disabled={busy || !filled}
        loading={busy}
      />
    </View>
  );
}

function OtpStep({
  identifier,
  returnTo,
  draft,
  hasPassword,
  startWithQrFallback,
  onNeedsSignup,
  onUsePassword,
  onAuthed,
  onBack,
}: {
  identifier: string;
  returnTo?: string;
  draft: Draft | null;
  hasPassword: boolean;
  startWithQrFallback: boolean;
  onNeedsSignup: () => void;
  onUsePassword: () => void;
  onAuthed: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showQrFallback, setShowQrFallback] = useState(startWithQrFallback);
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const requestOtp = useAuth((s) => s.requestOtp);
  const p = usePalette();

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const masked = identifier.includes("@")
    ? identifier
    : `••••• ${identifier.slice(-4)}`;

  const submit = async () => {
    if (busy || code.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      const res = await verifyOtp(identifier, code);
      if (res.outcome === "ok") {
        onAuthed();
        return;
      }
      if (!draft?.name) {
        onNeedsSignup();
        return;
      }
      await useAuth.getState().signup({
        identifier,
        name: draft.name,
        ...(draft.password ? { password: draft.password } : {}),
        ...(draft.workspaceName ? { workspaceName: draft.workspaceName } : {}),
      });
      onAuthed();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await requestOtp(identifier);
      setCooldown(30);
    } catch {
      setShowQrFallback(true);
    }
  };

  return (
    <View className="gap-4">
      <Field label="Verification code" error={error}>
        <OtpInput
          value={code}
          onChange={setCode}
          onSubmit={() => void submit()}
          invalid={!!error}
          autoFocus
        />
        <Text className="text-[12px]" style={{ color: p.mutedForeground }}>
          Sent to {masked}, expires in 5 minutes.
        </Text>
      </Field>
      <Button
        label="Verify"
        onPress={() => void submit()}
        disabled={busy || code.length !== 6}
        loading={busy}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            variant="outline"
            onPress={() => void resend()}
            disabled={cooldown > 0}
          />
        </View>
        <View className="flex-1">
          <Button label="Back" variant="outline" onPress={onBack} />
        </View>
      </View>
      {hasPassword && (
        <LinkButton label="Use password instead" onPress={onUsePassword} />
      )}
      {showQrFallback && (
        <View
          className="rounded-lg border p-4"
          style={{
            borderColor: p.border,
            backgroundColor: withAlpha(p.muted, 0.4),
          }}
        >
          <Text
            className="text-[13px] font-medium"
            style={{ color: p.foreground }}
          >
            Can't receive the code?
          </Text>
          <Text className="mt-1 text-xs" style={{ color: p.mutedForeground }}>
            Show this QR to an admin — scanning it logs this device in without
            any SMS.
          </Text>
          <View className="mt-3">
            <QrLoginPanel identifier={identifier} returnTo={returnTo} />
          </View>
        </View>
      )}
    </View>
  );
}

function CreateStep({
  identifier,
  hasInvite,
  onReady,
  onBack,
}: {
  identifier: string;
  hasInvite: boolean;
  onReady: (draft: Draft) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useAuth((s) => s.requestOtp);
  const p = usePalette();

  const canSubmit =
    !!name.trim() && (hasInvite || !!workspaceName.trim()) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    // Same floor as the web form (minLength=10) — RN inputs don't enforce it.
    if (!hasInvite && password && password.length < 10) {
      setError("Minimum 10 characters.");
      return;
    }
    setBusy(true);
    try {
      await requestOtp(identifier);
      onReady({
        identifier,
        name: name.trim(),
        ...(hasInvite
          ? {}
          : {
              workspaceName: workspaceName.trim(),
              ...(password ? { password } : {}),
            }),
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4">
      <Field label="Your name" error={error}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          autoComplete="name"
          autoFocus
          onSubmitEditing={() => void submit()}
          returnKeyType="next"
        />
      </Field>
      {hasInvite ? (
        <View
          className="rounded-md border px-3 py-2"
          style={{ borderColor: p.border, backgroundColor: p.muted }}
        >
          <Text className="text-xs" style={{ color: p.mutedForeground }}>
            Invited workspace member.
          </Text>
        </View>
      ) : (
        <>
          <Field label="Company / workspace name">
            <Input
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="e.g. Kataria Syntex"
              onSubmitEditing={() => void submit()}
              returnKeyType="next"
            />
          </Field>
          <Field label="Password (optional)">
            <Input
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              returnKeyType="done"
            />
            <Text className="text-[12px]" style={{ color: p.mutedForeground }}>
              Minimum 10 characters.
            </Text>
          </Field>
        </>
      )}
      <Button
        label="Send verification code"
        onPress={() => void submit()}
        disabled={!canSubmit}
        loading={busy}
      />
      <Button label="Back" variant="outline" onPress={onBack} disabled={busy} />
    </View>
  );
}

function PasswordStep({
  identifier,
  onAuthed,
  onBack,
}: {
  identifier: string;
  onAuthed: () => void;
  onBack: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginPassword = useAuth((s) => s.loginPassword);

  const submit = async () => {
    if (busy || !password) return;
    setError(null);
    setBusy(true);
    try {
      await loginPassword(identifier, password);
      onAuthed();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4">
      <Field label="Password" error={error}>
        <Input
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          autoFocus
          onSubmitEditing={() => void submit()}
          returnKeyType="done"
        />
      </Field>
      <Button
        label="Log in"
        onPress={() => void submit()}
        disabled={busy || !password}
        loading={busy}
      />
      <Button
        label="Use a verification code instead"
        variant="outline"
        onPress={onBack}
      />
    </View>
  );
}

/** Segmented method switch — the web MethodTab: active tab takes the card
 *  surface + hairline border, icon + 13px medium label. */
function MethodTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-md border"
      style={({ pressed }) => ({
        backgroundColor: active ? p.card : "transparent",
        borderColor: active ? p.border : "transparent",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text
        className="text-[13px] font-medium"
        numberOfLines={1}
        style={{ color: active ? p.foreground : p.mutedForeground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AuthScreen({ returnTo }: { returnTo?: string }) {
  const requestOtp = useAuth((s) => s.requestOtp);
  const lookupIdentifier = useAuth((s) => s.lookupIdentifier);
  const router = useRouter();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("home");
  const [method, setMethod] = useState<"phone" | "qr">("phone");
  const [identifier, setIdentifier] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [pendingHasInvite, setPendingHasInvite] = useState(false);
  const [otpFallback, setOtpFallback] = useState(false);
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  const finishAuth = () => router.replace(returnTo ?? "/");

  const handleIdentifier = async (value: string) => {
    setHomeError(null);
    setOtpFallback(false);
    try {
      const result = await lookupIdentifier(value);
      setIdentifier(value);
      setAccountExists(result.exists);
      setHasPassword(result.hasPassword);
      setPendingHasInvite(result.hasInvite);
      if (result.exists) {
        setDraft(null);
        setHomeBusy(true);
        try {
          await requestOtp(value);
          setStep("otp");
        } catch {
          setOtpFallback(true);
          setStep("otp");
        } finally {
          setHomeBusy(false);
        }
      } else {
        setStep("create");
      }
    } catch (err) {
      setHomeError(friendlyError(err));
    }
  };

  const title =
    step === "home"
      ? "Sign in"
      : step === "create"
        ? "Set up account"
        : step === "password"
          ? "Enter password"
          : "Verification";

  const description =
    step === "home"
      ? "Enter your phone number or email, or scan the QR code."
      : step === "create"
        ? "Enter your profile details."
        : step === "password"
          ? "Enter your account password."
          : null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow items-center justify-center"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 16,
      }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: p.background }}
    >
      <View className="mb-6 flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: p.foreground }}
        >
          <Text
            className="text-lg font-semibold leading-none tracking-tight"
            style={{ color: p.background }}
          >
            K
          </Text>
        </View>
        <Text
          className="text-[17px] font-semibold tracking-tight"
          style={{ color: p.foreground }}
        >
          {COMPANY_DETAILS.name} Biz App
        </Text>
      </View>

      <Card className="w-full max-w-md">
        <View className="gap-4">
          <View className="gap-1.5">
            <Text
              className="text-[16px] font-semibold leading-tight tracking-tight"
              style={{ color: p.foreground }}
            >
              {title}
            </Text>
            {description ? (
              <Text
                className="text-[14px] leading-normal"
                style={{ color: p.mutedForeground }}
              >
                {description}
              </Text>
            ) : null}
          </View>

          {step === "home" && (
            <View className="gap-5">
              <View
                className="flex-row gap-1 rounded-md border p-1"
                style={{ backgroundColor: p.muted, borderColor: p.border }}
              >
                {(["phone", "qr"] as const).map((m) => (
                  <MethodTab
                    key={m}
                    active={method === m}
                    onPress={() => setMethod(m)}
                    label={m === "phone" ? "Phone / Email" : "Instant QR Login"}
                    icon={
                      m === "phone" ? (
                        <Feather
                          name="smartphone"
                          size={16}
                          color={
                            method === m ? p.foreground : p.mutedForeground
                          }
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="qrcode"
                          size={16}
                          color={
                            method === m ? p.foreground : p.mutedForeground
                          }
                        />
                      )
                    }
                  />
                ))}
              </View>
              {method === "phone" ? (
                <IdentifierStep
                  busy={homeBusy}
                  error={homeError}
                  onNext={(value) => void handleIdentifier(value)}
                />
              ) : (
                <View className="items-center py-2">
                  <QrLoginPanel returnTo={returnTo} />
                </View>
              )}
            </View>
          )}

          {step === "otp" && (
            <OtpStep
              identifier={identifier}
              returnTo={returnTo}
              draft={draft}
              hasPassword={accountExists && hasPassword}
              startWithQrFallback={otpFallback}
              onNeedsSignup={() => {
                setDraft({ identifier });
                setStep("create");
              }}
              onUsePassword={() => setStep("password")}
              onAuthed={finishAuth}
              onBack={() => {
                setDraft(null);
                setStep("home");
              }}
            />
          )}

          {step === "create" && !accountExists && (
            <CreateStep
              identifier={identifier}
              hasInvite={pendingHasInvite}
              onReady={(d) => {
                setDraft(d);
                setStep("otp");
              }}
              onBack={() => setStep("home")}
            />
          )}

          {step === "password" && (
            <PasswordStep
              identifier={identifier}
              onAuthed={finishAuth}
              onBack={() => setStep("otp")}
            />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}
