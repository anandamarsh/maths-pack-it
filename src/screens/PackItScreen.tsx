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
};

type DragState = {
  itemId: number;
  x: number;
  y: number;
};

type ReturnState = {
  itemId: number;
  x: number;
  y: number;
};

type SquareSnip = {
  x: number;
  y: number;
  size: number;
};

type FlashFeedback = {
  ok: boolean;
  icon: true;
} | null;

type RevealCtaMode = "next" | "retry" | null;

const QUESTION_COUNT = 10;
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
  const [mistakeQuestionIndexes, setMistakeQuestionIndexes] = useState<number[]>(
    [],
  );
  const [typedQuestionLength, setTypedQuestionLength] = useState(0);
  const [typedStepLengths, setTypedStepLengths] = useState<number[]>([]);
  const [showNextQuestionButton, setShowNextQuestionButton] = useState(false);
  const [revealCtaMode, setRevealCtaMode] = useState<RevealCtaMode>(null);
  const [questionResetKey, setQuestionResetKey] = useState(0);
  const [snipMode, setSnipMode] = useState(false);
  const [snipSelection, setSnipSelection] = useState<SquareSnip>({
    x: 24,
    y: 24,
    size: 240,
  });
  const [isRecordingDemo, setIsRecordingDemo] = useState(false);
  const [isQuestionDemo, setIsQuestionDemo] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);
  const [hoveredSourceArea, setHoveredSourceArea] = useState(false);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sourceAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const musicStartedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const demoTimerRef = useRef<number | null>(null);
  const returnTimerRef = useRef<number | null>(null);
  const questionTypeIntervalRef = useRef<number | null>(null);
  const stepTypeIntervalRef = useRef<number | null>(null);
  const stepTypeDelayRef = useRef<number | null>(null);
  const dragSoundPointRef = useRef<{
    x: number;
    y: number;
    carry: number;
  } | null>(null);

  const question = round.questions[questionIndex];
  const containers = Array.from({ length: question.groupsA }, (_, index) =>
    items.filter((item) => item.containerIndex === index),
  );
  const remainingItems = items.filter((item) => item.containerIndex === null);
  const packedItemsTotal = items.length - remainingItems.length;
  const canSubmit = packedItemsTotal > 0 && revealCtaMode === null && !isQuestionDemo;
  const score = round.questions.length - mistakeQuestionIndexes.length;
  const returningItemIds = new Set(returnStates.map((state) => state.itemId));

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
            }, 3000);
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
      if (nextLength >= fullText.length && questionTypeIntervalRef.current !== null) {
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
    setQuestionResetKey((current) => current + 1);
    dragSoundPointRef.current = null;
  }

  function assignItemToContainer(
    itemId: number,
    containerIndex: number | null,
  ) {
    ensureMusic();
    playRipple(340 + (containerIndex ?? 0) * 45);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              containerIndex,
            }
          : item,
      ),
    );
    setDragState(null);
    setHoveredContainerIndex(null);
    setHoveredSourceArea(false);
    setReturnStates([]);
    dragSoundPointRef.current = null;
  }

  function handleSubmitAnswer() {
    const isCorrect =
      remainingItems.length === 0 &&
      containers.every((containerItems) => containerItems.length === question.unitRate);

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
    if (isQuestionDemo || revealCtaMode === "retry") {
      return;
    }

    ensureMusic();
    setReturnStates([]);
    const rect = event.currentTarget.getBoundingClientRect();
    setDragState({
      itemId,
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

    const hitIndex = containerRefs.current.findIndex((node) => {
      if (!node) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    });

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

    setDragState({
      ...dragState,
      x: event.clientX - 24,
      y: event.clientY - 24,
    });
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

    const hitIndex = containerRefs.current.findIndex((node) => {
      if (!node) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    });

    if (hitIndex >= 0) {
      assignItemToContainer(dragState.itemId, hitIndex);
      return;
    }

    if (isOverSource) {
      assignItemToContainer(dragState.itemId, null);
      return;
    }

    const draggedItemId = dragState.itemId;
    const originNode = itemRefs.current[draggedItemId];
    const originRect = originNode?.getBoundingClientRect();
    setReturnStates([
      {
        itemId: draggedItemId,
        x: dragState.x,
        y: dragState.y,
      },
    ]);
    setDragState(null);
    setHoveredContainerIndex(null);
    setHoveredSourceArea(false);
    dragSoundPointRef.current = null;

    if (originRect) {
      requestAnimationFrame(() => {
        setReturnStates([
          {
            itemId: draggedItemId,
            x: originRect.left + originRect.width / 2 - 32,
            y: originRect.top + originRect.height / 2 - 32,
          },
        ]);
      });
      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current);
      }
      window.setTimeout(() => {
        setReturnStates((current) =>
          current.filter((state) => state.itemId !== draggedItemId),
        );
      }, 220);
    } else {
      setReturnStates([]);
    }
  }

  async function handleCapture() {
    if (!rootRef.current) {
      return;
    }

    const canvas = await html2canvas(rootRef.current, {
      backgroundColor: "#f8fafc",
      scale: window.devicePixelRatio > 1 ? 2 : 1,
    });

    let sourceCanvas = canvas;
    if (snipMode) {
      const outputCanvas = document.createElement("canvas");
      const rootRect = rootRef.current.getBoundingClientRect();
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

    sourceCanvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      playCameraShutter();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = snipMode
        ? "pack-it-snip.png"
        : "pack-it-screenshot.png";
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  function toggleSquareSnip() {
    setSnipMode((current) => !current);
  }

  function moveSnip(event: ReactPointerEvent<HTMLDivElement>) {
    if (!snipMode || !rootRef.current) {
      return;
    }

    const rect = rootRef.current.getBoundingClientRect();
    const size = snipSelection.size;
    const x = Math.max(
      0,
      Math.min(event.clientX - rect.left - size / 2, rect.width - size),
    );
    const y = Math.max(
      0,
      Math.min(event.clientY - rect.top - size / 2, rect.height - size),
    );
    setSnipSelection((current) => ({ ...current, x, y }));
  }

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
    if (questionSolved || isQuestionDemo || revealCtaMode === "retry") {
      return;
    }

    setIsQuestionDemo(true);
    setRevealCtaMode(null);
    markQuestionPenalty();

    const targetAssignments = buildRobotTargetAssignments(
      items,
      question.groupsA,
      question.unitRate,
    );
    const assignments = items
      .filter((item) => targetAssignments.get(item.id) !== item.containerIndex)
      .map((item) => ({
        itemId: item.id,
        containerIndex: targetAssignments.get(item.id) ?? null,
      }));

    const DEMO_STEP_MS = 480;
    const DEMO_DROP_DELAY_MS = 240;

    assignments.forEach((assignment, index) => {
      window.setTimeout(() => {
        const itemCenter = getScreenCenter(itemRefs.current[assignment.itemId]);
        if (itemCenter) {
          setPhantomPos({ ...itemCenter, isClicking: false });
        }

        window.setTimeout(() => {
          const targetCenter =
            assignment.containerIndex === null
              ? getScreenCenter(sourceAreaRef.current)
              : getScreenCenter(containerRefs.current[assignment.containerIndex]);
          if (targetCenter) {
            setPhantomPos({ ...targetCenter, isClicking: true });
          }
          assignItemToContainer(assignment.itemId, assignment.containerIndex);
        }, DEMO_DROP_DELAY_MS);
      }, index * DEMO_STEP_MS);
    });

    window.setTimeout(
      () => {
        setShowUnitReveal(true);
        setTypedStepLengths([]);
        setShowNextQuestionButton(false);
        setRevealCtaMode("retry");
        setPhantomPos(null);
        setIsQuestionDemo(false);
      },
      assignments.length * DEMO_STEP_MS + 650,
    );
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
  }

  function handleNowYourTurn() {
    handleRestart();
  }

  const visibleStepLines = showUnitReveal
    ? question.blackboardSteps
        .map((line, index) => line.slice(0, typedStepLengths[index] ?? 0))
        .filter((line) => line.length > 0)
    : [];
  const visibleQuestionText = isRoundComplete
    ? ""
    : question.questionText.slice(0, typedQuestionLength);

  const questionPanel = (
    <div className="flex h-full min-h-[10.5rem] gap-0">
      <div
        className="font-arcade flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[1.1rem] border-[3px] border-slate-400 bg-slate-900"
        style={{
          boxShadow:
            "0 0 0 2px rgba(15,23,42,0.55), 0 10px 24px rgba(2,6,23,0.38)",
        }}
      >
        <div
          className="flex min-h-[4.25rem] items-center px-5 py-2 text-[1.15rem] font-semibold leading-relaxed text-white"
          style={{ letterSpacing: "0.015em" }}
        >
          {isRoundComplete ? (
            <span style={{ color: "#facc15" }}>
              Round complete. Score: {score}/{round.questions.length}
            </span>
          ) : (
            renderHighlightedQuestion(visibleQuestionText)
          )}
        </div>
        <div className="border-t border-slate-500/90" />
        <div className="min-h-[5.6rem] flex-1 bg-slate-950 px-5 py-4 text-[1.05rem] font-semibold leading-relaxed text-slate-100">
          {visibleStepLines.length > 0
            ? visibleStepLines.map((line, index) => {
                const isLastVisibleLine = index === visibleStepLines.length - 1;
                const isFinalLine =
                  index === question.blackboardSteps.length - 1 &&
                  (typedStepLengths[index] ?? 0) >= question.blackboardSteps[index]!.length;
                return (
                  <div key={`${index}-${line}`}>
                    {renderHighlightedQuestion(line)}
                    {isLastVisibleLine && isFinalLine && showNextQuestionButton ? (
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
                        {revealCtaMode === "retry" ? "Now you try it" : "Next question"}
                      </button>
                    ) : null}
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );

  return (
    <GameLayout
      muted={muted}
      onToggleMute={handleToggleMute}
      onRestart={handleRestart}
      keypadValue={showUnitReveal ? String(question.unitRate) : ""}
      onKeypadChange={() => {}}
      onCapture={handleCapture}
      onToggleSquareSnip={toggleSquareSnip}
      squareSnipActive={snipMode}
      onRecordDemo={handleRecordDemo}
      isRecordingDemo={isRecordingDemo}
      onQuestionDemo={solveCurrentQuestion}
      isQuestionDemo={isQuestionDemo}
      onKeypadSubmit={handleSubmitAnswer}
      canSubmit={canSubmit}
      forceKeypadExpanded
      progress={questionIndex + (questionSolved ? 1 : 0)}
      progressTotal={QUESTION_COUNT}
      levelCount={4}
      currentLevel={1}
      unlockedLevel={1}
      questionPanel={questionPanel}
    >
      <div
        ref={rootRef}
        className="h-full w-full overflow-hidden bg-slate-950"
        onPointerDownCapture={ensureAudioReady}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={moveSnip}
      >
        <div className="flex h-full flex-col px-6 pb-[14.5rem] pt-[3.6rem]">
          <div className="relative flex-1 overflow-hidden bg-transparent">
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
              style={{ left: "45.5%", top: "4%", height: "93%", opacity: 0.2 }}
            />
            <div
              className="pointer-events-none absolute left-0 right-0 z-[1] h-[2px] bg-white"
              style={{ top: "90%", opacity: 0.2 }}
            />
            <div
              className="pointer-events-none absolute left-0 right-0 z-[2]"
              style={{ top: "calc(92.5% - 4px)" }}
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
                              dragState?.itemId === item.id ||
                              returningItemIds.has(item.id)
                                ? 0
                                : 1,
                            pointerEvents: revealCtaMode === "retry" || isQuestionDemo ? "none" : "auto",
                          }}
                        >
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
                {containers.map((containerItems, index) => (
                  (() => {
                    const isHovered = hoveredContainerIndex === index;
                    const isOverfilled = containerItems.length > question.unitRate;
                    const isCorrect = containerItems.length === question.unitRate;
                    const borderColor = isHovered
                      ? "#facc15"
                      : isOverfilled
                        ? "#f87171"
                        : isCorrect
                          ? "#86efac"
                          : "#475569";
                    const counterColor = isOverfilled
                      ? "#f87171"
                      : isCorrect
                        ? "#86efac"
                        : "#67e8f9";
                    const counterGlow = isOverfilled
                      ? "rgba(248,113,113,0.72)"
                      : isCorrect
                        ? "rgba(134,239,172,0.72)"
                        : "rgba(103,232,249,0.72)";
                    const counterGlowOuter = isOverfilled
                      ? "rgba(239,68,68,0.26)"
                      : isCorrect
                        ? "rgba(34,197,94,0.26)"
                        : "rgba(56,189,248,0.26)";

                    return (
                  <div
                    key={`${questionIndex}-${index}`}
                    ref={(node) => {
                      containerRefs.current[index] = node;
                    }}
                    className="relative min-h-[5rem] rounded-[1.35rem] border-[3px] px-4 py-[0.35rem]"
                    style={{
                      borderColor,
                      background: "transparent",
                      boxShadow: isHovered ? "0 0 18px rgba(250,204,21,0.3)" : "none",
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
                            handlePointerDown(item.id, event)
                          }
                          className="flex h-16 w-16 items-center justify-center bg-transparent text-[3.1rem]"
                          style={{
                            opacity:
                              dragState?.itemId === item.id ||
                              returningItemIds.has(item.id)
                                ? 0
                                : 1,
                            pointerEvents: revealCtaMode === "retry" || isQuestionDemo ? "none" : "auto",
                          }}
                        >
                          {question.pair.itemEmoji}
                        </button>
                      ))}
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            </div>

            {dragState ? (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-[70] flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                style={{
                  left: dragState.x,
                  top: dragState.y,
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
            ) : null}

            {returnStates.map((returnState) => (
              <div
                key={`return-${returnState.itemId}`}
                aria-hidden="true"
                className="pointer-events-none fixed z-[69] flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                style={{
                  left: returnState.x,
                  top: returnState.y,
                  transition: "left 220ms ease-out, top 220ms ease-out",
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

            {snipMode ? (
              <div
                className="pointer-events-none absolute z-[76] rounded-2xl border-4 border-sky-300"
                style={{
                  left: snipSelection.x,
                  top: snipSelection.y,
                  width: snipSelection.size,
                  height: snipSelection.size,
                  background: "rgba(14, 165, 233, 0.08)",
                  boxShadow: "0 0 0 9999px rgba(15,23,42,0.22)",
                }}
              />
            ) : null}
          </div>
        </div>

        <PhantomHand pos={phantomPos} />
      </div>
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
    </GameLayout>
  );
}
