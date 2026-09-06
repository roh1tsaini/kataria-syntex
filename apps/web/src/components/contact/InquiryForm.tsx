"use client";

import { cloneElement, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { products } from "@/content/products";
import { inquirySchema, type InquiryInput } from "@/lib/validation/inquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error";

type Draft = Omit<InquiryInput, "website">;

const DRAFT_KEY = "ks-inquiry-draft";
const emptyDraft: Draft = {
  name: "",
  company: "",
  email: "",
  phone: "",
  country: "",
  product: "",
  shade: "",
  quantity: "",
  message: "",
};

/**
 * Inquiry draft — a buyer can start an inquiry on a product page, leave,
 * and find it intact on the contact page. Persisted locally, never sent
 * until submitted. Loaded after mount so SSR and first client render match.
 */
function useDraft() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
      setDraft({ ...emptyDraft, ...saved });
    } catch {
      // corrupt draft — start fresh
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);
  const setField = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [field]: value }));
  const reset = () => setDraft(emptyDraft);
  return { ...draft, setField, reset };
}

interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactElement<Record<string, unknown>>;
  hint?: string;
  error?: string;
}

function FormField({ id, label, children, hint, error }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-navy"
      >
        {label}
      </label>
      {cloneElement(children, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error
          ? `${id}-error`
          : hint
            ? `${id}-hint`
            : undefined,
      })}
      {hint ? (
        <p id={`${id}-hint`} className="font-mono text-[10px] text-ink-soft/70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-mono text-[11px] font-medium text-danger animate-fade-slide-in"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The inquiry form — the commercial heart of the site. Draft persists
 * locally (localStorage), validation is shared with the server (Zod), and a
 * hidden honeypot field quietly filters bots.
 */
export function InquiryForm({ initialProduct }: { initialProduct?: string }) {
  const draft = useDraft();
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [website, setWebsite] = useState(""); // honeypot

  // Deep links like /contact?product=... pre-fill the draft.
  useEffect(() => {
    if (initialProduct) draft.setField("product", initialProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const payload = {
      name: draft.name,
      company: draft.company,
      email: draft.email,
      phone: draft.phone,
      country: draft.country,
      product: draft.product,
      shade: draft.shade,
      quantity: draft.quantity,
      message: draft.message,
      website,
    };

    const local = inquirySchema.safeParse(payload);
    if (!local.success) {
      setFieldErrors(local.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setStatus("submitting");

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      type InquiryResponse = {
        ok: boolean;
        error?: string;
        fields?: Record<string, string[]>;
      };
      let result: InquiryResponse | null = null;
      try {
        result = (await response.json()) as InquiryResponse;
      } catch {
        // 429/503 can return plain text — fall back to the status text.
      }
      const errorMessage =
        result?.error ??
        (response.ok
          ? "Something went wrong."
          : `Request failed (${response.status}). Please try again, or use WhatsApp.`);
      if (!response.ok || !result?.ok) {
        if (result?.fields) setFieldErrors(result.fields);
        setServerError(errorMessage);
        setStatus("error");
        return;
      }
      draft.reset();
      setStatus("success");
    } catch {
      setServerError("Network error — please try again, or use WhatsApp.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="card-sheen flex min-h-96 flex-col items-start justify-center gap-5 rounded-card border border-line bg-paper p-8 shadow-card md:p-12 animate-fade-zoom-in">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h2 className="font-display text-3xl font-bold tracking-tight text-navy">
          Inquiry received.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-ink-soft">
          The desk will reply with commercial options — usually within one
          working day. For anything urgent, WhatsApp gets the fastest answer.
        </p>
        <Button type="button" variant="ghost" onClick={() => setStatus("idle")}>
          Send another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      {/* Honeypot — invisible to humans, irresistible to bots */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <FormField id="name" label="Your name *" error={fieldErrors.name?.[0]}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={draft.name}
            onChange={(e) => draft.setField("name", e.target.value)}
            placeholder="Full name"
          />
        </FormField>
        <FormField
          id="company"
          label="Company"
          error={fieldErrors.company?.[0]}
        >
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            value={draft.company}
            onChange={(e) => draft.setField("company", e.target.value)}
            placeholder="Business name"
          />
        </FormField>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <FormField id="email" label="Email *" error={fieldErrors.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => draft.setField("email", e.target.value)}
            placeholder="you@company.com"
          />
        </FormField>
        <FormField
          id="phone"
          label="Phone / WhatsApp"
          error={fieldErrors.phone?.[0]}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={(e) => draft.setField("phone", e.target.value)}
            placeholder="+91 ..."
          />
        </FormField>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <FormField
          id="product"
          label="Yarn of interest"
          error={fieldErrors.product?.[0]}
        >
          <select
            id="product"
            name="product"
            value={draft.product}
            onChange={(e) => draft.setField("product", e.target.value)}
            className={cn(
              "h-11 w-full cursor-pointer rounded-control border border-line bg-paper px-3.5 font-body text-sm shadow-xs",
              "transition-[border-color,box-shadow] focus:border-royal focus:shadow-[0_0_0_3px_rgb(30_58_138/0.12)] focus:outline-none",
              draft.product ? "text-navy" : "text-ink-soft/60",
            )}
          >
            <option value="">Select a yarn</option>
            {products.map((product) => (
              <option key={product.slug} value={product.name}>
                {product.name}
              </option>
            ))}
            <option value="Other / not sure">Other / not sure</option>
          </select>
        </FormField>
        <FormField id="shade" label="Shade code" error={fieldErrors.shade?.[0]}>
          <Input
            id="shade"
            name="shade"
            value={draft.shade}
            onChange={(e) => draft.setField("shade", e.target.value)}
            placeholder="e.g. 88L (from the shade card)"
          />
        </FormField>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <FormField
          id="quantity"
          label="Approximate quantity"
          error={fieldErrors.quantity?.[0]}
        >
          <Input
            id="quantity"
            name="quantity"
            value={draft.quantity}
            onChange={(e) => draft.setField("quantity", e.target.value)}
            placeholder="e.g. 500 kg / month"
          />
        </FormField>
        <FormField
          id="country"
          label="Delivery location"
          error={fieldErrors.country?.[0]}
        >
          <Input
            id="country"
            name="country"
            autoComplete="country-name"
            value={draft.country}
            onChange={(e) => draft.setField("country", e.target.value)}
            placeholder="City / country"
          />
        </FormField>
      </div>

      <FormField
        id="message"
        label="The requirement *"
        hint="Drafts save automatically on this device."
        error={fieldErrors.message?.[0]}
      >
        <Textarea
          id="message"
          name="message"
          value={draft.message}
          onChange={(e) => draft.setField("message", e.target.value)}
          placeholder="Counts or denier, end use, timeline — anything that helps us quote precisely."
        />
      </FormField>

      {serverError ? (
        <p role="alert" className="font-mono text-xs text-danger">
          {serverError}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Sending…" : "Send the inquiry"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
