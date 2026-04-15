// src/components/SessionReportModal.tsx

import { useEffect, useRef, useState } from "react";
import { useIsMobileLandscape } from "../hooks/useMediaQuery";
import { useLocale, useT } from "../i18n";
import type { SessionSummary } from "../report/sessionLog";
import { emailReport, shareReport } from "../report/shareReport";
import type { ModalAutopilotControls } from "../hooks/useAutopilot";

const EGGS_PER_LEVEL = 2;
const EGG_INDICES = Array.from({ length: EGGS_PER_LEVEL }, (_, i) => i);

function LevelCompleteReportActions({
  summary,
  isMobileLandscape,
  demoMode = false,
  autopilotControlsRef,
}: {
  summary: SessionSummary;
  isMobileLandscape: boolean;
  demoMode?: boolean;
  autopilotControlsRef?: React.MutableRefObject<ModalAutopilotControls | null>;
}) {
  const t = useT();
  const [generating, setGenerating] = useState(false);
  const [shareEmail, setShareEmail] = useState(() => {
    try { return localStorage.getItem("reportEmail") || ""; } catch { return ""; }
  });
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const totalEggs = summary.normalEggs + summary.monsterEggs;
  const canEmailReport = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail.trim());

  // Ref so autopilot always calls the latest handleEmailSend
  const handleEmailSendRef = useRef<() => void>(() => {});

  async function handleEmailSend() {
    if (!canEmailReport || generating) return;
    setGenerating(true);
    setEmailFeedback(null);
    setEmailError(false);
    try {
      await emailReport(summary, shareEmail);
      setEmailFeedback(t("report.sendSuccess", { email: shareEmail.trim() }));
    } catch (error) {
      console.error("Email send failed:", error);
      setEmailError(true);
      setEmailFeedback(
        error instanceof Error ? error.message : t("report.sendFail"),
      );
    } finally {
      setGenerating(false);
    }
  }

  handleEmailSendRef.current = handleEmailSend;

  // Expose controls to autopilot
  useEffect(() => {
    if (!autopilotControlsRef) return;
    autopilotControlsRef.current = {
      appendChar: (ch) => {
        setShareEmail(prev => {
          const v = prev + ch;
          try { localStorage.setItem("reportEmail", v); } catch { /* ignore */ }
          return v;
        });
        setEmailFeedback(null);
        setEmailError(false);
      },
      setEmail: (v) => {
        setShareEmail(v);
        try { localStorage.setItem("reportEmail", v); } catch { /* ignore */ }
        setEmailFeedback(null);
        setEmailError(false);
      },
      triggerSend: () => handleEmailSendRef.current(),
    };
    return () => {
      if (autopilotControlsRef) autopilotControlsRef.current = null;
    };
  // autopilotControlsRef is a stable ref object — only run on mount/unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    setGenerating(true);
    try {
      await shareReport(summary);
    } catch (error) {
      console.error("Report share failed:", error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto mt-5 w-full max-w-xl">
      {demoMode ? (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-left text-sm font-bold text-white"
          style={{
            background: "#09104c",
            border: "1px solid rgba(96, 165, 250, 0.75)",
          }}
        >
          Enter your email to receive your report.
        </div>
      ) : null}
      {!isMobileLandscape && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-emerald-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("report.score")}
            </div>
            <div className="mt-1 text-xl font-black text-emerald-300 md:text-2xl">
              {summary.correctCount}/{summary.totalQuestions}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("report.accuracy")}
            </div>
            <div className="mt-1 text-xl font-black text-yellow-300 md:text-2xl">
              {summary.accuracy}%
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("report.eggs")}
            </div>
            <div className="mt-1 text-xl font-black text-fuchsia-300 md:text-2xl">
              {totalEggs}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={generating}
          className="arcade-button relative shrink-0 px-3 py-3 text-sm md:px-5 md:text-base"
          style={{
            borderColor: "#fbbf24",
            opacity: generating ? 0.6 : 1,
            cursor: generating ? "not-allowed" : "pointer",
          }}
        >
          {/* Always render "Share Report" to fix the button width; overlay "Creating..." on top */}
          <span className={generating ? "invisible" : ""}>{t("report.shareReport")}</span>
          {generating && <span className="absolute inset-0 flex items-center justify-center">{t("report.creating")}</span>}
        </button>
        <input
          type="email"
          data-autopilot-key="email-input"
          value={shareEmail}
          onChange={(event) => {
            const v = event.target.value;
            setShareEmail(v);
            try { localStorage.setItem("reportEmail", v); } catch { /* ignore */ }
            if (emailFeedback) {
              setEmailFeedback(null);
              setEmailError(false);
            }
          }}
          placeholder={
            demoMode ? "Enter your email to receive your report" : t("report.emailPlaceholder")
          }
          className="min-w-0 flex-1 rounded-2xl border-2 border-cyan-300 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-200"
        />
        <button
          type="button"
          data-autopilot-key="email-send"
          onClick={handleEmailSend}
          disabled={!canEmailReport || generating}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400 text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:opacity-100"
          aria-label={t("report.emailAria")}
          title={canEmailReport ? t("report.sendTitle") : t("report.enterEmail")}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="m22 2-7 20-4-9-9-4Z" />
          </svg>
        </button>
      </div>
      <div className={`mt-2 text-sm font-semibold ${emailError ? "text-rose-300" : "text-emerald-300"} ${emailFeedback ? "" : "invisible"}`}>
        {emailFeedback ?? "\u00a0"}
      </div>
    </div>
  );
}

interface Props {
  summary: SessionSummary;
  level: number;
  onClose: () => void;
  onNextLevel?: () => void;
  demoMode?: boolean;
  /** When provided (autopilot mode), exposes email controls to the autopilot engine */
  autopilotControlsRef?: React.MutableRefObject<ModalAutopilotControls | null>;
}

export default function SessionReportModal({ summary, level, onClose, onNextLevel, demoMode = false, autopilotControlsRef }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const isMobileLandscape = useIsMobileLandscape();
  const headingClasses = locale === "en"
    ? "text-4xl font-black uppercase tracking-[0.18em] text-yellow-300 md:text-5xl"
    : "font-i18n text-4xl font-black tracking-[0.06em] text-yellow-300 md:text-5xl";

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(15,23,42,0.985) 0%, rgba(2,6,23,0.995) 78%)",
      }}
    >
      <div
        className={`arcade-panel w-full text-center ${
          isMobileLandscape
            ? "h-full max-w-none rounded-none border-0 p-6"
            : "max-w-3xl p-6 md:p-10"
        }`}
        style={{
          background: isMobileLandscape
            ? "rgba(15, 23, 42, 0.97)"
            : "rgba(15, 23, 42, 0.8)",
          border: isMobileLandscape ? "none" : undefined,
        }}
      >
        <div className={headingClasses}>
          {t("report.levelComplete", { level })}
        </div>
        <div className="font-i18n mt-2 text-base font-bold text-purple-300 md:text-lg">
          {t("report.subheading")}
        </div>
        <div className="mt-4 flex items-center justify-center gap-1">
          {EGG_INDICES.map((i) => (
            <svg
              key={i}
              viewBox="0 0 512 512"
              width={isMobileLandscape ? "18" : "24"}
              height={isMobileLandscape ? "18" : "24"}
              style={{
                filter:
                  "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))",
              }}
            >
              <path
                d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                fill="#facc15"
                stroke="#fbbf24"
                strokeWidth="18"
              />
              <ellipse
                cx="190"
                cy="150"
                rx="35"
                ry="60"
                fill="#fef08a"
                opacity="0.4"
                transform="rotate(-20 190 150)"
              />
            </svg>
          ))}
        </div>

        <LevelCompleteReportActions
          summary={summary}
          isMobileLandscape={isMobileLandscape}
          demoMode={demoMode}
          autopilotControlsRef={autopilotControlsRef}
        />

        <div className="mt-6 flex flex-col items-center gap-3">
          {level < 2 && onNextLevel && (
            <button
              onClick={onNextLevel}
              data-autopilot-key="next-level"
              className="arcade-button px-8 py-4 text-base md:text-lg"
            >
              {t("report.nextLevel")}
            </button>
          )}
          {level >= 2 && (
            <button
              onClick={onClose}
              className="arcade-button px-8 py-4 text-base md:text-lg"
            >
              {t("report.playAgain")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
