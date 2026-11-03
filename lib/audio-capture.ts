"use client";

/** Shazam expects raw signed 16-bit little-endian PCM, mono, 44.1 kHz. */
export const TARGET_SAMPLE_RATE = 44100;
export const CLIP_SECONDS = 4;
export const RECORD_MS = 5500;

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
    public code: "unsupported" | "denied" | "no-mic" | "silent" | "decode" | "aborted",
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

export function startCapture(durationMs = RECORD_MS): Capture {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const releaseMic = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
  };

  const result = (async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new CaptureError("unsupported", "This browser can't record audio");
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Voice processing destroys the spectral detail fingerprinting relies on.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new CaptureError("no-mic", "No microphone found");
      }
      throw new CaptureError("denied", "Microphone access denied");
    }

    if (cancelled) {
      releaseMic();
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
        releaseMic();
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
      else releaseMic();
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
    throw new CaptureError("decode", "Couldn't process the recording");
  } finally {
    void ctx.close();
  }

  // Drop the first ~0.4s (mic warm-up click) and keep at most CLIP_SECONDS.
  const skip = Math.min(0.4, Math.max(0, decoded.duration - CLIP_SECONDS));
  const seconds = Math.min(CLIP_SECONDS, decoded.duration - skip);
  if (seconds < 1.5) throw new CaptureError("silent", "Recording was too short");

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
  if (peak < 0.005) throw new CaptureError("silent", "Couldn't hear anything — turn it up");

  // Normalize quiet captures so the fingerprint has enough signal.
  const gain = peak < 0.5 ? 0.9 / peak : 1;
  const pcm = new DataView(new ArrayBuffer(samples.length * 2));
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    pcm.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return pcm.buffer;
}
