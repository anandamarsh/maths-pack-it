import { useEffect, useState } from "react";
import { useT } from "../i18n";

function usePortraitMobile() {
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const [isPortrait, setIsPortrait] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: portrait)").matches
      : false
  );

  useEffect(() => {
    if (!isTouchDevice) return;

    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isTouchDevice]);

  return isTouchDevice && isPortrait;
}

export default function RotatePrompt() {
  const show = usePortraitMobile();
  const t = useT();

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage({ type: "interactive-maths:overlay-active", active: show }, "*");
  }, [show]);

  useEffect(() => {
    if (show) {
      (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
        ?.lock?.("landscape")
        ?.catch(() => {});
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#0d1b35",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ animation: "wobble 1.8s ease-in-out infinite" }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="35" y="10" width="50" height="80" rx="8" fill="#1e3a6e" stroke="#4a9eff" strokeWidth="3" />
          <rect x="41" y="22" width="38" height="55" rx="3" fill="#0d1b35" />
          <rect x="50" y="83" width="20" height="3" rx="1.5" fill="#4a9eff" />
          <path d="M 20 100 A 45 45 0 0 1 100 100" stroke="#4a9eff" strokeWidth="4" strokeLinecap="round" fill="none" strokeDasharray="8 4" />
          <polyline points="93,92 100,100 92,107" stroke="#4a9eff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>

      <div style={{ textAlign: "center", color: "#e0eeff", padding: "0 2rem" }}>
        <p style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.02em" }}>
          {t("rotate.heading")}
        </p>
        <p style={{ fontSize: "1rem", color: "#7aaad4", lineHeight: 1.5 }}>
          {t("rotate.subtext")}
        </p>
      </div>

      <style>{`
        @keyframes wobble {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(-25deg); }
          50%  { transform: rotate(20deg); }
          75%  { transform: rotate(-15deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
