import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { QrCode, Smartphone } from "lucide-react-native";
import { ApiError, friendlyError, useAuth } from "@kataria-syntex/app-core";
import { COMPANY_DETAILS, safeNextPath } from "@kataria-syntex/shared";

import { Page } from "@/components/page";
import { QrLoginPanel } from "@/components/qr-login-panel";
import { Button, ButtonText } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageDescription, PageTitle, Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type Step = "home" | "otp" | "password" | "create";

type Draft = {
  identifier: string;
  name?: string;
  password?: string;
  code?: string;
};

export function AuthScreen({ next }: { next: string | null }) {
  const router = useRouter();
  const requestOtp = useAuth((s) => s.requestOtp);
  const lookupIdentifier = useAuth((s) => s.lookupIdentifier);
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const loginPassword = useAuth((s) => s.loginPassword);
  const signup = useAuth((s) => s.signup);

  const [step, setStep] = useState<Step>("home");
  const [authMethod, setAuthMethod] = useState<"phone" | "qr">("phone");
  const [identifier, setIdentifier] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [otpFallback, setOtpFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationClosed, setRegistrationClosed] = useState(false);

  // OTP step state
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Password step state
  const [password, setPassword] = useState("");

  // Create step state
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const done = () => {
    router.replace(safeNextPath(next));
  };

  const showRegistrationClosed = () => {
    setDraft(null);
    setStep("home");
    setRegistrationClosed(true);
  };

  const handleIdentifierSubmit = async () => {
    setError(null);
    setOtpFallback(false);
    // A new lookup is a fresh attempt — a closed notice from the previous one
    // must not linger over it.
    setRegistrationClosed(false);
    const value = identifier.trim();
    if (value.length < 5) return;

    setBusy(true);
    try {
      const result = await lookupIdentifier(value);
      setIdentifier(value);
      setHasPassword(result.hasPassword);

      if (result.registrationClosed) {
        showRegistrationClosed();
        return;
      }

      if (result.exists) {
        setDraft(null);
        try {
          await requestOtp(value);
          setCooldown(30);
          setStep("otp");
        } catch (err) {
          if (err instanceof ApiError && err.code === "registration_closed") {
            showRegistrationClosed();
            return;
          }
          setOtpFallback(true);
          setStep("otp");
        }
      } else {
        setStep("create");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await verifyOtp(identifier, otpCode);
      if (res.outcome === "ok") {
        done();
        return;
      }
      if (!draft?.name || !draft.password) {
        // Verified but no account and no collected profile yet — carry the
        // verified code into the create step so signup never asks for a
        // second code.
        setDraft({ identifier, code: otpCode });
        setStep("create");
        return;
      }
      // Complete the pending signup now (the create step collected these
      // fields before the code was sent).
      await signup({
        identifier,
        name: draft.name,
        password: draft.password,
        code: otpCode,
      });
      done();
    } catch (err) {
      if (err instanceof ApiError && err.code === "registration_closed") {
        showRegistrationClosed();
        return;
      }
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await requestOtp(identifier);
      setCooldown(30);
    } catch (err) {
      if (err instanceof ApiError && err.code === "registration_closed") {
        showRegistrationClosed();
        return;
      }
      setOtpFallback(true);
    }
  };

  const handlePasswordSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginPassword(identifier, password);
      done();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (draft?.code) {
        // The code was verified on the way here; complete the signup with it
        // rather than sending a second code.
        await signup({
          identifier,
          name: createName.trim(),
          password: createPassword,
          code: draft.code,
        });
        done();
        return;
      }
      await requestOtp(identifier);
      setDraft({
        identifier,
        name: createName.trim(),
        password: createPassword,
      });
      setCooldown(30);
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError && err.code === "registration_closed") {
        showRegistrationClosed();
        return;
      }
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const maskedIdentifier = identifier.includes("@")
    ? identifier
    : `••••• ${identifier.slice(-4)}`;

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
    <Page contentClassName="items-center justify-center min-h-full py-8">
      {/* Blocking notice for an unknown identifier while registration is off
          (design.md Section 3, Closed registration). */}
      <Sheet
        open={registrationClosed}
        onClose={() => setRegistrationClosed(false)}
      >
        <SheetHeader>
          <SheetTitle>Registration closed</SheetTitle>
          <SheetDescription>
            New account registration is currently closed.
          </SheetDescription>
        </SheetHeader>
      </Sheet>

      <View className="w-full max-w-sm">
        {/* Brand lockup — full app name above the auth card (design.md
            Section 2.8). */}
        <View className="mb-6 flex-row items-center gap-3 self-center">
          <View className="size-11 items-center justify-center rounded-xl bg-foreground">
            <Text
              className="text-lg font-semibold leading-none tracking-tight text-background"
              accessibilityElementsHidden
            >
              K
            </Text>
          </View>
          <Text className="text-[17px] font-semibold tracking-tight">
            {COMPANY_DETAILS.name} Biz App
          </Text>
        </View>

        <PageTitle>{title}</PageTitle>
        {description ? (
          <PageDescription className="mt-1">{description}</PageDescription>
        ) : null}

        {/* Tab switcher: Phone vs QR (only shown on home step) */}
        {step === "home" ? (
          <View
            className="mt-6 flex-row rounded-full border border-border bg-muted p-1"
            accessibilityRole="tablist"
            accessibilityLabel="Sign-in method"
          >
            <Pressable
              onPress={() => setAuthMethod("phone")}
              className={cn(
                "h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full px-3",
                authMethod === "phone" ? "bg-card shadow-sm" : null,
              )}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMethod === "phone" }}
            >
              <Smartphone
                size={16}
                className={cn(
                  authMethod === "phone"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <Text
                className={cn(
                  "font-medium text-[13px]",
                  authMethod === "phone"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                Phone / Email
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMethod("qr")}
              className={cn(
                "h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full px-3",
                authMethod === "qr" ? "bg-card shadow-sm" : null,
              )}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMethod === "qr" }}
            >
              <QrCode
                size={16}
                className={cn(
                  authMethod === "qr"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <Text
                className={cn(
                  "font-medium text-[13px]",
                  authMethod === "qr"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                Instant QR Login
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Card className="mt-4">
          <CardContent className="p-5">
            {authMethod === "qr" && step === "home" ? (
              <QrLoginPanel onSuccess={done} />
            ) : step === "home" ? (
              <View className="gap-4">
                <Field>
                  <FieldLabel>Phone number or email</FieldLabel>
                  <Input
                    placeholder="+91 98765 43210 or you@gmail.com"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    keyboardType="email-address"
                    accessibilityLabel="Phone number or email"
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>

                <Button
                  onPress={handleIdentifierSubmit}
                  loading={busy}
                  disabled={busy || identifier.trim().length < 5}
                  accessibilityLabel="Continue sign in"
                >
                  <ButtonText>Continue</ButtonText>
                </Button>
              </View>
            ) : step === "otp" ? (
              <View className="gap-4">
                <Field>
                  <FieldLabel>Verification code</FieldLabel>
                  <Input
                    placeholder="123456"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    accessibilityLabel="6-digit verification code"
                  />
                  <FieldDescription>
                    Sent to {maskedIdentifier}, expires in 5 minutes.
                  </FieldDescription>
                  {error && <FieldError>{error}</FieldError>}
                </Field>

                <Button
                  onPress={handleVerifyOtp}
                  loading={busy}
                  disabled={busy || otpCode.length !== 6}
                  accessibilityLabel="Verify code"
                >
                  <ButtonText>Verify</ButtonText>
                </Button>

                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={handleResendOtp}
                    disabled={cooldown > 0}
                  >
                    <ButtonText variant="outline">
                      {cooldown > 0
                        ? `Resend code in ${cooldown}s`
                        : "Resend code"}
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => {
                      setError(null);
                      setDraft(null);
                      setStep("home");
                    }}
                  >
                    <ButtonText variant="outline">Back</ButtonText>
                  </Button>
                </View>

                {hasPassword && (
                  <Button
                    variant="link"
                    onPress={() => {
                      setError(null);
                      setStep("password");
                    }}
                  >
                    <ButtonText
                      variant="link"
                      className="text-muted-foreground"
                    >
                      Use password instead
                    </ButtonText>
                  </Button>
                )}

                {otpFallback && (
                  <View className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
                    <Text className="font-medium text-xs text-foreground">
                      Can't receive the code?
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Scan this QR code from a signed-in device:
                    </Text>
                    <View className="mt-3">
                      <QrLoginPanel identifier={identifier} onSuccess={done} />
                    </View>
                  </View>
                )}
              </View>
            ) : step === "password" ? (
              <View className="gap-4">
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    placeholder="Enter password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    accessibilityLabel="Account password"
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>

                <Button
                  onPress={handlePasswordSubmit}
                  loading={busy}
                  disabled={busy || !password}
                  accessibilityLabel="Log in with password"
                >
                  <ButtonText>Log in</ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setError(null);
                    setStep("otp");
                  }}
                >
                  <ButtonText variant="outline">
                    Use verification code instead
                  </ButtonText>
                </Button>
              </View>
            ) : (
              // Create step
              <View className="gap-4">
                <Field>
                  <FieldLabel>Your name</FieldLabel>
                  <Input
                    placeholder="Full name"
                    value={createName}
                    onChangeText={setCreateName}
                    accessibilityLabel="Full name"
                  />
                </Field>

                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    placeholder="At least 10 characters"
                    value={createPassword}
                    onChangeText={setCreatePassword}
                    secureTextEntry
                    autoComplete="new-password"
                    accessibilityLabel="Create password"
                  />
                  <FieldDescription>Minimum 10 characters.</FieldDescription>
                  {error && <FieldError>{error}</FieldError>}
                </Field>

                <Button
                  onPress={handleCreateSubmit}
                  loading={busy}
                  disabled={
                    busy ||
                    createName.trim().length === 0 ||
                    createPassword.length < 10
                  }
                  accessibilityLabel="Submit account details"
                >
                  <ButtonText>Send verification code</ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setError(null);
                    // A draft may hold a verified code for an identifier the
                    // user is abandoning; never carry it into a new attempt.
                    setDraft(null);
                    setStep("home");
                  }}
                >
                  <ButtonText variant="outline">Back</ButtonText>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </Page>
  );
}
