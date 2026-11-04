"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  Loader2,
  X,
  ExternalLink,
  Music,
  RotateCcw,
  Headphones,
  Radio,
  Monitor,
} from "lucide-react";
import {
  startCapture,
  CaptureError,
  RECORD_MS,
  type Capture,
  type AudioSourceType,
} from "@/lib/audio-capture";

interface Song {
  title: string;
  artist: string;
  album: string | null;
  released: string | null;
  coverArt: string | null;
  shazam: string | null;
  appleMusic: string | null;
  spotify: string | null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "listening"; source: AudioSourceType }
  | { kind: "identifying" }
  | { kind: "result"; song: Song }
  | { kind: "error"; message: string };

interface Theme {
  text: string;
  textMuted: string;
  card: string;
  cardB: string;
}

const MONO = "var(--font-jetbrains), monospace";

export function SongIdentifier({
  color,
  rgb,
  theme: T,
  align,
  currentStation,
  isPlaying = false,
}: {
  color: string;
  rgb: string;
  theme: Theme;
  align: "left" | "center";
  currentStation?: {
    id: string;
    name: string;
    genre: string;
    streamUrl: string;
  };
  isPlaying?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // "internal" = headphone-friendly (stream or system/tab audio)
  // "mic" = external microphone
  const [listenMode, setListenMode] = useState<"internal" | "mic">("internal");
  // When in internal mode: "stream" (active station) or "system" (another tab/desktop app)
  const [internalSubMode, setInternalSubMode] = useState<"stream" | "system">("stream");

  const captureRef = useRef<Capture | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      captureRef.current?.cancel();
      abortRef.current?.abort();
    },
    [],
  );

  const identify = useCallback(
    async (sourceOverride?: AudioSourceType) => {
      let source: AudioSourceType;
      if (sourceOverride) {
        source = sourceOverride;
      } else if (listenMode === "internal") {
        source = isPlaying && currentStation && internalSubMode === "stream" ? "stream" : "system";
      } else {
        source = "mic";
      }

      setPhase({ kind: "listening", source });

      const capture = startCapture({
        source,
        streamUrl: currentStation?.streamUrl,
      });
      captureRef.current = capture;

      let pcm: ArrayBuffer;
      try {
        pcm = await capture.result;
      } catch (err) {
        captureRef.current = null;
        if (err instanceof CaptureError && err.code === "aborted") {
          return setPhase({ kind: "idle" });
        }
        return setPhase({
          kind: "error",
          message: err instanceof CaptureError ? err.message : "Recording failed",
        });
      }
      captureRef.current = null;
      setPhase({ kind: "identifying" });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/recognize", {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
          },
          body: pcm,
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (data?.status === "success" && data.result) {
          setPhase({ kind: "result", song: data.result as Song });
        } else {
          setPhase({ kind: "error", message: data?.error ?? "Recognition failed" });
        }
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        setPhase({ kind: "error", message: "Network error — check your connection" });
      } finally {
        abortRef.current = null;
      }
    },
    [listenMode, internalSubMode, isPlaying, currentStation],
  );

  const handleClick = (override?: AudioSourceType) => {
    if (phase.kind === "listening") return captureRef.current?.stop();
    if (phase.kind === "identifying") return;
    void identify(override);
  };

  const busy = phase.kind === "listening" || phase.kind === "identifying";

  const getPrimaryLabel = () => {
    if (phase.kind === "listening") {
      if (phase.source === "stream") return "Listening to station…";
      if (phase.source === "system") return "Listening to tab/system…";
      return "Listening via mic…";
    }
    if (phase.kind === "identifying") return "Identifying with Shazam…";
    if (phase.kind === "result") return "Identify another track";
    if (phase.kind === "error") return "Try again";

    if (listenMode === "internal") {
      if (isPlaying && currentStation && internalSubMode === "stream") {
        return `Identify Station (${currentStation.name})`;
      }
      return "Capture Tab / System Audio";
    }
    return "Tap to Identify (Mic)";
  };

  const getPrimaryIcon = () => {
    if (phase.kind === "listening") return <Square size={14} color={color} fill={color} />;
    if (phase.kind === "identifying") return <Loader2 size={18} color={color} className="animate-spin" />;
    if (phase.kind === "result" || phase.kind === "error") return <RotateCcw size={16} color={T.textMuted} />;

    if (listenMode === "internal") {
      if (isPlaying && currentStation && internalSubMode === "stream") {
        return <Radio size={18} color={color} />;
      }
      return <Headphones size={18} color={color} />;
    }
    return <Mic size={18} color={T.textMuted} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header and Mode Selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            opacity: 0.9,
            textAlign: align,
            margin: 0,
          }}
        >
          Identify Song
        </p>

        {/* Listen mode switch: Internal (headphones) vs Mic (speakers) */}
        <div
          role="radiogroup"
          aria-label="Audio listen mode"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 2,
            borderRadius: 8,
            background: `rgba(${rgb}, 0.08)`,
            border: `1px solid ${T.cardB}`,
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={listenMode === "internal"}
            onClick={() => {
              setListenMode("internal");
              if (phase.kind === "error") setPhase({ kind: "idle" });
            }}
            disabled={busy}
            title="Internal listen: Identify through headphones or active radio stream without microphone"
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: "none",
              fontSize: 10,
              fontFamily: MONO,
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: busy ? "not-allowed" : "pointer",
              background: listenMode === "internal" ? color : "transparent",
              color: listenMode === "internal" ? "#ffffff" : T.textMuted,
              fontWeight: listenMode === "internal" ? 600 : 400,
              transition: "all .2s ease",
            }}
          >
            <Headphones size={12} />
            Internal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={listenMode === "mic"}
            onClick={() => {
              setListenMode("mic");
              if (phase.kind === "error") setPhase({ kind: "idle" });
            }}
            disabled={busy}
            title="Mic listen: Use microphone to identify songs playing through speakers in the room"
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: "none",
              fontSize: 10,
              fontFamily: MONO,
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: busy ? "not-allowed" : "pointer",
              background: listenMode === "mic" ? color : "transparent",
              color: listenMode === "mic" ? "#ffffff" : T.textMuted,
              fontWeight: listenMode === "mic" ? 600 : 400,
              transition: "all .2s ease",
            }}
          >
            <Mic size={12} />
            Mic
          </button>
        </div>
      </div>

      {/* Sub-toggle when Internal mode is active and radio is playing */}
      {listenMode === "internal" && isPlaying && currentStation && (
        <div style={{ display: "flex", gap: 6, fontSize: 10.5, fontFamily: MONO }}>
          <button
            type="button"
            onClick={() => {
              setInternalSubMode("stream");
              if (phase.kind === "error") setPhase({ kind: "idle" });
            }}
            disabled={busy}
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 7,
              border: `1px solid ${internalSubMode === "stream" ? color : T.cardB}`,
              background: internalSubMode === "stream" ? `rgba(${rgb}, .14)` : "transparent",
              color: internalSubMode === "stream" ? color : T.textMuted,
              cursor: busy ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "all .2s",
            }}
          >
            <Radio size={12} /> Radio Stream
          </button>
          <button
            type="button"
            onClick={() => {
              setInternalSubMode("system");
              if (phase.kind === "error") setPhase({ kind: "idle" });
            }}
            disabled={busy}
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 7,
              border: `1px solid ${internalSubMode === "system" ? color : T.cardB}`,
              background: internalSubMode === "system" ? `rgba(${rgb}, .14)` : "transparent",
              color: internalSubMode === "system" ? color : T.textMuted,
              cursor: busy ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "all .2s",
            }}
          >
            <Monitor size={12} /> Tab / System
          </button>
        </div>
      )}

      {/* Main Identification Action Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleClick()}
        disabled={phase.kind === "identifying"}
        aria-busy={busy}
        aria-label={getPrimaryLabel()}
        style={{
          width: "100%",
          padding: "15px 18px",
          borderRadius: 14,
          background: busy ? `rgba(${rgb},.16)` : T.card,
          border: `1px solid ${busy ? color : T.cardB}`,
          backdropFilter: "blur(18px)",
          cursor: phase.kind === "identifying" ? "progress" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          position: "relative",
          overflow: "hidden",
          transition: "background .3s ease, border-color .3s ease",
        }}
      >
        {phase.kind === "listening" && (
          <>
            {[0, 0.6].map((delay) => (
              <motion.span
                key={delay}
                aria-hidden
                style={{
                  position: "absolute",
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: `2px solid rgba(${rgb},.35)`,
                }}
                animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut", delay }}
              />
            ))}
            <motion.span
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: RECORD_MS / 1000, ease: "linear" }}
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: 2,
                width: "100%",
                background: color,
                transformOrigin: "left",
              }}
            />
          </>
        )}

        <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center" }}>
          {getPrimaryIcon()}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            position: "relative",
            zIndex: 2,
            color: busy ? color : T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {getPrimaryLabel()}
        </span>
      </motion.button>

      {/* Results, Errors, and Adaptive Hints */}
      <div aria-live="polite" style={{ minHeight: 0 }}>
        <AnimatePresence mode="wait">
          {phase.kind === "result" && (
            <ResultCard
              key="result"
              song={phase.song}
              color={color}
              theme={T}
              onDismiss={() => setPhase({ kind: "idle" })}
            />
          )}

          {phase.kind === "error" && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              style={{ fontSize: 12, color: "#ef4444", textAlign: align, lineHeight: 1.5 }}
            >
              {phase.message}
            </motion.p>
          )}

          {phase.kind === "idle" && (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 11, color: T.textMuted, textAlign: align, lineHeight: 1.5 }}
            >
              {listenMode === "internal" ? (
                isPlaying && currentStation && internalSubMode === "stream" ? (
                  <>
                    🎧 <strong>Internal listen:</strong> Identifies the live radio station playing in your headphones without microphone.
                  </>
                ) : (
                  <>
                    🎧 <strong>Internal listen:</strong> Select your browser tab or system sound to identify music playing through your headphones.
                  </>
                )
              ) : (
                <>
                  🎙️ <strong>Microphone listen:</strong> Uses your mic to identify music playing out loud through speakers.
                </>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResultCard({
  song,
  color,
  theme: T,
  onDismiss,
}: {
  song: Song;
  color: string;
  theme: Theme;
  onDismiss: () => void;
}) {
  const links = [
    song.shazam && { href: song.shazam, label: "Shazam", tint: "#0088ff" },
    song.appleMusic && { href: song.appleMusic, label: "Apple Music", tint: "#FC3C44" },
    song.spotify && { href: song.spotify, label: "Spotify", tint: "#1DB954" },
  ].filter(Boolean) as { href: string; label: string; tint: string }[];

  const detail = [song.album, song.released].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{
        position: "relative",
        display: "flex",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        background: T.card,
        border: `1px solid ${T.cardB}`,
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          flexShrink: 0,
          overflow: "hidden",
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {song.coverArt ? (
          <img
            src={song.coverArt}
            alt={`Cover art for ${song.title}`}
            width={64}
            height={64}
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Music size={22} color={color} aria-hidden />
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1, paddingRight: 18 }}>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: T.text,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={song.title}
        >
          {song.title}
        </p>
        <p
          style={{
            fontSize: 12,
            color,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={song.artist}
        >
          {song.artist}
        </p>
        {detail && (
          <p
            style={{
              fontSize: 10.5,
              color: T.textMuted,
              marginTop: 2,
              fontFamily: MONO,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {detail}
          </p>
        )}
        {links.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: l.tint,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ExternalLink size={10} aria-hidden /> {l.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss result"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.textMuted,
          display: "flex",
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
