import { NextRequest, NextResponse } from "next/server";
import { recognizeWithAudd, recognizeWithShazam, type RecognitionOutcome } from "@/lib/recognition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BYTES_PER_SECOND = 44100 * 2;
const MIN_BYTES = BYTES_PER_SECOND * 1;
const MAX_BYTES = BYTES_PER_SECOND * 5;

const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;
// Best-effort per-instance limiter; use a shared store (e.g. Upstash) for strict global limits.
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function json(body: object, status = 200, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}

function isSameOrigin(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function safeTimezone(value: string | null) {
  if (value && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(value) && value.length <= 64) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return value;
    } catch {}
  }
  return "Etc/UTC";
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return json({ status: "error", error: "Forbidden" }, 403);
  }

  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (rateLimited(ip)) {
    return json({ status: "error", error: "Too many requests — wait a moment" }, 429, { "Retry-After": "60" });
  }

  if (req.headers.get("content-type")?.split(";")[0] !== "application/octet-stream") {
    return json({ status: "error", error: "Unsupported media type" }, 415);
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return json({ status: "error", error: "Audio clip too large" }, 413);
  }

  let pcm: ArrayBuffer;
  try {
    pcm = await req.arrayBuffer();
  } catch {
    return json({ status: "error", error: "Invalid audio payload" }, 400);
  }
  if (pcm.byteLength > MAX_BYTES) return json({ status: "error", error: "Audio clip too large" }, 413);
  if (pcm.byteLength < MIN_BYTES || pcm.byteLength % 2 !== 0) {
    return json({ status: "error", error: "Audio clip too short" }, 400);
  }

  const shazamKey = process.env.RAPIDAPI_KEY;
  const auddToken = process.env.AUDD_API_TOKEN;
  if (!shazamKey && !auddToken) {
    return json({
      status: "unconfigured",
      error: "Song recognition isn't configured on this server",
    });
  }

  try {
    let outcome: RecognitionOutcome = { status: "no_match" };
    if (shazamKey) {
      outcome = await recognizeWithShazam(pcm, shazamKey, safeTimezone(req.headers.get("x-timezone")));
    }
    if (outcome.status !== "success" && auddToken) {
      const fallback = await recognizeWithAudd(pcm, auddToken);
      if (fallback.status === "success" || outcome.status === "error") outcome = fallback;
    }

    if (outcome.status === "success") return json(outcome);
    if (outcome.status === "no_match") {
      return json({ status: "no_match", error: "No match — try again closer to the speaker" });
    }
    return json({ status: "error", error: outcome.message }, 502);
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    console.error("[recognize] Failed:", timedOut ? "upstream timeout" : err);
    return json(
      { status: "error", error: timedOut ? "Recognition timed out" : "Recognition failed" },
      timedOut ? 504 : 500,
    );
  }
}
