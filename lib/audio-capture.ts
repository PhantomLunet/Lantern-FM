"use client";

/** Shazam expects raw signed 16-bit little-endian PCM, mono, 44.1 kHz. */
export const TARGET_SAMPLE_RATE = 44100;
export const CLIP_SECONDS = 4;
export const RECORD_MS = 5000;

export type AudioSourceType = "stream" | "system" | "mic";

export interface CaptureOptions {
  source?: AudioSourceType;
  streamUrl?: string;
  durationMs?: number;
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export class CaptureError extends Error {
  constructor(
    public code: "unsupported" | "denied" | "no-mic" | "silent" | "decode" | "aborted" | "stream-failed",
    message: string,
  ) {
    super(message);
  }
}

export interface Capture {
  /** Resolves with mono 44.1 kHz Int16 PCM once recording completes. */
  result: Promise<ArrayBuffer>;
  /** Stop early and process whatever has been recorded so far. */
  stop: () => void;
  /** Abort without producing a result. */
  cancel: () => void;
}

export function startCapture(options: CaptureOptions | number = {}): Capture {
  const opts: CaptureOptions = typeof options === "number" ? { durationMs: options } : options;
  const source: AudioSourceType = opts.source ?? "mic";
  const durationMs = opts.durationMs ?? RECORD_MS;

  if (source === "stream") {
    return startStreamCapture(opts.streamUrl);
  }

  return startMediaCapture(source, durationMs);
}

/**
 * Captures audio directly from the active live radio stream through the server proxy.
 * Completely internal, zero microphone access, works even with headphones.
 */
function startStreamCapture(streamUrl?: string): Capture {
  if (!streamUrl) {
    return {
      result: Promise.reject(new CaptureError("stream-failed", "No station stream selected")),
      stop: () => {},
      cancel: () => {},
    };
  }

  const controller = new AbortController();
  let cancelled = false;

  const result = (async () => {
    try {
      const res = await fetch(`/api/stream-sample?url=${encodeURIComponent(streamUrl)}`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new CaptureError(
          "stream-failed",
          errJson?.error || "Failed to sample current station stream",
        );
      }

      const blob = await res.blob();
      if (cancelled) throw new CaptureError("aborted", "Cancelled");
      return await toPcm16(blob);
    } catch (err) {
      if (err instanceof CaptureError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new CaptureError("aborted", "Cancelled");
      }
      throw new CaptureError("stream-failed", "Failed to sample audio stream");
    }
  })();

  return {
    result,
    stop: () => {
      // Stream capture runs as a single fetch, stop aborts early if needed
    },
    cancel: () => {
      cancelled = true;
      controller.abort();
    },
  };
}

/**
 * Captures audio from either:
 * - "mic": physical microphone via getUserMedia
 * - "system": internal browser tab / system audio via getDisplayMedia (for headphone listening)
 */
function startMediaCapture(source: "mic" | "system", durationMs: number): Capture {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const releaseStream = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
  };

  const result = (async () => {
    if (typeof MediaRecorder === "undefined") {
      throw new CaptureError("unsupported", "This browser does not support audio recording");
    }

    try {
      if (source === "system") {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new CaptureError(
            "unsupported",
            "Internal audio sharing is not supported on this device/browser",
          );
        }

        // Request display media with audio enabled
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          // Hint to browsers to include system audio if supported
          systemAudio: "include",
        } as DisplayMediaStreamOptions);

        // Stop video immediately — we only care about internal audio!
        stream.getVideoTracks().forEach((t) => t.stop());

        const audioTracks = stream.getAudioTracks();
        if (!audioTracks || audioTracks.length === 0) {
          releaseStream();
          throw new CaptureError(
            "no-mic",
            "No audio was shared. Please check 'Share tab audio' or 'Share system audio' when prompted.",
          );
        }
      } else {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new CaptureError("unsupported", "This browser cannot record audio");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Voice processing destroys the spectral detail fingerprinting relies on.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
      }
    } catch (err) {
      if (err instanceof CaptureError) throw err;
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        throw new CaptureError("aborted", "Audio selection cancelled");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new CaptureError("no-mic", "No audio input device found");
      }
      throw new CaptureError("denied", "Audio permission denied");
    }

    if (cancelled) {
      releaseStream();
      throw new CaptureError("aborted", "Cancelled");
    }

    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    const recorded = await new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder!.onerror = () => reject(new CaptureError("decode", "Recording failed"));
      recorder!.onstop = () => {
        releaseStream();
        if (cancelled) return reject(new CaptureError("aborted", "Cancelled"));
        resolve(new Blob(chunks, { type: recorder!.mimeType || mimeType || "audio/webm" }));
      };
      recorder!.start(250);
      timer = setTimeout(() => {
        if (recorder?.state === "recording") recorder.stop();
      }, durationMs);
    });

    if (recorded.size === 0) throw new CaptureError("silent", "No audio recorded");
    return toPcm16(recorded);
  })();

  return {
    result,
    stop: () => {
      if (recorder?.state === "recording") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder?.state === "recording") recorder.stop();
      else releaseStream();
    },
  };
}

async function toPcm16(blob: Blob): Promise<ArrayBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new CaptureError("decode", "Couldn't decode audio stream");
  } finally {
    void ctx.close();
  }

  // Drop the first ~0.3s (warm-up click) and keep at most CLIP_SECONDS.
  const skip = Math.min(0.3, Math.max(0, decoded.duration - CLIP_SECONDS));
  const seconds = Math.min(CLIP_SECONDS, decoded.duration - skip);
  if (seconds < 1.5) throw new CaptureError("silent", "Audio sample was too short");

  const frames = Math.floor(seconds * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0, skip, seconds);
  const rendered = await offline.startRendering();

  const samples = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.005) {
    throw new CaptureError(
      "silent",
      "Audio level is too quiet — check that music is currently playing",
    );
  }

  // Normalize quiet captures so the fingerprint has enough signal.
  const gain = peak < 0.5 ? 0.9 / peak : 1;
  const pcm = new DataView(new ArrayBuffer(samples.length * 2));
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    pcm.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return pcm.buffer;
}
