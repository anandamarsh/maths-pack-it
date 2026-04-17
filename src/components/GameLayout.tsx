import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  useIsCoarsePointer,
  useIsMobileLandscape,
} from "../hooks/useMediaQuery";
import { GAME_STORAGE_PREFIX, getGameShareUrl } from "../config/game";
import { useT } from "../i18n";
import { SocialComments, SocialShare, openCommentsComposer } from "./Social";
import AudioButton from "./AudioButton";
import AutopilotIcon from "./AutopilotIcon";
import LanguageSwitcher from "./LanguageSwitcher";
import LevelButtons from "./LevelButtons";
import NumericKeypad from "./NumericKeypad";
import QuestionBox from "./QuestionBox";

const YOUTUBE_BUBBLE_DISMISSED_KEY =
  `${GAME_STORAGE_PREFIX}:youtube-bubble-dismissed`;
const YOUTUBE_ICON_URL = "/youtube-circle-logo-svgrepo-com.svg";

function readYouTubeBubbleDismissed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(YOUTUBE_BUBBLE_DISMISSED_KEY) === "true";
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const videoId = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.replace(/^\/+/, "")
      : (parsed.searchParams.get("v") ??
        (parsed.pathname.startsWith("/shorts/")
          ? parsed.pathname.split("/")[2]
          : null));
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

interface GameLayoutProps {
  // Controls
  muted: boolean;
  onToggleMute: () => void;
  onRestart?: () => void;

  // Keypad — fully controlled; pass onChange to make buttons live
  keypadValue: string;
  onKeypadChange?: (v: string) => void;
  onKeypadKeyInput?: (key: string) => boolean;
  onKeypadSubmit?: () => void;
  onKeypadEnterPress?: () => boolean;
  canSubmit?: boolean;
  demoBanner?: ReactNode;
  calculatorTopBanner?: ReactNode;
  chromeTheme?: {
    questionBoxStyle?: CSSProperties;
    calculatorBannerStyle?: CSSProperties;
    keypadTheme?: {
      panelBackground?: string;
      panelBorder?: string;
      panelGlow?: string;
      displayBorder?: string;
      displayColor?: string;
      displayGlow?: string;
    };
  };
  hideKeypad?: boolean;

  // Question bar (optional)
  question?: ReactNode;
  questionPanel?:
    | ReactNode
    | ((state: {
        calculatorMinimized: boolean;
        toggleCalculatorMinimized: () => void;
      }) => ReactNode);
  questionShake?: boolean;

  // Progress dots (optional)
  progress?: number;
  progressTotal?: number;

  // Level buttons (optional)
  levelCount?: number;
  currentLevel?: number;
  unlockedLevel?: number;
  onLevelSelect?: (level: number) => void;

  // Dev-only screenshot capture
  onCapture?: () => void;
  onToggleSquareSnip?: () => void;
  squareSnipActive?: boolean;
  // Dev-only demo video recording
  onRecordDemo?: () => void;
  isRecordingDemo?: boolean;

  // Autopilot
  isAutopilot?: boolean;
  onCancelAutopilot?: () => void;
  isQuestionDemo?: boolean;
  onQuestionDemo?: () => void;

  // Forces keypad to stay expanded (used by autopilot when typing)
  forceKeypadExpanded?: boolean;
  autoExpandCalculator?: boolean;
  sceneBackdrop?: ReactNode;
  mobileMinimizeResetKey?: string | number;
  mobileWrongAnswerRevealKey?: string | number;
  desktopDragActive?: boolean;

  // Game canvas
  children:
    | ReactNode
    | ((state: {
        calculatorMinimized: boolean;
        toggleCalculatorMinimized: () => void;
      }) => ReactNode);
}

export default function GameLayout({
  muted,
  onToggleMute,
  onRestart,
  keypadValue,
  onKeypadChange,
  onKeypadKeyInput,
  onKeypadSubmit,
  onKeypadEnterPress,
  canSubmit = false,
  demoBanner,
  calculatorTopBanner,
  chromeTheme,
  hideKeypad = false,
  question,
  questionShake = false,
  progress,
  progressTotal,
  levelCount,
  currentLevel,
  unlockedLevel,
  onLevelSelect,
  onCapture,
  onToggleSquareSnip,
  squareSnipActive = false,
  onRecordDemo,
  isRecordingDemo = false,
  isQuestionDemo = false,
  onQuestionDemo,
  forceKeypadExpanded = false,
  autoExpandCalculator = false,
  sceneBackdrop,
  mobileMinimizeResetKey,
  mobileWrongAnswerRevealKey,
  desktopDragActive = false,
  children,
  questionPanel,
}: GameLayoutProps) {
  const t = useT();
  const isMobileLandscape = useIsMobileLandscape();
  const isCoarsePointer = useIsCoarsePointer();
  // Minimized by default on touch devices; expanded by default on desktop
  const [calcMinimized, setCalcMinimized] = useState(
    () => isMobileLandscape || isCoarsePointer,
  );
  // Effective minimized state: autopilot forces expansion when needed
  const effectiveCalcMinimized = forceKeypadExpanded ? false : calcMinimized;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareDrawerOpen, setShareDrawerOpen] = useState(false);
  const [youtubeBubbleDismissed, setYoutubeBubbleDismissed] = useState(
    readYouTubeBubbleDismissed,
  );
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const pendingSubmitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/manifest.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load manifest (${response.status})`);
        }
        return response.json() as Promise<{ videoUrl?: unknown }>;
      })
      .then((manifest) => {
        if (cancelled) return;
        const rawVideoUrl =
          typeof manifest.videoUrl === "string" ? manifest.videoUrl.trim() : "";
        setYoutubeEmbedUrl(rawVideoUrl ? toYouTubeEmbedUrl(rawVideoUrl) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setYoutubeEmbedUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pendingSubmitTimerRef.current !== null) {
        window.clearTimeout(pendingSubmitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      YOUTUBE_BUBBLE_DISMISSED_KEY,
      youtubeBubbleDismissed ? "true" : "false",
    );
  }, [youtubeBubbleDismissed]);

  useEffect(() => {
    if (isMobileLandscape) {
      setCalcMinimized(true);
    }
  }, [isMobileLandscape, mobileMinimizeResetKey]);

  useEffect(() => {
    if (isMobileLandscape) {
      setCalcMinimized(true);
    }
  }, [isMobileLandscape, mobileWrongAnswerRevealKey]);

  useEffect(() => {
    if (autoExpandCalculator) {
      setCalcMinimized(false);
    }
  }, [autoExpandCalculator]);

  useEffect(() => {
    if (!desktopDragActive || isMobileLandscape || isCoarsePointer) {
      return;
    }

    setCalcMinimized(true);
  }, [desktopDragActive, isMobileLandscape, isCoarsePointer]);

  function toggleCalc() {
    setCalcMinimized((m) => !m);
  }

  function handleKeypadSubmit() {
    if (pendingSubmitTimerRef.current !== null) {
      return;
    }

    if (isCoarsePointer && !effectiveCalcMinimized && !forceKeypadExpanded) {
      setCalcMinimized(true);
      pendingSubmitTimerRef.current = window.setTimeout(() => {
        pendingSubmitTimerRef.current = null;
        onKeypadSubmit?.();
      }, 320);
      return;
    }

    onKeypadSubmit?.();
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("social.shareTitle"),
          url: getGameShareUrl(),
        });
      } catch {
        /* dismissed */
      }
    } else {
      setShareDrawerOpen((o) => !o);
    }
  }

  const dots =
    progress !== undefined && progressTotal !== undefined
      ? Array.from({ length: progressTotal }, (_, i) => i < progress)
      : null;
  const dockHeight = effectiveCalcMinimized
    ? "4.5rem"
    : isMobileLandscape
      ? "19rem"
      : calculatorTopBanner
        ? "17.9rem"
        : "15.25rem";
  const dockTransition = "320ms cubic-bezier(0.22,0.72,0.2,1)";
  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col arcade-grid"
      style={{ background: "#020617" }}
    >
      {sceneBackdrop ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {sceneBackdrop}
        </div>
      ) : null}

      {/* ── Comments drawer ──────────────────────────────────────────────── */}
      {commentsOpen && (
        <div
          className="social-backdrop"
          onClick={() => setCommentsOpen(false)}
        />
      )}
      <div
        className={`social-comments-drawer social-drawer ${commentsOpen ? "is-open" : ""}`}
      >
        <div className="social-drawer-header">
          {/* Add Comment on the left — opens compose area inside the iframe */}
          <button
            className="social-new-comment"
            onClick={() => openCommentsComposer()}
          >
            {t("toolbar.addComment")}
          </button>
          <button
            className="social-drawer-close"
            onClick={() => setCommentsOpen(false)}
          >
            <svg
              className="social-close-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="social-comments-shell">
          <SocialComments />
        </div>
      </div>

      {/* ── Share fallback drawer (desktop without navigator.share) ─────── */}
      {shareDrawerOpen && (
        <div
          className="social-backdrop"
          onClick={() => setShareDrawerOpen(false)}
        />
      )}
      <div
        className={`social-share-drawer social-drawer ${shareDrawerOpen ? "is-open" : ""}`}
      >
        <div className="social-drawer-header">
          <h2 className="m-0 text-sm font-black uppercase tracking-wider">
            {t("toolbar.share")}
          </h2>
          <button
            className="social-drawer-close"
            onClick={() => setShareDrawerOpen(false)}
          >
            <svg
              className="social-close-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SocialShare />
      </div>

      {youtubeModalOpen && youtubeEmbedUrl && (
        <>
          <div
            className="social-backdrop social-video-backdrop"
            onClick={() => setYoutubeModalOpen(false)}
          />
          <div
            className="social-video-modal"
            role="dialog"
            aria-modal="true"
            aria-label="How to play video"
          >
            <button
              type="button"
              className="social-video-modal-close"
              aria-label="Close how to play video"
              onClick={() => setYoutubeModalOpen(false)}
            >
              <CloseIcon
                className="social-video-modal-close-icon"
                aria-hidden="true"
              />
            </button>
            <iframe
              src={youtubeEmbedUrl}
              title="How to play video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </>
      )}

      {/* ── Top bar overlay ─────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-[60] h-20 pointer-events-none">
        <div className="absolute left-2 top-2 flex items-center gap-1.5 z-[62] pointer-events-auto">
          <div className="w-10 h-10 shrink-0" aria-hidden="true" />

          {onRestart && (
            <button
              onClick={onRestart}
              title={t("toolbar.restart")}
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-full h-full"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}

          <AudioButton muted={muted} onToggle={onToggleMute} />

          {onCapture && (
            <button
              onClick={onCapture}
              title={t("toolbar.screenshot")}
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-full h-full"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          )}

          {onToggleSquareSnip && (
            <button
              onClick={onToggleSquareSnip}
              title={
                squareSnipActive
                  ? "Hide square snip tool"
                  : "Show square snip tool"
              }
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
              style={
                squareSnipActive
                  ? {
                      background: "linear-gradient(180deg,#0369a1,#075985)",
                      borderColor: "#38bdf8",
                    }
                  : undefined
              }
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <rect
                  x="4.5"
                  y="4.5"
                  width="15"
                  height="15"
                  rx="2"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="2.5 2.5"
                />
                <path
                  d="M8.5 9.5h1.3l.8-1.4h2.8l.8 1.4h1.3a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-7a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z"
                  stroke="white"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="13"
                  r="1.9"
                  stroke="white"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
          )}

          {onRecordDemo && !isRecordingDemo && (
            <button
              onClick={onRecordDemo}
              title="Record demo video"
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-full h-full"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="13" height="16" rx="2" />
                <path d="m22 7-5 3.5V14l5 3.5Z" />
              </svg>
            </button>
          )}
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 z-[61] flex flex-col items-center gap-1.5 pointer-events-auto"
          style={{ top: "0.5rem" }}
        >
          {levelCount !== undefined &&
            currentLevel !== undefined &&
            unlockedLevel !== undefined &&
            onLevelSelect && (
              <LevelButtons
                levelCount={levelCount}
                currentLevel={currentLevel}
                unlockedLevel={unlockedLevel}
                onSelect={onLevelSelect}
              />
            )}

          {dots && (
            <div className="flex items-center justify-center gap-1.5">
              {dots.map((filled, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-300"
                  style={{
                    background: filled ? "#67e8f9" : "transparent",
                    borderColor: filled ? "#67e8f9" : "rgba(255,255,255,0.26)",
                    boxShadow: filled
                      ? "0 0 8px rgba(103,232,249,0.8)"
                      : undefined,
                    transform: filled ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="social-launchers pointer-events-auto"
          style={!isCoarsePointer ? { top: "0.5rem" } : undefined}
        >
          <LanguageSwitcher />

          {onQuestionDemo && (
            <AutopilotIcon
              onClick={onQuestionDemo}
              active={isQuestionDemo}
              title={t("toolbar.showSolve")}
              ariaLabel={t("toolbar.showSolve")}
            />
          )}

          <button
            onClick={handleShare}
            title={t("toolbar.share")}
            className={`social-launcher arcade-button ${shareDrawerOpen ? "is-active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="social-launcher-icon"
            >
              <circle cx="18" cy="5" r="3" stroke="white" strokeWidth="2" />
              <circle cx="6" cy="12" r="3" stroke="white" strokeWidth="2" />
              <circle cx="18" cy="19" r="3" stroke="white" strokeWidth="2" />
              <line
                x1="8.59"
                y1="13.51"
                x2="15.42"
                y2="17.49"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="15.41"
                y1="6.51"
                x2="8.59"
                y2="10.49"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            onClick={() => setCommentsOpen((o) => !o)}
            title={t("toolbar.comments")}
            className={`social-launcher arcade-button ${commentsOpen ? "is-active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="social-launcher-icon"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {youtubeEmbedUrl && (
            <div className="social-video-cta">
              {!youtubeBubbleDismissed && false && (
                <div
                  className="social-video-bubble"
                  role="complementary"
                  aria-label="How to play video prompt"
                >
                  <button
                    type="button"
                    className="social-video-bubble-link"
                    onClick={() => setYoutubeModalOpen(true)}
                  >
                    <span className="social-video-bubble-icon-shell">
                      <img
                        src={YOUTUBE_ICON_URL}
                        alt="YouTube"
                        className="social-launcher-icon social-launcher-image"
                      />
                    </span>
                    <span className="social-video-bubble-copy">
                      {t("social.youtubePrompt")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="social-video-bubble-dismiss"
                    onClick={() => setYoutubeBubbleDismissed(true)}
                  >
                    {t("social.youtubeDismiss")}
                  </button>
                </div>
              )}

              <button
                type="button"
                title="Watch how to play"
                aria-label="Watch how to play"
                className={`social-video-button ${youtubeModalOpen ? "is-active" : ""}`}
                onClick={() => setYoutubeModalOpen(true)}
              >
                <img
                  src={YOUTUBE_ICON_URL}
                  alt="YouTube"
                  className="social-launcher-icon social-launcher-image"
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Rest: canvas (absolute) + floating bottom bar ───────────────── */}
      <div className="relative z-[1] flex-1 min-h-0 mx-0 mb-0">
        {/* Canvas — always fills the full rest area */}
        <div
          className="absolute left-0 right-0 top-0 overflow-hidden"
          style={{
            bottom: dockHeight,
            transition: `bottom ${dockTransition}`,
          }}
        >
          {typeof children === "function"
            ? children({
                calculatorMinimized: effectiveCalcMinimized,
                toggleCalculatorMinimized: toggleCalc,
              })
            : children}
        </div>

        {demoBanner ? (
          <div
            className={`pointer-events-none absolute z-[58] flex ${
              isMobileLandscape
                ? "bottom-20 left-0 top-0 w-12 items-center justify-start"
                : "left-2 right-2 top-2 justify-center"
            }`}
          >
            <div
              className={
                isMobileLandscape
                  ? "rounded-r-2xl rounded-l-none px-1.5 py-3 text-center"
                  : "max-w-2xl rounded-2xl px-5 py-1.5 text-center"
              }
              style={{
                background: "#09104c",
                border: "1px solid rgba(96, 165, 250, 0.75)",
                color: "#ffffff",
                boxShadow:
                  "0 0 24px rgba(96,165,250,0.38), 0 0 44px rgba(59,130,246,0.2)",
                writingMode: isMobileLandscape ? "vertical-rl" : undefined,
                textOrientation: isMobileLandscape ? "upright" : undefined,
              }}
            >
              {demoBanner}
            </div>
          </div>
        ) : null}

        {/* Bottom overlay — floats over canvas, anchored to bottom */}
        <div
          className="absolute z-[90] flex flex-row items-stretch gap-2 pointer-events-auto"
          style={{
            bottom: "3px",
            left: "2px",
            right: "2px",
            height: dockHeight,
            transition: `height ${dockTransition}`,
          }}
        >
          {/* Message box — same height as calculator, click = toggle */}
          {questionPanel !== undefined ? (
            <div className="flex-1 min-w-0 pointer-events-auto">
              {typeof questionPanel === "function"
                ? questionPanel({
                    calculatorMinimized: effectiveCalcMinimized,
                    toggleCalculatorMinimized: toggleCalc,
                  })
                : questionPanel}
            </div>
          ) : question !== undefined ? (
            <div className="flex-1 min-w-0 pointer-events-auto">
              <QuestionBox
                shake={questionShake}
                onClick={toggleCalc}
                style={chromeTheme?.questionBoxStyle}
              >
                {question}
              </QuestionBox>
            </div>
          ) : null}

          {/* Calculator */}
          {!hideKeypad && (
            <div className="flex h-full min-h-0 flex-col justify-end self-stretch pointer-events-auto">
              {calculatorTopBanner ? (
                <div
                  className="arcade-panel px-3 py-2 text-center text-[1rem] font-bold leading-tight text-white"
                  style={{
                    background: "rgba(250,204,21,0.12)",
                    borderColor: "#facc15",
                    borderWidth: "3px",
                    color: "#fde047",
                    marginBottom: "2px",
                    ...chromeTheme?.calculatorBannerStyle,
                  }}
                >
                  {calculatorTopBanner}
                </div>
              ) : null}
              <NumericKeypad
                value={keypadValue}
                onChange={onKeypadChange}
                onKeyInput={onKeypadKeyInput}
                onSubmit={handleKeypadSubmit}
                onEnterPress={onKeypadEnterPress}
                canSubmit={canSubmit}
                minimized={effectiveCalcMinimized}
                onToggleMinimized={toggleCalc}
                theme={chromeTheme?.keypadTheme}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
