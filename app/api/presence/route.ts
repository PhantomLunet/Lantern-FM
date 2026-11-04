import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory sliding window for single-instance / local / preview environments
// Maps clientId -> lastActiveTimestamp (ms)
const localPresenceMap = new Map<string, number>();

// Inactivity threshold: prune clients who haven't pinged in 35 seconds
const INACTIVE_TIMEOUT_MS = 35_000;

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return { url: url.replace(/\/$/, ""), token };
  return null;
}

/**
 * Executes a pipeline of commands against Upstash Redis REST API.
 */
async function runUpstashPipeline(config: UpstashConfig, commands: (string | number)[][]) {
  const res = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash pipeline error: ${res.status}`);
  }
  return res.json();
}

/**
 * Prunes expired local entries and returns the local presence count.
 */
function updateLocalPresence(clientId: string, isLeaving = false): number {
  const now = Date.now();
  if (isLeaving) {
    localPresenceMap.delete(clientId);
  } else if (clientId) {
    localPresenceMap.set(clientId, now);
  }

  // Prune expired
  for (const [id, timestamp] of localPresenceMap.entries()) {
    if (now - timestamp > INACTIVE_TIMEOUT_MS) {
      localPresenceMap.delete(id);
    }
  }

  return Math.max(1, localPresenceMap.size);
}

function jsonResponse(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  const upstash = getUpstashConfig();
  const now = Date.now();

  if (upstash) {
    try {
      const minValid = now - INACTIVE_TIMEOUT_MS;
      // Pipeline: remove expired entries and count active builders
      const results = await runUpstashPipeline(upstash, [
        ["ZREMRANGEBYSCORE", "lantern_builders_online", 0, minValid],
        ["ZCARD", "lantern_builders_online"],
      ]);
      const count = Number(results[1]?.result ?? 1);
      return jsonResponse({ count: Math.max(1, count) });
    } catch (err) {
      console.warn("[presence] Upstash GET failed, falling back to local memory:", err);
    }
  }

  const count = updateLocalPresence("");
  return jsonResponse({ count });
}

export async function POST(req: NextRequest) {
  let clientId = "";
  let action = "heartbeat";

  // Check URL query parameters (e.g. from sendBeacon)
  const queryAction = req.nextUrl.searchParams.get("action");
  const queryClientId = req.nextUrl.searchParams.get("clientId");
  if (queryAction) action = queryAction;
  if (queryClientId) clientId = queryClientId;

  // Check JSON body if available
  try {
    const body = await req.json();
    if (body.clientId) clientId = body.clientId;
    if (body.action) action = body.action;
  } catch {
    // Body might be empty or url-encoded from sendBeacon
  }

  if (!clientId) {
    // Fallback to IP identifier if no clientId provided
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    clientId = `ip_${ip}`;
  }

  const isLeaving = action === "leave";
  const now = Date.now();
  const upstash = getUpstashConfig();

  if (upstash) {
    try {
      const minValid = now - INACTIVE_TIMEOUT_MS;
      if (isLeaving) {
        const results = await runUpstashPipeline(upstash, [
          ["ZREM", "lantern_builders_online", clientId],
          ["ZREMRANGEBYSCORE", "lantern_builders_online", 0, minValid],
          ["ZCARD", "lantern_builders_online"],
        ]);
        const count = Number(results[2]?.result ?? 0);
        return jsonResponse({ success: true, count: Math.max(0, count) });
      } else {
        const results = await runUpstashPipeline(upstash, [
          ["ZADD", "lantern_builders_online", now, clientId],
          ["ZREMRANGEBYSCORE", "lantern_builders_online", 0, minValid],
          ["ZCARD", "lantern_builders_online"],
        ]);
        const count = Number(results[2]?.result ?? 1);
        return jsonResponse({ success: true, count: Math.max(1, count) });
      }
    } catch (err) {
      console.warn("[presence] Upstash POST failed, falling back to local memory:", err);
    }
  }

  const count = updateLocalPresence(clientId, isLeaving);
  return jsonResponse({ success: true, count });
}

