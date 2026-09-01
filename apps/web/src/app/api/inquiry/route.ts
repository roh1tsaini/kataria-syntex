import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation/inquiry";

export const dynamic = "force-dynamic";

// Separate D1 (kataria-web-inquiry) keeps public inquiries isolated from the
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
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx.env as CloudflareEnv).INQUIRY_DB ?? null;
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
      { status: 400 },
    );
  }

  const rawWebsite =
    typeof body === "object" && body !== null && "website" in body
      ? (body as { website?: unknown }).website
      : undefined;
  if (rawWebsite) {
    return NextResponse.json({ ok: true });
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please review the highlighted fields.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? null;

  // Persist to D1 when bound (Workers runtime). In `next dev` without Workers
  // bindings, the DB is absent — keep the validation pass but don't fail the
  // request (dev fallback).
  const db = await getInquiryDb();
  if (!db) {
    console.warn(
      "inquiry: INQUIRY_DB not bound — dropping persist in dev (validation ok)",
    );
    return NextResponse.json({ ok: true });
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
        { status: 429 },
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

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("inquiry insert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save inquiry — please try again." },
      { status: 500 },
    );
  }
}
