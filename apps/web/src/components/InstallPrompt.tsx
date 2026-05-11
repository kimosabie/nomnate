"use client";

import { useEffect, useState } from "react";

type Mode = "android" | "ios" | null;

const STORAGE_KEY = "nomnate_install_dismissed";

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

    if (isIOS) {
      setMode("ios");
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
      setMode("android");
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setMode(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    setMode(null);
  }

  if (!mode) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 998,
        background: "#E8621A", color: "#fff",
        borderRadius: "14px 14px 0 0",
        padding: "14px 16px",
        boxShadow: "0 -2px 16px rgba(232,98,26,0.3)",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <span style={{ fontSize: 22 }}>📱</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>Add NomNate to your home screen</p>
        {mode === "ios" ? (
          <p style={{ fontSize: 11, opacity: 0.85, margin: "2px 0 0" }}>
            Tap Share then &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <button
            onClick={install}
            style={{
              marginTop: 6, background: "#fff", color: "#E8621A",
              border: "none", borderRadius: 50, padding: "5px 14px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Install
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", opacity: 0.8, lineHeight: 1 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
