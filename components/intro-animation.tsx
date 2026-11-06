"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroAnimationProps {
  onComplete: () => void;
  accentColor?: string;
}

function ease(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  return clamped * clamped * (3 - 2 * clamped);
}

export function IntroAnimation({ onComplete, accentColor = "#F59E0B" }: IntroAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCompleteRef = useRef(false);

  const completeIntro = useCallback(() => {
    if (isCompleteRef.current) return;
    isCompleteRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [onComplete]);

  // Handle keyboard skip (Esc, Space, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        completeIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completeIntro]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const drawLantern = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale: number,
      glow: number,
      flicker: number,
    ) => {
      const s = scale;
      c.save();

      const pt = (px: number, py: number): [number, number] => [cx + px * s, cy + py * s];

      // Hanging loop and ring
      const [lx, ly] = pt(0, -177);
      const ringR = Math.max(3, 10 * s);
      c.strokeStyle = "#465d77";
      c.lineWidth = Math.max(2, 3 * s);
      c.beginPath();
      c.arc(lx, ly, ringR, 0, Math.PI * 2);
      c.stroke();

      // Stem down to cap
      const [sx1, sy1] = pt(0, -167);
      const [sx2, sy2] = pt(0, -154);
      c.strokeStyle = "#30455c";
      c.lineWidth = Math.max(2, 4 * s);
      c.beginPath();
      c.moveTo(sx1, sy1);
      c.lineTo(sx2, sy2);
      c.stroke();

      // Cap
      c.fillStyle = "#122237";
      c.strokeStyle = "#263b53";
      c.lineWidth = Math.max(1, 2 * s);
      c.beginPath();
      const [p1x, p1y] = pt(-36, -152);
      const [p2x, p2y] = pt(-22, -169);
      const [p3x, p3y] = pt(22, -169);
      const [p4x, p4y] = pt(36, -152);
      c.moveTo(p1x, p1y);
      c.lineTo(p2x, p2y);
      c.lineTo(p3x, p3y);
      c.lineTo(p4x, p4y);
      c.closePath();
      c.fill();
      c.stroke();

      // Outer glass chamber frame
      const [left, top] = pt(-37, -151);
      const [right, bottom] = pt(37, 111);
      const frameW = right - left;
      const frameH = bottom - top;
      const radius = Math.max(5, 7 * s);

      c.fillStyle = "#0b1829";
      c.strokeStyle = "#2a3f57";
      c.lineWidth = Math.max(2, 4 * s);
      c.beginPath();
      c.roundRect(left, top, frameW, frameH, radius);
      c.fill();
      c.stroke();

      // Warm illuminated glass
      const gR = Math.round(55 + 55 * glow);
      const gG = Math.round(36 + 24 * glow);
      const gB = Math.round(14 + 7 * glow);
      const [gLeft, gTop] = pt(-25, -137);
      const [gRight, gBottom] = pt(25, 98);
      c.fillStyle = `rgb(${gR},${gG},${gB})`;
      c.beginPath();
      c.roundRect(gLeft, gTop, gRight - gLeft, gBottom - gTop, Math.max(3, 4 * s));
      c.fill();

      // Inner flame layers
      const [fx, fy] = pt(0, 5);
      const fw = 13 * s;
      const fh = 24 * s;

      // Outer flame layer (deep warm amber)
      c.fillStyle = "#a05b0d";
      c.beginPath();
      c.ellipse(fx, fy, fw, fh, 0, 0, Math.PI * 2);
      c.fill();

      // Mid flame layer (bright golden)
      c.fillStyle = "#faa92b";
      c.beginPath();
      c.ellipse(fx, fy - 1 * s, 7 * s, 14 * s, 0, 0, Math.PI * 2);
      c.fill();

      // Inner flame core (incandescent white-amber)
      c.fillStyle = "#fff6da";
      c.beginPath();
      c.ellipse(fx, fy - 2 * s, 4 * s, 9 * s, 0, 0, Math.PI * 2);
      c.fill();

      // Crossbars
      c.strokeStyle = "#2a3f54";
      c.lineWidth = Math.max(2, 3 * s);
      for (const yy of [-111, -53, 5, 63]) {
        const [x1, y1] = pt(-34, yy);
        const [x2, y2] = pt(34, yy);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      }

      // Vertical side rails & rivets
      c.strokeStyle = "#1d2e42";
      c.lineWidth = Math.max(2, 4 * s);
      for (const xx of [-31, 31]) {
        const [x1, y1] = pt(xx, -144);
        const [x2, y2] = pt(xx, 104);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();

        for (const yy of [-143, 102]) {
          const [rx, ry] = pt(xx, yy);
          c.fillStyle = "#546c84";
          c.beginPath();
          c.arc(rx, ry, Math.max(2, 3 * s), 0, Math.PI * 2);
          c.fill();
        }
      }

      // Weighted base
      c.fillStyle = "#112236";
      c.strokeStyle = "#2b3e53";
      c.lineWidth = Math.max(1, 2 * s);
      c.beginPath();
      const [b1x, b1y] = pt(-39, 111);
      const [b2x, b2y] = pt(39, 111);
      const [b3x, b3y] = pt(31, 135);
      const [b4x, b4y] = pt(-31, 135);
      c.moveTo(b1x, b1y);
      c.lineTo(b2x, b2y);
      c.lineTo(b3x, b3y);
      c.lineTo(b4x, b4y);
      c.closePath();
      c.fill();
      c.stroke();

      // Lower jewel & mount
      const [jx1, jy1] = pt(0, 135);
      const [jx2, jy2] = pt(0, 147);
      c.strokeStyle = "#384d64";
      c.lineWidth = Math.max(2, 3 * s);
      c.beginPath();
      c.moveTo(jx1, jy1);
      c.lineTo(jx2, jy2);
      c.stroke();

      const [jx, jy] = pt(0, 151);
      const jr = Math.max(3, 5 * s);
      c.fillStyle = "#11233a";
      c.strokeStyle = "#3d546c";
      c.lineWidth = Math.max(1, 2 * s);
      c.beginPath();
      c.arc(jx, jy, jr, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.restore();
    };

    const render = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const t = elapsed;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Adaptive center position matching the landing page hero
      const isMobile = width < 768;
      const cx = isMobile ? width * 0.5 : width * 0.565;
      const cy = isMobile ? height * 0.42 : height * 0.485;
      const baseScale = isMobile ? Math.min(width / 500, 0.78) : Math.min(width / 1400, 1.0);

      // ── Background with Vignette & Center Warmth ──
      ctx.fillStyle = "#050d1a";
      ctx.fillRect(0, 0, width, height);

      // Vignette radial gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.85);
      bgGrad.addColorStop(0, "rgba(17, 30, 52, 0.95)");
      bgGrad.addColorStop(0.5, "rgba(9, 18, 33, 0.98)");
      bgGrad.addColorStop(1, "rgba(4, 8, 16, 1)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Warm halo parameters
      const warmStrength = ease((t - 0.42) / 0.66) * (1.0 - ease((t - 3.78) / 0.46));
      const flicker = 0.9 + 0.1 * Math.sin(t * 8.5) + 0.035 * Math.sin(t * 18.0);

      // Ambient radial warm halo behind lantern
      if (warmStrength > 0) {
        const haloR = 260 * baseScale * flicker;
        const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        haloGrad.addColorStop(0, `rgba(245, 158, 11, ${0.45 * warmStrength * flicker})`);
        haloGrad.addColorStop(0.35, `rgba(217, 119, 6, ${0.2 * warmStrength * flicker})`);
        haloGrad.addColorStop(0.7, `rgba(180, 83, 9, ${0.06 * warmStrength})`);
        haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 1. Radio Frequency Sweep (t = 0.12s to 0.98s) ──
      const sweep = ease((t - 0.12) / 0.86);
      if (sweep > 0 && sweep < 1.0) {
        const sy = isMobile ? height * 0.75 : height * 0.72;
        const startX = width * 0.12;
        const endX = width * 0.88;
        const sx = width * (0.14 + 0.72 * sweep);
        const sweepAlpha = Math.max(0, 1.0 - Math.abs(sweep - 0.52) * 0.35);

        // Faint baseline
        ctx.strokeStyle = "rgba(231, 151, 24, 0.18)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX, sy);
        ctx.lineTo(endX, sy);
        ctx.stroke();

        // Highlight sweep beam
        const beamGrad = ctx.createLinearGradient(sx - 90, sy, sx + 90, sy);
        beamGrad.addColorStop(0, "rgba(255, 180, 57, 0)");
        beamGrad.addColorStop(0.5, `rgba(255, 195, 80, ${sweepAlpha * 0.9})`);
        beamGrad.addColorStop(1, "rgba(255, 180, 57, 0)");
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx - 90, sy);
        ctx.lineTo(sx + 90, sy);
        ctx.stroke();

        // Active tuning frequency bead
        ctx.fillStyle = `rgba(255, 235, 175, ${sweepAlpha})`;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ── 2. Concentric Amber Broadcast Ripples (t = 0.72s to 3.6s) ──
      if (t < 3.6 && warmStrength > 0) {
        for (const phaseOffset of [0.0, 0.48]) {
          const phase = ((t - 0.72 - phaseOffset) % 1.18) / 1.18;
          if (phase >= 0.0 && phase <= 1.0) {
            const radius = (34 + 210 * phase) * baseScale;
            const rAlpha = Math.max(0, 0.42 * (1.0 - phase) * warmStrength);
            ctx.strokeStyle = `rgba(255, 172, 50, ${rAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(cx, cy, radius, radius * 0.88, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // ── 3. Lantern Elevation & Ignition (t > 0.45s) ──
      const lanternReveal = ease((t - 0.53) / 0.8);
      if (lanternReveal > 0) {
        const currentScale = (0.72 + 0.28 * lanternReveal) * baseScale;
        const lanternY = cy + (1.0 - lanternReveal) * 28;

        // Warm light pool beneath lamp
        if (warmStrength > 0) {
          const poolY = lanternY + 185 * currentScale;
          const poolW = 54 * currentScale * (0.9 + 0.1 * flicker);
          const poolH = 9 * currentScale;
          const poolGrad = ctx.createRadialGradient(cx, poolY, 0, cx, poolY, poolW);
          poolGrad.addColorStop(0, `rgba(224, 143, 22, ${0.45 * warmStrength * flicker})`);
          poolGrad.addColorStop(1, "rgba(224, 143, 22, 0)");
          ctx.fillStyle = poolGrad;
          ctx.beginPath();
          ctx.ellipse(cx, poolY, poolW, poolH, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        drawLantern(ctx, cx, lanternY, currentScale, warmStrength * flicker, flicker);
      }

      // ── 4. Brand Wordmark & Equalizer Meter (t = 1.48s to 3.7s) ──
      const logoAlpha = ease((t - 1.48) / 0.72) * (1.0 - ease((t - 3.66) / 0.34));
      if (logoAlpha > 0) {
        const rise = (1.0 - ease((t - 1.48) / 0.72)) * 14;
        const logoX = isMobile ? width * 0.5 : width * 0.32;
        const logoY = isMobile ? height * 0.72 + rise : height * 0.47 + rise;

        ctx.textAlign = isMobile ? "center" : "left";
        ctx.textBaseline = "middle";

        // Wordmark: "Lantern.fm"
        ctx.fillStyle = `rgba(236, 239, 245, ${logoAlpha})`;
        const titleFontSize = Math.round(isMobile ? 38 : Math.min(width * 0.042, 64));
        ctx.font = `600 ${titleFontSize}px var(--font-fraunces), serif`;
        ctx.fillText("Lantern.fm", logoX, logoY);

        // Subtitle: "AMBIENT RADIO FOR LATE-NIGHT CODERS"
        const subFontSize = isMobile ? 10 : 12;
        ctx.fillStyle = `rgba(130, 160, 195, ${logoAlpha * 0.9})`;
        ctx.font = `400 ${subFontSize}px var(--font-jetbrains), monospace`;
        ctx.letterSpacing = "0.22em";
        ctx.fillText("AMBIENT RADIO FOR LATE-NIGHT CODERS", logoX, logoY + (isMobile ? 32 : 46));
        ctx.letterSpacing = "0px";

        // 17-bar ambient audio equalizer meter
        const baseMeterY = logoY + (isMobile ? 64 : 95);
        const barCount = 17;
        const barSpacing = isMobile ? 8 : 11;
        const meterTotalW = barCount * barSpacing;
        const meterStartX = isMobile ? logoX - meterTotalW / 2 : logoX;

        for (let i = 0; i < barCount; i++) {
          const wave = 0.5 + 0.5 * Math.sin(t * 7.0 + i * 0.62) * Math.cos(i * 0.23);
          const barH = (8 + 38 * wave) * (isMobile ? 0.7 : 1);
          const bx = meterStartX + i * barSpacing;
          const barColor = `rgba(245, ${158 + Math.round(wave * 28)}, 11, ${logoAlpha * (0.6 + wave * 0.4)})`;

          ctx.fillStyle = barColor;
          ctx.beginPath();
          ctx.roundRect(bx, baseMeterY - barH, isMobile ? 3.5 : 5, barH, 2);
          ctx.fill();
        }
      }

      // ── 5. Golden Bloom Transition (t = 3.35s to 4.5s) ──
      const transition = ease((t - 3.35) / 1.13);
      if (transition > 0) {
        if (transition < 0.92) {
          const bloomAlpha = 0.65 * Math.sin((Math.PI * transition) / 0.92);
          const bloomRadius = (100 + 460 * transition) * baseScale;
          const bloomGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
          bloomGrad.addColorStop(0, `rgba(255, 190, 60, ${bloomAlpha})`);
          bloomGrad.addColorStop(0.45, `rgba(245, 158, 11, ${bloomAlpha * 0.4})`);
          bloomGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = bloomGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Trigger landing page transition at 4.4s or continue
      if (t >= 4.5) {
        completeIntro();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [completeIntro]);

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          key="intro-container"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "#050d1a",
            overflow: "hidden",
            cursor: "pointer",
          }}
          onClick={completeIntro}
          title="Click or press Space / Esc to skip intro"
        >
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
            }}
          />

          {/* Minimalist Skip / Hint Pill */}
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 28,
              zIndex: 10001,
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                completeIntro();
              }}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: 20,
                padding: "6px 14px",
                color: "#94a3b8",
                fontSize: 11,
                fontFamily: "var(--font-jetbrains), monospace",
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all .2s ease",
              }}
            >
              <span>Skip Intro</span>
              <span style={{ opacity: 0.6 }}>→</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
