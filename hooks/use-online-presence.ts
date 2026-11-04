"use client";

import { useEffect, useRef, useState } from "react";

const HEARTBEAT_INTERVAL_MS = 15_000;
const CLIENT_STORAGE_KEY = "lantern_builder_session_id";

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "ssr_builder";
  try {
    let id = sessionStorage.getItem(CLIENT_STORAGE_KEY);
    if (!id) {
      id = `builder_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      sessionStorage.setItem(CLIENT_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `builder_${Math.random().toString(36).substring(2, 10)}`;
  }
}

export function useOnlinePresence() {
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    const clientId = getOrCreateClientId();
    clientIdRef.current = clientId;

    let isMounted = true;

    const sendHeartbeat = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, action: "heartbeat" }),
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.count === "number") {
            setOnlineCount(Math.max(1, data.count));
            setIsLoading(false);
          }
        }
      } catch (err) {
        // Silently tolerate temporary network glitch
      }
    };

    // Immediate ping on mount
    void sendHeartbeat();

    // Periodic heartbeat
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Leave notification when tab is closed
    const handleLeave = () => {
      const url = `/api/presence?action=leave&clientId=${encodeURIComponent(clientId)}`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, JSON.stringify({ clientId, action: "leave" }));
      } else {
        fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", handleLeave);
    window.addEventListener("beforeunload", handleLeave);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleLeave);
      window.removeEventListener("beforeunload", handleLeave);
      handleLeave();
    };
  }, []);

  return { onlineCount, isLoading };
}

