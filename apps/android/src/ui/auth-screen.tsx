/**
 * Auth screen — the phone-first port of apps/app's AuthPage. Same step
 * machine (home → otp → create → password), same store calls, same error
 * copy; the QR method panel replaces the desktop's always-visible panel
 * (a phone IS the QR scanner target, so pairing is shown via the panel or
 * scanned with another device).
 */

import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { useAuth, friendlyError } from "@kataria-syntex/app-core";
import { useRouter } from "expo-router";
import { usePalette } from "@/theme";
import { Button, Field, Input, Card } from "@/ui/kit";
import { QrLoginPanel } from "@/ui/qr-login-panel";

type Step = "home" | "otp" | "create" | "password";

type Draft = {
  identifier: string;
  name?: string;
  workspaceName?: string;
  password?: string;
};

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
  const p = usePalette();
  const filled = identifier.trim().length >= 5;
  return (
    <View className="gap-4">
      <Field label="Phone number or email" error={error}>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="+91 98765 43210 or you@gmail.com"
          value={identifier}
          onChangeText={setIdentifier}
        />
      </Field>
      <Button
        label="Continue"
        onPress={() => onNext(identifier.trim())}
        disabled={busy || !filled}
        loading={busy}
      />
      <Text className="text-[11px]" style={{ color: p.mutedForeground }}>
        Wrong number? Accounts match the phone/email the admin invited.
      </Text>
    </View>
  );
}

function OtpStep({
  identifier,
  draft,
  hasPassword,
  startWithQrFallback,
  onNeedsSignup,
  onUsePassword,
  onBack,
}: {
  identifier: string;
  draft: Draft | null;
  hasPassword: boolean;
  startWithQrFallback: boolean;
  onNeedsSignup: () => void;
  onUsePassword: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showQrFallback, setShowQrFallback] = useState(startWithQrFallback);
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const requestOtp = useAuth((s) => s.requestOtp);
  const router = useRouter();
  const p = usePalette();

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const masked = identifier.includes("@")
    ? identifier
    : `••••• ${identifier.slice(-4)}`;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await verifyOtp(identifier, code);
      if (res.outcome === "ok") {
        router.replace("/");
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
      router.replace("/");
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
        <Input
          keyboardType="number-pad"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChangeText={setCode}
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
            label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            variant="secondary"
            onPress={() => void resend()}
            disabled={cooldown > 0}
          />
        </View>
        <View className="flex-1">
          <Button label="Back" variant="secondary" onPress={onBack} />
        </View>
      </View>
      {hasPassword && (
        <Button
          label="Use password instead"
          variant="ghost"
          onPress={onUsePassword}
        />
      )}
      {showQrFallback && (
        <View
          className="rounded-lg border p-4"
          style={{ borderColor: p.border, backgroundColor: p.muted }}
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
            <QrLoginPanel identifier={identifier} />
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

  const submit = async () => {
    setError(null);
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
        <Input value={name} onChangeText={setName} placeholder="Full name" />
      </Field>
      {!hasInvite && (
        <>
          <Field label="Company / workspace name">
            <Input
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="e.g. Kataria Syntex"
            />
          </Field>
          <Field label="Password (optional)">
            <Input
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 10 characters"
            />
          </Field>
        </>
      )}
      <Button
        label="Send verification code"
        onPress={() => void submit()}
        disabled={busy || !name.trim() || (!hasInvite && !workspaceName.trim())}
        loading={busy}
      />
      <Button
        label="Back"
        variant="secondary"
        onPress={onBack}
        disabled={busy}
      />
    </View>
  );
}

function PasswordStep({
  identifier,
  onBack,
}: {
  identifier: string;
  onBack: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginPassword = useAuth((s) => s.loginPassword);
  const router = useRouter();

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginPassword(identifier, password);
      router.replace("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4">
      <Field label="Password" error={error}>
        <Input secureTextEntry value={password} onChangeText={setPassword} />
      </Field>
      <Button
        label="Log in"
        onPress={() => void submit()}
        disabled={busy || !password}
        loading={busy}
      />
      <Button
        label="Use a verification code instead"
        variant="secondary"
        onPress={onBack}
      />
    </View>
  );
}

export function AuthScreen() {
  const requestOtp = useAuth((s) => s.requestOtp);
  const lookupIdentifier = useAuth((s) => s.lookupIdentifier);
  const router = useRouter();
  const p = usePalette();
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

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow items-center justify-center p-4"
      style={{ backgroundColor: p.background }}
    >
      <View className="mb-6 flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: p.foreground }}
        >
          <Text
            className="text-lg font-semibold"
            style={{ color: p.background }}
          >
            K
          </Text>
        </View>
        <Text
          className="text-[17px] font-semibold"
          style={{ color: p.foreground }}
        >
          {COMPANY_DETAILS.name} Biz App
        </Text>
      </View>

      <Card className="w-full max-w-md">
        <View className="gap-4">
          <View>
            <Text
              className="text-[17px] font-semibold"
              style={{ color: p.foreground }}
            >
              {title}
            </Text>
          </View>

          {step === "home" && (
            <View className="gap-5">
              <View
                className="flex-row gap-1 rounded-md border p-1"
                style={{ backgroundColor: p.muted, borderColor: p.border }}
              >
                {(["phone", "qr"] as const).map((m) => (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: method === m }}
                    onPress={() => setMethod(m)}
                    className="min-h-[40px] flex-1 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: method === m ? p.card : "transparent",
                    }}
                  >
                    <Text
                      className="text-[13px] font-medium"
                      style={{
                        color: method === m ? p.foreground : p.mutedForeground,
                      }}
                    >
                      {m === "phone" ? "Phone / Email" : "Instant QR Login"}
                    </Text>
                  </Pressable>
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
                  <QrLoginPanel />
                </View>
              )}
            </View>
          )}

          {step === "otp" && (
            <OtpStep
              identifier={identifier}
              draft={draft}
              hasPassword={accountExists && hasPassword}
              startWithQrFallback={otpFallback}
              onNeedsSignup={() => {
                setDraft({ identifier });
                setStep("create");
              }}
              onUsePassword={() => setStep("password")}
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
              onBack={() => setStep("otp")}
            />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}
