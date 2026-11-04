
"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX,
  Sun, Moon, Sliders, X, Radio, RefreshCw,
  Menu,
} from "lucide-react";
import { SongIdentifier } from "@/components/song-identifier";
import { useNoiseGenerator } from "@/hooks/use-noise-generator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlinePresence } from "@/hooks/use-online-presence";

// ─── Data ────────────────────────────────────────────────────────────────────

interface Station {
  id: string;
  name: string;
  sub: string;
  genre: string;
  color: string;
  rgb: string;
  streamUrl: string;
  baseListeners?: number;
}

// Restored reliable streams + fixed Classical
const STATIONS: Station[] = [
  {
    id: "lofi",
    name: "Lo-Fi Beats",
    sub: "dusty beats & soft keys",
    genre: "Chill / Lofi",
    color: "#F59E0B",
    rgb: "245,158,11",
    streamUrl: "https://usa9.fastcast4u.com/proxy/jamz?mp=/1",
    baseListeners: 12450,
  },
  {
    id: "jazz",
    name: "Jazz Cafe",
    sub: "warm brass & brushed drums",
    genre: "Jazz",
    color: "#F97316",
    rgb: "249,115,22",
    streamUrl: "https://streaming.radio.co/s774887f7b/listen",
    baseListeners: 8320,
  },
  {
    id: "rain",
    name: "Rain + Piano",
    sub: "raindrops on glass",
    genre: "Ambient",
    color: "#60A5FA",
    rgb: "96,165,250",
    streamUrl: "https://stream.zeno.fm/f3wvbbqmdg8uv",
    baseListeners: 4100,
  },
  {
    id: "night",
    name: "Night Drive",
    sub: "synth waves & city lights",
    genre: "Synthwave",
    color: "#A855F7",
    rgb: "168,85,247",
    streamUrl: "https://stream.zeno.fm/0r0xa792kwzuv",
    baseListeners: 6500,
  },
  {
    id: "focus",
    name: "Deep Focus",
    sub: "icy drones & pure silence",
    genre: "Drone",
    color: "#BAE6FD",
    rgb: "186,230,253",
    streamUrl: "https://stream.zeno.fm/f3wvbbqmdg8uv",
    baseListeners: 9800,
  },
  {
    id: "field",
    name: "Field Recordings",
    sub: "forests & distant streams",
    genre: "Nature",
    color: "#22C55E",
    rgb: "34,197,94",
    streamUrl: "https://ice1.somafm.com/missioncontrol-128-mp3",
    baseListeners: 1250,
  },
  {
    id: "classical",
    name: "Classical",
    sub: "orchestral masterpieces",
    genre: "Classical",
    color: "#EC4899",
    rgb: "236,72,153",
    streamUrl: "https://wfmt.streamguys1.com/main-mp3",
    baseListeners: 7400,
  },
  {
    id: "electronic",
    name: "Electronic",
    sub: "beats & bass drops",
    genre: "Electronic",
    color: "#06B6D4",
    rgb: "6,182,212",
    streamUrl: "https://ice1.somafm.com/digitalis-128-mp3",
    baseListeners: 5100,
  },
  {
    id: "hiphop",
    name: "Hip-Hop",
    sub: "beats & rhymes",
    genre: "Hip-Hop",
    color: "#EF4444",
    rgb: "239,68,68",
    streamUrl: "https://ice1.somafm.com/fluid-128-mp3",
    baseListeners: 8900,
  },
  {
    id: "indie",
    name: "Indie Folk",
    sub: "acoustic & heartfelt",
    genre: "Indie",
    color: "#84CC16",
    rgb: "132,204,22",
    streamUrl: "https://ice1.somafm.com/indiepop-128-mp3",
    baseListeners: 3400,
  },
];

interface AmbientSound {
  id: string;
  name: string;
  emoji: string;
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: "rain", name: "Rain", emoji: "🌧" },
  { id: "cafe", name: "Cafe Chatter", emoji: "☕" },
  { id: "thunder", name: "Thunder", emoji: "⚡" },
  { id: "vinyl", name: "Vinyl Crackle", emoji: "◉" },
  { id: "keys", name: "Keyboard", emoji: "⌨" },
  { id: "fire", name: "Fireplace", emoji: "🔥" },
  { id: "train", name: "Train", emoji: "🚂" },
  { id: "wind", name: "Wind", emoji: "🌬" },
];

const VIZ = [38, 72, 55, 88, 44, 78, 60, 92, 48, 65, 82, 54, 70, 42, 85];

const WEATHER_CONDITIONS: Record<string, { emoji: string; label: string }> = {
  clear: { emoji: "☀️", label: "Clear" },
  clouds: { emoji: "☁️", label: "Cloudy" },
  rain: { emoji: "🌧", label: "Rainy" },
  drizzle: { emoji: "🌦", label: "Drizzle" },
  thunderstorm: { emoji: "⛈", label: "Stormy" },
  snow: { emoji: "❄️", label: "Snowy" },
  mist: { emoji: "🌫", label: "Misty" },
  fog: { emoji: "🌫", label: "Foggy" },
  haze: { emoji: "🌫", label: "Hazy" },
  smoke: { emoji: "🌫", label: "Smoky" },
  dust: { emoji: "🌪", label: "Dusty" },
  default: { emoji: "🌤", label: "Fair" },
};

// ─── Framer Motion Variants ──────────────────────────────────────────────────

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.45, type: "spring" as const, stiffness: 260, damping: 20 } },
};

// ─── Theme palettes ───────────────────────────────────────────────────────────

const MOON = {
  bg: "#050d1a",
  sidebar: "#070f1f",
  sidebarB: "rgba(255,255,255,0.045)",
  card: "rgba(10,20,42,0.78)",
  cardB: "rgba(255,255,255,0.07)",
  text: "#d6e4f7",
  textMuted: "#3d5570",
  textDim: "#1e3050",
  player: "rgba(4,9,20,0.97)",
};

const RISE = {
  bg: "#FAF5EC",
  sidebar: "#F5EDD5",
  sidebarB: "rgba(0,0,0,0.06)",
  card: "rgba(255,252,244,0.88)",
  cardB: "rgba(0,0,0,0.07)",
  text: "#2d2010",
  textMuted: "#9b8060",
  textDim: "#c9b490",
  player: "rgba(250,245,236,0.97)",
};

// ─── Lantern SVG ──────────────────────────────────────────────────────────────

const LanternSVG = memo(function LanternSVG({
  color, rgb, isPlaying, isLightOn,
}: {
  color: string; rgb: string; isPlaying: boolean; isLightOn: boolean;
}) {
  const isMobile = useIsMobile();
  const scale = isMobile ? 0.75 : 1;
  const width = 148 * scale;
  const height = 290 * scale;
  const haloSize = 340 * scale;
  const reflectionWidth = 110 * scale;
  const reflectionHeight = 28 * scale;
  const gid = rgb.replace(/,/g, "-");
  const transitionStr = "all 1.2s ease-in-out";

  return (
    <div style={{ position: "relative", width, height }}>
      {/* Bloom halo */}
      <div style={{
        position: "absolute", top: "42%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: haloSize, height: haloSize, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${rgb},0.38) 0%, rgba(${rgb},0.12) 38%, transparent 68%)`,
        animation: isLightOn ? "lanternPulse 3.8s ease-in-out infinite" : "none",
        pointerEvents: "none", zIndex: 0,
        opacity: isLightOn ? 1 : 0,
        transition: transitionStr,
      }} />

      {/* Desk reflection */}
      <div style={{
        position: "absolute", bottom: -16 * scale, left: "50%",
        transform: "translateX(-50%)",
        width: reflectionWidth, height: reflectionHeight, borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(${rgb},0.28) 0%, transparent 70%)`,
        filter: `blur(${10 * scale}px)`, zIndex: 0,
        opacity: isLightOn ? 1 : 0,
        transition: transitionStr,
      }} />

      <svg viewBox="0 0 148 290" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{
          position: "relative", zIndex: 1,
          width: "100%", height: "100%",
          filter: isLightOn
            ? `drop-shadow(0 0 18px rgba(${rgb},0.55)) drop-shadow(0 6px 14px rgba(0,0,0,0.5))`
            : `drop-shadow(0 8px 16px rgba(0,0,0,0.15))`,
          transition: transitionStr,
        }}
      >
        <defs>
          <radialGradient id={`flame-${gid}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="28%" stopColor={color} stopOpacity="0.95" />
            <stop offset="70%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`glass-${gid}`} cx="28%" cy="35%" r="75%">
            <stop offset="0%" stopColor="white" stopOpacity={isLightOn ? "0.12" : "0.25"} />
            <stop offset="100%" stopColor={color} stopOpacity={isLightOn ? "0.04" : "0.01"} />
          </radialGradient>
          <filter id={`glow-${gid}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Hook ring */}
        <circle cx="74" cy="11" r="8" stroke={isLightOn ? "#566070" : "#8a96a8"} strokeWidth="2.5" style={{ transition: transitionStr }} />
        <line x1="74" y1="19" x2="74" y2="34" stroke={isLightOn ? "#566070" : "#8a96a8"} strokeWidth="2.5" style={{ transition: transitionStr }} />

        {/* Peak ornament */}
        <path d="M58,34 L74,20 L90,34" fill={isLightOn ? "#202d3e" : "#e2e8f0"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />

        {/* Top cap */}
        <path d="M50,34 L98,34 L102,50 L46,50 Z" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <path d="M52,34 L96,34 L100,48 L48,48 Z" fill={isLightOn ? "#212f42" : "#ffffff"} style={{ transition: transitionStr }} />
        <line x1="52" y1="35" x2="96" y2="35" stroke={isLightOn ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.05)"} strokeWidth="1" />
        <rect x="48" y="48" width="52" height="6" rx="1.5" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <line x1="48" y1="49" x2="100" y2="49" stroke={isLightOn ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"} strokeWidth="1" />

        {/* Top corner rosettes */}
        <circle cx="51" cy="51" r="3.5" fill={isLightOn ? "#141e2c" : "#e2e8f0"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />
        <circle cx="97" cy="51" r="3.5" fill={isLightOn ? "#141e2c" : "#e2e8f0"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />
        <circle cx="51" cy="51" r="1.5" fill={isLightOn ? "#374555" : "#94a3b8"} style={{ transition: transitionStr }} />
        <circle cx="97" cy="51" r="1.5" fill={isLightOn ? "#374555" : "#94a3b8"} style={{ transition: transitionStr }} />

        {/* Frame pillars */}
        <rect x="47" y="51" width="7" height="158" rx="2" fill={isLightOn ? "#141e2c" : "#e2e8f0"} style={{ transition: transitionStr }} />
        <rect x="94" y="51" width="7" height="158" rx="2" fill={isLightOn ? "#141e2c" : "#e2e8f0"} style={{ transition: transitionStr }} />
        <line x1="48.5" y1="51" x2="48.5" y2="209" stroke={isLightOn ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.8)"} strokeWidth="1" style={{ transition: transitionStr }} />
        <line x1="99.5" y1="51" x2="99.5" y2="209" stroke={isLightOn ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)"} strokeWidth="1" style={{ transition: transitionStr }} />

        {/* Glass body */}
        <rect x="54" y="54" width="40" height="152" fill={`url(#glass-${gid})`} style={{ transition: transitionStr }} />
        <rect x="54" y="54" width="40" height="152" fill={isLightOn ? `rgba(${rgb},0.065)` : "rgba(0,0,0,0.02)"} style={{ transition: transitionStr }} />
        <path d="M54,70 L60,70 L60,196 L54,196" fill={isLightOn ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.4)"} style={{ transition: transitionStr }} />

        {/* Horizontal bars */}
        <rect x="47" y="92" width="54" height="3" rx="1" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <rect x="47" y="95" width="54" height="1" rx="0.5" fill={isLightOn ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
        <rect x="47" y="133" width="54" height="3" rx="1" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <rect x="47" y="136" width="54" height="1" rx="0.5" fill={isLightOn ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
        <rect x="47" y="174" width="54" height="3" rx="1" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />

        {/* Edge lines */}
        <line x1="54" y1="54" x2="94" y2="54" stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />
        <line x1="54" y1="206" x2="94" y2="206" stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />

        {/* Inner glow layers */}
        <ellipse cx="74" cy="138" rx="26" ry="48" fill={`rgba(${rgb},0.11)`} style={{ opacity: isLightOn ? 1 : 0, transition: transitionStr }} />
        <ellipse cx="74" cy="138" rx="17" ry="34" fill={`rgba(${rgb},0.22)`} style={{ opacity: isLightOn ? 1 : 0, transition: transitionStr }} />

        {/* Core flame body */}
        <ellipse
          cx="74" cy="141" rx="11" ry="25"
          fill={`url(#flame-${gid})`}
          style={{
            animation: (isPlaying && isLightOn)
              ? "flameFlicker 0.85s ease-in-out infinite"
              : "none",
            transformOrigin: "74px 141px",
            opacity: isLightOn ? 1 : 0,
            transition: transitionStr,
          }}
        />
        {/* Flame tip */}
        <ellipse
          cx="74" cy="125" rx="5" ry="9"
          fill="white" opacity={0.88}
          style={{
            animation: (isPlaying && isLightOn)
              ? "flameFlicker 0.65s ease-in-out infinite reverse"
              : "none",
            transformOrigin: "74px 125px",
            opacity: isLightOn ? 1 : 0,
            transition: transitionStr,
          }}
        />

        {/* Bottom corner rosettes */}
        <circle cx="51" cy="207" r="3.5" fill={isLightOn ? "#141e2c" : "#e2e8f0"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />
        <circle cx="97" cy="207" r="3.5" fill={isLightOn ? "#141e2c" : "#e2e8f0"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />
        <circle cx="51" cy="207" r="1.5" fill={isLightOn ? "#374555" : "#94a3b8"} style={{ transition: transitionStr }} />
        <circle cx="97" cy="207" r="1.5" fill={isLightOn ? "#374555" : "#94a3b8"} style={{ transition: transitionStr }} />

        {/* Bottom cap */}
        <rect x="48" y="207" width="52" height="6" rx="1.5" fill={isLightOn ? "#212f42" : "#ffffff"} style={{ transition: transitionStr }} />
        <path d="M46,213 L102,213 L106,230 L42,230 Z" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <path d="M48,213 L100,213 L104,228 L44,228 Z" fill={isLightOn ? "#212f42" : "#ffffff"} style={{ transition: transitionStr }} />
        <line x1="48" y1="214" x2="100" y2="214" stroke={isLightOn ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"} strokeWidth="1" />

        {/* Base plate */}
        <rect x="44" y="228" width="60" height="8" rx="2" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <ellipse cx="74" cy="236" rx="30" ry="5" fill={isLightOn ? "#111d2a" : "#e2e8f0"} style={{ transition: transitionStr }} />

        {/* Finial */}
        <path d="M68,236 Q74,250 80,236" fill="none" stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1.5" style={{ transition: transitionStr }} />
        <circle cx="74" cy="253" r="5" fill={isLightOn ? "#1a2636" : "#f1f5f9"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1.5" style={{ transition: transitionStr }} />
        <circle cx="74" cy="253" r="2" fill={isLightOn ? "#374555" : "#94a3b8"} style={{ transition: transitionStr }} />
        <path d="M72.5,258 L74,268 L75.5,258" fill={isLightOn ? "#1a2636" : "#f1f5f9"} style={{ transition: transitionStr }} />
        <circle cx="74" cy="271" r="2.5" fill={isLightOn ? "#212f42" : "#ffffff"} stroke={isLightOn ? "#374555" : "#cbd5e1"} strokeWidth="1" style={{ transition: transitionStr }} />

        {/* Desk glow puddle */}
        <ellipse
          cx="74" cy="283" rx="24" ry="4"
          fill={`rgba(${rgb},0.22)`}
          filter={`url(#glow-${gid})`}
          style={{ opacity: isLightOn ? 1 : 0, transition: transitionStr }}
        />
      </svg>
    </div>
  );
});

// ─── Audio Visualizer Component ───────────────────────────────────────────────

const AudioVisualizer = memo(function AudioVisualizer({
  isPlaying,
  stationRgb,
  analyser,
  ambientLevels,
}: {
  isPlaying: boolean;
  stationRgb: string;
  analyser: AnalyserNode | null;
  ambientLevels: Record<string, number>;
}) {
  const [levels, setLevels] = useState<number[]>(VIZ.map(() => 4));

  const hasAmbient = Object.values(ambientLevels).some(v => v > 0);
  const totalAmbient = Object.values(ambientLevels).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!isPlaying) {
      setLevels(VIZ.map(() => 4));
      return;
    }

    let animationId: number;
    const baseLevel = Math.min(totalAmbient / 200, 1);

    const updateLevels = () => {
      let hasData = false;
      if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const newLevels = VIZ.map((_, i) => {
          const index = Math.floor((i / VIZ.length) * dataArray.length * 0.5);
          const value = dataArray[index] || 0;
          if (value > 0) hasData = true;
          return Math.max(4, (value / 255) * 92);
        });

        if (hasData) {
          setLevels(newLevels);
          animationId = requestAnimationFrame(updateLevels);
          return;
        }
      }

      // Fallback: If no real data from analyser (e.g. CORS blocked) or no analyser,
      // simulate the visualizer based on music playing and ambient levels
      const simulatedLevels = VIZ.map((base, i) => {
        const noise = Math.random() * 0.4 + 0.8;
        const wave = Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.6;
        // Bump higher if pure music (no ambient)
        const multiplier = hasAmbient ? baseLevel * wave : 0.6 * wave;
        return Math.max(4, base * multiplier * noise);
      });
      setLevels(simulatedLevels);
      animationId = requestAnimationFrame(updateLevels);
    };

    updateLevels();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, analyser, hasAmbient, totalAmbient]);

  return (
    <div style={{
      display: "flex", alignItems: "flex-end",
      gap: 2.5, justifyContent: "flex-end", height: 48,
    }}>
      {levels.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: h }}
          transition={{ duration: 0.05, ease: "easeOut" }}
          style={{
            width: 3,
            background: `rgba(${stationRgb},${0.38 + (i % 4) * 0.15})`,
            borderRadius: "2px 2px 0 0",
          }}
        />
      ))}
    </div>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function LanternFM() {
  const [mode, setMode] = useState<"moonlight" | "sunrise">("moonlight");
  const [station, setStation] = useState<Station>(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [showMixer, setShowMixer] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [time, setTime] = useState(new Date());
  const [muted, setMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Live online builders count from presence service
  const { onlineCount } = useOnlinePresence();

  const [location, setLocation] = useState<{ city: string; temp: number; condition: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [ambientLevels, setAmbientLevels] = useState<Record<string, number>>({
    rain: 0, cafe: 0, thunder: 0, vinyl: 0, keys: 0, fire: 0, train: 0, wind: 0,
  });

  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Use noise generator for ambient sounds
  const { initAudioContext: initNoiseContext } = useNoiseGenerator({
    masterVolume: volume,
    muted,
    isPlaying: playing,
    levels: ambientLevels,
  });

  const T = mode === "moonlight" ? MOON : RISE;
  const D = mode === "moonlight";
  const isLightOn = playing && D;

  // Initialize audio context and analyser
  const initAudioContext = useCallback(() => {
    if ((!audioContextRef.current || audioContextRef.current.state === 'closed') && typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
    }
  }, []);

  // Clock update
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Geolocation and weather
  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        const weatherData = await weatherRes.json();
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        const geoData = await geoRes.json();
        const weatherCode = weatherData.current?.weather_code || 0;
        let condition = "default";
        if (weatherCode === 0) condition = "clear";
        else if (weatherCode <= 3) condition = "clouds";
        else if (weatherCode <= 49) condition = "fog";
        else if (weatherCode <= 59) condition = "drizzle";
        else if (weatherCode <= 69) condition = "rain";
        else if (weatherCode <= 79) condition = "snow";
        else if (weatherCode <= 99) condition = "thunderstorm";
        const city = geoData.address?.city ||
          geoData.address?.town ||
          geoData.address?.village ||
          geoData.address?.county ||
          "Unknown";
        setLocation({ city, temp: Math.round(weatherData.current?.temperature_2m || 20), condition });
        setLocationLoading(false);
      } catch {
        setLocation({ city: "Local", temp: 20, condition: "default" });
        setLocationLoading(false);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
        () => {
          setLocation({ city: "Unknown", temp: 18, condition: "default" });
          setLocationLoading(false);
        },
        { timeout: 10000 }
      );
    } else {
      setLocation({ city: "Unknown", temp: 18, condition: "default" });
      setLocationLoading(false);
    }
  }, []);


  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lantern-mode');
      const savedVolume = localStorage.getItem('lantern-volume');
      const savedStation = localStorage.getItem('lantern-station');
      const savedAmbient = localStorage.getItem('lantern-ambient');
      if (savedMode) setMode(savedMode as "moonlight" | "sunrise");
      if (savedVolume) setVolume(parseInt(savedVolume));
      if (savedStation) {
        const found = STATIONS.find(s => s.id === savedStation);
        if (found) setStation(found);
      }
      if (savedAmbient) {
        try {
          const parsed = JSON.parse(savedAmbient);
          const defaultLevels = {
            rain: 0, cafe: 0, thunder: 0, vinyl: 0, keys: 0, fire: 0, train: 0, wind: 0,
          };
          setAmbientLevels({ ...defaultLevels, ...parsed });
        } catch { /* ignore */ }
      }
    }
  }, []);

  // Save preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lantern-mode', mode);
      localStorage.setItem('lantern-volume', volume.toString());
      localStorage.setItem('lantern-station', station.id);
      localStorage.setItem('lantern-ambient', JSON.stringify(ambientLevels));
    }
  }, [mode, volume, station, ambientLevels]);

  // ─── AUDIO MANAGEMENT ──────────────

  // Initialize audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      // NO crossOrigin="anonymous" here so streams play reliably across browsers
      audioRef.current.onerror = () => {
        setStreamError("Failed to load stream. Try another station.");
        setIsLoading(false);
        setPlaying(false);
      };
    }
  }, []);

  // Handle station changes & play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      if (audio.src !== station.streamUrl) {
        audio.src = station.streamUrl;
      }
      setIsLoading(true);
      setStreamError(null);
      initAudioContext();
      initNoiseContext();

      audio.play().then(() => {
        setIsLoading(false);
        setStreamError(null);
        // Do NOT wrap the audio element in a MediaElementAudioSourceNode or connect it to the AudioContext.
        // Doing so redirects the stream to the AudioContext, which silences it due to browser CORS policies on 
        // cross-origin audio elements without crossOrigin="anonymous".
        // Bypassing AudioContext allows the HTMLAudioElement to play directly, while the visualizer falls back
        // to a simulated waveform animation.
      }).catch(() => {
        setStreamError("Stream unavailable. The ambient mixer still works!");
        setIsLoading(false);
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.id, playing]);

  // Volume control 
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const handlePlayPause = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    initNoiseContext();
    setPlaying(p => !p);
  };

  const handleStationChange = (newStation: Station) => {
    if (newStation.id === station.id) return;
    setStation(newStation);
  };

  const timeStr = mounted
    ? time.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
    : "--:--:--";

  // ─── Sidebar Content ─────

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "0 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: `rgba(${station.rgb},.14)`,
              border: `1px solid rgba(${station.rgb},.3)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 14px rgba(${station.rgb},.22)`,
              transition: "all .5s ease", flexShrink: 0,
            }}
          >
            <img src="/Lantern.svg" alt="Lantern logo" style={{ width: 16, height: 18 }} />
          </motion.div>
          <span style={{
            fontFamily: "var(--font-fraunces), serif",
            fontSize: 20, fontWeight: 600, letterSpacing: "-.025em",
            color: T.text,
          }}>Lantern.fm</span>
        </div>
        <p style={{ fontSize: 11, color: T.textMuted, paddingLeft: 42, letterSpacing: ".02em", lineHeight: 1.4 }}>
          Ambient radio for late&#8209;night coders.
        </p>
      </div>

      <div style={{ height: 1, background: T.sidebarB, margin: "0 22px 20px" }} />

      {/* Station list */}
      <div style={{ padding: "0 10px", flex: 1, overflowY: "auto" }}>
        <p style={{
          fontSize: 9.5, fontFamily: "var(--font-jetbrains), monospace",
          color: T.textMuted, letterSpacing: ".16em", textTransform: "uppercase",
          padding: "0 12px", marginBottom: 10,
        }}>Stations</p>

        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          {STATIONS.map(s => {
            const active = station.id === s.id;
            return (
              <motion.button
                key={s.id}
                variants={staggerItem}
                whileHover={{ x: 4, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.97 }}
                className={`stn-row${D ? "" : " light"}`}
                onClick={() => {
                  handleStationChange(s);
                  if (isMobile) setShowSidebar(false);
                }}
                aria-label={`Switch to ${s.name} station`}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "none", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 11, textAlign: "left",
                  background: active ? `rgba(${s.rgb},.11)` : "transparent",
                }}
              >
                {/* Station dot */}
                <motion.div
                  animate={{
                    scale: active ? 1.3 : 1,
                    boxShadow: active ? `0 0 11px ${s.color}` : "0 0 0px transparent",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: s.color, flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, lineHeight: 1.3,
                    color: active ? s.color : T.text,
                    transition: "color .3s",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{s.sub}</div>
                </div>

                {/* Active mini-viz */}
                {active && playing && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    {[1, 2, 3].map(b => (
                      <div key={b} style={{
                        width: 2.5, height: 8 + b * 4,
                        background: s.color, borderRadius: 1.5, opacity: .85,
                        animation: `vizPulse ${.35 + b * .15}s ease-in-out infinite`,
                        animationDelay: `${b * .08}s`,
                        transformOrigin: "bottom",
                      }} />
                    ))}
                  </div>
                )}

                {active && !playing && (
                  <Radio size={14} color={s.color} style={{ opacity: 0.6 }} />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Sidebar footer */}
      <div style={{
        padding: "20px 22px 0",
        borderTop: `1px solid ${T.sidebarB}`,
        marginTop: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: "#22C55E",
            animation: "breatheDot 2.2s ease-in-out infinite",
          }} />
          <span style={{
            fontSize: 10.5, fontFamily: "var(--font-jetbrains), monospace",
            color: T.textMuted,
          }}>
            {onlineCount.toLocaleString()} {onlineCount === 1 ? "builder online" : "builders online"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {locationLoading ? (
            <>
              <span style={{ fontSize: 15 }}>🌐</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>Locating...</span>
            </>
          ) : location ? (
            <>
              <span style={{ fontSize: 15 }}>{WEATHER_CONDITIONS[location.condition]?.emoji || WEATHER_CONDITIONS.default.emoji}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {WEATHER_CONDITIONS[location.condition]?.label || "Fair"} · {location.temp}°C · {location.city}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 15 }}>🌤</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>Weather unavailable</span>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div style={{
        width: "100vw", height: "100dvh", display: "flex",
        overflow: "hidden", position: "relative",
        background: T.bg, color: T.text,
        fontFamily: "var(--font-dm-sans), sans-serif",
        transition: "background .7s ease, color .4s ease",
      }}>

        {/* ── Background layers ─────────────────────────────────────────── */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: isLightOn
            ? `radial-gradient(ellipse at 68% 38%, rgba(${station.rgb},.055) 0%, transparent 55%),
               radial-gradient(ellipse at 22% 75%, rgba(${station.rgb},.025) 0%, transparent 45%)`
            : (D
              ? `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.015) 0%, transparent 60%)`
              : `radial-gradient(circle at 50% 45%, rgba(0,0,0,0.02) 0%, transparent 60%)`),
          transition: "all 1.2s ease",
        }} />

        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: D ? .028 : .016,
        }} />

        {/* ── Desktop sidebar ──────────────────────────────────────────── */}
        {!isMobile && (
          <aside style={{
            width: 258, minHeight: "100dvh", flexShrink: 0,
            background: T.sidebar, borderRight: `1px solid ${T.sidebarB}`,
            display: "flex", flexDirection: "column",
            padding: "26px 0", zIndex: 10,
          }}>
            {sidebarContent}
          </aside>
        )}

        {/* ── Mobile sidebar drawer ──────────────────────────────────── */}
        <AnimatePresence>
          {isMobile && showSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setShowSidebar(false)}
                className="mobile-backdrop"
                style={{
                  position: "fixed", inset: 0,
                  background: "rgba(0,0,0,0.55)", zIndex: 40,
                }}
              />
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                style={{
                  position: "fixed", left: 0, top: 0, bottom: 0,
                  width: 280, background: T.sidebar,
                  borderRight: `1px solid ${T.sidebarB}`,
                  display: "flex", flexDirection: "column",
                  padding: "26px 0", zIndex: 50,
                  boxShadow: "8px 0 32px rgba(0,0,0,0.3)",
                }}
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main area ──────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", position: "relative", zIndex: 2,
        }}>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              height: 62, display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: isMobile ? "0 16px" : "0 30px",
              borderBottom: `1px solid ${T.cardB}`,
              flexShrink: 0, zIndex: 5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 18 }}>
              {isMobile && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSidebar(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: T.text, display: "flex", padding: 4,
                  }}
                >
                  <Menu size={20} />
                </motion.button>
              )}

              <div style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: isMobile ? 15 : 18, fontWeight: 300,
                color: T.text, letterSpacing: ".06em",
              }}>{timeStr}</div>

              {!isMobile && <div style={{ width: 1, height: 18, background: T.cardB }} />}

              <motion.div
                layout
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "4px 10px", borderRadius: 20,
                  background: `rgba(${station.rgb},.08)`,
                  border: `1px solid rgba(${station.rgb},.18)`,
                }}
              >
                <motion.div
                  animate={{
                    boxShadow: playing ? `0 0 8px ${station.color}` : '0 0 0px transparent',
                    scale: playing ? [1, 1.2, 1] : 1,
                  }}
                  transition={playing ? { repeat: Infinity, duration: 1.5 } : {}}
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: station.color,
                  }}
                />
                <span style={{
                  fontSize: 10.5, fontFamily: "var(--font-jetbrains), monospace",
                  color: station.color, letterSpacing: ".08em",
                }}>{playing ? 'LIVE' : station.genre.toUpperCase()}</span>
              </motion.div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowMixer(m => !m)}
                style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  background: showMixer ? `rgba(${station.rgb},.1)` : "transparent",
                  border: `1px solid ${showMixer ? `rgba(${station.rgb},.38)` : T.cardB}`,
                  color: showMixer ? station.color : T.textMuted,
                  transition: "all .22s ease",
                }}
              >
                <Sliders size={13} />
                {!isMobile && "Mixer"}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setMode(m => m === "moonlight" ? "sunrise" : "moonlight")}
                style={{
                  width: 68, height: 32, borderRadius: 16, cursor: "pointer",
                  background: D ? "#0b1a30" : "#f0e4c0",
                  border: `1px solid ${T.sidebarB}`,
                  position: "relative", display: "flex",
                  alignItems: "center", padding: "0 4px",
                  transition: "background .5s ease",
                }}
              >
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: D ? "#1a3560" : "#f0c030",
                    boxShadow: D ? "0 0 10px rgba(80,130,255,.4)" : "0 0 14px rgba(240,180,48,.65)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginLeft: D ? 0 : 36,
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={D ? "moon" : "sun"}
                      initial={{ rotate: -60, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 60, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {D ? <Moon size={12} color="#93c5fd" /> : <Sun size={12} color="#7c5200" />}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.button>
            </div>
          </motion.header>

          {/* Hero */}
          <main style={{
            flex: 1, overflowY: "auto", display: "flex",
            alignItems: "center", justifyContent: "center",
            padding: isMobile ? "24px 16px" : "0 28px", position: "relative",
          }}>
            {D && <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `linear-gradient(135deg, rgba(${station.rgb},.025) 0%, transparent 55%, rgba(${station.rgb},.015) 100%)`,
            }} />}

            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 168px 1fr",
              alignItems: "center",
              gap: isMobile ? 24 : 44,
              width: "100%",
              maxWidth: 920,
            }}>

              {/* ── Left: station info + viz ── */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                style={{ textAlign: isMobile ? "center" : "right", order: isMobile ? 2 : 1 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={station.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    <p style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 10, color: station.color,
                      letterSpacing: ".22em", textTransform: "uppercase",
                      marginBottom: 12, opacity: .9,
                    }}>{playing ? 'Now Streaming' : 'Ready to Play'}</p>

                    <h1 style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: isMobile ? 32 : 44, fontWeight: 700,
                      color: T.text, lineHeight: 1.05,
                      letterSpacing: "-.035em", marginBottom: 8,
                    }}>{station.name}</h1>

                    <p style={{ fontSize: 13.5, color: T.textMuted, marginBottom: isMobile ? 16 : 26, lineHeight: 1.4 }}>
                      {station.sub}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {!isMobile && (
                  <AudioVisualizer
                    isPlaying={playing}
                    stationRgb={station.rgb}
                    analyser={analyserRef.current}
                    ambientLevels={ambientLevels}
                  />
                )}
              </motion.div>

              {/* ── Center: Lantern ── */}
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 200 }}
                style={{
                  display: "flex", justifyContent: "center",
                  position: "relative",
                  order: isMobile ? 1 : 2,
                }}
              >
                <LanternSVG
                  color={station.color}
                  rgb={station.rgb}
                  isPlaying={playing}
                  isLightOn={isLightOn}
                />
              </motion.div>

              {/* ── Right: Shazam ── */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.15 }}
                style={{ order: 3 }}
              >
                <SongIdentifier
                  color={station.color}
                  rgb={station.rgb}
                  theme={T}
                  align={isMobile ? "center" : "left"}
                  currentStation={station}
                  isPlaying={playing}
                />
              </motion.div>
            </div>
          </main>

          {/* ── Bottom player ───────────────────────────────────────────── */}
          <motion.footer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              height: isMobile ? 68 : 78, flexShrink: 0,
              background: T.player,
              borderTop: `1px solid ${T.cardB}`,
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              display: "flex", alignItems: "center",
              padding: isMobile ? "0 12px" : "0 28px",
              gap: isMobile ? 12 : 22, zIndex: 10,
              boxShadow: D
                ? `0 -6px 48px rgba(${station.rgb},.055)`
                : "0 -4px 24px rgba(0,0,0,.06)",
            }}
          >
            {/* Track label */}
            <div style={{ minWidth: isMobile ? 100 : 172 }}>
              <div style={{
                fontSize: isMobile ? 12 : 13, fontWeight: 500,
                color: streamError ? '#ef4444' : T.text, marginBottom: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: isMobile ? 120 : 200,
              }}>
                {streamError ? 'Stream Issue' : station.name}
              </div>
              <div style={{
                fontSize: isMobile ? 10 : 11,
                color: streamError ? '#ef4444' : T.textMuted,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: isMobile ? 120 : 200,
              }}>
                {streamError ? 'Ambient mixer still works!' : `${station.genre} · Live Radio`}
              </div>
            </div>

            {/* Playback controls - Centered Play button without prev/next */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: isMobile ? 4 : 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 14 : 20 }}>
                {/* Play button with pulsing ring */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {playing && (
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        width: 42, height: 42, borderRadius: "50%",
                        border: `2px solid ${station.color}`,
                      }}
                    />
                  )}
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePlayPause}
                    disabled={isLoading}
                    style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: station.color, border: "none",
                      cursor: isLoading ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 0 22px rgba(${station.rgb},.45)`,
                      color: D ? "#000" : "#fff",
                      opacity: isLoading ? 0.7 : 1,
                      position: "relative", zIndex: 2,
                    }}
                  >
                    {isLoading ? (
                      <RefreshCw size={17} className="animate-spin" />
                    ) : playing ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Live indicator bar */}
              {!isMobile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 300 }}>
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-jetbrains), monospace",
                    color: playing ? station.color : T.textMuted, minWidth: 34, textAlign: 'right'
                  }}>{playing ? 'LIVE' : '---'}</span>

                  <div style={{
                    flex: 1, height: 3,
                    background: D ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)",
                    borderRadius: 2, position: "relative", overflow: 'hidden',
                  }}>
                    {playing && (
                      <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                        style={{
                          height: "100%", width: "40%",
                          background: `linear-gradient(90deg, transparent, ${station.color}, transparent)`,
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Volume */}
            <div style={{
              display: "flex", alignItems: "center", gap: 9,
              minWidth: isMobile ? 80 : 148,
            }}>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMuted(m => !m)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.textMuted, display: 'flex', padding: 2,
                }}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </motion.button>

              {/* Volume slider */}
              <div style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center" }}>
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 3,
                  borderRadius: 2,
                  background: D ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${muted ? 0 : volume}%`,
                    background: `rgba(${station.rgb},.65)`,
                    borderRadius: 2,
                    transition: 'width 0.08s ease',
                  }} />
                </div>
                <input
                  type="range" min={0} max={100}
                  value={muted ? 0 : volume}
                  onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
                  className="volume-slider"
                  style={{
                    position: "absolute", left: 0, right: 0, width: "100%",
                    "--slider-color": station.color,
                    "--slider-glow": `rgba(${station.rgb},.45)`,
                  } as React.CSSProperties}
                />
              </div>

              {!isMobile && (
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-jetbrains), monospace",
                  color: T.textDim, minWidth: 26, textAlign: "right",
                }}>{muted ? 0 : volume}</span>
              )}
            </div>
          </motion.footer>
        </div>

        {/* ── Ambient Mixer Panel ────────────────────────────────────────── */}
        <AnimatePresence>
          {showMixer && (
            <motion.aside
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              style={{
                width: isMobile ? "100%" : 276,
                position: isMobile ? "fixed" : "absolute",
                right: 0, top: 0, bottom: 0,
                flexShrink: 0,
                background: T.sidebar,
                borderLeft: `1px solid ${T.cardB}`,
                display: "flex", flexDirection: "column",
                padding: "22px 18px",
                zIndex: isMobile ? 45 : 20,
                overflowY: "auto",
                boxShadow: isMobile ? "-8px 0 32px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{
                  fontFamily: "var(--font-fraunces), serif",
                  fontSize: 19, fontWeight: 600, color: T.text,
                }}>Ambient Mixer</h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMixer(false)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: T.textMuted, display: "flex", padding: 4,
                    borderRadius: 6,
                  }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <p style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 22, lineHeight: 1.55 }}>
                Layer ambient sounds beneath your music. Sounds play when radio is active.
              </p>

              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                {AMBIENT_SOUNDS.map(s => (
                  <motion.div key={s.id} variants={staggerItem} style={{ marginBottom: 20 }}>
                    <div style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", marginBottom: 9,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 17 }}>{s.emoji}</span>
                        <span style={{ fontSize: 12.5, color: T.text, fontWeight: 500 }}>{s.name}</span>
                      </div>
                      <span style={{
                        fontSize: 10, fontFamily: "var(--font-jetbrains), monospace",
                        color: ambientLevels[s.id] > 0 ? station.color : T.textMuted,
                        fontWeight: ambientLevels[s.id] > 0 ? 500 : 400,
                      }}>{ambientLevels[s.id]}%</span>
                    </div>

                    {/* Slider */}
                    <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
                      <div style={{
                        position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2,
                        background: D ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${ambientLevels[s.id]}%`,
                          background: ambientLevels[s.id] > 0
                            ? `linear-gradient(to right, rgba(${station.rgb},.5), rgba(${station.rgb},.9))`
                            : "transparent",
                          borderRadius: 2,
                          transition: "width .08s, background .5s",
                        }} />
                      </div>
                      <input
                        type="range" min={0} max={100}
                        value={ambientLevels[s.id]}
                        onChange={e =>
                          setAmbientLevels(prev => ({ ...prev, [s.id]: Number(e.target.value) }))
                        }
                        className="lantern-slider"
                        style={{
                          position: "absolute", left: 0, right: 0, width: "100%",
                          "--slider-color": station.color,
                          "--slider-glow": `rgba(${station.rgb},.45)`,
                        } as React.CSSProperties}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Reset button */}
              <motion.button
                whileHover={{
                  scale: 1.02,
                  borderColor: `rgba(${station.rgb},.3)`,
                  color: station.color,
                }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAmbientLevels({
                  rain: 0, cafe: 0, thunder: 0, vinyl: 0, keys: 0, fire: 0, train: 0, wind: 0,
                })}
                style={{
                  marginTop: 16, padding: "10px 14px", borderRadius: 8,
                  background: 'transparent',
                  border: `1px solid ${T.cardB}`,
                  color: T.textMuted,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Reset All Layers
              </motion.button>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
