import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import PhantomHand from "../components/PhantomHand";
import GameLayout from "../components/GameLayout";
import { makeRound } from "../game/packItGame";
import type { PackQuestion } from "../calculations/types.ts";
import {
  ensureAudioReady,
  isMuted,
  playCameraShutter,
  playCorrect,
  playDragStep,
  playLevelComplete,
  playTypewriterTick,
  playRipple,
  playWrong,
  startMusic,
  toggleMute,
} from "../sound";
import type { PhantomPos } from "../hooks/useAutopilot";

type PackedItem = {
  id: number;
  containerIndex: number | null;
  comboId: number | null;
};

type DragState = {
  itemIds: number[];
  origin: "source" | "container";
  comboId: number | null;
  isLifted: boolean;
  x: number;
  y: number;
};

type ReturnState = {
  itemId: number;
  x: number;
  y: number;
  durationMs?: number;
};

type SquareSnip = {
  x: number;
  y: number;
  size: number;
};

type SnipDragState = {
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  initial: SquareSnip;
};

type FlashFeedback = {
  ok: boolean;
  icon: true;
} | null;

type RevealCtaMode = "next" | "retry" | null;
const DOCK_TRANSITION = "320ms cubic-bezier(0.22,0.72,0.2,1)";

const QUESTION_COUNT = 10;
const AUTOPILOT_QUESTION_COUNT = 5;
const QUESTION_KEYWORDS = new Set([
  "pack",
  "packed",
  "package",
  "packaged",
  "equal",
  "equally",
  "same",
  "share",
  "shared",
  "split",
  "divide",
  "divided",
  "distribute",
  "distributed",
  "distribution",
  "even",
  "evenly",
  "each",
  "every",
  "per",
]);

function buildInitialItems(question: PackQuestion): PackedItem[] {
  return Array.from({ length: question.totalA }, (_, index) => ({
    id: index,
    containerIndex: null,
    comboId: null,
  }));
}

function buildRobotTargetAssignments(
  items: PackedItem[],
  groupsA: number,
  unitRate: number,
) {
  const nextAssignments = new Map<number, number | null>();
  const movableItems: PackedItem[] = [];

  for (let containerIndex = 0; containerIndex < groupsA; containerIndex += 1) {
    const itemsInContainer = items
      .filter((item) => item.containerIndex === containerIndex)
      .sort((left, right) => left.id - right.id);
    const keepCount = Math.min(itemsInContainer.length, unitRate);

    itemsInContainer.forEach((item, index) => {
      if (index < keepCount) {
        nextAssignments.set(item.id, containerIndex);
      } else {
        movableItems.push(item);
      }
    });
  }

  items
    .filter((item) => item.containerIndex === null)
    .sort((left, right) => left.id - right.id)
    .forEach((item) => {
      movableItems.push(item);
    });

  let movableIndex = 0;
  for (let containerIndex = 0; containerIndex < groupsA; containerIndex += 1) {
    const alreadyAssignedCount = Array.from(nextAssignments.values()).filter(
      (value) => value === containerIndex,
    ).length;
    const neededCount = unitRate - alreadyAssignedCount;

    for (let count = 0; count < neededCount; count += 1) {
      const movableItem = movableItems[movableIndex];
      if (!movableItem) {
        break;
      }
      nextAssignments.set(movableItem.id, containerIndex);
      movableIndex += 1;
    }
  }

  return nextAssignments;
}

function isHighlightedToken(token: string): boolean {
  const normalized = token.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /\d/.test(token) || QUESTION_KEYWORDS.has(normalized);
}

function isMathSymbolToken(token: string): boolean {
  return token.includes("=") || token.includes("∴") || token.includes("÷");
}

function renderHighlightedQuestion(text: string): ReactNode {
  return text.split(/(\s+)/).map((part, index) => {
    if (part.trim() === "") {
      return (
        <span key={`space-${index}`} style={{ whiteSpace: "pre" }}>
          {part}
        </span>
      );
    }

    return (
      <span
        key={`${part}-${index}`}
        style={
          isMathSymbolToken(part)
            ? { color: "#86efac" }
            : isHighlightedToken(part)
              ? { color: "#facc15" }
              : undefined
        }
      >
        {part}
      </span>
    );
  });
}

function DigitalCount({
  value,
  color = "#67e8f9",
  glow = "rgba(103,232,249,0.72)",
  glowOuter = "rgba(56,189,248,0.26)",
}: {
  value: number;
  color?: string;
  glow?: string;
  glowOuter?: string;
}) {
  return (
    <div
      className="digital-meter rounded-lg px-3 py-1 text-[1.6rem] leading-none"
      style={{
        color,
        textShadow: `0 0 12px ${glow}, 0 0 22px ${glowOuter}`,
      }}
    >
      {String(value).padStart(2, "0")}
    </div>
  );
}

let captureColorProbe: HTMLDivElement | null = null;
const UNSUPPORTED_CAPTURE_COLOR_PATTERN = /oklab\([^)]*\)|oklch\([^)]*\)/i;

function hasUnsupportedCaptureColor(value: string) {
  return UNSUPPORTED_CAPTURE_COLOR_PATTERN.test(value);
}

function getCaptureColorProbe() {
  if (typeof document === "undefined") {
    return null;
  }

  if (captureColorProbe) {
    return captureColorProbe;
  }

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.left = "-30000px";
  probe.style.top = "0";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "#000";
  document.body.appendChild(probe);
  captureColorProbe = probe;
  return captureColorProbe;
}

function normalizeCaptureColor(value: string) {
  if (!value || !hasUnsupportedCaptureColor(value)) {
    return value;
  }

  const probe = getCaptureColorProbe();
  if (!probe) {
    return null;
  }

  try {
    probe.style.color = "rgb(0, 0, 1)";
    probe.style.color = value;
    const normalized = window.getComputedStyle(probe).color;
    return hasUnsupportedCaptureColor(normalized) ? null : normalized;
  } catch {
    return null;
  }
}

function sanitizeCaptureValue(property: string, value: string) {
  if (!value || !hasUnsupportedCaptureColor(value)) {
    return value;
  }

  if (
    property.includes("shadow") ||
    property === "filter" ||
    property === "backdrop-filter" ||
    property === "background-image" ||
    property === "mask-image" ||
    property === "border-image-source"
  ) {
    return "none";
  }

  if (property === "background" || property === "background-color") {
    const normalized = normalizeCaptureColor(value);
    return normalized ?? "transparent";
  }

  if (
    property.includes("color") ||
    property === "fill" ||
    property === "stroke"
  ) {
    return normalizeCaptureColor(value) ?? "transparent";
  }

  if (property.startsWith("border")) {
    const normalized = normalizeCaptureColor(value);
    return normalized ?? value.replace(UNSUPPORTED_CAPTURE_COLOR_PATTERN, "transparent");
  }

  return value.replace(UNSUPPORTED_CAPTURE_COLOR_PATTERN, "transparent");
}

function sourceBackgroundFromRoot(root: HTMLElement) {
  let current: HTMLElement | null = root;

  while (current) {
    const rawBackground =
      window.getComputedStyle(current).backgroundColor || "transparent";
    if (
      rawBackground &&
      rawBackground !== "transparent" &&
      rawBackground !== "rgba(0, 0, 0, 0)"
    ) {
      if (!hasUnsupportedCaptureColor(rawBackground)) {
        return rawBackground;
      }
      return normalizeCaptureColor(rawBackground) ?? "#020617";
    }
    current = current.parentElement;
  }

  return "#020617";
}

function buildCaptureIframe(sourceRoot: HTMLElement) {
  const sourceRect = sourceRoot.getBoundingClientRect();
  const sourceBackground = sourceBackgroundFromRoot(sourceRoot);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-30000px";
  iframe.style.top = "0";
  iframe.style.width = `${Math.ceil(sourceRect.width)}px`;
  iframe.style.height = `${Math.ceil(sourceRect.height)}px`;
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  const captureDocument = iframe.contentDocument;
  const captureWindow = iframe.contentWindow;
  if (!captureDocument || !captureWindow) {
    iframe.remove();
    throw new Error("Unable to create capture document");
  }

  captureDocument.open();
  captureDocument.write(
    '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
  );
  captureDocument.close();

  const replicaRoot = sourceRoot.cloneNode(true) as HTMLElement;
  const sourceElements = [
    sourceRoot,
    ...Array.from(sourceRoot.querySelectorAll<HTMLElement>("*")),
  ];
  const replicaElements = [
    replicaRoot,
    ...Array.from(replicaRoot.querySelectorAll<HTMLElement>("*")),
  ];
  const pairCount = Math.min(sourceElements.length, replicaElements.length);

  for (let index = 0; index < pairCount; index += 1) {
    const sourceElement = sourceElements[index];
    const replicaElement = replicaElements[index];
    const computedStyle = window.getComputedStyle(sourceElement);

    replicaElement.removeAttribute("class");
    replicaElement.removeAttribute("id");
    replicaElement.removeAttribute("data-pack-it-capture-root");

    for (const attributeName of Array.from(
      replicaElement.getAttributeNames(),
    )) {
      if (
        attributeName === "src" ||
        attributeName === "href" ||
        attributeName === "alt"
      ) {
        continue;
      }
      if (attributeName.startsWith("aria-")) {
        continue;
      }
      replicaElement.removeAttribute(attributeName);
    }

    for (const property of computedStyle) {
      const value = computedStyle.getPropertyValue(property);
      if (!value) {
        continue;
      }

      const sanitizedValue = hasUnsupportedCaptureColor(value)
        ? sanitizeCaptureValue(property, value)
        : value;
      if (!sanitizedValue || hasUnsupportedCaptureColor(sanitizedValue)) {
        continue;
      }

      replicaElement.style.setProperty(property, sanitizedValue);
    }

    replicaElement.style.setProperty("transition", "none");
    replicaElement.style.setProperty("animation", "none");
    replicaElement.style.setProperty("caret-color", "transparent");
    replicaElement.style.setProperty("color-scheme", "light");
  }

  captureDocument.documentElement.style.margin = "0";
  captureDocument.documentElement.style.padding = "0";
  captureDocument.documentElement.style.width = `${Math.ceil(sourceRect.width)}px`;
  captureDocument.documentElement.style.height = `${Math.ceil(sourceRect.height)}px`;
  captureDocument.body.style.margin = "0";
  captureDocument.body.style.padding = "0";
  captureDocument.body.style.width = `${Math.ceil(sourceRect.width)}px`;
  captureDocument.body.style.height = `${Math.ceil(sourceRect.height)}px`;
  captureDocument.body.style.background = sourceBackground;
  captureDocument.body.style.overflow = "hidden";

  replicaRoot.style.position = "relative";
  replicaRoot.style.left = "0";
  replicaRoot.style.top = "0";
  replicaRoot.style.width = `${Math.ceil(sourceRect.width)}px`;
  replicaRoot.style.height = `${Math.ceil(sourceRect.height)}px`;
  replicaRoot.style.minWidth = `${Math.ceil(sourceRect.width)}px`;
  replicaRoot.style.minHeight = `${Math.ceil(sourceRect.height)}px`;
  replicaRoot.style.pointerEvents = "none";
  replicaRoot.style.margin = "0";
  replicaRoot.style.isolation = "isolate";
  replicaRoot.style.background = sourceBackground;

  replicaRoot
    .querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Remove "] > span:last-child',
    )
    .forEach((node) => {
      node.style.transform = "translateY(-20px)";
    });

  replicaRoot
    .querySelectorAll<HTMLElement>("[data-capture-ignore='true']")
    .forEach((node) => {
      node.remove();
    });

  captureDocument.body.appendChild(replicaRoot);
  return { iframe, root: replicaRoot };
}

async function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string) {
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode PNG"));
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export default function PackItScreen() {
  const round = useMemo(() => makeRound(1, "load"), []);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [items, setItems] = useState<PackedItem[]>(() =>
    buildInitialItems(round.questions[0]),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredContainerIndex, setHoveredContainerIndex] = useState<
    number | null
  >(null);
  const [returnStates, setReturnStates] = useState<ReturnState[]>([]);
  const [muted, setMuted] = useState(isMuted());
  const [showUnitReveal, setShowUnitReveal] = useState(false);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [questionSolved, setQuestionSolved] = useState(false);
  const [flash, setFlash] = useState<FlashFeedback>(null);
  const [mistakeQuestionIndexes, setMistakeQuestionIndexes] = useState<
    number[]
  >([]);
  const [typedQuestionLength, setTypedQuestionLength] = useState(0);
  const [typedStepLengths, setTypedStepLengths] = useState<number[]>([]);
  const [showNextQuestionButton, setShowNextQuestionButton] = useState(false);
  const [revealCtaMode, setRevealCtaMode] = useState<RevealCtaMode>(null);
  const [questionResetKey, setQuestionResetKey] = useState(0);
  const [displayTopBoxCount, setDisplayTopBoxCount] = useState(0);
  const [calculatorInput, setCalculatorInput] = useState("0");
  const [calculatorOverride, setCalculatorOverride] = useState(false);
  const [isCalculatorAdjusting, setIsCalculatorAdjusting] = useState(false);
  const [isContinuousAutopilot, setIsContinuousAutopilot] = useState(false);
  const [snipMode, setSnipMode] = useState(false);
  const [snipSelection, setSnipSelection] = useState<SquareSnip>({
    x: 24,
    y: 24,
    size: 240,
  });
  const [captureFlashVisible, setCaptureFlashVisible] = useState(false);
  const [isRecordingDemo, setIsRecordingDemo] = useState(false);
  const [isQuestionDemo, setIsQuestionDemo] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);
  const [hoveredSourceArea, setHoveredSourceArea] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const nextComboIdRef = useRef(1);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sourceAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const musicStartedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const captureSceneRef = useRef<HTMLDivElement>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const demoTimerRef = useRef<number | null>(null);
  const returnTimerRef = useRef<number | null>(null);
  const questionTypeIntervalRef = useRef<number | null>(null);
  const stepTypeIntervalRef = useRef<number | null>(null);
  const stepTypeDelayRef = useRef<number | null>(null);
  const displaySyncLockRef = useRef<number | null>(null);
  const keypadDebounceRef = useRef<number | null>(null);
  const keypadAdjustTimersRef = useRef<number[]>([]);
  const autopilotAdvanceTimerRef = useRef<number | null>(null);
  const continuousAutopilotStartTimerRef = useRef<number | null>(null);
  const cheatBufferRef = useRef("");
  const continuousAutopilotStartIndexRef = useRef(0);
  const dragSoundPointRef = useRef<{
    x: number;
    y: number;
    carry: number;
  } | null>(null);
  const snipDragRef = useRef<SnipDragState | null>(null);
  const captureFlashTimerRef = useRef<number | null>(null);
  const itemsRef = useRef<PackedItem[]>(items);

  const question = round.questions[questionIndex];
  const containers = Array.from({ length: question.groupsA }, (_, index) =>
    items.filter((item) => item.containerIndex === index),
  );
  const remainingItems = items.filter((item) => item.containerIndex === null);
  const packedItemsTotal = items.length - remainingItems.length;
  const canSubmit =
    packedItemsTotal > 0 && revealCtaMode === null && !isQuestionDemo;
  const score = round.questions.length - mistakeQuestionIndexes.length;
  const returningItemIds = new Set(returnStates.map((state) => state.itemId));
  const draggedItemIds = new Set(dragState?.itemIds ?? []);
  const selectedItemIdSet = new Set(selectedItemIds);
  const comboSize = question.groupsA;
  const autopilotProgress = isContinuousAutopilot
    ? Math.min(
        AUTOPILOT_QUESTION_COUNT,
        Math.max(0, questionIndex - continuousAutopilotStartIndexRef.current) +
          (questionSolved ? 1 : 0),
      )
    : questionIndex + (questionSolved ? 1 : 0);
  const progressTotal = isContinuousAutopilot
    ? AUTOPILOT_QUESTION_COUNT
    : QUESTION_COUNT;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (stepTypeIntervalRef.current !== null) {
      window.clearInterval(stepTypeIntervalRef.current);
      stepTypeIntervalRef.current = null;
    }
    if (stepTypeDelayRef.current !== null) {
      window.clearTimeout(stepTypeDelayRef.current);
      stepTypeDelayRef.current = null;
    }

    if (!showUnitReveal) {
      setTypedStepLengths([]);
      setShowNextQuestionButton(false);
      setRevealCtaMode(null);
      return;
    }

    const steps = question.blackboardSteps;
    setTypedStepLengths(Array.from({ length: steps.length }, () => 0));
    setShowNextQuestionButton(false);

    let lineIndex = 0;
    let charIndex = 0;

    const startTypingLine = () => {
      const line = steps[lineIndex] ?? "";
      stepTypeIntervalRef.current = window.setInterval(() => {
        charIndex += 1;
        setTypedStepLengths((current) => {
          const next = [...current];
          next[lineIndex] = charIndex;
          return next;
        });
        if (line[charIndex - 1]?.trim()) {
          playTypewriterTick();
        }
        if (charIndex >= line.length && stepTypeIntervalRef.current !== null) {
          window.clearInterval(stepTypeIntervalRef.current);
          stepTypeIntervalRef.current = null;
          if (lineIndex >= steps.length - 1) {
            stepTypeDelayRef.current = window.setTimeout(() => {
              setShowNextQuestionButton(true);
            }, 1000);
            return;
          }
          lineIndex += 1;
          charIndex = 0;
          stepTypeDelayRef.current = window.setTimeout(startTypingLine, 1000);
        }
      }, 22);
    };

    startTypingLine();

    return () => {
      if (stepTypeIntervalRef.current !== null) {
        window.clearInterval(stepTypeIntervalRef.current);
        stepTypeIntervalRef.current = null;
      }
      if (stepTypeDelayRef.current !== null) {
        window.clearTimeout(stepTypeDelayRef.current);
        stepTypeDelayRef.current = null;
      }
    };
  }, [question.blackboardSteps, questionResetKey, showUnitReveal]);

  useEffect(() => {
    if (displaySyncLockRef.current !== null) {
      return;
    }
    setDisplayTopBoxCount(containers[0]?.length ?? 0);
  }, [containers]);

  useEffect(() => {
    if (!calculatorOverride) {
      setCalculatorInput(String(displayTopBoxCount));
    }
  }, [calculatorOverride, displayTopBoxCount]);

  useEffect(() => {
    return () => {
      if (demoTimerRef.current !== null) {
        window.clearTimeout(demoTimerRef.current);
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (recordingStreamRef.current) {
        for (const track of recordingStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current);
      }
      if (questionTypeIntervalRef.current !== null) {
        window.clearInterval(questionTypeIntervalRef.current);
      }
      if (stepTypeIntervalRef.current !== null) {
        window.clearInterval(stepTypeIntervalRef.current);
      }
      if (stepTypeDelayRef.current !== null) {
        window.clearTimeout(stepTypeDelayRef.current);
      }
      if (displaySyncLockRef.current !== null) {
        window.clearTimeout(displaySyncLockRef.current);
      }
      if (keypadDebounceRef.current !== null) {
        window.clearTimeout(keypadDebounceRef.current);
      }
      if (autopilotAdvanceTimerRef.current !== null) {
        window.clearTimeout(autopilotAdvanceTimerRef.current);
      }
      if (continuousAutopilotStartTimerRef.current !== null) {
        window.clearTimeout(continuousAutopilotStartTimerRef.current);
      }
      if (captureFlashTimerRef.current !== null) {
        window.clearTimeout(captureFlashTimerRef.current);
      }
      keypadAdjustTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      keypadAdjustTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (isRoundComplete) {
      setTypedQuestionLength(0);
      return;
    }

    if (questionTypeIntervalRef.current !== null) {
      window.clearInterval(questionTypeIntervalRef.current);
      questionTypeIntervalRef.current = null;
    }

    setTypedQuestionLength(0);
    const fullText = question.questionText;
    let nextLength = 0;
    questionTypeIntervalRef.current = window.setInterval(() => {
      nextLength += 1;
      setTypedQuestionLength(nextLength);
      if (fullText[nextLength - 1]?.trim()) {
        playTypewriterTick();
      }
      if (
        nextLength >= fullText.length &&
        questionTypeIntervalRef.current !== null
      ) {
        window.clearInterval(questionTypeIntervalRef.current);
        questionTypeIntervalRef.current = null;
      }
    }, 22);

    return () => {
      if (questionTypeIntervalRef.current !== null) {
        window.clearInterval(questionTypeIntervalRef.current);
        questionTypeIntervalRef.current = null;
      }
    };
  }, [isRoundComplete, question.questionText, questionResetKey]);

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFlash(null);
    }, 1150);

    return () => window.clearTimeout(timer);
  }, [flash]);

  function ensureMusic() {
    ensureAudioReady();
    if (!musicStartedRef.current) {
      musicStartedRef.current = true;
      startMusic();
    }
  }

  function handleToggleMute() {
    const nextMuted = toggleMute();
    if (!nextMuted) {
      ensureAudioReady();
    }
    setMuted(nextMuted);
  }

  function markQuestionPenalty() {
    setMistakeQuestionIndexes((current) =>
      current.includes(questionIndex) ? current : [...current, questionIndex],
    );
  }

  function handleRestart() {
    if (demoTimerRef.current !== null) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }
    if (questionTypeIntervalRef.current !== null) {
      window.clearInterval(questionTypeIntervalRef.current);
      questionTypeIntervalRef.current = null;
    }
    if (stepTypeIntervalRef.current !== null) {
      window.clearInterval(stepTypeIntervalRef.current);
      stepTypeIntervalRef.current = null;
    }
    if (stepTypeDelayRef.current !== null) {
      window.clearTimeout(stepTypeDelayRef.current);
      stepTypeDelayRef.current = null;
    }
    setQuestionIndex(0);
    setItems(buildInitialItems(round.questions[0]));
    setShowUnitReveal(false);
    setIsRoundComplete(false);
    setQuestionSolved(false);
    setDragState(null);
    setHoveredContainerIndex(null);
    setReturnStates([]);
    setPhantomPos(null);
    setIsQuestionDemo(false);
    setFlash(null);
    setMistakeQuestionIndexes([]);
    setTypedQuestionLength(0);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setIsCalculatorAdjusting(false);
    setIsContinuousAutopilot(false);
    setQuestionResetKey((current) => current + 1);
    dragSoundPointRef.current = null;
    nextComboIdRef.current = 1;
    if (displaySyncLockRef.current !== null) {
      window.clearTimeout(displaySyncLockRef.current);
      displaySyncLockRef.current = null;
    }
    if (keypadDebounceRef.current !== null) {
      window.clearTimeout(keypadDebounceRef.current);
      keypadDebounceRef.current = null;
    }
    if (autopilotAdvanceTimerRef.current !== null) {
      window.clearTimeout(autopilotAdvanceTimerRef.current);
      autopilotAdvanceTimerRef.current = null;
    }
    if (continuousAutopilotStartTimerRef.current !== null) {
      window.clearTimeout(continuousAutopilotStartTimerRef.current);
      continuousAutopilotStartTimerRef.current = null;
    }
    keypadAdjustTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    keypadAdjustTimersRef.current = [];
    cheatBufferRef.current = "";
    continuousAutopilotStartIndexRef.current = 0;
  }

  function assignItems(
    itemIds: number[],
    getContainerIndex: (itemId: number, index: number) => number | null,
    comboId: number | null,
  ) {
    ensureMusic();
    const firstContainerIndex = getContainerIndex(itemIds[0]!, 0);
    playRipple(340 + (firstContainerIndex ?? 0) * 45);
    setItems((currentItems) =>
      currentItems.map((item) =>
        itemIds.includes(item.id)
          ? {
              ...item,
              containerIndex: getContainerIndex(
                item.id,
                itemIds.indexOf(item.id),
              ),
              comboId,
            }
          : item,
      ),
    );
    setDragState(null);
    setHoveredContainerIndex(null);
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    setReturnStates([]);
    dragSoundPointRef.current = null;
  }

  function lockDisplayTopBoxCount(nextValue: number, delayMs: number) {
    if (displaySyncLockRef.current !== null) {
      window.clearTimeout(displaySyncLockRef.current);
    }
    displaySyncLockRef.current = window.setTimeout(() => {
      setDisplayTopBoxCount(nextValue);
      displaySyncLockRef.current = null;
    }, delayMs);
  }

  function clearKeypadAdjustTimers() {
    if (keypadDebounceRef.current !== null) {
      window.clearTimeout(keypadDebounceRef.current);
      keypadDebounceRef.current = null;
    }
    keypadAdjustTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    keypadAdjustTimersRef.current = [];
  }

  function scheduleAdjustTimer(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      keypadAdjustTimersRef.current = keypadAdjustTimersRef.current.filter(
        (current) => current !== timer,
      );
      callback();
    }, delayMs);
    keypadAdjustTimersRef.current.push(timer);
  }

  function getCurrentItemsInContainer(containerIndex: number) {
    return itemsRef.current
      .filter((item) => item.containerIndex === containerIndex)
      .sort((left, right) => left.id - right.id);
  }

  function animateItemsToSource(itemIds: number[]) {
    const packedItems = itemsRef.current.filter(
      (item) => itemIds.includes(item.id) && item.containerIndex !== null,
    );
    if (packedItems.length === 0) {
      return;
    }

    const startStates = packedItems
      .map((item) => {
        const center = getScreenCenter(itemRefs.current[item.id]);
        return center
          ? {
              itemId: item.id,
              x: center.x - 32,
              y: center.y - 32,
              durationMs: 440,
            }
          : null;
      })
      .filter(
        (
          state,
        ): state is {
          itemId: number;
          x: number;
          y: number;
          durationMs: number;
        } => state !== null,
      );

    setReturnStates(startStates);
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        itemIds.includes(currentItem.id)
          ? { ...currentItem, containerIndex: null, comboId: null }
          : currentItem,
      ),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetStates = packedItems
          .map((item) => {
            const center = getScreenCenter(itemRefs.current[item.id]);
            return center
              ? {
                  itemId: item.id,
                  x: center.x - 32,
                  y: center.y - 32,
                  durationMs: 440,
                }
              : null;
          })
          .filter(
            (
              state,
            ): state is {
              itemId: number;
              x: number;
              y: number;
              durationMs: number;
            } => state !== null,
          );
        setReturnStates(targetStates);
      });
    });

    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
    }
    returnTimerRef.current = window.setTimeout(() => {
      setReturnStates([]);
    }, 480);
  }

  function animateItemsFromSourceToAssignments(
    itemIds: number[],
    targetContainerIndexes: number[],
  ) {
    const sourceItems = itemsRef.current.filter((item) =>
      itemIds.includes(item.id),
    );
    if (sourceItems.length === 0) {
      return;
    }

    const comboIds = itemIds.map(
      (_, index) =>
        nextComboIdRef.current + Math.floor(index / question.groupsA),
    );
    nextComboIdRef.current += Math.ceil(itemIds.length / question.groupsA);

    const startStates = sourceItems
      .map((item) => {
        const center = getScreenCenter(itemRefs.current[item.id]);
        return center
          ? {
              itemId: item.id,
              x: center.x - 32,
              y: center.y - 32,
              durationMs: 480,
            }
          : null;
      })
      .filter(
        (
          state,
        ): state is {
          itemId: number;
          x: number;
          y: number;
          durationMs: number;
        } => state !== null,
      );

    setReturnStates(startStates);
    setItems((currentItems) =>
      currentItems.map((currentItem) => {
        const itemIndex = itemIds.indexOf(currentItem.id);
        return itemIndex >= 0
          ? {
              ...currentItem,
              containerIndex: targetContainerIndexes[itemIndex] ?? 0,
              comboId: comboIds[itemIndex] ?? null,
            }
          : currentItem;
      }),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetStates = sourceItems
          .map((item) => {
            const center = getScreenCenter(itemRefs.current[item.id]);
            return center
              ? {
                  itemId: item.id,
                  x: center.x - 32,
                  y: center.y - 32,
                  durationMs: 480,
                }
              : null;
          })
          .filter(
            (
              state,
            ): state is {
              itemId: number;
              x: number;
              y: number;
              durationMs: number;
            } => state !== null,
          );
        setReturnStates(targetStates);
      });
    });

    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
    }
    returnTimerRef.current = window.setTimeout(() => {
      setReturnStates([]);
    }, 520);
  }

  function applyCalculatorTarget(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    const targetTopCount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    const currentTopCount = getCurrentItemsInContainer(0).length;
    const sourceCount = itemsRef.current.filter(
      (item) => item.containerIndex === null,
    ).length;
    const maxAdditionalSteps = Math.ceil(sourceCount / question.groupsA);

    clearKeypadAdjustTimers();
    if (displaySyncLockRef.current !== null) {
      window.clearTimeout(displaySyncLockRef.current);
      displaySyncLockRef.current = null;
    }

    if (targetTopCount === currentTopCount) {
      setCalculatorOverride(false);
      setIsCalculatorAdjusting(false);
      return;
    }

    setIsCalculatorAdjusting(true);

    if (targetTopCount > currentTopCount) {
      const stepsToAdd = Math.min(
        targetTopCount - currentTopCount,
        maxAdditionalSteps,
      );
      if (stepsToAdd === 0) {
        setIsCalculatorAdjusting(false);
        return;
      }
      const itemCountToAdd = stepsToAdd * question.groupsA;
      const sourceItems = itemsRef.current
        .filter((item) => item.containerIndex === null)
        .sort((left, right) => left.id - right.id)
        .slice(0, itemCountToAdd);
      const itemIds = sourceItems.map((item) => item.id);
      const targetContainerIndexes = Array.from(
        { length: itemIds.length },
        (_, index) => index % question.groupsA,
      );

      lockDisplayTopBoxCount(currentTopCount + stepsToAdd, 520);
      animateItemsFromSourceToAssignments(itemIds, targetContainerIndexes);
      scheduleAdjustTimer(() => {
        setIsCalculatorAdjusting(false);
        if (targetTopCount <= currentTopCount + stepsToAdd) {
          setCalculatorOverride(false);
        }
      }, 560);
      return;
    }

    const stepsToRemove = currentTopCount - targetTopCount;
    const removableIds = Array.from({ length: stepsToRemove }, (_, rowIndex) =>
      Array.from({ length: question.groupsA }, (_, containerIndex) => {
        const itemsInContainer = getCurrentItemsInContainer(containerIndex);
        return (
          itemsInContainer[itemsInContainer.length - 1 - rowIndex]?.id ?? null
        );
      }),
    )
      .flat()
      .filter((itemId): itemId is number => itemId !== null);

    lockDisplayTopBoxCount(targetTopCount, 440);
    animateItemsToSource(removableIds);
    scheduleAdjustTimer(() => {
      setIsCalculatorAdjusting(false);
      setCalculatorOverride(false);
    }, 480);
  }

  function handleCalculatorChange(nextValue: string) {
    const digitsOnly = nextValue.replace(/\D/g, "");
    const normalizedValue =
      digitsOnly === "" ? "0" : String(Number.parseInt(digitsOnly, 10));

    setCalculatorInput(normalizedValue);
    setCalculatorOverride(true);

    clearKeypadAdjustTimers();
    keypadDebounceRef.current = window.setTimeout(() => {
      keypadDebounceRef.current = null;
      applyCalculatorTarget(normalizedValue);
    }, 360);
  }

  function handleCalculatorKeyInput(key: string) {
    return key === "." || key === "±";
  }

  function revealAnswerForCurrentQuestion() {
    markQuestionPenalty();
    clearKeypadAdjustTimers();
    setCalculatorInput(String(question.unitRate));
    setCalculatorOverride(true);
  }

  function stageComboIntoTopBox(
    itemIds: number[],
    targetContainerIndexes: number[],
    comboId: number,
    startPosition?: { x: number; y: number },
  ) {
    const finalTopBoxCount = targetContainerIndexes.filter(
      (containerIndex) => containerIndex === 0,
    ).length;
    lockDisplayTopBoxCount(finalTopBoxCount, 600);
    assignItems(itemIds, () => 0, comboId);

    const trailingItemIds = itemIds.slice(1);
    if (trailingItemIds.length === 0) {
      return;
    }

    window.setTimeout(() => {
      const fallbackCenter = getScreenCenter(containerRefs.current[0]);
      const startX =
        startPosition?.x ?? (fallbackCenter ? fallbackCenter.x - 32 : 0);
      const startY =
        startPosition?.y ?? (fallbackCenter ? fallbackCenter.y - 32 : 0);

      setReturnStates(
        trailingItemIds.map((itemId, trailingIndex) => ({
          itemId,
          x: startX + (trailingIndex + 1) * 72,
          y: startY,
          durationMs: 440,
        })),
      );

      setItems((currentItems) =>
        currentItems.map((item) => {
          const itemIndex = itemIds.indexOf(item.id);
          return itemIndex >= 1
            ? {
                ...item,
                containerIndex: targetContainerIndexes[itemIndex] ?? 0,
                comboId,
              }
            : item;
        }),
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReturnStates(
            trailingItemIds
              .map((itemId) => {
                const center = getScreenCenter(itemRefs.current[itemId]);
                return center
                  ? {
                      itemId,
                      x: center.x - 32,
                      y: center.y - 32,
                      durationMs: 440,
                    }
                  : null;
              })
              .filter(
                (
                  state,
                ): state is {
                  itemId: number;
                  x: number;
                  y: number;
                  durationMs: number;
                } => state !== null,
              ),
          );
        });
      });

      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current);
      }
      returnTimerRef.current = window.setTimeout(() => {
        setReturnStates([]);
      }, 480);
    }, 120);
  }

  function runQuestionAutopilot(mode: "retry" | "solve") {
    if (questionSolved || isQuestionDemo || revealCtaMode === "retry") {
      return;
    }

    setIsQuestionDemo(true);
    setRevealCtaMode(null);
    markQuestionPenalty();

    const targetAssignments = buildRobotTargetAssignments(
      itemsRef.current,
      question.groupsA,
      question.unitRate,
    );
    const pendingByContainer = Array.from(
      { length: comboSize },
      () => [] as number[],
    );
    itemsRef.current
      .filter((item) => targetAssignments.get(item.id) !== item.containerIndex)
      .forEach((item) => {
        const containerIndex = targetAssignments.get(item.id);
        if (
          containerIndex !== undefined &&
          containerIndex !== null &&
          containerIndex < comboSize
        ) {
          pendingByContainer[containerIndex]!.push(item.id);
        }
      });

    const comboAssignments = Array.from(
      {
        length: Math.max(
          ...pendingByContainer.map((bucket) => bucket.length),
          0,
        ),
      },
      (_, rowIndex) =>
        pendingByContainer
          .map((bucket, containerIndex) => {
            const itemId = bucket[rowIndex];
            return itemId === undefined ? null : { itemId, containerIndex };
          })
          .filter(
            (
              entry,
            ): entry is {
              itemId: number;
              containerIndex: number;
            } => entry !== null,
          ),
    ).filter((group) => group.length > 0);

    const DEMO_STEP_MS = 720;
    const DEMO_DROP_DELAY_MS = 260;

    comboAssignments.forEach((group, index) => {
      window.setTimeout(() => {
        const orderedGroup = group
          .slice()
          .sort((left, right) => left.containerIndex - right.containerIndex);
        const leadItemCenter = getScreenCenter(
          itemRefs.current[orderedGroup[0]!.itemId],
        );
        setSelectedItemIds(orderedGroup.map((entry) => entry.itemId));
        const comboId = nextComboIdRef.current;
        nextComboIdRef.current += 1;

        if (leadItemCenter) {
          setPhantomPos({ ...leadItemCenter, isClicking: false });
        }

        window.setTimeout(() => {
          const targetCenter = getScreenCenter(containerRefs.current[0]);
          if (targetCenter) {
            setPhantomPos({ ...targetCenter, isClicking: true });
          }
          stageComboIntoTopBox(
            orderedGroup.map((entry) => entry.itemId),
            orderedGroup.map((entry) => entry.containerIndex),
            comboId,
            targetCenter
              ? { x: targetCenter.x - 32, y: targetCenter.y - 32 }
              : undefined,
          );
        }, DEMO_DROP_DELAY_MS);
      }, index * DEMO_STEP_MS);
    });

    window.setTimeout(
      () => {
        setSelectedItemIds([]);
        setShowUnitReveal(true);
        setTypedStepLengths([]);
        setShowNextQuestionButton(false);
        setRevealCtaMode(mode === "retry" ? "retry" : "next");
        setPhantomPos(null);
        setIsQuestionDemo(false);
        if (mode === "solve") {
          setQuestionSolved(true);
          setFlash({ ok: true, icon: true });
          playCorrect();
        }
      },
      comboAssignments.length * DEMO_STEP_MS + 700,
    );
  }

  function handleSubmitAnswer() {
    const isCorrect =
      remainingItems.length === 0 &&
      containers.every(
        (containerItems) => containerItems.length === question.unitRate,
      );

    if (isCorrect) {
      setShowUnitReveal(true);
      setQuestionSolved(true);
      setFlash({ ok: true, icon: true });
      setRevealCtaMode("next");
      playCorrect();
      return;
    }

    setShowUnitReveal(false);
    setQuestionSolved(false);
    setFlash({ ok: false, icon: true });
    markQuestionPenalty();
    playWrong();
  }

  function handlePointerDown(
    itemId: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (isQuestionDemo || revealCtaMode === "retry" || isCalculatorAdjusting) {
      return;
    }

    ensureMusic();
    setReturnStates([]);
    const rect = event.currentTarget.getBoundingClientRect();
    const clickedItem = items.find((item) => item.id === itemId);
    if (!clickedItem) {
      return;
    }

    let itemIds: number[] = [];
    let origin: "source" | "container" = "source";
    let comboId: number | null = null;

    if (clickedItem.containerIndex === null) {
      const sourceItems = items
        .filter((item) => item.containerIndex === null)
        .sort((left, right) => left.id - right.id);
      const startIndex = sourceItems.findIndex((item) => item.id === itemId);
      itemIds = sourceItems
        .slice(startIndex, startIndex + comboSize)
        .map((item) => item.id);
      if (itemIds.length < comboSize) {
        const needed = comboSize - itemIds.length;
        itemIds = [
          ...sourceItems
            .slice(Math.max(0, startIndex - needed), startIndex)
            .map((item) => item.id),
          ...itemIds,
        ];
      }
      comboId = nextComboIdRef.current;
    } else {
      origin = "container";
      comboId = clickedItem.comboId;
      if (comboId === null) {
        return;
      }
      itemIds = items
        .filter((item) => item.comboId === comboId)
        .sort((left, right) => left.id - right.id)
        .map((item) => item.id);
    }

    if (itemIds.length === 0) {
      return;
    }

    setSelectedItemIds(itemIds);
    setDragState({
      itemIds,
      origin,
      comboId,
      isLifted: false,
      x: event.clientX - rect.width / 2,
      y: event.clientY - rect.height / 2,
    });
    dragSoundPointRef.current = {
      x: event.clientX,
      y: event.clientY,
      carry: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState) {
      return;
    }

    const sourceRect = sourceAreaRef.current?.getBoundingClientRect();
    const isOverSource = sourceRect
      ? event.clientX >= sourceRect.left &&
        event.clientX <= sourceRect.right &&
        event.clientY >= sourceRect.top &&
        event.clientY <= sourceRect.bottom
      : false;

    const topContainer = containerRefs.current[0];
    const hitIndex = topContainer
      ? (() => {
          const rect = topContainer.getBoundingClientRect();
          return event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
            ? 0
            : -1;
        })()
      : -1;

    setHoveredContainerIndex(hitIndex >= 0 ? hitIndex : null);
    setHoveredSourceArea(isOverSource);

    const lastPoint = dragSoundPointRef.current;
    if (lastPoint) {
      const dx = event.clientX - lastPoint.x;
      const dy = event.clientY - lastPoint.y;
      const distance = Math.hypot(dx, dy);
      const nextCarry = lastPoint.carry + distance;
      const STEP_PIXELS = 30;

      if (nextCarry >= STEP_PIXELS) {
        playDragStep();
      }

      dragSoundPointRef.current = {
        x: event.clientX,
        y: event.clientY,
        carry: nextCarry >= STEP_PIXELS ? nextCarry % STEP_PIXELS : nextCarry,
      };
    }

    setDragState((current) =>
      current
        ? {
            ...current,
            isLifted:
              current.isLifted ||
              Math.hypot(
                event.clientX - (current.x + 32),
                event.clientY - (current.y + 32),
              ) > 6,
            x: event.clientX - 24,
            y: event.clientY - 24,
          }
        : current,
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState) {
      return;
    }

    const sourceRect = sourceAreaRef.current?.getBoundingClientRect();
    const isOverSource = sourceRect
      ? event.clientX >= sourceRect.left &&
        event.clientX <= sourceRect.right &&
        event.clientY >= sourceRect.top &&
        event.clientY <= sourceRect.bottom
      : false;

    const topContainer = containerRefs.current[0];
    const hitIndex = topContainer
      ? (() => {
          const rect = topContainer.getBoundingClientRect();
          return event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
            ? 0
            : -1;
        })()
      : -1;

    if (hitIndex >= 0) {
      if (dragState.origin === "source") {
        const comboId = dragState.comboId ?? nextComboIdRef.current;
        stageComboIntoTopBox(
          dragState.itemIds,
          dragState.itemIds.map((_, index) => index),
          comboId,
          { x: dragState.x, y: dragState.y },
        );
        nextComboIdRef.current = comboId + 1;
        return;
      }

      return;
    }

    if (isOverSource) {
      lockDisplayTopBoxCount(0, 220);
      assignItems(dragState.itemIds, () => null, null);
      return;
    }

    const originStates = dragState.itemIds.map((itemId, index) => ({
      itemId,
      originRect: itemRefs.current[itemId]?.getBoundingClientRect(),
      x: dragState.x + index * 30,
      y: dragState.y,
    }));

    setReturnStates(originStates.map(({ itemId, x, y }) => ({ itemId, x, y })));
    setDragState(null);
    setHoveredContainerIndex(null);
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    dragSoundPointRef.current = null;

    if (originStates.some((state) => state.originRect)) {
      requestAnimationFrame(() => {
        setReturnStates(
          originStates
            .map(({ itemId, originRect }) =>
              originRect
                ? {
                    itemId,
                    x: originRect.left + originRect.width / 2 - 32,
                    y: originRect.top + originRect.height / 2 - 32,
                  }
                : null,
            )
            .filter((state): state is ReturnState => state !== null),
        );
      });
      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current);
      }
      returnTimerRef.current = window.setTimeout(() => {
        setReturnStates([]);
      }, 220);
    } else {
      setReturnStates([]);
    }
  }

  async function handleCapture(closeSnipAfterCapture = false) {
    if (!rootRef.current || !captureSceneRef.current) {
      return;
    }

    triggerCaptureFlash();

    const captureFrame = buildCaptureIframe(captureSceneRef.current);

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(captureFrame.root, {
        backgroundColor: sourceBackgroundFromRoot(captureSceneRef.current),
        scale: window.devicePixelRatio > 1 ? 2 : 1,
        useCORS: true,
      });
    } finally {
      captureFrame.iframe.remove();
    }

    let sourceCanvas = canvas;
    if (snipMode) {
      const outputCanvas = document.createElement("canvas");
      const rootRect = captureSceneRef.current.getBoundingClientRect();
      const scaleX = canvas.width / rootRect.width;
      const scaleY = canvas.height / rootRect.height;
      const sx = snipSelection.x * scaleX;
      const sy = snipSelection.y * scaleY;
      const sw = snipSelection.size * scaleX;
      const sh = snipSelection.size * scaleY;
      outputCanvas.width = sw;
      outputCanvas.height = sh;
      const ctx = outputCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      }
      sourceCanvas = outputCanvas;
    }

    await downloadCanvasPng(
      sourceCanvas,
      snipMode ? "pack-it-snip.png" : "pack-it-screenshot.png",
    );

    if (closeSnipAfterCapture && snipMode) {
      closeSnipMode();
    }
  }

  function makeDefaultSnipSelection() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    const size = Math.max(120, Math.min(Math.min(rect.width, rect.height) * 0.42, 280));
    return {
      x: (rect.width - size) / 2,
      y: (rect.height - size) / 2,
      size,
    } satisfies SquareSnip;
  }

  function clampSnipSelection(next: SquareSnip) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return next;
    }
    const maxSize = Math.max(96, Math.min(rect.width, rect.height));
    const size = Math.max(96, Math.min(next.size, maxSize));
    return {
      x: Math.min(Math.max(0, next.x), rect.width - size),
      y: Math.min(Math.max(0, next.y), rect.height - size),
      size,
    };
  }

  function closeSnipMode() {
    snipDragRef.current = null;
    setSnipMode(false);
  }

  function triggerCaptureFlash() {
    playCameraShutter();
    setCaptureFlashVisible(true);
    if (captureFlashTimerRef.current !== null) {
      window.clearTimeout(captureFlashTimerRef.current);
    }
    captureFlashTimerRef.current = window.setTimeout(() => {
      setCaptureFlashVisible(false);
    }, 180);
  }

  async function handleCaptureSnip() {
    await handleCapture(true);
  }

  function toggleSquareSnip() {
    setSnipMode((current) => {
      const next = !current;
      if (next && !rootRef.current) {
        return current;
      }
      if (next) {
        const initial = makeDefaultSnipSelection();
        if (initial) {
          setSnipSelection(initial);
        }
      } else {
        snipDragRef.current = null;
      }
      return next;
    });
  }

  useEffect(() => {
    if (!snipMode) {
      snipDragRef.current = null;
      return;
    }

    function onMove(event: PointerEvent) {
      const drag = snipDragRef.current;
      if (!drag) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (drag.mode === "move") {
        setSnipSelection(
          clampSnipSelection({
            ...drag.initial,
            x: drag.initial.x + dx,
            y: drag.initial.y + dy,
          }),
        );
        return;
      }

      const delta = Math.max(dx, dy);
      setSnipSelection(
        clampSnipSelection({
          ...drag.initial,
          size: drag.initial.size + delta,
        }),
      );
    }

    function onUp(event: PointerEvent) {
      if (snipDragRef.current?.pointerId !== event.pointerId) {
        return;
      }
      snipDragRef.current = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeSnipMode();
    }

    function onResize() {
      setSnipSelection((current) => clampSnipSelection(current));
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [snipMode, snipSelection]);

  function stopRecording(download = true) {
    if (demoTimerRef.current !== null) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      const recorder = recorderRef.current;
      recorder.onstop = () => {
        if (download) {
          const blob = new Blob(recordingChunksRef.current, {
            type: recorder.mimeType || "video/webm",
          });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `pack-it-demo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`;
          anchor.click();
          URL.revokeObjectURL(url);
        }
        recordingChunksRef.current = [];
      };
      recorder.stop();
    }

    if (recordingStreamRef.current) {
      for (const track of recordingStreamRef.current.getTracks()) {
        track.stop();
      }
      recordingStreamRef.current = null;
    }

    recorderRef.current = null;
    setIsRecordingDemo(false);
  }

  async function handleRecordDemo() {
    if (isRecordingDemo) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9,opus",
      )
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      setIsRecordingDemo(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      stream
        .getVideoTracks()[0]
        ?.addEventListener("ended", () => stopRecording(true));
      recorder.start(1000);
      demoTimerRef.current = window.setTimeout(
        () => stopRecording(true),
        15000,
      );
    } catch {
      stopRecording(false);
    }
  }

  function getScreenCenter(
    node: HTMLElement | null,
  ): { x: number; y: number } | null {
    if (!node) {
      return null;
    }

    const rect = node.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function solveCurrentQuestion() {
    runQuestionAutopilot("retry");
  }

  function animateItemsBackToSource() {
    const packedItems = items.filter((item) => item.containerIndex !== null);

    if (packedItems.length === 0) {
      setShowUnitReveal(false);
      setTypedStepLengths([]);
      setShowNextQuestionButton(false);
      setRevealCtaMode(null);
      return;
    }

    setShowUnitReveal(false);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setHoveredContainerIndex(null);
    setHoveredSourceArea(false);

    const startStates = packedItems
      .map((item) => {
        const center = getScreenCenter(itemRefs.current[item.id]);
        return center
          ? { itemId: item.id, x: center.x - 32, y: center.y - 32 }
          : null;
      })
      .filter((state): state is ReturnState => state !== null);

    setReturnStates(startStates);
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.containerIndex !== null
          ? { ...currentItem, containerIndex: null }
          : currentItem,
      ),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetStates = packedItems
          .map((item) => {
            const center = getScreenCenter(itemRefs.current[item.id]);
            return center
              ? { itemId: item.id, x: center.x - 32, y: center.y - 32 }
              : null;
          })
          .filter((state): state is ReturnState => state !== null);
        setReturnStates(targetStates);
      });
    });

    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
    }
    returnTimerRef.current = window.setTimeout(() => {
      setReturnStates([]);
    }, 220);
  }

  function goToNextQuestion() {
    if (questionIndex === round.questions.length - 1) {
      setIsRoundComplete(true);
      playLevelComplete();
      return;
    }

    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setItems(buildInitialItems(round.questions[nextIndex]));
    setShowUnitReveal(false);
    setQuestionSolved(false);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setDragState(null);
    setHoveredContainerIndex(null);
    setReturnStates([]);
    setPhantomPos(null);
    setIsQuestionDemo(false);
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setIsCalculatorAdjusting(false);
    clearKeypadAdjustTimers();
  }

  function handleNowYourTurn() {
    handleRestart();
  }

  useEffect(() => {
    function handleCheatCodes(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable ||
        !/^\d$/.test(event.key)
      ) {
        return;
      }

      cheatBufferRef.current = `${cheatBufferRef.current}${event.key}`.slice(
        -6,
      );

      if (cheatBufferRef.current === "197879") {
        revealAnswerForCurrentQuestion();
        cheatBufferRef.current = "";
        return;
      }

      if (cheatBufferRef.current === "198081") {
        clearKeypadAdjustTimers();
        if (displaySyncLockRef.current !== null) {
          window.clearTimeout(displaySyncLockRef.current);
          displaySyncLockRef.current = null;
        }
        setCalculatorInput("0");
        setCalculatorOverride(false);
        setDisplayTopBoxCount(0);
        continuousAutopilotStartIndexRef.current = questionIndex;
        setIsContinuousAutopilot(true);
        cheatBufferRef.current = "";
        if (!questionSolved && !isQuestionDemo && revealCtaMode !== "retry") {
          runQuestionAutopilot("solve");
        }
      }
    }

    window.addEventListener("keydown", handleCheatCodes);
    return () => {
      window.removeEventListener("keydown", handleCheatCodes);
    };
  }, [question.unitRate]);

  useEffect(() => {
    if (!isContinuousAutopilot) {
      return;
    }

    const solvedCount =
      questionIndex -
      continuousAutopilotStartIndexRef.current +
      (questionSolved ? 1 : 0);

    if (isRoundComplete) {
      setIsContinuousAutopilot(false);
      setPhantomPos(null);
      return;
    }

    if (questionSolved && showNextQuestionButton && revealCtaMode === "next") {
      if (solvedCount >= AUTOPILOT_QUESTION_COUNT) {
        setIsContinuousAutopilot(false);
        return;
      }
      if (autopilotAdvanceTimerRef.current !== null) {
        window.clearTimeout(autopilotAdvanceTimerRef.current);
      }
      autopilotAdvanceTimerRef.current = window.setTimeout(() => {
        autopilotAdvanceTimerRef.current = null;
        goToNextQuestion();
      }, 800);
      return;
    }

    if (!questionSolved && !isQuestionDemo && revealCtaMode !== "retry") {
      if (continuousAutopilotStartTimerRef.current !== null) {
        window.clearTimeout(continuousAutopilotStartTimerRef.current);
      }
      continuousAutopilotStartTimerRef.current = window.setTimeout(() => {
        continuousAutopilotStartTimerRef.current = null;
        runQuestionAutopilot("solve");
      }, 0);
    }
  }, [
    isContinuousAutopilot,
    isQuestionDemo,
    isRoundComplete,
    questionIndex,
    questionSolved,
    revealCtaMode,
    showNextQuestionButton,
  ]);

  const visibleStepLines = showUnitReveal
    ? question.blackboardSteps
        .map((line, index) => line.slice(0, typedStepLengths[index] ?? 0))
        .filter((line) => line.length > 0)
    : [];
  const visibleQuestionText = isRoundComplete
    ? ""
    : question.questionText.slice(0, typedQuestionLength);

  const questionPanel = ({
    calculatorMinimized,
    toggleCalculatorMinimized,
  }: {
    calculatorMinimized: boolean;
    toggleCalculatorMinimized: () => void;
  }) => (
    <div
      className="flex h-full gap-0"
      style={{
        height: calculatorMinimized ? "4.5rem" : undefined,
        minHeight: calculatorMinimized ? "4.5rem" : "10.5rem",
        transition: `height ${DOCK_TRANSITION}, min-height ${DOCK_TRANSITION}`,
      }}
    >
      <div
        className="font-arcade flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[1.1rem] border-[3px] border-slate-400 bg-slate-950"
        style={{
          boxShadow:
            "0 0 0 2px rgba(15,23,42,0.55), 0 10px 24px rgba(2,6,23,0.38)",
        }}
      >
        <div
          className="flex cursor-pointer items-center bg-slate-900 px-5 text-[1.15rem] font-semibold leading-relaxed text-white"
          onClick={toggleCalculatorMinimized}
          style={{
            minHeight: calculatorMinimized ? "100%" : "4.25rem",
            paddingTop: calculatorMinimized ? "0.25rem" : "0.5rem",
            paddingBottom: calculatorMinimized ? "0.25rem" : "0.5rem",
            transition: `min-height ${DOCK_TRANSITION}, padding ${DOCK_TRANSITION}`,
            letterSpacing: "0.015em",
          }}
        >
          {isRoundComplete ? (
            <span style={{ color: "#facc15" }}>
              Round complete. Score: {score}/{round.questions.length}
            </span>
          ) : (
            renderHighlightedQuestion(visibleQuestionText)
          )}
        </div>
        <div
          className="flex-1 bg-slate-950"
          style={{
            maxHeight: calculatorMinimized ? "0px" : "14rem",
            opacity: calculatorMinimized ? 0 : 1,
            overflow: "hidden",
            transition: `max-height ${DOCK_TRANSITION}, opacity ${DOCK_TRANSITION}`,
          }}
        >
          <div className="border-t border-slate-500/90" />
          <div className="min-h-[5.6rem] h-full bg-slate-950 px-5 py-4 text-[1.05rem] font-semibold leading-relaxed text-slate-100">
            {visibleStepLines.length > 0
              ? visibleStepLines.map((line, index) => {
                  const isLastVisibleLine =
                    index === visibleStepLines.length - 1;
                  const isFinalLine =
                    index === question.blackboardSteps.length - 1 &&
                    (typedStepLengths[index] ?? 0) >=
                      question.blackboardSteps[index]!.length;
                  return (
                    <div key={`${index}-${line}`}>
                      {renderHighlightedQuestion(line)}
                      {isLastVisibleLine &&
                      isFinalLine &&
                      showNextQuestionButton ? (
                        <button
                          type="button"
                          onClick={
                            revealCtaMode === "retry"
                              ? handleNowYourTurn
                              : goToNextQuestion
                          }
                          className="ml-4 inline-flex h-[2rem] items-center rounded-full border-[3px] border-yellow-300 bg-orange-700 px-4 font-arcade text-[0.82rem] font-bold leading-none text-white align-middle"
                          style={{
                            boxShadow:
                              "0 0 10px rgba(250,204,21,0.18), 0 0 0 2px rgba(124,45,18,0.45)",
                          }}
                        >
                          {revealCtaMode === "retry"
                            ? "Now you try it"
                            : "Next question"}
                        </button>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <GameLayout
        muted={muted}
        onToggleMute={handleToggleMute}
        onRestart={handleRestart}
        keypadValue={
          calculatorOverride ? calculatorInput : String(displayTopBoxCount)
        }
        onKeypadChange={handleCalculatorChange}
        onKeypadKeyInput={handleCalculatorKeyInput}
        onCapture={handleCapture}
        onToggleSquareSnip={toggleSquareSnip}
        squareSnipActive={snipMode}
        onRecordDemo={handleRecordDemo}
        isRecordingDemo={isRecordingDemo}
        onQuestionDemo={solveCurrentQuestion}
        isQuestionDemo={isQuestionDemo}
        onKeypadSubmit={handleSubmitAnswer}
        canSubmit={canSubmit}
        progress={autopilotProgress}
        progressTotal={progressTotal}
        levelCount={4}
        currentLevel={1}
        unlockedLevel={1}
        questionPanel={questionPanel}
        children={() => (
        <div
          ref={rootRef}
          data-pack-it-capture-root="true"
          className="h-full w-full overflow-hidden bg-slate-950"
          onPointerDownCapture={ensureAudioReady}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
            <div className="flex h-full flex-col px-6 pb-3 pt-[3.6rem]">
              <div className="relative flex-1 overflow-hidden bg-transparent">
                <div
                  ref={captureSceneRef}
                  className="absolute inset-0 bg-slate-950"
                  data-pack-it-capture-root="true"
                >
                  {false ? (
                    <div
                      className="pointer-events-none absolute left-1/2 z-[8] -translate-x-1/2"
                      style={{ top: "-0.75rem" }}
                    >
                      <button
                        type="button"
                        className="pointer-events-auto rounded-full border-[3px] border-yellow-300 bg-slate-900 px-6 py-2 font-arcade text-[1rem] font-bold text-yellow-200"
                        style={{
                          boxShadow:
                            "0 0 16px rgba(250,204,21,0.22), 0 8px 18px rgba(2,6,23,0.35)",
                        }}
                        onClick={animateItemsBackToSource}
                      >
                        Now you try it
                      </button>
                    </div>
                  ) : null}
                  <div
                    className="pointer-events-none absolute z-[1] w-[2px] bg-white"
                    style={{
                      left: "46.25%",
                      top: "0",
                      height: "99%",
                      opacity: 0.2,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-[1] h-[2px] bg-white"
                    style={{ top: "91%", opacity: 0.2 }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-[2]"
                    style={{ top: "calc(94.25% - 4px)" }}
                  >
                    <div className="grid grid-cols-2">
                      <div className="flex justify-center">
                        <DigitalCount value={remainingItems.length} />
                      </div>
                      <div className="flex justify-center">
                        <DigitalCount value={packedItemsTotal} />
                      </div>
                    </div>
                  </div>

                  <div className="relative z-[3] grid h-full grid-cols-[45.5%_calc(54.5%-2rem)] gap-8 px-0 pb-3 pt-7">
                    <div
                      ref={sourceAreaRef}
                      className="relative h-full bg-transparent pl-4 pr-5 pt-4"
                      style={{
                        boxShadow: hoveredSourceArea
                          ? "inset 0 0 0 2px rgba(250,204,21,0.45), 0 0 18px rgba(250,204,21,0.18)"
                          : "none",
                      }}
                    >
                      <div className="flex min-h-[7rem] flex-wrap content-start justify-start gap-4">
                        {items
                          .slice()
                          .sort((a, b) => a.id - b.id)
                          .map((item) =>
                            item.containerIndex === null ? (
                              <button
                                key={item.id}
                                ref={(node) => {
                                  itemRefs.current[item.id] = node;
                                }}
                                type="button"
                                aria-label={`${question.pair.item} ${item.id + 1}`}
                                onPointerDown={(event) =>
                                  handlePointerDown(item.id, event)
                                }
                                className="relative flex h-16 w-16 items-center justify-center rounded-full border-0 bg-transparent text-[3.1rem] outline-none transition-transform active:scale-95 focus:outline-none"
                                style={{
                                  appearance: "none",
                                  WebkitAppearance: "none",
                                  boxShadow: "none",
                                  opacity:
                                    (dragState?.isLifted &&
                                      draggedItemIds.has(item.id)) ||
                                    returningItemIds.has(item.id)
                                      ? 0
                                      : 1,
                                  pointerEvents:
                                    revealCtaMode === "retry" || isQuestionDemo
                                      ? "none"
                                      : "auto",
                                }}
                              >
                                {selectedItemIdSet.has(item.id) &&
                                !dragState?.isLifted ? (
                                  <span
                                    className="pointer-events-none absolute inset-0 rounded-full"
                                    style={{
                                      boxShadow:
                                        "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                                      transform: "translateY(-4px)",
                                    }}
                                  />
                                ) : null}
                                <span className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center">
                                  {question.pair.itemEmoji}
                                </span>
                              </button>
                            ) : (
                              <div
                                key={item.id}
                                aria-hidden="true"
                                className="h-16 w-16 shrink-0"
                              />
                            ),
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 content-start pt-1">
                      {containers.map((containerItems, index) =>
                        (() => {
                        const isHovered =
                          hoveredContainerIndex === index &&
                          dragState?.origin === "source";
                        const isDisabledBox = index !== 0;
                        const isOverfilled =
                          containerItems.length > question.unitRate;
                        const isCorrect =
                          containerItems.length === question.unitRate;
                        const borderColor = isHovered
                          ? "#facc15"
                          : isOverfilled
                            ? "#f87171"
                            : isCorrect
                              ? "#86efac"
                              : isDisabledBox
                                ? "rgba(100,116,139,0.4)"
                                : "#475569";
                        const counterColor = isOverfilled
                          ? "#f87171"
                          : isCorrect
                            ? "#86efac"
                            : isDisabledBox
                              ? "rgba(103,232,249,0.42)"
                              : "#67e8f9";
                        const counterGlow = isOverfilled
                          ? "rgba(248,113,113,0.72)"
                          : isCorrect
                            ? "rgba(134,239,172,0.72)"
                            : isDisabledBox
                              ? "rgba(103,232,249,0.28)"
                              : "rgba(103,232,249,0.72)";
                        const counterGlowOuter = isOverfilled
                          ? "rgba(239,68,68,0.26)"
                          : isCorrect
                            ? "rgba(34,197,94,0.26)"
                            : isDisabledBox
                              ? "rgba(56,189,248,0.1)"
                              : "rgba(56,189,248,0.26)";

                        return (
                          <div
                            key={`${questionIndex}-${index}`}
                            ref={(node) => {
                              containerRefs.current[index] = node;
                            }}
                            className="relative min-h-[5rem] overflow-hidden rounded-[1.35rem] border-[3px] px-4 py-[0.35rem]"
                            style={{
                              borderColor,
                              background: "transparent",
                              boxShadow: isHovered
                                ? "0 0 18px rgba(250,204,21,0.3)"
                                : isDisabledBox
                                  ? "none"
                                  : "none",
                              opacity: isDisabledBox ? 0.78 : 1,
                            }}
                          >
                            <div className="pointer-events-none absolute right-4 top-1/2 z-[2] -translate-y-1/2">
                              <DigitalCount
                                value={containerItems.length}
                                color={counterColor}
                                glow={counterGlow}
                                glowOuter={counterGlowOuter}
                              />
                            </div>
                            <div className="flex min-h-[3.15rem] max-w-[calc(100%-5.5rem)] flex-wrap items-center content-center justify-start gap-2 pr-2">
                              {containerItems.map((item) => (
                                <button
                                  key={item.id}
                                  ref={(node) => {
                                    itemRefs.current[item.id] = node;
                                  }}
                                  type="button"
                                  aria-label={`Remove ${question.pair.item} from ${question.pair.container} ${index + 1}`}
                                  onPointerDown={(event) =>
                                    index === 0
                                      ? handlePointerDown(item.id, event)
                                      : undefined
                                  }
                                  className="relative flex h-16 w-16 items-center justify-center bg-transparent text-[3.1rem] leading-none"
                                  style={{
                                    opacity:
                                      (dragState?.isLifted &&
                                        draggedItemIds.has(item.id)) ||
                                      returningItemIds.has(item.id)
                                        ? 0
                                        : isDisabledBox
                                          ? 0.46
                                          : 1,
                                    pointerEvents:
                                      revealCtaMode === "retry" ||
                                      isQuestionDemo ||
                                      index !== 0
                                        ? "none"
                                        : "auto",
                                  }}
                                >
                                  {selectedItemIdSet.has(item.id) &&
                                  !dragState?.isLifted ? (
                                    <span
                                      className="pointer-events-none absolute inset-0 rounded-full"
                                      style={{
                                        boxShadow:
                                          "0 0 0 3px rgba(250,204,21,0.82), 0 0 0 8px rgba(250,204,21,0.14), 0 0 14px rgba(250,204,21,0.2)",
                                        transform: "translateY(-4px)",
                                      }}
                                    />
                                  ) : null}
                                  <span
                                    className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                                    style={{ transform: "translateY(4px)" }}
                                  >
                                    {question.pair.itemEmoji}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })(),
                    )}
                  </div>
                </div>

                {dragState?.isLifted ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none fixed z-[70] flex items-center gap-2 rounded-full bg-transparent"
                    style={{
                      left: dragState.x,
                      top: dragState.y,
                    }}
                  >
                    {dragState.itemIds.map((itemId) => (
                      <span
                        key={`drag-${itemId}`}
                        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                      >
                        <span
                          className="pointer-events-none absolute inset-0 rounded-full"
                          style={{
                            boxShadow:
                              "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                            transform: "translateY(-4px)",
                          }}
                        />
                        <span className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center">
                          {question.pair.itemEmoji}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {returnStates.map((returnState) => (
                  <div
                    key={`return-${returnState.itemId}`}
                    aria-hidden="true"
                    className="pointer-events-none fixed z-[69] flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                    style={{
                      left: returnState.x,
                      top: returnState.y,
                      transition: `left ${returnState.durationMs ?? 220}ms ease-out, top ${returnState.durationMs ?? 220}ms ease-out`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        boxShadow:
                          "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                        transform: "translateY(-4px)",
                      }}
                    />
                    <span className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center">
                      {question.pair.itemEmoji}
                    </span>
                  </div>
                ))}
                </div>

                {snipMode ? (
                  <div
                    className="pointer-events-auto absolute inset-0 z-[82]"
                    data-capture-ignore="true"
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <div
                      className="absolute rounded-2xl"
                      style={{
                        left: snipSelection.x,
                        top: snipSelection.y,
                        width: snipSelection.size,
                        height: snipSelection.size,
                        border: "2px dashed rgba(255,255,255,0.95)",
                        boxShadow: "0 0 0 9999px rgba(2,6,23,0.22)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <button
                        type="button"
                        title="Capture square snip"
                        onClick={handleCaptureSnip}
                        className="arcade-button absolute -left-3 -top-3 z-[2] h-10 w-10 p-1.5"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
                          <path
                            d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12.5" r="3.25" stroke="white" strokeWidth="2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Close square snip"
                        title="Close square snip"
                        onClick={closeSnipMode}
                        className="arcade-button absolute -right-3 -top-3 z-[2] flex h-10 w-10 items-center justify-center p-1.5"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-full w-full"
                          stroke="white"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        >
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Move square snip"
                        title="Drag to move"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          snipDragRef.current = {
                            mode: "move",
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            initial: snipSelection,
                          };
                        }}
                        className="absolute inset-0 cursor-move rounded-2xl"
                        style={{ background: "transparent" }}
                      />
                      <button
                        type="button"
                        aria-label="Resize square snip"
                        title="Drag to resize"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          snipDragRef.current = {
                            mode: "resize",
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            initial: snipSelection,
                          };
                        }}
                        className="absolute -bottom-3 -right-3 z-[2] h-7 w-7 rounded-full border-2 border-white bg-sky-400/90"
                        style={{ boxShadow: "0 0 18px rgba(56,189,248,0.45)" }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <PhantomHand pos={phantomPos} />
          </div>
        )}
      />
      {captureFlashVisible && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[120]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.7) 22%, rgba(255,255,255,0.18) 52%, rgba(255,255,255,0) 78%)",
          }}
        />
      )}
      {flash?.icon &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{ left: "16px", top: "16px" }}
          >
            {flash.ok ? (
              <svg
                viewBox="0 0 120 120"
                width="64"
                height="64"
                style={{
                  display: "block",
                  animation:
                    "icon-drop-left 1.15s cubic-bezier(0.22,0.72,0.2,1) forwards",
                  filter:
                    "drop-shadow(0 0 12px #4ade80) drop-shadow(0 0 24px #16a34a)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#14532d" />
                <path
                  d="M30 62 L50 82 L90 38"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 120 120"
                width="64"
                height="64"
                style={{
                  display: "block",
                  animation:
                    "icon-drop-left 1.15s cubic-bezier(0.22,0.72,0.2,1) forwards",
                  filter:
                    "drop-shadow(0 0 12px #f87171) drop-shadow(0 0 24px #b91c1c)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#7f1d1d" />
                <path
                  d="M38 38 L82 82 M82 38 L38 82"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
