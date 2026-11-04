import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing stream url" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid stream protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid stream url format" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        // Crucial: 0 ensures Icecast does not interleave raw text metadata inside the MP3 frames
        "Icy-MetaData": "0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: `Upstream radio station returned ${upstream.status}` },
        { status: 502 },
      );
    }

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    // ~128KB gives approximately 6-8 seconds of 128kbps MP3 audio
    const targetBytes = 128 * 1024;

    while (received < targetBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
      }
    }

    clearTimeout(timeout);
    controller.abort();

    if (received < 16 * 1024) {
      return NextResponse.json({ error: "Stream sample was too short to identify" }, { status: 502 });
    }

    // Merge chunks
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Locate the first MP3 sync word (11 sync bits: 0xFF followed by 0xE0 mask)
    let syncIndex = 0;
    for (let i = 0; i < merged.length - 1; i++) {
      if (merged[i] === 0xff && (merged[i + 1] & 0xe0) === 0xe0) {
        syncIndex = i;
        break;
      }
    }

    const cleanBuffer = syncIndex > 0 ? merged.subarray(syncIndex) : merged;

    return new NextResponse(cleanBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "Radio stream sampling timed out" : "Failed to sample radio stream" },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

