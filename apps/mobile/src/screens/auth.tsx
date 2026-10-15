import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { QrCode, Smartphone } from "lucide-react-native";
import { ApiError, friendlyError, useAuth } from "@kataria-syntex/app-core";

import { Page } from "@/components/page";
import { QrLoginPanel } from "@/components/qr-login-panel";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Eyebrow,
  PageDescription,
  PageTitle,
  Text,
} from "@/components/ui/text";
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
  const [, setAccountExists] = useState(false);
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
    router.replace((next as any) || "/");
  };

  const showRegistrationClosed = () => {
    setDraft(null);
    setStep("home");
    setRegistrationClosed(true);
  };

  const handleIdentifierSubmit = async () => {
    setError(null);
    setOtpFallback(false);
    const value = identifier.trim();
    if (value.length < 5) return;

    setBusy(true);
    try {
      const result = await lookupIdentifier(value);
      setIdentifier(value);
      setAccountExists(result.exists);
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
        setStep("create");
        return;
      }
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

  return (
    <Page contentClassName="items-center justify-center min-h-full py-8">
      <View className="w-full max-w-sm">
        <Eyebrow>Kataria Syntex</Eyebrow>
        <PageTitle className="mt-1">
          {step === "home"
            ? "Sign in"
            : step === "create"
              ? "Set up account"
              : step === "password"
                ? "Enter password"
                : "Verification"}
        </PageTitle>
        <PageDescription className="mt-1">
          {step === "home"
            ? "Enter your phone number or email, or scan the QR code."
            : step === "create"
              ? "Enter your profile details."
              : step === "password"
                ? `Enter your password for ${maskedIdentifier}.`
                : `Enter the 6-digit code sent to ${maskedIdentifier}.`}
        </PageDescription>

        {/* Tab switcher: Phone vs QR (only shown on home step) */}
        {step === "home" ? (
          <View className="mt-6 flex-row rounded-lg border border-border bg-muted/40 p-1">
            <Pressable
              onPress={() => setAuthMethod("phone")}
              className={cn(
                "flex-1 flex-row items-center justify-center gap-2 rounded-md py-2",
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
                  "font-medium text-xs",
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
                "flex-1 flex-row items-center justify-center gap-2 rounded-md py-2",
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
                  "font-medium text-xs",
                  authMethod === "qr"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                Scan QR
              </Text>
            </Pressable>
          </View>
        ) : null}

        {registrationClosed && (
          <View className="mt-4 rounded-lg bg-destructive/10 p-3">
            <Text className="text-xs text-destructive">
              Registration is currently closed for new accounts.
            </Text>
          </View>
        )}

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
                      {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => {
                      setError(null);
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
                      Can't receive the SMS code?
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
                  <ButtonText>
                    {draft?.code
                      ? "Complete sign up"
                      : "Send verification code"}
                  </ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setError(null);
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
