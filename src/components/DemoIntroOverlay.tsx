// src/components/DemoIntroOverlay.tsx — Intro/outro slides for demo video recording

import { useEffect, useState } from "react";

export type SlideType = "intro" | "outro";

interface Props {
  type: SlideType;
  onComplete?: () => void;
  onFadeStart?: () => void;
  isStatic?: boolean;
}

const INTRO_HOLD_MS = 10000;
const OUTRO_HOLD_MS = 5000;
const INTRO_FADE_MS = 600;
const OUTRO_FADE_MS = 1200;

export default function DemoIntroOverlay({ type, onComplete, onFadeStart, isStatic = false }: Props) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (isStatic) {
      setOpacity(1);
      return;
    }

    const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;
    const holdMs = type === "intro" ? INTRO_HOLD_MS : OUTRO_HOLD_MS;
    const duration = holdMs + fadeMs;
    const fadeOutTimer = window.setTimeout(() => {
      onFadeStart?.();
      setOpacity(0);
    }, holdMs);
    const completeTimer = window.setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isStatic, type, onComplete, onFadeStart]);

  const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;

  return (
    <div
      data-testid={`demo-overlay-${type}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "all",
      }}
    >
      {type === "intro"
        ? (isStatic ? <IntroPromptFrame /> : <IntroFrame opacity={opacity} fadeMs={fadeMs} />)
        : <OutroFrame opacity={opacity} fadeMs={fadeMs} />}
    </div>
  );
}

function IntroPromptFrame() {
  return (
    <div
      data-testid="demo-intro-prompt"
      style={{
        position: "fixed",
        inset: 0,
        background: "#020617",
      }}
    />
  );
}

function IntroFrame({ opacity, fadeMs }: { opacity: number; fadeMs: number }) {
  return (
    <iframe
      title="Demo intro screen"
      data-testid="demo-intro-frame"
      src="/intro.html"
      style={{
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        background: "#020617",
        opacity,
        transition: `opacity ${fadeMs}ms ease-in-out`,
      }}
    />
  );
}

function OutroFrame({ opacity, fadeMs }: { opacity: number; fadeMs: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#020617" }}>
      <iframe
        title="Demo outro screen"
        data-testid="demo-outro-frame"
        src="/outro.html"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#020617",
          opacity,
          transition: `opacity ${fadeMs}ms ease-in-out`,
        }}
      />
    </div>
  );
}
