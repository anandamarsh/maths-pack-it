import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import GameLayout from "../components/GameLayout";
import { makeRound } from "../game/packItGame";
import type { PackQuestion, RoundName } from "../calculations/types.ts";
import {
  getLocalizedLevelOneBlackboardSteps,
  getLocalizedLevelOneQuestionText,
} from "../calculations/level-1/round-1.ts";
import {
  useIsCoarsePointer,
  useIsMobileLandscape,
} from "../hooks/useMediaQuery";
import { useLocale, useT } from "../i18n";
import {
  ensureAudioReady,
  isMuted,
  playCorrect,
  playDragStep,
  playLevelComplete,
  playRipple,
  playWrong,
  startMusic,
  toggleMute,
} from "../sound";

const ROUND_SEQUENCE: RoundName[] = ["load", "pack", "ship"];
const QUESTIONS_PER_ROUND = 10;

const L1_QUESTION_KEYWORDS = [
  "each",
  "every",
  "per",
  "hold",
  "holds",
  "total",
  "many",
  "in",
  "how",
  "would",
  "be",
  "times",
];
const L1_KEYWORD_PATTERN = L1_QUESTION_KEYWORDS.slice()
  .sort((a, b) => b.length - a.length)
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const L1_KEYWORD_REGEX = new RegExp(L1_KEYWORD_PATTERN, "giu");
const L1_KEYWORD_TEST_REGEX = new RegExp(`^(?:${L1_KEYWORD_PATTERN})$`, "iu");

function splitQuestionTokens(text: string) {
  const segments = text.match(
    /\d+|×|∴|÷|=|[A-Za-z]+|[\u0900-\u097F]+|[\u4E00-\u9FFF]+|\s+|./gu,
  );
  return segments ?? [text];
}

function renderHighlighted(text: string): ReactNode {
  return text
    .trim()
    .replace(L1_KEYWORD_REGEX, (match) => `\u0000${match}\u0000`)
    .split("\u0000")
    .flatMap((part) => splitQuestionTokens(part))
    .map((part, index) => {
      let color: string | undefined;
      if (/[=∴×÷]/.test(part)) color = "#86efac";
      else if (/\d/.test(part)) color = "#facc15";
      else if (L1_KEYWORD_TEST_REGEX.test(part)) color = "#facc15";
      return (
        <span key={`${index}-${part}`} style={color ? { color } : undefined}>
          {part}
        </span>
      );
    });
}

function ProgressDot({ state }: { state: "solved" | "mistake" | "pending" }) {
  const color =
    state === "solved" ? "#22c55e" : state === "mistake" ? "#ef4444" : "#475569";
  return (
    <span
      aria-hidden="true"
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        boxShadow:
          state === "pending"
            ? "inset 0 0 4px rgba(0,0,0,0.5)"
            : `0 0 8px ${color}aa`,
        transition: "background 200ms, box-shadow 200ms",
      }}
    />
  );
}

function L1ProgressBar({
  current,
  target,
  onOvershoot,
}: {
  current: number;
  target: number;
  onOvershoot: () => void;
}) {
  const ratio = target === 0 ? 0 : current / target;
  const state: "blue" | "green" | "red" =
    ratio > 1 ? "red" : ratio === 1 ? "green" : "blue";
  const color =
    state === "red" ? "#ef4444" : state === "green" ? "#22c55e" : "#3b82f6";
  const flash = state !== "blue";
  const prevRatioRef = useRef(ratio);
  useEffect(() => {
    if (prevRatioRef.current <= 1 && ratio > 1) onOvershoot();
    prevRatioRef.current = ratio;
  }, [ratio, onOvershoot]);
  const filledStyle: CSSProperties = {
    width: `${Math.min(ratio, 1) * 100}%`,
    background: color,
    height: "100%",
    borderRadius: 12,
    transition: "width 220ms ease-out, background 220ms",
    animation: flash
      ? "packit-l1-progress-flash 520ms ease-in-out infinite alternate"
      : "none",
    boxShadow: flash ? `0 0 18px ${color}` : undefined,
  };
  return (
    <div
      aria-label={`progress ${current} of ${target}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={current}
      style={{
        width: "100%",
        height: 18,
        borderRadius: 12,
        background: "rgba(15,23,42,0.78)",
        border: "1px solid rgba(71,85,105,0.6)",
        overflow: "hidden",
      }}
    >
      <div style={filledStyle} />
    </div>
  );
}

function TestTube({
  unitRate,
  itemEmoji,
  showPlus,
  showMinus,
  disabled,
  onPlus,
  onMinus,
  tubeWidth,
  tubeHeight,
  itemSize,
  ariaLabel,
}: {
  unitRate: number;
  itemEmoji: string;
  showPlus: boolean;
  showMinus: boolean;
  disabled: boolean;
  onPlus: () => void;
  onMinus: () => void;
  tubeWidth: number;
  tubeHeight: number;
  itemSize: number;
  ariaLabel: string;
}) {
  const items = Array.from({ length: unitRate }, (_, i) => i);
  return (
    <div
      aria-label={ariaLabel}
      style={{
        position: "relative",
        width: tubeWidth,
        height: tubeHeight,
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: `${tubeWidth * 0.45}px ${tubeWidth * 0.45}px ${tubeWidth * 0.55}px ${tubeWidth * 0.55}px`,
          background:
            "linear-gradient(180deg, rgba(148,163,184,0.12) 0%, rgba(15,23,42,0.88) 100%)",
          border: "2px solid rgba(148,163,184,0.55)",
          boxShadow:
            "inset 0 0 18px rgba(56,189,248,0.12), 0 4px 14px rgba(2,6,23,0.5)",
          opacity: disabled ? 0.55 : 1,
          transition: "opacity 160ms",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: `${itemSize * 0.25}px ${tubeWidth * 0.12}px ${tubeWidth * 0.18}px ${tubeWidth * 0.12}px`,
          display: "flex",
          flexDirection: "column-reverse",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 2,
          pointerEvents: "none",
        }}
      >
        {items.map((i) => (
          <span
            key={i}
            style={{
              fontSize: itemSize,
              lineHeight: 1,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}
          >
            {itemEmoji}
          </span>
        ))}
      </div>
      {showPlus && (
        <button
          type="button"
          onClick={onPlus}
          disabled={disabled}
          aria-label="Add tube"
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: disabled ? "#334155" : "#2563eb",
            border: "2px solid white",
            color: "white",
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1,
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: "0 4px 10px rgba(2,6,23,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          +
        </button>
      )}
      {showMinus && (
        <button
          type="button"
          onClick={onMinus}
          disabled={disabled}
          aria-label="Remove tube"
          style={{
            position: "absolute",
            top: -10,
            left: -10,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: disabled ? "#334155" : "#dc2626",
            border: "2px solid white",
            color: "white",
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1,
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: "0 4px 10px rgba(2,6,23,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          −
        </button>
      )}
    </div>
  );
}

function DigitalReadout({ value }: { value: number }) {
  return (
    <div
      style={{
        fontFamily: "'DSEG7Classic', 'Courier New', monospace",
        fontSize: "2.4rem",
        fontWeight: 800,
        padding: "6px 18px",
        borderRadius: 10,
        color: "#67e8f9",
        background: "rgba(0,8,4,0.92)",
        border: "2px solid rgba(56,189,248,0.45)",
        textShadow:
          "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      {String(value).padStart(2, "0")}
    </div>
  );
}

type Phase =
  | "playing"
  | "correct"
  | "wrong"
  | "shipAnimating"
  | "roundTransition";

function getRoundNumberFromName(name: RoundName) {
  return ROUND_SEQUENCE.indexOf(name) + 1;
}

export default function PackItLevelOneScreen() {
  const { locale } = useLocale();
  const t = useT();
  const isMobileLandscape = useIsMobileLandscape();
  const isMobile = useIsCoarsePointer();

  const [muted, setMuted] = useState(isMuted());
  const [roundName, setRoundName] = useState<RoundName>("load");
  const [round, setRound] = useState(() => makeRound(1, "load", isMobile));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [tubeCount, setTubeCount] = useState(1);
  const [calculatorInput, setCalculatorInput] = useState("0");
  const [shipCommitted, setShipCommitted] = useState(false);
  const [pointsDeducted, setPointsDeducted] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [score, setScore] = useState(0);
  const [questionStates, setQuestionStates] = useState<
    Array<"solved" | "mistake" | "pending">
  >(() => Array(QUESTIONS_PER_ROUND).fill("pending"));
  const [shake, setShake] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [showNextButton, setShowNextButton] = useState(false);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const overshotOnceRef = useRef(false);
  const shipTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const nextButtonTimerRef = useRef<number | null>(null);
  const musicStartedRef = useRef(false);

  const question: PackQuestion = round.questions[questionIndex];

  const questionText = useMemo(
    () => getLocalizedLevelOneQuestionText(question, locale),
    [question, locale],
  );
  const stepsText = useMemo(
    () => getLocalizedLevelOneBlackboardSteps(question, locale),
    [question, locale],
  );

  const currentTotal = tubeCount * question.unitRate;
  const isShipLocked = roundName === "ship" && !shipCommitted;
  const tubesDisabled =
    isShipLocked || phase === "correct" || phase === "shipAnimating";

  const resetQuestionState = useCallback(() => {
    setTubeCount(1);
    setCalculatorInput("0");
    setShipCommitted(false);
    setPointsDeducted(false);
    setPhase("playing");
    setRevealedSteps(0);
    setShowNextButton(false);
    setShake(false);
    overshotOnceRef.current = false;
    if (shipTimerRef.current !== null) {
      window.clearTimeout(shipTimerRef.current);
      shipTimerRef.current = null;
    }
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (nextButtonTimerRef.current !== null) {
      window.clearTimeout(nextButtonTimerRef.current);
      nextButtonTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetQuestionState();
  }, [questionIndex, roundName, resetQuestionState]);

  useEffect(() => {
    return () => {
      if (shipTimerRef.current !== null)
        window.clearTimeout(shipTimerRef.current);
      if (revealTimerRef.current !== null)
        window.clearTimeout(revealTimerRef.current);
      if (nextButtonTimerRef.current !== null)
        window.clearTimeout(nextButtonTimerRef.current);
    };
  }, []);

  const beginMusic = useCallback(() => {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    ensureAudioReady();
    if (!isMuted()) startMusic();
  }, []);

  function revealStepsSequentially() {
    const lines = stepsText.length;
    let i = 0;
    const tick = () => {
      i += 1;
      setRevealedSteps(i);
      if (i < lines) {
        revealTimerRef.current = window.setTimeout(tick, 900);
      } else {
        nextButtonTimerRef.current = window.setTimeout(
          () => setShowNextButton(true),
          1800,
        );
      }
    };
    tick();
  }

  function markQuestionSolved(wasCorrect: boolean) {
    setQuestionStates((prev) => {
      const next = [...prev];
      next[questionIndex] = wasCorrect ? "solved" : "mistake";
      return next;
    });
    if (wasCorrect && !pointsDeducted) {
      setScore((s) => s + 1);
    }
  }

  function onCorrect() {
    setPhase("correct");
    playCorrect();
    markQuestionSolved(!pointsDeducted);
    revealStepsSequentially();
  }

  function onWrong() {
    playWrong();
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
    if (!pointsDeducted) {
      setScore((s) => Math.max(0, s - 1));
      setPointsDeducted(true);
      setQuestionStates((prev) => {
        if (prev[questionIndex] === "solved") return prev;
        const next = [...prev];
        next[questionIndex] = "mistake";
        return next;
      });
    }
  }

  function handlePlus() {
    if (tubesDisabled) return;
    beginMusic();
    const nextCount = tubeCount + 1;
    setTubeCount(nextCount);
    playDragStep();
    if (roundName === "load" && nextCount === question.groupsA) {
      onCorrect();
    }
  }

  function handleMinus() {
    if (tubesDisabled) return;
    beginMusic();
    if (tubeCount <= 1) return;
    setTubeCount((n) => Math.max(1, n - 1));
    playRipple(320);
  }

  function handleOvershoot() {
    if (overshotOnceRef.current) return;
    overshotOnceRef.current = true;
    playWrong();
  }

  function canSubmitKeypad() {
    if (phase !== "playing") return false;
    if (roundName === "load") return false;
    const parsed = Number.parseFloat(calculatorInput);
    return !Number.isNaN(parsed) && calculatorInput.trim() !== "";
  }

  function handleSubmit() {
    if (phase !== "playing") return;
    beginMusic();
    const parsed = Number.parseFloat(calculatorInput);
    const correct = parsed === question.answer;

    if (roundName === "pack") {
      if (correct) onCorrect();
      else onWrong();
      return;
    }

    if (roundName === "ship") {
      setShipCommitted(true);
      setPhase("shipAnimating");
      const target = correct ? question.groupsA : Math.max(1, tubeCount);
      let current = 1;
      setTubeCount(1);
      const step = () => {
        if (current >= target) {
          if (correct) {
            onCorrect();
          } else {
            onWrong();
            setPhase("playing");
            setShipCommitted(false);
            setTubeCount(1);
          }
          return;
        }
        current += 1;
        setTubeCount(current);
        playDragStep();
        shipTimerRef.current = window.setTimeout(step, 300);
      };
      shipTimerRef.current = window.setTimeout(step, 300);
    }
  }

  function advanceQuestion() {
    const lastInRound = questionIndex + 1 >= QUESTIONS_PER_ROUND;
    if (!lastInRound) {
      setQuestionIndex((i) => i + 1);
      return;
    }
    const nextRound = ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(roundName) + 1];
    if (!nextRound) {
      setIsRoundComplete(true);
      playLevelComplete();
      return;
    }
    setRoundName(nextRound);
    setRound(makeRound(1, nextRound, isMobile));
    setQuestionIndex(0);
    setQuestionStates(Array(QUESTIONS_PER_ROUND).fill("pending"));
  }

  function handleSelectRound(levelNumber: number) {
    const target = ROUND_SEQUENCE[levelNumber - 1];
    if (!target || target === roundName) return;
    if (levelNumber > getRoundNumberFromName(roundName)) return; // locked
    setRoundName(target);
    setRound(makeRound(1, target, isMobile));
    setQuestionIndex(0);
    setQuestionStates(Array(QUESTIONS_PER_ROUND).fill("pending"));
  }

  function handleRestart() {
    setRoundName("load");
    setRound(makeRound(1, "load", isMobile));
    setQuestionIndex(0);
    setScore(0);
    setQuestionStates(Array(QUESTIONS_PER_ROUND).fill("pending"));
    setIsRoundComplete(false);
  }

  function handleToggleMute() {
    const next = toggleMute();
    setMuted(next);
  }

  const tubeWidth = isMobileLandscape ? 56 : 78;
  const tubeHeightBase = isMobileLandscape ? 150 : 230;
  const itemSize = isMobileLandscape ? 20 : 30;
  const tubeHeight = Math.max(
    tubeHeightBase,
    question.unitRate * (itemSize + 3) + 40,
  );
  const tubeGap = isMobileLandscape ? 12 : 22;

  const questionNode: ReactNode = (
    <span
      className={shake ? "animate-shake" : undefined}
      style={{ display: "inline-block" }}
    >
      {renderHighlighted(questionText)}
    </span>
  );

  const playfield: ReactNode = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobileLandscape ? 14 : 26,
        padding: isMobileLandscape ? "12px 20px" : "24px 40px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes packit-l1-progress-flash {
          0% { opacity: 1; }
          100% { opacity: 0.45; }
        }
      `}</style>

      {phase === "correct" && (
        <div
          style={{
            color: "#bbf7d0",
            fontSize: isMobileLandscape ? "1.1rem" : "1.5rem",
            fontWeight: 800,
            minHeight: isMobileLandscape ? 28 : 40,
            textShadow: "0 0 12px rgba(34,197,94,0.4)",
          }}
        >
          {stepsText.slice(0, revealedSteps).map((line, i) => (
            <div key={i}>{renderHighlighted(line)}</div>
          ))}
          {showNextButton && (
            <button
              type="button"
              onClick={advanceQuestion}
              style={{
                marginTop: 10,
                padding: "8px 22px",
                borderRadius: 10,
                background: "#22c55e",
                color: "#052e14",
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              {t("game.next")}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: tubeGap,
          alignItems: "flex-end",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "100%",
        }}
      >
        {Array.from({ length: tubeCount }).map((_, idx) => (
          <TestTube
            key={idx}
            unitRate={question.unitRate}
            itemEmoji={question.pair.itemEmoji}
            showPlus={!isShipLocked}
            showMinus={idx > 0 && !isShipLocked}
            disabled={tubesDisabled}
            onPlus={handlePlus}
            onMinus={handleMinus}
            tubeWidth={tubeWidth}
            tubeHeight={tubeHeight}
            itemSize={itemSize}
            ariaLabel={`${
              idx === 0 ? "Starter" : "Replicated"
            } tube with ${question.unitRate} ${question.pair.itemPlural}`}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: 620,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: isMobileLandscape ? "0.95rem" : "1.1rem",
          }}
        >
          <span>
            {tubeCount} × {question.unitRate} =
          </span>
          <DigitalReadout value={currentTotal} />
          <span>{question.pair.itemPlural}</span>
        </div>
        <L1ProgressBar
          current={tubeCount}
          target={question.groupsA}
          onOvershoot={handleOvershoot}
        />
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginTop: 4,
          }}
          aria-label="Question progress"
        >
          {questionStates.map((state, i) => (
            <ProgressDot
              key={i}
              state={i === questionIndex && state === "pending" ? "pending" : state}
            />
          ))}
        </div>
      </div>

      {isRoundComplete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2,6,23,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
            zIndex: 20,
          }}
        >
          <div
            style={{
              color: "#facc15",
              fontSize: "2rem",
              fontWeight: 900,
              textShadow: "0 0 16px rgba(250,204,21,0.5)",
            }}
          >
            {t("game.levelComplete")}
          </div>
          <div
            style={{
              color: "#e2e8f0",
              fontSize: "1.25rem",
              fontWeight: 700,
            }}
          >
            Score: {score}
          </div>
          <button
            type="button"
            onClick={handleRestart}
            style={{
              padding: "10px 26px",
              borderRadius: 12,
              background: "#2563eb",
              color: "white",
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {t("report.playAgain")}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <GameLayout
      muted={muted}
      onToggleMute={handleToggleMute}
      onRestart={handleRestart}
      keypadValue={calculatorInput}
      onKeypadChange={(v) => setCalculatorInput(v)}
      onKeypadSubmit={handleSubmit}
      canSubmit={canSubmitKeypad()}
      question={questionNode}
      questionShake={shake}
      progress={questionStates.filter((s) => s === "solved").length}
      progressTotal={QUESTIONS_PER_ROUND}
      levelCount={3}
      currentLevel={getRoundNumberFromName(roundName)}
      unlockedLevel={getRoundNumberFromName(roundName)}
      onLevelSelect={handleSelectRound}
    >
      {playfield}
    </GameLayout>
  );
}
