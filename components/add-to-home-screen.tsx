"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  X,
  ExternalLink,
  Laptop,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
      setIsInstalled(Boolean(isStandaloneMode));
    };
    checkStandalone();

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canInstallNatively: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isStandalone,
    triggerInstall,
  };
}

interface AddToHomeScreenProps {
  color: string;
  rgb: string;
  theme: {
    card: string;
    cardB: string;
    text: string;
    textMuted: string;
    sidebarB: string;
  };
  compact?: boolean;
}

export function AddToHomeScreenCard({
  color,
  rgb,
  theme: T,
  compact = false,
}: AddToHomeScreenProps) {
  const { canInstallNatively, isInstalled, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  // If already running inside standalone app, show subtle status
  if (isStandalone) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 8,
          background: `rgba(${rgb}, 0.06)`,
          border: `1px solid ${T.cardB}`,
          fontSize: 10,
          fontFamily: "var(--font-jetbrains), monospace",
          color: T.textMuted,
        }}
      >
        <CheckCircle2 size={12} color="#22C55E" />
        <span>Lantern App Active</span>
      </div>
    );
  }

  const handleClick = async () => {
    if (canInstallNatively) {
      const handled = await triggerInstall();
      if (!handled) setShowInstructions(true);
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        style={{
          width: "100%",
          padding: compact ? "8px 10px" : "11px 14px",
          borderRadius: 10,
          background: `linear-gradient(135deg, rgba(${rgb}, 0.12) 0%, rgba(${rgb}, 0.04) 100%)`,
          border: `1px solid rgba(${rgb}, 0.25)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
          transition: "all .2s ease",
        }}
        title="Add Lantern.fm to your device home screen or desktop"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `rgba(${rgb}, 0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
              flexShrink: 0,
            }}
          >
            <Smartphone size={15} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: T.text,
                lineHeight: 1.2,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              Add to Home Screen
            </div>
            {!compact && (
              <div
                style={{
                  fontSize: 10,
                  color: T.textMuted,
                  marginTop: 2,
                  fontFamily: "var(--font-jetbrains), monospace",
                }}
              >
                Instant app access · No store needed
              </div>
            )}
          </div>
        </div>

        <Download size={14} color={color} style={{ flexShrink: 0 }} />
      </motion.button>

      {/* Instructional Modal for iOS and Desktop */}
      <AnimatePresence>
        {showInstructions && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            onClick={() => setShowInstructions(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: 18,
                background: "#081120",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "24px 22px",
                color: "#f1f5f9",
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                aria-label="Close"
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  display: "flex",
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `rgba(${rgb}, 0.16)`,
                    border: `1px solid ${color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <img src="/Lantern.svg" alt="Lantern logo" style={{ width: 22, height: 26 }} />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    Install Lantern.fm
                  </h3>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      margin: "3px 0 0",
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  >
                    Standalone Web Application
                  </p>
                </div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1", marginBottom: 18 }}>
                Experience Lantern.fm in pure fullscreen mode with seamless background audio playback,
                custom dock icons, and instant offline launch.
              </p>

              {/* iOS Safari Instructions */}
              {isIOS ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: 12,
                    padding: 14,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: color,
                        color: "#050d1a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </div>
                    <span style={{ fontSize: 12.5, color: "#e2e8f0" }}>
                      Tap the <strong>Share</strong> button <Share size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> in Safari toolbar.
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: color,
                        color: "#050d1a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      2
                    </div>
                    <span style={{ fontSize: 12.5, color: "#e2e8f0" }}>
                      Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} />.
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: 12,
                    padding: 14,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Laptop size={16} color={color} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#e2e8f0" }}>
                      In <strong>Chrome, Edge, or Brave</strong>: Click the install icon (
                      <Download size={11} style={{ display: "inline", margin: "0 1px" }} />) in the address bar.
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Smartphone size={16} color={color} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#e2e8f0" }}>
                      In <strong>Android Chrome</strong>: Tap the menu (⋮) → <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowInstructions(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 9,
                    background: color,
                    border: "none",
                    color: "#050d1a",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity .2s",
                  }}
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function AddToHomeScreenHeaderButton({
  color,
  rgb,
  theme: T,
}: {
  color: string;
  rgb: string;
  theme: { cardB: string; textMuted: string; text: string };
}) {
  const { isStandalone } = usePWAInstall();
  if (isStandalone) return null;

  return (
    <AddToHomeScreenCard
      color={color}
      rgb={rgb}
      theme={{
        card: "transparent",
        cardB: T.cardB,
        text: T.text,
        textMuted: T.textMuted,
        sidebarB: T.cardB,
      }}
      compact
    />
  );
}
