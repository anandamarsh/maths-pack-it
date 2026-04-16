import { useCallback, useEffect, useRef, useState } from "react";

export type AutopilotGamePhase = "tapping" | "answering" | "feedback" | "levelComplete";

// ── Half-human-speed timing ranges (ms) ──────────────────────────────────────
const T = {
  TAP_FIRST:    [640, 1100]  as [number, number],   // before first canvas tap
  TAP_BETWEEN:  [760, 1400]  as [number, number],   // between canvas taps
  READ_DELAY:   [1400, 2400] as [number, number],   // "reading" the question
  KEY_BETWEEN:  [360, 680]   as [number, number],   // between keypad digits
  PRE_SUBMIT:   [440, 760]   as [number, number],   // before pressing submit
  EMAIL_CLICK:  [2000, 3200] as [number, number],   // after modal, before typing email
  EMAIL_CHAR:   [8, 15]      as [number, number],   // between email characters
  SEND_PAUSE:   [700, 1100]  as [number, number],   // after last char, before send
  END_PAUSE:    [3600, 5000] as [number, number],   // after send, before next level
} as const;

const WRONG_ANSWER_RATE = 0.2;

function rand([lo, hi]: [number, number]): number {
  return Math.round(lo + Math.random() * (hi - lo));
}

function wrongAnswer(correct: number): number {
  const candidates = [-3, -2, -1, 1, 2, 3]
    .map(d => correct + d)
    .filter(v => v > 0 && v <= 20);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? correct + 1;
}

function getKeyRect(key: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${key}"]`);
  return el ? el.getBoundingClientRect() : null;
}

/** Controls exposed by the level-complete report modal for autopilot to drive */
export interface ModalAutopilotControls {
  appendChar: (ch: string) => void;
  setEmail: (v: string) => void;
  triggerSend: () => void;
}

export interface AutopilotCallbacks {
  simulateTap: (normX: number, normY: number) => void;
  setCalcValue: React.Dispatch<React.SetStateAction<string>>;
  submitAnswer: (overrideValue?: string) => void;
  goNextLevel: () => void;
  playAgain: () => void;
  restartAll: () => void;
  emailModalControls: React.MutableRefObject<ModalAutopilotControls | null>;
  onAutopilotComplete?: () => void;
}

export interface PhantomPos {
  x: number;
  y: number;
  isClicking: boolean;
  durationMs?: number;
}

interface AutopilotGameState {
  phase: AutopilotGamePhase;
  targetTaps: number;
  tapCount: number;
  level: number;
  levelCount: number;
}

interface UseAutopilotArgs {
  gameState: AutopilotGameState;
  callbacksRef: React.RefObject<AutopilotCallbacks | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  autopilotEmail: string;
  mode?: "continuous" | "single-question";
}

export function useAutopilot({
  gameState,
  callbacksRef,
  canvasRef,
  autopilotEmail,
  mode = "continuous",
}: UseAutopilotArgs) {
  const [isActive, setIsActive] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);

  const isActiveRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  function clearTimers() {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }

  function after(ms: number, fn: () => void): void {
    const t = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(t);
  }

  function canvasToScreen(normX: number, normY: number): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: rect.left + normX * rect.width, y: rect.top + normY * rect.height };
  }

  function moveHand(x: number, y: number) {
    setPhantomPos({ x, y, isClicking: false });
  }

  function clickAt(x: number, y: number) {
    setPhantomPos({ x, y, isClicking: true });
    window.setTimeout(() => {
      if (!isActiveRef.current) return;
      setPhantomPos(prev => prev ? { ...prev, isClicking: false } : null);
    }, 130);
  }

  // ── Phase handlers ────────────────────────────────────────────────────────

  function scheduleTaps(targetCount: number, alreadyDone: number) {
    const remaining = Math.max(0, targetCount - alreadyDone);
    if (remaining === 0) return;
    let delay = rand(T.TAP_FIRST);

    for (let i = 0; i < remaining; i++) {
      const tapDelay = delay;
      after(tapDelay, () => {
        const normX = 0.15 + Math.random() * 0.7;
        const normY = 0.15 + Math.random() * 0.65;
        const screen = canvasToScreen(normX, normY);
        if (screen) moveHand(screen.x, screen.y);
        window.setTimeout(() => {
          if (!isActiveRef.current) return;
          if (screen) clickAt(screen.x, screen.y);
          callbacksRef.current?.simulateTap(normX, normY);
        }, 100);
      });
      delay += rand(T.TAP_BETWEEN);
    }
  }

  function scheduleAnswer(correctAnswer: number) {
    const isWrong = Math.random() < WRONG_ANSWER_RATE;
    const answer = isWrong ? wrongAnswer(correctAnswer) : correctAnswer;
    const digits = String(answer).split("");
    let delay = rand(T.READ_DELAY);

    after(delay - 200, () => {
      const rect = getKeyRect(digits[0]);
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    for (const d of digits) {
      const td = delay;
      after(td, () => {
        const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${d}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          el.click(); // fires press() → playKeyClick() + flashKey() + onChange()
        }
      });
      delay += rand(T.KEY_BETWEEN);
    }

    after(delay + rand(T.PRE_SUBMIT), () => {
      const rect = getKeyRect("submit");
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        clickAt(cx, cy);
      }
      window.setTimeout(() => {
        if (!isActiveRef.current) return;
        callbacksRef.current?.submitAnswer();
        setPhantomPos(null);
        if (mode === "single-question") {
          isActiveRef.current = false;
          setIsActive(false);
          callbacksRef.current?.onAutopilotComplete?.();
        }
      }, 140);
    });
  }

  function scheduleLevelEnd() {
    const email = autopilotEmail;
    let delay = rand(T.EMAIL_CLICK);

    // Move hand toward email input
    after(delay - 400, () => {
      const rect = getKeyRect("email-input");
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // Click email input to focus it
    after(delay, () => {
      const rect = getKeyRect("email-input");
      if (rect) clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      // Clear any existing value first
      callbacksRef.current?.emailModalControls?.current?.setEmail?.("");
    });
    delay += 300;

    // Type email address character by character
    for (const ch of email) {
      const cd = delay;
      const c = ch;
      after(cd, () => {
        const rect = getKeyRect("email-input");
        if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
        callbacksRef.current?.emailModalControls?.current?.appendChar?.(c);
      });
      delay += rand(T.EMAIL_CHAR);
    }

    // Pause, move to send button
    delay += rand(T.SEND_PAUSE);
    after(delay - 400, () => {
      const rect = getKeyRect("email-send");
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // Click send
    after(delay, () => {
      const rect = getKeyRect("email-send");
      if (rect) clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      window.setTimeout(() => {
        if (!isActiveRef.current) return;
        callbacksRef.current?.emailModalControls?.current?.triggerSend?.();
        setPhantomPos(null);
      }, 140);
    });

    // Auto-proceed after send — phantom-click "Next Level" or halt
    delay += rand(T.END_PAUSE);
    after(delay - 400, () => {
      const { level, levelCount } = stateRef.current;
      if (level < levelCount) {
        const rect = getKeyRect("next-level");
        if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });
    after(delay, () => {
      const { level, levelCount } = stateRef.current;
      if (level < levelCount) {
        const el = document.querySelector<HTMLElement>('[data-autopilot-key="next-level"]');
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          window.setTimeout(() => {
            if (!isActiveRef.current) return;
            el.click();
            setPhantomPos(null);
          }, 140);
        } else {
          callbacksRef.current?.goNextLevel();
        }
      } else {
        // Final level — halt autopilot, leave modal visible
        isActiveRef.current = false;
        setIsActive(false);
        callbacksRef.current?.onAutopilotComplete?.();
      }
    });
  }

  // ── React to phase changes ────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      setPhantomPos(null);
      return;
    }
    clearTimers();

    const { phase, targetTaps, tapCount } = stateRef.current;

    switch (phase) {
      case "tapping":
        scheduleTaps(targetTaps, tapCount);
        break;
      case "answering":
        scheduleAnswer(targetTaps);
        break;
      case "feedback":
        break;
      case "levelComplete":
        scheduleLevelEnd();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, gameState.phase]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    isActiveRef.current = true;
    setIsActive(true);
  }, []);

  const deactivate = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    clearTimers();
    setPhantomPos(null);
  }, []);

  useEffect(() => () => clearTimers(), []);

  return { isActive, activate, deactivate, phantomPos };
}
