/**
 * HTML → PDF through Cloudflare Browser Run's /pdf Quick Action: a real
 * Chromium renders the shared challan template. Free tier is browser-time
 * budgeted (the route's own per-user budget caps requests before Cloudflare's
 * daily cap does); every call is one fetch, so Worker CPU stays flat.
 *
 * Secrets: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Browser Rendering
 * "Edit" permission), set via wrangler secrets — never in wrangler.jsonc.
 */
import type { Env } from "../env";

const ENDPOINT = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`;

export class PdfRenderError extends Error {
  constructor(
    readonly code: "pdf_not_configured" | "pdf_render_failed" | "rate_limited",
    readonly status: 429 | 500 | 502,
  ) {
    super(code);
  }
}

/** Browser Run credentials, or null when the secrets are absent/blank. */
function pdfCredentials(env: Env): { accountId: string; token: string } | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  return accountId && token ? { accountId, token } : null;
}

/** True when the Browser Run secrets are present. */
export function isPdfConfigured(env: Env): boolean {
  return pdfCredentials(env) !== null;
}

/** Renders a self-contained HTML document to PDF bytes. */
export async function renderHtmlPdf(
  env: Env,
  html: string,
): Promise<Uint8Array> {
  const credentials = pdfCredentials(env);
  if (!credentials) throw new PdfRenderError("pdf_not_configured", 500);

  let res: Response;
  try {
    res = await fetch(ENDPOINT(credentials.accountId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        pdfOptions: { printBackground: true, preferCSSPageSize: true },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new PdfRenderError("pdf_render_failed", 502);
  }
  if (res.status === 429) throw new PdfRenderError("rate_limited", 429);
  if (!res.ok) throw new PdfRenderError("pdf_render_failed", 502);
  return new Uint8Array(await res.arrayBuffer());
}
