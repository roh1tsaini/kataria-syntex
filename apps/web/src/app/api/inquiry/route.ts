import { NextResponse } from "next/server";
import { inquirySchema } from "@kataria-syntex/shared";

export const dynamic = "force-dynamic";

// Inquiry responses carry per-submission results — never cacheable by the
// browser or the edge. POSTs are not cached by default, but the header pins
// the contract explicitly (same story as the business app's /api/* no-store).
const NO_STORE = { "Cache-Control": "no-store" };

// Separate D1 (ks-web-db) keeps public inquiries isolated from the
// business app D1. Free tier: 500MB/DB, 5M reads/day.

function clientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .pop();
    if (last) return last;
  }
  return "unknown";
}

async function getInquiryDb(): Promise<D1Database | null> {
  try {
    // workerd only — resolves in `vinext dev` and on Workers, throws under
    // plain Node (`vinext start`), where there is no binding to read.
    const { env } = await import("cloudflare:workers");
    return (env as { INQUIRY_DB?: D1Database }).INQUIRY_DB ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400, headers: NO_STORE },
    );
  }

  const rawWebsite =
    typeof body === "object" && body !== null && "website" in body
      ? (body as { website?: unknown }).website
      : undefined;
  if (rawWebsite) {
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please review the highlighted fields.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 422, headers: NO_STORE },
    );
  }

  const data = parsed.data;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? null;

  // Persist to D1 when bound (Workers runtime). Without the binding the DB is
  // absent — validation still runs, but a missing binding in production must
  // fail loudly instead of silently discarding inquiries.
  const db = await getInquiryDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "inquiry: INQUIRY_DB not bound — dev fallback, not persisting",
      );
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    return NextResponse.json(
      { ok: false, error: "Could not save inquiry — please try again." },
      { status: 500, headers: NO_STORE },
    );
  }

  try {
    // Simple per-IP rate limit: 5 submissions / 15 minutes
    const windowIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const rate = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM inquiries WHERE ip = ? AND created_at > ?",
      )
      .bind(ip, windowIso)
      .first<{ c: number }>();
    if ((rate?.c ?? 0) >= 5) {
      return NextResponse.json(
        { ok: false, error: "Too many inquiries — please try again later." },
        { status: 429, headers: NO_STORE },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO inquiries (id, name, company, email, phone, country, product, shade, quantity, message, ip, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.name,
        data.company || null,
        data.email,
        data.phone || null,
        data.country || null,
        data.product || null,
        data.shade || null,
        data.quantity || null,
        data.message,
        ip,
        userAgent,
        now,
      )
      .run();

    return NextResponse.json({ ok: true, id }, { headers: NO_STORE });
  } catch (err) {
    console.error("inquiry insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save inquiry — please try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}
