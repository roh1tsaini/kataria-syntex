import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QrCode, Smartphone } from "lucide-react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { isPlainBrowser } from "@/lib/platform";
import { useAuth, friendlyError } from "@kataria-syntex/app-core";
import { QrLoginPanel } from "@/ui/components/qr-login-panel";
import { Button } from "@/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";
import { Input } from "@/ui/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/ui/components/ui/input-otp";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import { EASE_OUT, SPRING } from "@/ui/lib/motion";
import { cn } from "@/ui/lib/cn";

type Step = "home" | "otp" | "password" | "create";

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
  const reduceMotion = useReducedMotion();

  const filled = identifier.trim().length >= 5;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext(identifier.trim());
      }}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="identifier">Phone number or email</FieldLabel>
          <Input
            id="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="+91 98765 43210 or you@gmail.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "identifier-error" : undefined}
            required
            autoFocus
          />
        </Field>
        {error && (
          <motion.p
            id="identifier-error"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </FieldGroup>
      <Button type="submit" disabled={busy || !filled} loading={busy}>
        Continue
      </Button>
    </form>
  );
}

function OtpStep({
  identifier,
  draft,
  hasPassword,
  startWithQrFallback,
  onVerified,
  onNeedsSignup,
  onUsePassword,
  onBack,
}: {
  identifier: string;
  draft: Draft | null;
  hasPassword: boolean;
  startWithQrFallback: boolean;
  onVerified: () => void;
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const masked = identifier.includes("@")
    ? identifier
    : `••••• ${identifier.slice(-4)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await verifyOtp(identifier, code);
      if (res.outcome === "ok") {
        onVerified();
        return;
      }
      if (!draft?.name) {
        // Verified but no account and no collected profile yet — go collect.
        onNeedsSignup();
        return;
      }
      // Complete the pending signup now (the create step collected these
      // fields before the code was sent).
      await useAuth.getState().signup({
        identifier,
        name: draft.name,
        ...(draft.password ? { password: draft.password } : {}),
        ...(draft.workspaceName ? { workspaceName: draft.workspaceName } : {}),
      });
      onVerified();
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
      // Quota/sender trouble — offer the admin-scan fallback instead.
      setShowQrFallback(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="otp">Verification code</FieldLabel>
            <InputOTP
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={setCode}
              autoFocus
              aria-invalid={!!error}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    data-invalid={error ? true : undefined}
                    className={
                      error
                        ? "[data-invalid=true]:border-destructive [data-invalid=true]:text-destructive"
                        : undefined
                    }
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription>
              Sent to {masked}, expires in 5 minutes.
            </FieldDescription>
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <Button
          type="submit"
          disabled={busy || code.length !== 6}
          loading={busy}
        >
          Verify
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={resend}
            disabled={cooldown > 0}
            className="flex-1"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            Back
          </Button>
        </div>
        {hasPassword && (
          <Button
            variant="link"
            onClick={onUsePassword}
            className="min-h-11 w-full text-xs text-muted-foreground underline"
          >
            Use password instead
          </Button>
        )}
      </form>
      {showQrFallback && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium">Can't receive the code?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Show this QR to an admin — scanning it logs this device in without
            any SMS.
          </p>
          <div className="mt-3">
            <QrLoginPanel identifier={identifier} />
          </div>
        </div>
      )}
    </div>
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="create-name">Your name</FieldLabel>
          <Input
            id="create-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "create-error" : undefined}
          />
        </Field>
        {hasInvite ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            Invited workspace member.
          </p>
        ) : (
          <>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="create-ws">
                Company / workspace name
              </FieldLabel>
              <Input
                id="create-ws"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Kataria Syntex"
                required
                aria-invalid={!!error}
                aria-describedby={error ? "create-error" : undefined}
              />
            </Field>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="create-pw">
                Password{" "}
                <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="create-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                aria-invalid={!!error}
                aria-describedby={error ? "create-error" : undefined}
              />
              <FieldDescription>Minimum 10 characters.</FieldDescription>
            </Field>
          </>
        )}
        {error && <FieldError id="create-error">{error}</FieldError>}
      </FieldGroup>
      <Button
        type="submit"
        disabled={busy || !name.trim() || (!hasInvite && !workspaceName.trim())}
        loading={busy}
      >
        Send verification code
      </Button>
      <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
        Back
      </Button>
    </form>
  );
}

function PasswordStep({
  identifier,
  onDone,
  onBack,
}: {
  identifier: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginPassword = useAuth((s) => s.loginPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginPassword(identifier, password);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="pw-password">Password</FieldLabel>
          <Input
            id="pw-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            required
            autoFocus
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <Button type="submit" disabled={busy || !password} loading={busy}>
        Log in
      </Button>
      <Button type="button" variant="outline" onClick={onBack}>
        Use a verification code instead
      </Button>
    </form>
  );
}

function MethodTab({
  active,
  reduceMotion,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  reduceMotion: boolean;
  onClick: () => void;
  icon: typeof Smartphone;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 sm:h-10",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="auth-method-thumb"
          transition={reduceMotion ? { duration: 0 } : SPRING}
          className="absolute inset-0 rounded-md border border-border bg-card shadow-soft"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          "relative z-10 size-4 shrink-0",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="relative z-10 truncate">{label}</span>
    </button>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const requestOtp = useAuth((s) => s.requestOtp);
  const lookupIdentifier = useAuth((s) => s.lookupIdentifier);
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("home");
  const [authMethod, setAuthMethod] = useState<"phone" | "qr">("phone");
  const [identifier, setIdentifier] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [pendingHasInvite, setPendingHasInvite] = useState(false);
  const [otpFallback, setOtpFallback] = useState(false);
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  const done = () => navigate("/", { replace: true });

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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <span
            className="text-lg font-semibold leading-none tracking-tight"
            aria-hidden
          >
            K
          </span>
        </div>
        <div className="text-[17px] font-semibold tracking-tight">
          {COMPANY_DETAILS.name} Biz App
        </div>
      </div>
      {isPlainBrowser() && (
        <Link
          to="/download"
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Get the app for desktop or Android
        </Link>
      )}
      <motion.div
        initial={{
          opacity: 0,
          y: reduceMotion ? 0 : 6,
          scale: reduceMotion ? 1 : 0.99,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.15 : 0.24, ease: EASE_OUT }}
        className="w-full max-w-md sm:max-w-2xl"
      >
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={
                  step === "home"
                    ? `home-${authMethod}`
                    : `${step}-${identifier}`
                }
                className="grid overflow-hidden"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, gridTemplateRows: "0fr" }
                }
                animate={{ opacity: 1, gridTemplateRows: "1fr" }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        gridTemplateRows: "0fr",
                        transition: { duration: 0.16, ease: EASE_OUT },
                      }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.2,
                  ease: EASE_OUT,
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  {step === "home" && (
                    <div className="flex flex-col gap-5">
                      {/* Phones: one method at a time behind the segmented switch */}
                      <div
                        role="group"
                        aria-label="Sign-in method"
                        className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted p-1 sm:hidden"
                      >
                        <MethodTab
                          active={authMethod === "phone"}
                          reduceMotion={!!reduceMotion}
                          onClick={() => setAuthMethod("phone")}
                          icon={Smartphone}
                          label="Phone / Email"
                        />
                        <MethodTab
                          active={authMethod === "qr"}
                          reduceMotion={!!reduceMotion}
                          onClick={() => setAuthMethod("qr")}
                          icon={QrCode}
                          label="Instant QR Login"
                        />
                      </div>
                      <div className="sm:hidden">
                        {authMethod === "phone" ? (
                          <IdentifierStep
                            busy={homeBusy}
                            error={homeError}
                            onNext={(value) => void handleIdentifier(value)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-2">
                            <QrLoginPanel />
                          </div>
                        )}
                      </div>

                      {/* Desktop: email/phone box left, QR always right */}
                      <div className="hidden gap-6 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                        <div className="min-w-0">
                          <IdentifierStep
                            busy={homeBusy}
                            error={homeError}
                            onNext={(value) => void handleIdentifier(value)}
                          />
                        </div>
                        <div
                          aria-hidden
                          className="w-px self-stretch bg-border"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-col items-center justify-center">
                            <QrLoginPanel />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "otp" && (
                    <OtpStep
                      identifier={identifier}
                      draft={draft}
                      hasPassword={accountExists && hasPassword}
                      startWithQrFallback={otpFallback}
                      onVerified={done}
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
                      onDone={done}
                      onBack={() => setStep("otp")}
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
