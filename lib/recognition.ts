import "server-only";

export interface RecognizedSong {
  title: string;
  artist: string;
  album: string | null;
  released: string | null;
  coverArt: string | null;
  shazam: string | null;
  appleMusic: string | null;
  spotify: string | null;
}

export type RecognitionOutcome =
  | { status: "success"; provider: "shazam" | "audd"; result: RecognizedSong }
  | { status: "no_match" }
  | { status: "error"; message: string };

const SAMPLE_RATE = 44100;
const UPSTREAM_TIMEOUT_MS = 15000;

const LINK_HOSTS = new Set([
  "www.shazam.com",
  "shazam.com",
  "music.apple.com",
  "geo.music.apple.com",
  "open.spotify.com",
]);

const IMAGE_HOST_SUFFIXES = [".mzstatic.com", ".shazam.com", ".scdn.co", ".spotifycdn.com"];

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Only pass through https links on hosts we expect, so a compromised upstream can't inject javascript: or phishing URLs. */
function safeLink(value: unknown): string | null {
  const raw = text(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && LINK_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeImage(value: unknown): string | null {
  const raw = text(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const ok = url.protocol === "https:" && IMAGE_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s));
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}

function spotifySearch(title: string, artist: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}

// ─── Shazam (RapidAPI) ───────────────────────────────────────────────────────

interface ShazamAction { uri?: string; type?: string }
interface ShazamTrack {
  title?: string;
  subtitle?: string;
  url?: string;
  images?: { coverart?: string; coverarthq?: string; background?: string };
  hub?: { options?: { actions?: ShazamAction[] }[]; actions?: ShazamAction[] };
  sections?: { type?: string; metadata?: { title?: string; text?: string }[] }[];
}

export async function recognizeWithShazam(
  pcm: ArrayBuffer,
  apiKey: string,
  timezone: string,
): Promise<RecognitionOutcome> {
  const params = new URLSearchParams({ timezone, locale: "en-US" });
  const res = await fetch(`https://shazam.p.rapidapi.com/songs/v2/detect?${params}`, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "shazam.p.rapidapi.com",
    },
    body: Buffer.from(pcm).toString("base64"),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    console.error("[recognize] Shazam rejected the API key:", res.status);
    return { status: "error", message: "Recognition service is misconfigured" };
  }
  if (res.status === 429) return { status: "error", message: "Recognition quota reached — try later" };
  if (!res.ok) {
    console.error("[recognize] Shazam upstream error:", res.status);
    return { status: "error", message: "Recognition service unavailable" };
  }

  const data = (await res.json()) as { matches?: unknown[]; track?: ShazamTrack };
  const track = data.track;
  if (!data.matches?.length || !track) return { status: "no_match" };

  const title = text(track.title) ?? "Unknown title";
  const artist = text(track.subtitle) ?? "Unknown artist";
  const songMeta = track.sections?.find((s) => s.type === "SONG")?.metadata ?? [];
  const meta = (label: string) => text(songMeta.find((m) => m.title === label)?.text);

  const hubUris = [
    ...(track.hub?.options?.flatMap((o) => o.actions ?? []) ?? []),
    ...(track.hub?.actions ?? []),
  ].map((a) => a.uri);
  const appleMusic = hubUris.map(safeLink).find((u) => u?.includes("music.apple.com")) ?? null;

  return {
    status: "success",
    provider: "shazam",
    result: {
      title,
      artist,
      album: meta("Album"),
      released: meta("Released"),
      coverArt: safeImage(track.images?.coverarthq) ?? safeImage(track.images?.coverart),
      shazam: safeLink(track.url),
      appleMusic,
      spotify: spotifySearch(title, artist),
    },
  };
}

// ─── AudD (optional fallback) ────────────────────────────────────────────────

function pcmToWav(pcm: ArrayBuffer): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const write = (o: number, s: string) => [...s].forEach((c, i) => header.setUint8(o + i, c.charCodeAt(0)));
  write(0, "RIFF");
  header.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, SAMPLE_RATE, true);
  header.setUint32(28, SAMPLE_RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  write(36, "data");
  header.setUint32(40, pcm.byteLength, true);
  return new Blob([header.buffer, pcm], { type: "audio/wav" });
}

export async function recognizeWithAudd(pcm: ArrayBuffer, apiToken: string): Promise<RecognitionOutcome> {
  const form = new FormData();
  form.append("file", pcmToWav(pcm), "clip.wav");
  form.append("api_token", apiToken);
  form.append("return", "apple_music,spotify");

  const res = await fetch("https://api.audd.io/", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[recognize] AudD upstream error:", res.status);
    return { status: "error", message: "Recognition service unavailable" };
  }

  const data = await res.json();
  if (data.status !== "success" || !data.result) return { status: "no_match" };

  const r = data.result;
  const title = text(r.title) ?? "Unknown title";
  const artist = text(r.artist) ?? "Unknown artist";
  return {
    status: "success",
    provider: "audd",
    result: {
      title,
      artist,
      album: text(r.album),
      released: text(r.release_date),
      coverArt: safeImage(r.spotify?.album?.images?.[0]?.url) ?? safeImage(r.apple_music?.artwork?.url?.replace("{w}x{h}", "400x400")),
      shazam: null,
      appleMusic: safeLink(r.apple_music?.url),
      spotify: safeLink(r.spotify?.external_urls?.spotify) ?? spotifySearch(title, artist),
    },
  };
}
