import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import PhantomHand from "../components/PhantomHand";
import GameLayout from "../components/GameLayout";
import { makeRound } from "../game/packItGame";
import type { PackQuestion, RoundName } from "../calculations/types.ts";
import {
  getLocalizedInsufficientItemsLabel,
  getLocalizedLevelOneBlackboardSteps,
  getLocalizedLevelOneQuestionText,
} from "../calculations/level-1/round-1.ts";
import { getDemoConfig } from "../demoMode";
import {
  useIsCoarsePointer,
  useIsMobileLandscape,
} from "../hooks/useMediaQuery";
import { useLocale, useT } from "../i18n";
import {
  ensureAudioReady,
  isMuted,
  playCameraShutter,
  playCorrect,
  playDragStep,
  playKeyClick,
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
  anchorItemId: number;
  origin: "source" | "container";
  comboId: number | null;
  isLifted: boolean;
  isSnappedToContainers: boolean;
  x: number;
  y: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
};

type PhantomDragState = {
  itemIds: number[];
  anchorItemId: number;
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

function getAnchoredGroupItemIds(anchorItemId: number, itemIds: number[]) {
  return [anchorItemId, ...itemIds.filter((itemId) => itemId !== anchorItemId)];
}

function sortContainerItems(left: PackedItem, right: PackedItem) {
  const leftCombo = left.comboId ?? -1;
  const rightCombo = right.comboId ?? -1;
  if (leftCombo !== rightCombo) {
    return leftCombo - rightCombo;
  }
  return left.id - right.id;
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
  return QUESTION_KEYWORDS.has(normalized);
}

function isNumericToken(token: string): boolean {
  return /\d/.test(token);
}

function isMathSymbolToken(token: string): boolean {
  return token.includes("=") || token.includes("∴") || token.includes("÷");
}

function isMathWordToken(token: string): boolean {
  const normalized = token.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized === "per";
}

const QUESTION_KEYWORD_COLOR = "#facc15";
const QUESTION_SYMBOL_COLOR = "#66ff66";
const RETURN_ANIMATION_MS = 220;
const PACK_HOLD_DELAY_MS = 300;
const PACK_HOLD_INTERVAL_MS = 150;
const SHIP_RESULT_DELAY_MS = 500;
const DESKTOP_TUBE_MIN_CAPACITY = 6;
const DESKTOP_TUBE_MAX_CAPACITY = 10;
const MOBILE_VISIBLE_TUBE_CAPACITY = 5;
const DESKTOP_RIGHT_RAIL_WIDTH_PX = 17 * 16;
const DESKTOP_GROUP_MIN_CAPACITY = 4;
const DESKTOP_GROUP_MAX_CAPACITY = 8;
const ROUND_SEQUENCE: RoundName[] = ["load", "pack", "ship"];

function ProgressApple({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center leading-none transition-all duration-300"
      style={{
        fontSize: "1.45rem",
        filter: active
          ? undefined
          : "grayscale(1) saturate(0) brightness(0.78)",
        opacity: active ? 1 : 0.72,
        transform: active ? "scale(1.04)" : "scale(0.96)",
        textShadow: active
          ? "0 0 10px rgba(239,68,68,0.32)"
          : "0 0 6px rgba(100,116,139,0.18)",
      }}
    >
      🍎
    </span>
  );
}

function MobileLevelButton({
  label,
  active,
  locked,
  onClick,
}: {
  label: string;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className="h-8 w-10 rounded-lg border-2 text-sm font-black transition-colors disabled:cursor-not-allowed"
      style={{
        background: locked ? "#0f172a" : active ? "#0ea5e9" : "#1e293b",
        borderColor: locked ? "#1e293b" : active ? "#38bdf8" : "#475569",
        color: locked ? "#64748b" : "#ffffff",
        opacity: locked ? 0.7 : 1,
      }}
    >
      {locked ? "\u{1F512}" : label}
    </button>
  );
}

function getDesktopTubeCapacityForSceneHeight(sceneHeight: number) {
  const itemSizePx = 48;
  const stackStepPx = itemSizePx + 8;
  const topGapPx = stackStepPx;
  const availableTubeHeight = Math.max(0, sceneHeight - topGapPx);
  const estimatedCapacity =
    Math.floor(Math.max(0, availableTubeHeight - itemSizePx) / stackStepPx) + 1;

  return Math.max(
    DESKTOP_TUBE_MIN_CAPACITY,
    Math.min(DESKTOP_TUBE_MAX_CAPACITY, estimatedCapacity),
  );
}

function getDesktopGroupCapacityForSceneWidth(sceneWidth: number) {
  const itemSizePx = 48;
  const containerPaddingX = Math.max(10, Math.round(itemSizePx * 0.25));
  const containerWidthPx = Math.max(
    itemSizePx + containerPaddingX * 2,
    Math.round(itemSizePx * 1.9),
  );
  const containerStripGapPx = Math.max(18, Math.round(itemSizePx * 0.8));
  const containerColumnPaddingX = Math.max(10, Math.round(itemSizePx * 0.25));
  const availableContainerWidth = Math.max(
    0,
    sceneWidth * 0.65 - containerColumnPaddingX * 2,
  );
  const estimatedCapacity = Math.floor(
    (availableContainerWidth + containerStripGapPx) /
      (containerWidthPx + containerStripGapPx),
  );

  return Math.max(
    DESKTOP_GROUP_MIN_CAPACITY,
    Math.min(DESKTOP_GROUP_MAX_CAPACITY, estimatedCapacity),
  );
}

function getDesktopPlayfieldWidth(viewportWidth: number) {
  return Math.max(0, viewportWidth - DESKTOP_RIGHT_RAIL_WIDTH_PX);
}

function stripTrailingPeriod(text: string) {
  return text.replace(/\.\s*$/, "");
}

function renderHighlightedQuestion(
  text: string,
  colors?: {
    normal?: string;
    highlight?: string;
    symbol?: string;
  },
): ReactNode {
  return text
    .trim()
    .split(/\s+/)
    .map((part, index, parts) => (
      <span key={`${part}-${index}`}>
        <span
          style={
            isMathSymbolToken(part) || isMathWordToken(part)
              ? { color: colors?.symbol ?? "#86efac" }
              : isNumericToken(part)
                ? { color: QUESTION_KEYWORD_COLOR }
                : isHighlightedToken(part)
                  ? { color: colors?.highlight ?? "#facc15" }
                  : colors?.normal
                    ? { color: colors.normal }
                    : undefined
          }
        >
          {part}
        </span>
        {index < parts.length - 1 ? " " : null}
      </span>
    ));
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
      className="digital-meter px-3 py-2 text-[1.6rem] leading-none"
      style={{
        borderRadius: "8px",
        background: "rgba(15,23,42,0.7)",
        boxShadow:
          "0 0 10px rgba(103,232,249,0.12), 0 6px 16px rgba(2,6,23,0.34)",
        color,
        textShadow: `0 0 12px ${glow}, 0 0 22px ${glowOuter}`,
      }}
    >
      {String(value).padStart(2, "0")}
    </div>
  );
}

function renderSceneAtmosphere(item: string): ReactNode {
  switch (item) {
    case "apple":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 18% 14%, rgba(248,113,113,0.18), transparent 24%), radial-gradient(circle at 82% 16%, rgba(251,146,60,0.14), transparent 22%), linear-gradient(180deg, rgba(120,53,15,0.12) 0%, rgba(2,6,23,0) 28%), linear-gradient(180deg, #101827 0%, #08111d 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.34]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <g fill="rgba(255,255,255,0.68)">
                <circle cx="82" cy="48" r="3" />
                <circle cx="152" cy="96" r="2.2" />
                <circle cx="318" cy="44" r="1.8" />
                <circle cx="426" cy="142" r="2.6" />
                <circle cx="672" cy="36" r="2" />
                <circle cx="818" cy="94" r="3" />
                <circle cx="932" cy="66" r="2.4" />
              </g>
              <g fill="rgba(30,41,59,0.9)">
                <path d="M0 575C85 502 166 472 246 498C300 432 392 410 480 446C558 386 656 382 730 442C794 392 878 384 958 424L1000 700H0Z" />
              </g>
              <g
                fill="none"
                stroke="rgba(120,53,15,0.78)"
                strokeWidth="12"
                strokeLinecap="round"
              >
                <path d="M132 700V470" />
                <path d="M302 700V438" />
                <path d="M490 700V492" />
                <path d="M712 700V448" />
                <path d="M874 700V474" />
              </g>
              <g fill="rgba(22,101,52,0.72)">
                <ellipse cx="132" cy="430" rx="82" ry="54" />
                <ellipse cx="302" cy="398" rx="98" ry="64" />
                <ellipse cx="490" cy="454" rx="88" ry="56" />
                <ellipse cx="712" cy="406" rx="94" ry="62" />
                <ellipse cx="874" cy="434" rx="88" ry="58" />
              </g>
              <g fill="rgba(239,68,68,0.44)">
                <circle cx="106" cy="438" r="8" />
                <circle cx="154" cy="452" r="7" />
                <circle cx="274" cy="398" r="9" />
                <circle cx="328" cy="418" r="7" />
                <circle cx="470" cy="456" r="8" />
                <circle cx="520" cy="432" r="6" />
                <circle cx="692" cy="410" r="9" />
                <circle cx="744" cy="424" r="7" />
                <circle cx="852" cy="438" r="8" />
                <circle cx="900" cy="420" r="7" />
              </g>
            </svg>
          </div>
        </>
      );
    case "fish":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 16% 14%, rgba(34,211,238,0.12), transparent 18%), radial-gradient(circle at 84% 16%, rgba(45,212,191,0.1), transparent 18%), linear-gradient(180deg, #092033 0%, #08131f 44%, #040b12 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.36]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <radialGradient id="fishGlowLeft" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
                <radialGradient id="fishGlowRight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(45,212,191,0.16)" />
                  <stop offset="100%" stopColor="rgba(45,212,191,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="152"
                cy="118"
                rx="102"
                ry="80"
                fill="url(#fishGlowLeft)"
              />
              <ellipse
                cx="854"
                cy="164"
                rx="94"
                ry="74"
                fill="url(#fishGlowRight)"
              />
              <g fill="rgba(15,118,110,0.18)">
                <ellipse cx="122" cy="534" rx="78" ry="124" />
                <ellipse cx="202" cy="556" rx="56" ry="112" />
                <ellipse cx="804" cy="538" rx="70" ry="118" />
                <ellipse cx="882" cy="562" rx="52" ry="106" />
              </g>
              <g fill="rgba(12,74,110,0.22)">
                <path d="M0 632C120 606 226 602 332 624C422 642 522 650 626 626C736 602 852 598 1000 620V700H0Z" />
              </g>
              <g fill="rgba(5,15,28,0.72)">
                <path d="M0 648C122 620 244 618 352 638C458 658 562 658 672 634C786 610 892 610 1000 628V700H0Z" />
              </g>
              <g fill="rgba(255,255,255,0.15)">
                <circle cx="108" cy="146" r="8" />
                <circle cx="132" cy="118" r="5" />
                <circle cx="782" cy="198" r="7" />
                <circle cx="818" cy="172" r="5" />
                <circle cx="846" cy="208" r="4" />
              </g>
              <g fill="rgba(96,165,250,0.18)">
                <path d="M282 214C306 188 342 188 366 214C338 226 310 226 282 214Z" />
                <path d="M634 256C658 230 694 230 718 256C690 268 662 268 634 256Z" />
              </g>
              <g fill="rgba(251,191,36,0.2)">
                <circle cx="160" cy="600" r="18" />
                <circle cx="154" cy="600" r="6" />
                <circle cx="166" cy="588" r="5" />
                <circle cx="176" cy="604" r="4" />
              </g>
              <g fill="rgba(248,113,113,0.18)">
                <path d="M748 606C748 584 766 566 790 566C814 566 832 584 832 606C810 614 770 614 748 606Z" />
                <path d="M770 606C770 624 762 640 748 650C752 632 748 620 738 608Z" />
                <path d="M810 606C820 620 822 634 818 650C804 640 796 624 796 606Z" />
              </g>
              <g fill="rgba(251,146,60,0.18)">
                <path d="M470 598C484 560 518 542 554 552C542 584 514 608 470 598Z" />
                <path d="M470 598C432 608 404 590 394 556C432 544 458 562 470 598Z" />
                <circle cx="470" cy="598" r="12" />
              </g>
            </svg>
          </div>
        </>
      );
    case "egg":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 18% 16%, rgba(250,204,21,0.16), transparent 18%), radial-gradient(circle at 80% 18%, rgba(245,158,11,0.12), transparent 20%), linear-gradient(180deg, #2a1d11 0%, #120f11 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.34]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <radialGradient id="eggGlowLeft" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(250,204,21,0.18)" />
                  <stop offset="100%" stopColor="rgba(250,204,21,0)" />
                </radialGradient>
                <radialGradient id="eggGlowRight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(245,158,11,0.16)" />
                  <stop offset="100%" stopColor="rgba(245,158,11,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="176"
                cy="122"
                rx="108"
                ry="72"
                fill="url(#eggGlowLeft)"
              />
              <ellipse
                cx="822"
                cy="114"
                rx="118"
                ry="74"
                fill="url(#eggGlowRight)"
              />
              <g fill="rgba(120,53,15,0.22)">
                <path d="M0 636C100 604 210 598 314 618C412 636 514 646 620 626C732 604 846 600 1000 620V700H0Z" />
              </g>
              <g fill="rgba(41,37,36,0.72)">
                <path d="M0 652C116 620 236 618 348 638C460 658 570 660 680 636C794 612 896 612 1000 628V700H0Z" />
              </g>
              <g fill="rgba(22,101,52,0.16)">
                <ellipse cx="118" cy="566" rx="92" ry="54" />
                <ellipse cx="256" cy="588" rx="110" ry="58" />
                <ellipse cx="782" cy="574" rx="102" ry="56" />
                <ellipse cx="914" cy="592" rx="86" ry="50" />
              </g>
              <g fill="rgba(146,64,14,0.26)">
                <path d="M84 540C108 470 164 424 228 424C290 424 346 470 370 540C316 526 272 520 226 520C178 520 134 526 84 540Z" />
                <path d="M690 536C714 462 776 414 844 414C910 414 968 462 992 536C934 522 890 516 842 516C792 516 744 522 690 536Z" />
              </g>
              <g fill="rgba(120,53,15,0.22)">
                <ellipse cx="226" cy="398" rx="84" ry="26" />
                <ellipse cx="844" cy="386" rx="92" ry="28" />
              </g>
              <g fill="rgba(250,204,21,0.18)">
                <ellipse cx="470" cy="522" rx="72" ry="30" />
                <ellipse cx="552" cy="542" rx="64" ry="28" />
              </g>
              <g fill="rgba(255,255,255,0.16)">
                <ellipse cx="448" cy="508" rx="18" ry="24" />
                <ellipse cx="486" cy="528" rx="16" ry="22" />
                <ellipse cx="538" cy="528" rx="18" ry="24" />
                <ellipse cx="574" cy="548" rx="16" ry="22" />
              </g>
              <g fill="rgba(250,204,21,0.18)">
                <path d="M118 500C142 466 180 450 216 456C204 488 170 510 118 500Z" />
                <path d="M780 488C808 450 850 432 892 440C878 482 840 504 780 488Z" />
              </g>
              <g fill="rgba(239,68,68,0.18)">
                <path d="M168 486C186 460 212 450 238 456C226 482 202 496 168 486Z" />
                <path d="M842 472C860 444 890 434 918 442C904 468 878 482 842 472Z" />
              </g>
              <g fill="rgba(255,255,255,0.12)">
                <circle cx="148" cy="120" r="3" />
                <circle cx="226" cy="88" r="2.5" />
                <circle cx="804" cy="92" r="3" />
                <circle cx="872" cy="132" r="2.5" />
              </g>
            </svg>
          </div>
        </>
      );
    case "cookie":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 18% 14%, rgba(251,191,36,0.14), transparent 16%), radial-gradient(circle at 78% 16%, rgba(180,83,9,0.14), transparent 16%), linear-gradient(180deg, #24180f 0%, #0c0d12 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.32]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <radialGradient id="cookieGlowLeft" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.18)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0)" />
                </radialGradient>
                <radialGradient id="cookieGlowRight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(180,83,9,0.16)" />
                  <stop offset="100%" stopColor="rgba(180,83,9,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="164"
                cy="140"
                rx="128"
                ry="86"
                fill="url(#cookieGlowLeft)"
              />
              <ellipse
                cx="826"
                cy="152"
                rx="136"
                ry="92"
                fill="url(#cookieGlowRight)"
              />
              <g fill="rgba(92,51,23,0.26)">
                <path d="M0 628C104 590 196 584 288 600C368 614 430 644 504 646C598 650 674 602 758 600C844 598 922 622 1000 614V700H0Z" />
                <path d="M0 676C118 652 244 650 360 670C474 690 594 692 716 668C822 648 914 646 1000 660V700H0Z" />
              </g>
              <g fill="rgba(255,255,255,0.08)">
                <ellipse cx="208" cy="118" rx="86" ry="34" />
                <ellipse cx="790" cy="110" rx="102" ry="38" />
              </g>
              <g fill="rgba(120,53,15,0.24)">
                <ellipse cx="136" cy="582" rx="56" ry="78" />
                <ellipse cx="188" cy="560" rx="62" ry="90" />
                <ellipse cx="250" cy="586" rx="52" ry="74" />
                <ellipse cx="710" cy="584" rx="58" ry="82" />
                <ellipse cx="772" cy="560" rx="64" ry="94" />
                <ellipse cx="836" cy="586" rx="54" ry="78" />
              </g>
              <g fill="rgba(210,105,30,0.16)">
                <ellipse cx="190" cy="462" rx="116" ry="44" />
                <ellipse cx="792" cy="448" rx="132" ry="48" />
              </g>
              <g fill="rgba(245,158,11,0.18)">
                <ellipse cx="306" cy="470" rx="58" ry="26" />
                <ellipse cx="604" cy="456" rx="54" ry="24" />
              </g>
              <g fill="rgba(68,38,20,0.34)">
                <rect x="150" y="384" width="26" height="120" rx="13" />
                <rect x="206" y="372" width="22" height="110" rx="11" />
                <rect x="760" y="368" width="24" height="118" rx="12" />
                <rect x="812" y="384" width="28" height="122" rx="14" />
              </g>
              <g fill="rgba(120,53,15,0.24)">
                <ellipse cx="164" cy="352" rx="58" ry="22" />
                <ellipse cx="812" cy="340" rx="68" ry="24" />
              </g>
              <g fill="rgba(251,191,36,0.18)">
                <path d="M260 404C308 382 358 384 408 406C360 420 310 420 260 404Z" />
                <path d="M564 390C612 368 664 370 720 392C666 406 614 406 564 390Z" />
              </g>
              <g fill="rgba(251,191,36,0.22)">
                <circle cx="114" cy="146" r="6" />
                <circle cx="152" cy="180" r="4.5" />
                <circle cx="204" cy="126" r="5.5" />
                <circle cx="240" cy="164" r="4" />
                <circle cx="744" cy="178" r="5.5" />
                <circle cx="794" cy="138" r="4.5" />
                <circle cx="846" cy="166" r="5.5" />
                <circle cx="888" cy="126" r="4" />
              </g>
              <g fill="rgba(68,38,20,0.34)">
                <circle cx="202" cy="528" r="18" />
                <circle cx="228" cy="552" r="12" />
                <circle cx="760" cy="518" r="20" />
                <circle cx="792" cy="548" r="13" />
              </g>
            </svg>
          </div>
        </>
      );
    case "cupcake":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 18% 14%, rgba(244,114,182,0.18), transparent 16%), radial-gradient(circle at 82% 18%, rgba(251,191,36,0.1), transparent 18%), linear-gradient(180deg, #2a1330 0%, #0b0d14 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.32]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <radialGradient
                  id="cupcakeBerryGlowLeft"
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop offset="0%" stopColor="rgba(244,114,182,0.2)" />
                  <stop offset="100%" stopColor="rgba(244,114,182,0)" />
                </radialGradient>
                <radialGradient
                  id="cupcakeBerryGlowRight"
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop offset="0%" stopColor="rgba(251,191,36,0.16)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="176"
                cy="126"
                rx="120"
                ry="88"
                fill="url(#cupcakeBerryGlowLeft)"
              />
              <ellipse
                cx="828"
                cy="150"
                rx="104"
                ry="78"
                fill="url(#cupcakeBerryGlowRight)"
              />
              <g fill="rgba(236,72,153,0.18)">
                <path d="M0 642C120 604 220 590 310 600C388 610 446 644 532 646C616 648 682 612 770 608C848 604 924 620 1000 610V700H0Z" />
                <path d="M0 680C128 652 250 652 362 674C470 694 592 694 714 670C818 650 910 646 1000 660V700H0Z" />
              </g>
              <g fill="rgba(255,255,255,0.1)">
                <ellipse cx="182" cy="120" rx="82" ry="52" />
                <ellipse cx="834" cy="150" rx="72" ry="46" />
              </g>
              <g fill="rgba(249,168,212,0.16)">
                <ellipse cx="168" cy="566" rx="84" ry="58" />
                <ellipse cx="250" cy="586" rx="66" ry="46" />
                <ellipse cx="736" cy="572" rx="88" ry="60" />
                <ellipse cx="834" cy="590" rx="70" ry="48" />
              </g>
              <g fill="rgba(249,168,212,0.22)">
                <path d="M126 548C150 504 192 476 236 476C278 476 318 502 338 548C304 536 270 530 232 530C192 530 160 536 126 548Z" />
                <path d="M676 556C700 508 744 478 792 478C842 478 886 510 910 556C874 544 838 538 794 538C752 538 714 544 676 556Z" />
              </g>
              <g fill="rgba(255,255,255,0.08)">
                <ellipse cx="154" cy="432" rx="64" ry="18" />
                <ellipse cx="834" cy="426" rx="72" ry="20" />
              </g>
              <g fill="rgba(120,53,15,0.22)">
                <path d="M122 470C138 430 170 398 206 398C242 398 274 430 288 470C258 460 232 456 206 456C180 456 150 460 122 470Z" />
                <path d="M722 468C740 424 774 390 814 390C850 390 884 424 900 468C868 458 842 454 812 454C784 454 752 458 722 468Z" />
              </g>
              <g fill="rgba(251,191,36,0.18)">
                <ellipse cx="198" cy="384" rx="20" ry="48" />
                <ellipse cx="824" cy="376" rx="22" ry="50" />
              </g>
              <g fill="rgba(255,255,255,0.16)">
                <circle cx="184" cy="330" r="18" />
                <circle cx="812" cy="322" r="19" />
              </g>
              <g fill="rgba(134,239,172,0.16)">
                <ellipse cx="340" cy="532" rx="44" ry="22" />
                <ellipse cx="620" cy="518" rx="40" ry="20" />
              </g>
              <g fill="rgba(250,204,21,0.18)">
                <ellipse cx="340" cy="498" rx="26" ry="14" />
                <ellipse cx="624" cy="486" rx="24" ry="12" />
              </g>
              <g fill="rgba(244,114,182,0.3)">
                <circle cx="164" cy="126" r="13" />
                <circle cx="198" cy="94" r="11" />
                <circle cx="226" cy="134" r="10" />
                <circle cx="802" cy="148" r="13" />
                <circle cx="838" cy="120" r="10" />
                <circle cx="868" cy="156" r="11" />
              </g>
              <g fill="rgba(134,239,172,0.24)">
                <ellipse
                  cx="186"
                  cy="84"
                  rx="14"
                  ry="6"
                  transform="rotate(-28 186 84)"
                />
                <ellipse
                  cx="828"
                  cy="112"
                  rx="14"
                  ry="6"
                  transform="rotate(22 828 112)"
                />
              </g>
              <g fill="rgba(255,255,255,0.18)">
                <circle cx="150" cy="112" r="3.5" />
                <circle cx="214" cy="150" r="3" />
                <circle cx="790" cy="134" r="3.5" />
                <circle cx="860" cy="174" r="3" />
              </g>
            </svg>
          </div>
        </>
      );
    case "gem":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 18% 14%, rgba(34,211,238,0.14), transparent 18%), radial-gradient(circle at 82% 16%, rgba(192,132,252,0.12), transparent 18%), linear-gradient(180deg, #171c34 0%, #0a0d14 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.36]">
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <radialGradient id="gemGlowLeft" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
                <radialGradient id="gemGlowRight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(192,132,252,0.16)" />
                  <stop offset="100%" stopColor="rgba(192,132,252,0)" />
                </radialGradient>
              </defs>
              <ellipse
                cx="178"
                cy="122"
                rx="112"
                ry="84"
                fill="url(#gemGlowLeft)"
              />
              <ellipse
                cx="824"
                cy="144"
                rx="108"
                ry="82"
                fill="url(#gemGlowRight)"
              />
              <g fill="rgba(55,48,163,0.18)">
                <path d="M0 640C92 608 176 600 270 612C358 624 432 652 518 650C614 648 686 614 782 608C860 604 932 612 1000 624V700H0Z" />
              </g>
              <g fill="rgba(12,18,34,0.72)">
                <path d="M0 652C110 620 220 618 322 638C430 660 544 662 650 636C760 610 882 610 1000 628V700H0Z" />
              </g>
              <g fill="rgba(103,232,249,0.18)">
                <ellipse cx="172" cy="520" rx="88" ry="56" />
                <ellipse cx="820" cy="506" rx="98" ry="60" />
              </g>
              <g fill="rgba(148,163,184,0.16)">
                <ellipse cx="202" cy="470" rx="120" ry="20" />
                <ellipse cx="782" cy="454" rx="132" ry="22" />
              </g>
              <g fill="rgba(196,181,253,0.22)">
                <path d="M114 452C138 404 180 372 224 372C268 372 308 404 330 452C290 440 258 434 222 434C186 434 152 440 114 452Z" />
                <path d="M664 438C690 388 736 356 786 356C836 356 882 388 906 438C862 426 826 420 786 420C748 420 708 426 664 438Z" />
              </g>
              <g fill="rgba(103,232,249,0.28)">
                <path d="M134 418l18-26 36-10 32 10 20 26-18 30-34 12-34-12Z" />
                <path d="M734 404l22-30 40-12 38 12 24 30-20 34-42 14-42-14Z" />
                <path d="M448 544l18-24 34-8 32 8 18 24-16 28-34 10-34-10Z" />
              </g>
              <g fill="rgba(250,204,21,0.18)">
                <ellipse cx="310" cy="264" rx="78" ry="22" />
                <ellipse cx="636" cy="244" rx="86" ry="24" />
              </g>
              <g fill="rgba(148,163,184,0.24)">
                <circle cx="286" cy="264" r="24" />
                <circle cx="336" cy="264" r="24" />
                <rect x="286" y="240" width="50" height="48" rx="24" />
                <circle cx="612" cy="244" r="20" />
                <circle cx="660" cy="244" r="20" />
                <rect x="612" y="224" width="48" height="40" rx="20" />
              </g>
              <g fill="rgba(192,132,252,0.18)">
                <path d="M502 234C532 210 572 210 602 234C568 248 536 248 502 234Z" />
                <path d="M512 280C544 254 588 254 620 280C584 294 548 294 512 280Z" />
              </g>
              <g fill="rgba(255,255,255,0.12)">
                <circle cx="120" cy="72" r="3" />
                <circle cx="286" cy="54" r="2" />
                <circle cx="842" cy="84" r="3" />
                <circle cx="904" cy="112" r="2" />
              </g>
            </svg>
          </div>
        </>
      );
    default:
      return (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 14%, rgba(148,163,184,0.06), transparent 18%), radial-gradient(circle at 82% 18%, rgba(56,189,248,0.05), transparent 20%)",
          }}
        />
      );
  }
}

function getChromeTheme(item: string, palette: string) {
  switch (item) {
    case "apple":
      return {
        messagePanel: {
          outerBackground: "rgba(34,17,18,0.96)",
          outerBorder: "rgba(248,113,113,0.62)",
          outerShadow:
            "0 0 0 2px rgba(69,10,10,0.4), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(50,23,25,0.96)",
          bodyBackground: "rgba(28,12,15,0.98)",
          divider: "rgba(248,113,113,0.34)",
          text: "#fff7ed",
          highlight: "#fdba74",
          symbol: "#fca5a5",
          complete: "#fdba74",
        },
        questionBoxStyle: {
          background: "rgba(34,17,18,0.96)",
          borderColor: "rgba(248,113,113,0.62)",
          boxShadow:
            "0 0 26px rgba(127,29,29,0.24), inset 0 0 18px rgba(69,10,10,0.32)",
        },
        calculatorBannerStyle: {
          background: "rgba(24,11,12,0.94)",
          borderColor: "rgba(248,113,113,0.9)",
          color: "#fca5a5",
          boxShadow:
            "0 0 18px rgba(248,113,113,0.16), inset 0 0 16px rgba(127,29,29,0.24)",
        },
        keypadTheme: {
          panelBackground: "rgba(15,8,10,0.97)",
          panelBorder: "rgba(248,113,113,0.44)",
          panelGlow:
            "0 0 18px rgba(248,113,113,0.14), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(29,14,15,0.94)",
          digitBorder: "rgba(248,113,113,0.42)",
          operatorBackground: "rgba(35,17,18,0.94)",
          operatorBorder: "rgba(248,113,113,0.52)",
          displayBorder: "rgba(248,113,113,0.26)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    case "fish":
      return {
        messagePanel: {
          outerBackground: "rgba(7,22,33,0.96)",
          outerBorder: "rgba(45,212,191,0.52)",
          outerShadow:
            "0 0 0 2px rgba(8,47,73,0.44), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(10,30,40,0.96)",
          bodyBackground: "rgba(6,18,26,0.98)",
          divider: "rgba(45,212,191,0.3)",
          text: "#ecfeff",
          highlight: "#99f6e4",
          symbol: "#67e8f9",
          complete: "#99f6e4",
        },
        questionBoxStyle: {
          background: "rgba(7,22,33,0.96)",
          borderColor: "rgba(45,212,191,0.52)",
          boxShadow:
            "0 0 26px rgba(8,145,178,0.16), inset 0 0 18px rgba(8,47,73,0.34)",
        },
        calculatorBannerStyle: {
          background: "rgba(7,20,25,0.94)",
          borderColor: "rgba(45,212,191,0.82)",
          color: "#99f6e4",
          boxShadow:
            "0 0 18px rgba(45,212,191,0.14), inset 0 0 16px rgba(15,118,110,0.2)",
        },
        keypadTheme: {
          panelBackground: "rgba(4,14,19,0.97)",
          panelBorder: "rgba(45,212,191,0.4)",
          panelGlow:
            "0 0 18px rgba(45,212,191,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(7,24,29,0.94)",
          digitBorder: "rgba(45,212,191,0.36)",
          operatorBackground: "rgba(9,29,33,0.94)",
          operatorBorder: "rgba(45,212,191,0.48)",
          displayBorder: "rgba(45,212,191,0.22)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    case "cookie":
      return {
        messagePanel: {
          outerBackground: "rgba(32,18,12,0.96)",
          outerBorder: "rgba(251,146,60,0.52)",
          outerShadow:
            "0 0 0 2px rgba(67,20,7,0.44), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(46,26,18,0.96)",
          bodyBackground: "rgba(22,13,10,0.98)",
          divider: "rgba(251,146,60,0.28)",
          text: "#fff7ed",
          highlight: "#fdba74",
          symbol: "#facc15",
          complete: "#fdba74",
        },
        questionBoxStyle: {
          background: "rgba(32,18,12,0.96)",
          borderColor: "rgba(251,146,60,0.52)",
          boxShadow:
            "0 0 26px rgba(146,64,14,0.18), inset 0 0 18px rgba(67,20,7,0.34)",
        },
        calculatorBannerStyle: {
          background: "rgba(22,13,10,0.94)",
          borderColor: "rgba(251,146,60,0.82)",
          color: "#fdba74",
          boxShadow:
            "0 0 18px rgba(251,146,60,0.14), inset 0 0 16px rgba(120,53,15,0.22)",
        },
        keypadTheme: {
          panelBackground: "rgba(19,11,8,0.97)",
          panelBorder: "rgba(251,146,60,0.4)",
          panelGlow:
            "0 0 18px rgba(251,146,60,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(28,17,12,0.94)",
          digitBorder: "rgba(251,146,60,0.38)",
          operatorBackground: "rgba(34,20,14,0.94)",
          operatorBorder: "rgba(251,146,60,0.48)",
          displayBorder: "rgba(251,146,60,0.22)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    case "cupcake":
      return {
        messagePanel: {
          outerBackground: "rgba(35,15,34,0.96)",
          outerBorder: "rgba(244,114,182,0.5)",
          outerShadow:
            "0 0 0 2px rgba(80,7,36,0.42), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(50,20,43,0.96)",
          bodyBackground: "rgba(22,10,24,0.98)",
          divider: "rgba(244,114,182,0.28)",
          text: "#fff1f2",
          highlight: "#f9a8d4",
          symbol: "#fcd34d",
          complete: "#f9a8d4",
        },
        questionBoxStyle: {
          background: "rgba(35,15,34,0.96)",
          borderColor: "rgba(244,114,182,0.5)",
          boxShadow:
            "0 0 26px rgba(190,24,93,0.16), inset 0 0 18px rgba(80,7,36,0.34)",
        },
        calculatorBannerStyle: {
          background: "rgba(22,10,24,0.94)",
          borderColor: "rgba(244,114,182,0.8)",
          color: "#f9a8d4",
          boxShadow:
            "0 0 18px rgba(244,114,182,0.12), inset 0 0 16px rgba(157,23,77,0.2)",
        },
        keypadTheme: {
          panelBackground: "rgba(18,8,19,0.97)",
          panelBorder: "rgba(244,114,182,0.38)",
          panelGlow:
            "0 0 18px rgba(244,114,182,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(28,13,28,0.94)",
          digitBorder: "rgba(244,114,182,0.36)",
          operatorBackground: "rgba(34,16,33,0.94)",
          operatorBorder: "rgba(244,114,182,0.46)",
          displayBorder: "rgba(244,114,182,0.22)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    case "gem":
      return {
        messagePanel: {
          outerBackground: "rgba(18,23,38,0.96)",
          outerBorder: "rgba(167,139,250,0.48)",
          outerShadow:
            "0 0 0 2px rgba(30,41,59,0.46), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(22,30,48,0.96)",
          bodyBackground: "rgba(12,17,30,0.98)",
          divider: "rgba(45,212,191,0.24)",
          text: "#eff6ff",
          highlight: "#a5b4fc",
          symbol: "#99f6e4",
          complete: "#99f6e4",
        },
        questionBoxStyle: {
          background: "rgba(18,23,38,0.96)",
          borderColor: "rgba(167,139,250,0.48)",
          boxShadow:
            "0 0 26px rgba(76,29,149,0.18), inset 0 0 18px rgba(30,41,59,0.34)",
        },
        calculatorBannerStyle: {
          background: "rgba(12,17,30,0.94)",
          borderColor: "rgba(45,212,191,0.8)",
          color: "#99f6e4",
          boxShadow:
            "0 0 18px rgba(45,212,191,0.14), inset 0 0 16px rgba(13,148,136,0.18)",
        },
        keypadTheme: {
          panelBackground: "rgba(10,14,24,0.97)",
          panelBorder: "rgba(45,212,191,0.38)",
          panelGlow:
            "0 0 18px rgba(45,212,191,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(16,22,36,0.94)",
          digitBorder: "rgba(45,212,191,0.34)",
          operatorBackground: "rgba(18,27,41,0.94)",
          operatorBorder: "rgba(45,212,191,0.46)",
          displayBorder: "rgba(45,212,191,0.22)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    default:
      return {
        messagePanel: {
          outerBackground: "rgba(15,23,42,0.96)",
          outerBorder: `${palette}88`,
          outerShadow:
            "0 0 0 2px rgba(15,23,42,0.4), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(30,41,59,0.96)",
          bodyBackground: "rgba(15,23,42,0.98)",
          divider: `${palette}55`,
          text: "#ffffff",
          highlight: "#facc15",
          symbol: "#86efac",
          complete: "#facc15",
        },
        questionBoxStyle: {
          background: "rgba(15,23,42,0.96)",
          borderColor: `${palette}88`,
        },
        calculatorBannerStyle: {
          background: "rgba(10,15,28,0.94)",
          borderColor: `${palette}cc`,
          color: "#e2e8f0",
        },
        keypadTheme: {
          panelBackground: "rgba(2,6,23,0.97)",
          panelBorder: `${palette}66`,
          panelGlow:
            "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
          digitBackground: "rgba(11,18,32,0.94)",
          digitBorder: `${palette}55`,
          operatorBackground: "rgba(14,22,38,0.94)",
          operatorBorder: `${palette}77`,
          displayBorder: `${palette}44`,
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
  }
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
    return (
      normalized ??
      value.replace(UNSUPPORTED_CAPTURE_COLOR_PATTERN, "transparent")
    );
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
  const demoConfig = useMemo(() => getDemoConfig(), []);
  const { locale } = useLocale();
  const t = useT();
  const isMobileLandscape = useIsMobileLandscape();
  const isMobile = useIsCoarsePointer();
  const [desktopGroupCapacity, setDesktopGroupCapacity] = useState(() =>
    typeof window === "undefined"
      ? DESKTOP_GROUP_MAX_CAPACITY
      : getDesktopGroupCapacityForSceneWidth(
          getDesktopPlayfieldWidth(window.innerWidth),
        ),
  );
  const [desktopTubeCapacity, setDesktopTubeCapacity] = useState(() =>
    typeof window === "undefined"
      ? DESKTOP_TUBE_MAX_CAPACITY
      : getDesktopTubeCapacityForSceneHeight(window.innerHeight),
  );
  const [roundName, setRoundName] = useState<RoundName>("load");
  const round = useMemo(
    () =>
      makeRound(1, roundName, isMobile, {
        maxGroupCount: isMobile ? undefined : desktopGroupCapacity,
        maxUnitCount: isMobile ? undefined : desktopTubeCapacity,
      }),
    [desktopGroupCapacity, desktopTubeCapacity, isMobile, roundName],
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [items, setItems] = useState<PackedItem[]>(() =>
    buildInitialItems(round.questions[0]),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
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
  const [forceAnswerBanner, setForceAnswerBanner] = useState(false);
  const [isContinuousAutopilot, setIsContinuousAutopilot] = useState(false);
  const [mobileWrongAnswerRevealKey, setMobileWrongAnswerRevealKey] =
    useState(0);
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
  const [phantomDragState, setPhantomDragState] =
    useState<PhantomDragState | null>(null);
  const [groupingAnchorItemId, setGroupingAnchorItemId] = useState<
    number | null
  >(null);
  const [isGroupingPreviewAnimating, setIsGroupingPreviewAnimating] =
    useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [showInsufficientItemNotice, setShowInsufficientItemNotice] =
    useState(false);
  const [autoExpandCalculator, setAutoExpandCalculator] = useState(false);
  const [desktopRevealLineCount, setDesktopRevealLineCount] = useState(0);
  const nextComboIdRef = useRef(1);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sourceAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const nextQuestionButtonRef = useRef<HTMLButtonElement | null>(null);
  const roundCompleteButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const desktopRevealStartTimerRef = useRef<number | null>(null);
  const desktopRevealTimerRef = useRef<number | null>(null);
  const desktopNextButtonTimerRef = useRef<number | null>(null);
  const displaySyncLockRef = useRef<number | null>(null);
  const keypadDebounceRef = useRef<number | null>(null);
  const keypadAdjustTimersRef = useRef<number[]>([]);
  const autopilotSfxTimersRef = useRef<number[]>([]);
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
  const packHoldStartTimerRef = useRef<number | null>(null);
  const packHoldIntervalRef = useRef<number | null>(null);
  const autoExpandCalculatorTimerRef = useRef<number | null>(null);
  const itemsRef = useRef<PackedItem[]>(items);

  useEffect(() => {
    if (isMobile || typeof window === "undefined") {
      return;
    }

    const measureDesktopTubeCapacity = () => {
      const sceneHeight = Math.max(0, window.innerHeight);
      const nextCapacity = getDesktopTubeCapacityForSceneHeight(sceneHeight);
      const nextGroupCapacity = getDesktopGroupCapacityForSceneWidth(
        getDesktopPlayfieldWidth(window.innerWidth),
      );
      setDesktopGroupCapacity((current) =>
        current === nextGroupCapacity ? current : nextGroupCapacity,
      );
      setDesktopTubeCapacity((current) =>
        current === nextCapacity ? current : nextCapacity,
      );
    };

    measureDesktopTubeCapacity();
    window.addEventListener("resize", measureDesktopTubeCapacity);

    return () => {
      window.removeEventListener("resize", measureDesktopTubeCapacity);
    };
  }, [isMobile]);

  const question = round.questions[questionIndex];
  const isTapFillRound = question.round === "pack" || question.round === "ship";
  const isDesktopLayout = !isMobile;
  const containers = Array.from({ length: question.groupsA }, (_, index) =>
    items
      .filter((item) => item.containerIndex === index)
      .sort(sortContainerItems),
  );
  const remainingItems = items.filter((item) => item.containerIndex === null);
  const packedItemsTotal = items.length - remainingItems.length;
  const canSubmit = !showNextQuestionButton;
  const localizedQuestionText = useMemo(
    () => getLocalizedLevelOneQuestionText(question, locale),
    [locale, question],
  );
  const localizedBlackboardSteps = useMemo(
    () => getLocalizedLevelOneBlackboardSteps(question, locale),
    [locale, question],
  );
  const localizedInsufficientItemsText = useMemo(
    () => getLocalizedInsufficientItemsLabel(question.pair, locale),
    [locale, question.pair],
  );
  const score = round.questions.length - mistakeQuestionIndexes.length;
  const solvedQuestionCount = questionIndex + (questionSolved ? 1 : 0);
  const attemptedMistakeCount = mistakeQuestionIndexes.filter(
    (index) => index < solvedQuestionCount,
  ).length;
  const roundCompletionTotal = isContinuousAutopilot
    ? AUTOPILOT_QUESTION_COUNT
    : round.questions.length;
  const roundCompletionScore = isContinuousAutopilot
    ? Math.max(0, solvedQuestionCount - attemptedMistakeCount)
    : score;
  const returningItemIds = new Set(returnStates.map((state) => state.itemId));
  const draggedItemIds = new Set(dragState?.itemIds ?? []);
  const selectedItemIdSet = new Set(selectedItemIds);
  const comboSize = question.groupsA;
  const isGroupingPreviewActive =
    selectedItemIds.length > 0 &&
    groupingAnchorItemId !== null &&
    ((dragState?.origin === "source" && !dragState.isLifted) ||
      (isQuestionDemo && phantomDragState === null));
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
  const currentRoundLevel = ROUND_SEQUENCE.indexOf(roundName) + 1;
  const showDevCaptureControls = import.meta.env.DEV;
  const showAnswerBanner =
    !isQuestionDemo &&
    !isContinuousAutopilot &&
    !import.meta.env.DEV &&
    (demoConfig.showAnswers || forceAnswerBanner);
  const chromeTheme = useMemo(
    () => getChromeTheme(question.pair.item, question.pair.palette),
    [question.pair.item, question.pair.palette],
  );
  const containerBorderColor = chromeTheme.questionBoxStyle.borderColor;
  const containerBorderGlow = [
    `-10px 12px 16px -12px ${question.pair.palette}88`,
    `10px 12px 16px -12px ${question.pair.palette}88`,
    `0 14px 18px -14px ${question.pair.palette}88`,
  ].join(", ");
  const itemSizePx = isMobile ? 32 : 48;
  const itemFontSizePx = Math.round(itemSizePx * 0.84);
  const itemTranslateY = isMobileLandscape
    ? "translateY(2px)"
    : "translateY(4px)";
  const sourceGapPx = Math.max(
    6,
    Math.round(itemSizePx * (isMobileLandscape ? 0.2 : 0.24)),
  );
  const containerGapPx = Math.max(4, Math.round(itemSizePx * 0.16));
  const sourcePaddingX = Math.max(10, Math.round(itemSizePx * 0.25));
  const sourcePaddingTop = isDesktopLayout
    ? 0
    : Math.max(10, Math.round(itemSizePx * 0.25));
  const containerColumnPaddingX = Math.max(10, Math.round(itemSizePx * 0.25));
  const containerColumnPaddingTop = isDesktopLayout
    ? 0
    : Math.max(2, Math.round(itemSizePx * 0.08));
  const containerPaddingX = Math.max(10, Math.round(itemSizePx * 0.25));
  const containerPaddingY = Math.max(4, Math.round(itemSizePx * 0.08));
  const containerStackLiftPx = 8;
  const containerStackGapPx = 8;
  const containerStackStepPx = itemSizePx + containerStackGapPx;
  const visibleTubeCapacity = isMobileLandscape
    ? Math.min(question.unitRate, MOBILE_VISIBLE_TUBE_CAPACITY)
    : desktopTubeCapacity;
  const containerInnerMinHeightPx =
    itemSizePx + Math.max(0, visibleTubeCapacity - 1) * containerStackStepPx;
  const containerMinHeightPx = isMobileLandscape
    ? 208
    : containerInnerMinHeightPx + containerPaddingY * 2 + containerStackLiftPx;
  const containerWidthPx = Math.max(
    itemSizePx + containerPaddingX * 2,
    Math.round(itemSizePx * 1.9),
  );
  const containerStripGapPx = Math.max(18, Math.round(itemSizePx * 0.8));
  const containerStripBottomOffsetPx = isMobileLandscape ? 14 : 0;
  const containerSnapZonePaddingPx = Math.max(
    18,
    Math.round(itemSizePx * 0.55),
  );
  const containerSnapOffsetXPx = 4;
  const sourcePanelWidthPercent = 35;
  const containerPanelWidthPercent = 65;
  const lowerCountsStyle = isMobileLandscape
    ? { top: "calc(84.5% - 8px)" }
    : { bottom: "calc(0.5rem + 6px)" };
  const itemBoxStyle = {
    width: `${itemSizePx}px`,
    height: `${itemSizePx}px`,
    fontSize: `${itemFontSizePx}px`,
    lineHeight: 1,
  } as const;
  const itemHalfPx = itemSizePx / 2;
  const calculatorTopBanner = showAnswerBanner ? (
    <span className="font-black tracking-[0.06em]">
      <span className="text-white">{t("game.answerLabel")}</span>{" "}
      <span className="text-[#fde047]">{question.answer}</span>
    </span>
  ) : null;
  const shouldMinimizeOnSubmit = question.round === "ship";

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      if (desktopRevealTimerRef.current !== null) {
        window.clearTimeout(desktopRevealTimerRef.current);
      }
      if (desktopRevealStartTimerRef.current !== null) {
        window.clearTimeout(desktopRevealStartTimerRef.current);
      }
      if (desktopNextButtonTimerRef.current !== null) {
        window.clearTimeout(desktopNextButtonTimerRef.current);
      }
      if (autoExpandCalculatorTimerRef.current !== null) {
        window.clearTimeout(autoExpandCalculatorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      remainingItems.length === 0 &&
      !showInsufficientItemNotice &&
      !questionSolved &&
      !showNextQuestionButton &&
      !isQuestionDemo
    ) {
      if (autoExpandCalculatorTimerRef.current === null) {
        autoExpandCalculatorTimerRef.current = window.setTimeout(() => {
          autoExpandCalculatorTimerRef.current = null;
          setAutoExpandCalculator(true);
        }, 1000);
      }
      return;
    }

    if (autoExpandCalculatorTimerRef.current !== null) {
      window.clearTimeout(autoExpandCalculatorTimerRef.current);
      autoExpandCalculatorTimerRef.current = null;
    }
    setAutoExpandCalculator(false);
  }, [
    isQuestionDemo,
    questionSolved,
    remainingItems.length,
    showInsufficientItemNotice,
    showNextQuestionButton,
  ]);

  useEffect(() => {
    setItems(buildInitialItems(round.questions[0]));
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
  }, [round]);

  useEffect(() => {
    if (!isGroupingPreviewActive) {
      setIsGroupingPreviewAnimating(false);
      return;
    }

    setIsGroupingPreviewAnimating(false);
    const frame = window.requestAnimationFrame(() => {
      setIsGroupingPreviewAnimating(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isGroupingPreviewActive, groupingAnchorItemId, selectedItemIds]);

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
      setDesktopRevealLineCount(0);
      setShowNextQuestionButton(false);
      setRevealCtaMode(null);
      return;
    }

    const steps = localizedBlackboardSteps;
    if (isDesktopLayout) {
      setTypedStepLengths([]);
      setDesktopRevealLineCount(0);
      setShowNextQuestionButton(false);
      desktopRevealStartTimerRef.current = window.setTimeout(() => {
        desktopRevealStartTimerRef.current = null;
        setDesktopRevealLineCount(1);
      }, 1000);
    } else {
      setTypedStepLengths(steps.map((line) => line.length));
      setShowNextQuestionButton(true);
    }

    return () => {
      if (stepTypeIntervalRef.current !== null) {
        window.clearInterval(stepTypeIntervalRef.current);
        stepTypeIntervalRef.current = null;
      }
      if (stepTypeDelayRef.current !== null) {
        window.clearTimeout(stepTypeDelayRef.current);
        stepTypeDelayRef.current = null;
      }
      if (desktopRevealStartTimerRef.current !== null) {
        window.clearTimeout(desktopRevealStartTimerRef.current);
        desktopRevealStartTimerRef.current = null;
      }
      if (desktopRevealTimerRef.current !== null) {
        window.clearTimeout(desktopRevealTimerRef.current);
        desktopRevealTimerRef.current = null;
      }
      if (desktopNextButtonTimerRef.current !== null) {
        window.clearTimeout(desktopNextButtonTimerRef.current);
        desktopNextButtonTimerRef.current = null;
      }
    };
  }, [
    isDesktopLayout,
    localizedBlackboardSteps,
    questionResetKey,
    showUnitReveal,
  ]);

  useEffect(() => {
    if (!isDesktopLayout || !showUnitReveal) {
      return;
    }

    const totalLines = localizedBlackboardSteps.length;
    if (desktopRevealLineCount <= 0) {
      return;
    }
    if (desktopRevealLineCount >= totalLines) {
      if (
        showNextQuestionButton ||
        desktopNextButtonTimerRef.current !== null
      ) {
        return;
      }

      desktopNextButtonTimerRef.current = window.setTimeout(() => {
        desktopNextButtonTimerRef.current = null;
        setShowNextQuestionButton(true);
      }, 1000);
      return;
    }

    desktopRevealTimerRef.current = window.setTimeout(() => {
      desktopRevealTimerRef.current = null;
      setDesktopRevealLineCount((current) => Math.min(totalLines, current + 1));
    }, 1000);

    return () => {
      if (desktopRevealTimerRef.current !== null) {
        window.clearTimeout(desktopRevealTimerRef.current);
        desktopRevealTimerRef.current = null;
      }
      if (desktopRevealStartTimerRef.current !== null) {
        window.clearTimeout(desktopRevealStartTimerRef.current);
        desktopRevealStartTimerRef.current = null;
      }
      if (desktopNextButtonTimerRef.current !== null) {
        window.clearTimeout(desktopNextButtonTimerRef.current);
        desktopNextButtonTimerRef.current = null;
      }
    };
  }, [
    desktopRevealLineCount,
    isDesktopLayout,
    localizedBlackboardSteps,
    showNextQuestionButton,
    showUnitReveal,
  ]);

  useEffect(() => {
    if (!isDesktopLayout || !showUnitReveal || desktopRevealLineCount <= 0) {
      return;
    }

    playRipple(300);
  }, [desktopRevealLineCount, isDesktopLayout, showUnitReveal]);

  useEffect(() => {
    if (!isDesktopLayout || !showUnitReveal || !showNextQuestionButton) {
      return;
    }

    playRipple(300);
  }, [isDesktopLayout, showNextQuestionButton, showUnitReveal]);

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
      if (packHoldStartTimerRef.current !== null) {
        window.clearTimeout(packHoldStartTimerRef.current);
      }
      if (packHoldIntervalRef.current !== null) {
        window.clearInterval(packHoldIntervalRef.current);
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
    const fullText = localizedQuestionText;
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
  }, [isRoundComplete, localizedQuestionText, questionResetKey]);

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

  function revealInsufficientItemsState() {
    setShowUnitReveal(false);
    setQuestionSolved(false);
    setFlash({ ok: false, icon: true });
    setShowInsufficientItemNotice(true);
    markQuestionPenalty();
    revealWrongAnswerStateOnMobile();
    playWrong();
  }

  function finalizeQuestionReset() {
    clearPackHoldTimers();
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }
    if (stepTypeIntervalRef.current !== null) {
      window.clearInterval(stepTypeIntervalRef.current);
      stepTypeIntervalRef.current = null;
    }
    if (stepTypeDelayRef.current !== null) {
      window.clearTimeout(stepTypeDelayRef.current);
      stepTypeDelayRef.current = null;
    }
    setItems(buildInitialItems(question));
    setShowUnitReveal(false);
    setQuestionSolved(false);
    setDragState(null);
    setReturnStates([]);
    setPhantomPos(null);
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setFlash(null);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setSelectedItemIds([]);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setShowInsufficientItemNotice(false);
    setForceAnswerBanner(false);
    setIsCalculatorAdjusting(false);
    setIsContinuousAutopilot(false);
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
    clearAutopilotSfxTimers();
    keypadAdjustTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    keypadAdjustTimersRef.current = [];
  }

  function handleToolbarRefresh() {
    clearPackHoldTimers();
    if (demoTimerRef.current !== null) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (autopilotAdvanceTimerRef.current !== null) {
      window.clearTimeout(autopilotAdvanceTimerRef.current);
      autopilotAdvanceTimerRef.current = null;
    }
    if (continuousAutopilotStartTimerRef.current !== null) {
      window.clearTimeout(continuousAutopilotStartTimerRef.current);
      continuousAutopilotStartTimerRef.current = null;
    }
    clearAutopilotSfxTimers();
    setIsContinuousAutopilot(false);
    setPhantomPos(null);
    setPhantomDragState(null);
    setDragState(null);
    setFlash(null);

    const hasPackedItems = itemsRef.current.some(
      (item) => item.containerIndex !== null,
    );

    if (hasPackedItems) {
      animateItemsBackToSource(() => {
        finalizeQuestionReset();
      });
      return;
    }

    finalizeQuestionReset();
  }

  function handleRestart() {
    clearPackHoldTimers();
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
    setReturnStates([]);
    setPhantomPos(null);
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setFlash(null);
    setMistakeQuestionIndexes([]);
    setTypedQuestionLength(0);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setSelectedItemIds([]);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setShowInsufficientItemNotice(false);
    setForceAnswerBanner(false);
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
    clearAutopilotSfxTimers();
    keypadAdjustTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    keypadAdjustTimersRef.current = [];
    cheatBufferRef.current = "";
    continuousAutopilotStartIndexRef.current = 0;
  }

  function handleRoundChange(
    nextRound: RoundName,
    options?: { preserveContinuousAutopilot?: boolean },
  ) {
    if (nextRound === roundName) {
      return;
    }

    const preserveContinuousAutopilot =
      options?.preserveContinuousAutopilot ?? false;

    clearPackHoldTimers();
    setRoundName(nextRound);
    setQuestionIndex(0);
    setShowUnitReveal(false);
    setIsRoundComplete(false);
    setQuestionSolved(false);
    setDragState(null);
    setReturnStates([]);
    setPhantomPos(null);
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setFlash(null);
    setMistakeQuestionIndexes([]);
    setTypedQuestionLength(0);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setShowInsufficientItemNotice(false);
    setForceAnswerBanner(false);
    setIsCalculatorAdjusting(false);
    setIsContinuousAutopilot(preserveContinuousAutopilot);
    setQuestionResetKey((current) => current + 1);
    dragSoundPointRef.current = null;
    nextComboIdRef.current = 1;
    cheatBufferRef.current = "";
    continuousAutopilotStartIndexRef.current = 0;
    clearKeypadAdjustTimers();
    clearAutopilotSfxTimers();
  }

  function jumpToQuestionIndex(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= round.questions.length) {
      return;
    }

    clearPackHoldTimers();
    clearKeypadAdjustTimers();
    clearAutopilotSfxTimers();
    if (autopilotAdvanceTimerRef.current !== null) {
      window.clearTimeout(autopilotAdvanceTimerRef.current);
      autopilotAdvanceTimerRef.current = null;
    }
    if (continuousAutopilotStartTimerRef.current !== null) {
      window.clearTimeout(continuousAutopilotStartTimerRef.current);
      continuousAutopilotStartTimerRef.current = null;
    }

    setQuestionIndex(nextIndex);
    setItems(buildInitialItems(round.questions[nextIndex]));
    setShowUnitReveal(false);
    setIsRoundComplete(false);
    setQuestionSolved(false);
    setDragState(null);
    setReturnStates([]);
    setPhantomPos(null);
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setFlash(null);
    setTypedQuestionLength(0);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setShowInsufficientItemNotice(false);
    setForceAnswerBanner(false);
    setIsCalculatorAdjusting(false);
    setIsContinuousAutopilot(false);
    setQuestionResetKey((current) => current + 1);
    dragSoundPointRef.current = null;
    nextComboIdRef.current = 1;
  }

  function handleDevProgressDotClick(dotIndex: number) {
    if (!import.meta.env.DEV) {
      return;
    }

    if (dotIndex < 0 || dotIndex >= progressTotal) {
      return;
    }

    if (dotIndex >= round.questions.length - 1) {
      const roundPosition = ROUND_SEQUENCE.indexOf(roundName);
      const nextRound = ROUND_SEQUENCE[roundPosition + 1];
      if (nextRound) {
        handleRoundChange(nextRound);
        return;
      }

      setIsRoundComplete(true);
      playLevelComplete();
      return;
    }

    jumpToQuestionIndex(dotIndex + 1);
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
    setSelectedItemIds([]);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setReturnStates([]);
    setPhantomDragState(null);
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

  function clearAutopilotSfxTimers() {
    autopilotSfxTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    autopilotSfxTimersRef.current = [];
  }

  function scheduleAutopilotDragSounds(durationMs: number, intervalMs = 180) {
    clearAutopilotSfxTimers();
    const stepCount = Math.max(1, Math.floor(durationMs / intervalMs));
    for (let index = 0; index < stepCount; index += 1) {
      const timer = window.setTimeout(() => {
        autopilotSfxTimersRef.current = autopilotSfxTimersRef.current.filter(
          (current) => current !== timer,
        );
        playDragStep();
      }, index * intervalMs);
      autopilotSfxTimersRef.current.push(timer);
    }
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
      .sort(sortContainerItems);
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
              x: center.x - itemHalfPx,
              y: center.y - itemHalfPx,
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
                  x: center.x - itemHalfPx,
                  y: center.y - itemHalfPx,
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
              x: center.x - itemHalfPx,
              y: center.y - itemHalfPx,
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
                  x: center.x - itemHalfPx,
                  y: center.y - itemHalfPx,
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

  function clearPackHoldTimers() {
    if (packHoldStartTimerRef.current !== null) {
      window.clearTimeout(packHoldStartTimerRef.current);
      packHoldStartTimerRef.current = null;
    }
    if (packHoldIntervalRef.current !== null) {
      window.clearInterval(packHoldIntervalRef.current);
      packHoldIntervalRef.current = null;
    }
  }

  function animateSingleItemToContainer(
    itemId: number,
    containerIndex: number,
  ) {
    const itemNode = itemRefs.current[itemId];
    const startCenter = getScreenCenter(itemNode);

    if (startCenter) {
      setReturnStates([
        {
          itemId,
          x: startCenter.x - itemHalfPx,
          y: startCenter.y - itemHalfPx,
          durationMs: 240,
        },
      ]);
    }

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === itemId
          ? { ...currentItem, containerIndex, comboId: null }
          : currentItem,
      ),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetCenter = getScreenCenter(itemRefs.current[itemId]);
        setReturnStates(
          targetCenter
            ? [
                {
                  itemId,
                  x: targetCenter.x - itemHalfPx,
                  y: targetCenter.y - itemHalfPx,
                  durationMs: 240,
                },
              ]
            : [],
        );
      });
    });

    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
    }
    returnTimerRef.current = window.setTimeout(() => {
      setReturnStates([]);
    }, 280);
  }

  function addNextItemToContainer(containerIndex: number) {
    if (!isTapFillRound || isQuestionDemo || revealCtaMode === "retry") {
      return false;
    }

    const currentCount = getCurrentItemsInContainer(containerIndex).length;
    if (currentCount >= question.unitRate) {
      return false;
    }

    const nextItem = itemsRef.current
      .filter((item) => item.containerIndex === null)
      .sort((left, right) => left.id - right.id)[0];

    if (!nextItem) {
      return false;
    }

    ensureMusic();
    playRipple(340 + containerIndex * 45);
    animateSingleItemToContainer(nextItem.id, containerIndex);
    return true;
  }

  function handleContainerPointerDown(
    containerIndex: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!isTapFillRound || isCalculatorAdjusting) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearPackHoldTimers();
    setReturnStates([]);
    addNextItemToContainer(containerIndex);

    packHoldStartTimerRef.current = window.setTimeout(() => {
      packHoldStartTimerRef.current = null;
      packHoldIntervalRef.current = window.setInterval(() => {
        const didAddItem = addNextItemToContainer(containerIndex);
        if (!didAddItem) {
          clearPackHoldTimers();
        }
      }, PACK_HOLD_INTERVAL_MS);
    }, PACK_HOLD_DELAY_MS);
  }

  function applyCalculatorTarget(rawValue: string, onComplete?: () => void) {
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
      onComplete?.();
      return;
    }

    setIsCalculatorAdjusting(true);

    if (targetTopCount > currentTopCount) {
      const stepsToAdd = Math.min(
        targetTopCount - currentTopCount,
        maxAdditionalSteps,
      );
      const isOverflowRequest = targetTopCount > currentTopCount + stepsToAdd;
      if (stepsToAdd === 0) {
        setIsCalculatorAdjusting(false);
        if (isOverflowRequest) {
          revealInsufficientItemsState();
        }
        onComplete?.();
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
        if (isOverflowRequest) {
          revealInsufficientItemsState();
        }
        onComplete?.();
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
      onComplete?.();
    }, 480);
  }

  function handleCalculatorChange(nextValue: string) {
    const digitsOnly = nextValue.replace(/\D/g, "");
    const normalizedValue =
      digitsOnly === "" ? "0" : String(Number.parseInt(digitsOnly, 10));

    setShowInsufficientItemNotice(false);
    setCalculatorInput(normalizedValue);
    setCalculatorOverride(true);

    if (keypadDebounceRef.current !== null) {
      window.clearTimeout(keypadDebounceRef.current);
      keypadDebounceRef.current = null;
    }

    if (question.round === "ship") {
      clearKeypadAdjustTimers();
      setIsCalculatorAdjusting(false);
      return;
    }

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
    setForceAnswerBanner(true);
  }

  function stageComboIntoTopBox(
    itemIds: number[],
    targetContainerIndexes: number[],
    comboId: number,
    startPosition?: { x: number; y: number },
    options?: { alreadyExpanded?: boolean },
  ) {
    const COLUMN_DROP_DELAY_MS = 70;
    const COLUMN_EXPAND_MS = 180;
    const COLUMN_DROP_TRAVEL_MS = 320;
    const COLUMN_DROP_CLEANUP_MS = 620;
    const alreadyExpanded = options?.alreadyExpanded ?? false;
    const finalTopBoxCount = targetContainerIndexes.filter(
      (containerIndex) => containerIndex === 0,
    ).length;
    lockDisplayTopBoxCount(
      finalTopBoxCount,
      COLUMN_DROP_DELAY_MS +
        (alreadyExpanded ? 0 : COLUMN_EXPAND_MS) +
        COLUMN_DROP_TRAVEL_MS,
    );

    window.setTimeout(() => {
      const snapPosition = getTopBoxLeadDropPosition();
      const snapY = snapPosition?.y ?? startPosition?.y ?? 0;
      const groupedStartX = startPosition?.x ?? snapPosition?.x ?? 0;
      const groupedStartStates = itemIds.map((itemId, itemIndex) => ({
        itemId,
        x: groupedStartX + itemIndex * (itemSizePx + sourceGapPx),
        y: snapY,
        durationMs: COLUMN_EXPAND_MS,
      }));
      const expandedStates = itemIds.map((itemId, itemIndex) => {
        const targetContainerRect =
          containerRefs.current[
            targetContainerIndexes[itemIndex] ?? 0
          ]?.getBoundingClientRect();
        const x = targetContainerRect
          ? targetContainerRect.left +
            targetContainerRect.width / 2 -
            itemSizePx / 2 +
            containerSnapOffsetXPx
          : (startPosition?.x ?? 0);

        return {
          itemId,
          x,
          y: snapY,
          durationMs: COLUMN_EXPAND_MS,
        };
      });

      assignItems(
        itemIds,
        (_, itemIndex) => targetContainerIndexes[itemIndex] ?? 0,
        comboId,
      );
      setReturnStates(alreadyExpanded ? expandedStates : groupedStartStates);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alreadyExpanded) {
            setReturnStates(expandedStates);
          }
          window.setTimeout(
            () => {
              setReturnStates(
                itemIds
                  .map((itemId) => {
                    const center = getScreenCenter(itemRefs.current[itemId]);
                    return center
                      ? {
                          itemId,
                          x: center.x - itemHalfPx,
                          y: center.y - itemHalfPx,
                          durationMs: COLUMN_DROP_TRAVEL_MS,
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
            },
            alreadyExpanded ? 0 : COLUMN_EXPAND_MS,
          );
        });
      });

      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current);
      }
      returnTimerRef.current = window.setTimeout(() => {
        setReturnStates([]);
      }, COLUMN_DROP_CLEANUP_MS);
    }, COLUMN_DROP_DELAY_MS);
  }

  function getContainerStripRect() {
    const rects = containerRefs.current
      .map((node) => node?.getBoundingClientRect() ?? null)
      .filter((rect): rect is DOMRect => rect !== null);

    if (rects.length === 0) {
      return null;
    }

    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
    };
  }

  function getContainerDropZoneRect() {
    const sceneRect = captureSceneRef.current?.getBoundingClientRect();
    const stripRect = getContainerStripRect();
    if (!sceneRect || !stripRect) {
      return null;
    }

    return {
      left: sceneRect.left + (sceneRect.width * sourcePanelWidthPercent) / 100,
      top: sceneRect.top,
      right: sceneRect.right,
      bottom: stripRect.bottom + containerSnapZonePaddingPx,
    };
  }

  function isPointNearContainerStrip(x: number, y: number) {
    const rect = getContainerDropZoneRect();
    if (!rect) {
      return false;
    }

    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  }

  function getTopBoxLeadDropPosition(): { x: number; y: number } | null {
    const firstContainerRect =
      containerRefs.current[0]?.getBoundingClientRect();
    if (!firstContainerRect) {
      return null;
    }

    return {
      x:
        firstContainerRect.left +
        firstContainerRect.width / 2 -
        itemSizePx / 2 +
        containerSnapOffsetXPx,
      y:
        firstContainerRect.top -
        itemSizePx -
        (isMobileLandscape ? 16 : 32),
    };
  }

  function getSnappedDragPreviewPositions(itemIds: number[]) {
    const orderedIds = getAnchoredGroupItemIds(
      dragState?.anchorItemId ?? itemIds[0] ?? 0,
      itemIds,
    );

    return orderedIds.map((itemId, index) => {
      const containerRect =
        containerRefs.current[index]?.getBoundingClientRect();
      return {
        itemId,
        x: containerRect
          ? containerRect.left +
            containerRect.width / 2 -
            itemSizePx / 2 +
            containerSnapOffsetXPx
          : (dragState?.x ?? 0) + index * (itemSizePx + sourceGapPx),
      };
    });
  }

  function getGroupingPreviewFrame() {
    if (!isGroupingPreviewActive || groupingAnchorItemId === null) {
      return null;
    }

    const anchorRect =
      itemRefs.current[groupingAnchorItemId]?.getBoundingClientRect();
    if (!anchorRect) {
      return null;
    }

    return {
      left: anchorRect.left - sourceGapPx / 2,
      top: anchorRect.top,
      width:
        selectedItemIds.length * itemSizePx +
        Math.max(0, selectedItemIds.length - 1) * sourceGapPx +
        sourceGapPx,
      height: itemSizePx,
    };
  }

  function getGroupingPreviewTransform(itemId: number) {
    if (!isGroupingPreviewActive || groupingAnchorItemId === null) {
      return undefined;
    }

    const anchorRect =
      itemRefs.current[groupingAnchorItemId]?.getBoundingClientRect();
    const itemRect = itemRefs.current[itemId]?.getBoundingClientRect();
    if (!anchorRect || !itemRect) {
      return undefined;
    }

    const orderedIds = getAnchoredGroupItemIds(
      groupingAnchorItemId,
      selectedItemIds,
    );
    const targetIndex = orderedIds.indexOf(itemId);
    if (targetIndex < 0) {
      return undefined;
    }

    return `translate(${anchorRect.left + targetIndex * (itemSizePx + sourceGapPx) - itemRect.left}px, ${anchorRect.top - itemRect.top}px)`;
  }

  function getGroupingPreviewItemState(itemId: number) {
    if (!isGroupingPreviewActive) {
      return null;
    }

    const itemRect = itemRefs.current[itemId]?.getBoundingClientRect();
    const transform = getGroupingPreviewTransform(itemId);
    if (!itemRect || !transform) {
      return null;
    }

    return {
      left: itemRect.left,
      top: itemRect.top,
      transform: isGroupingPreviewAnimating ? transform : "translate(0px, 0px)",
    };
  }

  function runQuestionAutopilot(mode: "retry" | "solve") {
    if (questionSolved || isQuestionDemo || revealCtaMode === "retry") {
      return;
    }

    if (roundName === "pack" || roundName === "ship") {
      setIsQuestionDemo(true);
      setRevealCtaMode(null);
      markQuestionPenalty();
      setPhantomDragState(null);
      setSelectedItemIds([]);
      setGroupingAnchorItemId(null);
      setIsGroupingPreviewAnimating(false);
      clearKeypadAdjustTimers();
      if (displaySyncLockRef.current !== null) {
        window.clearTimeout(displaySyncLockRef.current);
        displaySyncLockRef.current = null;
      }
      setCalculatorInput("0");
      setCalculatorOverride(true);
      setDisplayTopBoxCount(0);

      const answerDigits = String(question.answer).split("");
      const KEY_MOVE_MS = 280;
      const KEY_PRESS_MS = 120;
      const KEY_SETTLE_MS = 220;
      const POST_INPUT_SETTLE_MS = roundName === "pack" ? 700 : 0;
      let timelineMs = 0;
      let autopilotDisplayValue = "0";

      answerDigits.forEach((digit) => {
        const keyCenter = getKeypadButtonCenter(digit);
        if (!keyCenter) {
          return;
        }

        window.setTimeout(() => {
          setPhantomPos({
            ...keyCenter,
            isClicking: false,
            durationMs: KEY_MOVE_MS,
          });
        }, timelineMs);

        window.setTimeout(() => {
          setPhantomPos({
            ...keyCenter,
            isClicking: true,
            durationMs: KEY_PRESS_MS,
          });
        }, timelineMs + KEY_MOVE_MS);

        window.setTimeout(
          () => {
            playKeyClick();
            autopilotDisplayValue =
              autopilotDisplayValue === "" || autopilotDisplayValue === "0"
                ? digit
                : autopilotDisplayValue === "-0"
                  ? `-${digit}`
                  : `${autopilotDisplayValue}${digit}`;

            if (roundName === "pack") {
              handleCalculatorChange(autopilotDisplayValue);
            } else {
              setCalculatorOverride(true);
              setCalculatorInput(autopilotDisplayValue);
            }
          },
          timelineMs + KEY_MOVE_MS + KEY_PRESS_MS,
        );

        timelineMs += KEY_MOVE_MS + KEY_PRESS_MS + KEY_SETTLE_MS;
      });

      const submitButtonCenter = getSubmitButtonCenter();
      if (!submitButtonCenter) {
        setPhantomPos(null);
        setIsQuestionDemo(false);
        return;
      }

      window.setTimeout(() => {
        setPhantomPos({
          ...submitButtonCenter,
          isClicking: false,
          durationMs: 80,
        });
      }, timelineMs + POST_INPUT_SETTLE_MS);

      window.setTimeout(
        () => {
          setPhantomPos({
            ...submitButtonCenter,
            isClicking: true,
            durationMs: 120,
          });
          playKeyClick();
        },
        timelineMs + POST_INPUT_SETTLE_MS + KEY_MOVE_MS,
      );

      window.setTimeout(
        () => {
          document
            .querySelector<HTMLButtonElement>('[data-autopilot-key="submit"]')
            ?.click();
        },
        timelineMs + POST_INPUT_SETTLE_MS + KEY_MOVE_MS + KEY_PRESS_MS,
      );

      window.setTimeout(
        () => {
          setPhantomPos(null);
          setIsQuestionDemo(false);
          if (mode === "retry") {
            setRevealCtaMode("retry");
          }
        },
        timelineMs + POST_INPUT_SETTLE_MS + KEY_MOVE_MS + KEY_PRESS_MS + 1600,
      );

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

    const DEMO_STEP_MS = 4080;
    const DEMO_PICKUP_PRESS_MS = 220;
    const DEMO_DRAG_START_DELAY_MS = 120;
    const DEMO_DRAG_TRAVEL_MS = 920;
    const DEMO_DROP_HOLD_MS = 300;
    const DEMO_FINAL_DROP_SETTLE_MS =
      DEMO_PICKUP_PRESS_MS +
      DEMO_DRAG_START_DELAY_MS +
      DEMO_DRAG_TRAVEL_MS +
      DEMO_DRAG_TRAVEL_MS +
      DEMO_DROP_HOLD_MS;

    comboAssignments.forEach((group, index) => {
      window.setTimeout(() => {
        const orderedGroup = group
          .slice()
          .sort((left, right) => left.containerIndex - right.containerIndex);
        const leadItemNode = itemRefs.current[orderedGroup[0]!.itemId];
        const anchorItemId = orderedGroup[0]!.itemId;
        const leadItemCenter = getScreenCenter(leadItemNode);
        const leadItemRect = leadItemNode?.getBoundingClientRect();
        const leadItemPickupPoint = getItemPickupPoint(leadItemNode);
        setSelectedItemIds(orderedGroup.map((entry) => entry.itemId));
        setGroupingAnchorItemId(anchorItemId);
        const comboId = nextComboIdRef.current;
        nextComboIdRef.current += 1;

        if (leadItemPickupPoint) {
          setPhantomPos({
            ...leadItemPickupPoint,
            isClicking: true,
            durationMs: 120,
          });
        }

        window.setTimeout(() => {
          if (leadItemPickupPoint) {
            setPhantomPos({
              ...leadItemPickupPoint,
              isClicking: false,
              durationMs: DEMO_DRAG_TRAVEL_MS,
            });
          }

          if (leadItemCenter) {
            setPhantomDragState({
              itemIds: orderedGroup.map((entry) => entry.itemId),
              anchorItemId,
              x: leadItemRect
                ? leadItemRect.left
                : leadItemCenter.x - itemHalfPx,
              y: leadItemRect
                ? leadItemRect.top
                : leadItemCenter.y - itemHalfPx,
            });
          }

          const targetLeadPosition = getTopBoxLeadDropPosition();
          window.setTimeout(() => {
            if (targetLeadPosition) {
              setPhantomPos({
                x: targetLeadPosition.x + itemHalfPx,
                y: targetLeadPosition.y + itemHalfPx,
                isClicking: false,
                durationMs: DEMO_DRAG_TRAVEL_MS,
              });
              scheduleAutopilotDragSounds(DEMO_DRAG_TRAVEL_MS);
              setPhantomDragState({
                itemIds: orderedGroup.map((entry) => entry.itemId),
                anchorItemId,
                x: targetLeadPosition.x,
                y: targetLeadPosition.y,
              });
            }
            window.setTimeout(() => {
              if (targetLeadPosition) {
                setPhantomPos({
                  x: targetLeadPosition.x + itemHalfPx,
                  y: targetLeadPosition.y + itemHalfPx,
                  isClicking: true,
                  durationMs: 120,
                });
              }
              window.setTimeout(() => {
                stageComboIntoTopBox(
                  orderedGroup.map((entry) => entry.itemId),
                  orderedGroup.map((entry) => entry.containerIndex),
                  comboId,
                  targetLeadPosition ?? undefined,
                );
                setPhantomPos(null);
                setPhantomDragState(null);
                setSelectedItemIds([]);
                setGroupingAnchorItemId(null);
                setIsGroupingPreviewAnimating(false);
              }, DEMO_DROP_HOLD_MS);
            }, DEMO_DRAG_TRAVEL_MS);
          }, DEMO_DRAG_TRAVEL_MS);
        }, DEMO_PICKUP_PRESS_MS + DEMO_DRAG_START_DELAY_MS);
      }, index * DEMO_STEP_MS);
    });

    window.setTimeout(
      () => {
        const submitButtonCenter = getSubmitButtonCenter();
        if (submitButtonCenter) {
          setPhantomPos({
            ...submitButtonCenter,
            isClicking: false,
            durationMs: 80,
          });
        }

        window.setTimeout(() => {
          if (submitButtonCenter) {
            setPhantomPos({
              ...submitButtonCenter,
              isClicking: true,
              durationMs: 120,
            });
          }
          playKeyClick();

          window.setTimeout(() => {
            setSelectedItemIds([]);
            setTypedStepLengths([]);
            setShowNextQuestionButton(false);
            setPhantomPos(null);
            setPhantomDragState(null);
            setIsQuestionDemo(false);

            const isCorrect = isCurrentBoardCorrect();

            if (isCorrect) {
              applyCorrectAnswerResult(mode === "retry" ? "retry" : "next");
            } else {
              setShowUnitReveal(false);
              setQuestionSolved(false);
              setFlash({ ok: false, icon: true });
              markQuestionPenalty();
              playWrong();
            }
          }, 180);
        }, 1000);
      },
      Math.max(
        0,
        (comboAssignments.length - 1) * DEMO_STEP_MS +
          DEMO_FINAL_DROP_SETTLE_MS,
      ),
    );
  }

  function applyCorrectAnswerResult(revealMode: RevealCtaMode) {
    setShowUnitReveal(true);
    setQuestionSolved(true);
    setFlash({ ok: true, icon: true });
    setRevealCtaMode(revealMode);
    playCorrect();
  }

  function revealWrongAnswerStateOnMobile() {
    if (isMobileLandscape) {
      setMobileWrongAnswerRevealKey((current) => current + 1);
    }
  }

  function handleSubmitAnswer() {
    if (question.round === "ship") {
      const submittedAnswer = Number.parseInt(calculatorInput, 10);
      applyCalculatorTarget(calculatorInput, () => {
        if (submittedAnswer > question.totalA) {
          revealInsufficientItemsState();
          return;
        }

        window.setTimeout(() => {
          const isCorrect = submittedAnswer === question.unitRate;

          if (isCorrect) {
            applyCorrectAnswerResult("next");
            return;
          }

          setShowUnitReveal(false);
          setQuestionSolved(false);
          setFlash({ ok: false, icon: true });
          markQuestionPenalty();
          revealWrongAnswerStateOnMobile();
          playWrong();
        }, SHIP_RESULT_DELAY_MS);
      });
      return;
    }

    const isCorrect =
      remainingItems.length === 0 &&
      containers.every(
        (containerItems) => containerItems.length === question.unitRate,
      );

    if (isCorrect) {
      applyCorrectAnswerResult("next");
      return;
    }

    setShowUnitReveal(false);
    setQuestionSolved(false);
    setFlash({ ok: false, icon: true });
    markQuestionPenalty();
    revealWrongAnswerStateOnMobile();
    playWrong();
  }

  function handlePointerDown(
    itemId: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (isTapFillRound) {
      return;
    }

    if (isQuestionDemo || revealCtaMode === "retry" || isCalculatorAdjusting) {
      return;
    }

    ensureMusic();
    setShowInsufficientItemNotice(false);
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
    setGroupingAnchorItemId(itemId);
    setDragState({
      itemIds,
      anchorItemId: itemId,
      origin,
      comboId,
      isLifted: false,
      isSnappedToContainers: false,
      x: rect.left,
      y: rect.top,
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
    });
    dragSoundPointRef.current = {
      x: event.clientX,
      y: event.clientY,
      carry: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (isTapFillRound) {
      return;
    }

    if (!dragState) {
      return;
    }

    const hitIndex = isPointNearContainerStrip(event.clientX, event.clientY)
      ? 0
      : -1;

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

    setDragState((current) => {
      if (!current) {
        return current;
      }

      const isLifted =
        current.isLifted ||
        Math.hypot(
          event.clientX - (current.x + current.pointerOffsetX),
          event.clientY - (current.y + current.pointerOffsetY),
        ) > 6;

      if (isLifted && hitIndex === 0) {
        const snapPosition = getTopBoxLeadDropPosition();
        if (snapPosition) {
          return {
            ...current,
            isLifted,
            isSnappedToContainers: true,
            x: snapPosition.x,
            y: snapPosition.y,
          };
        }
      }

      return {
        ...current,
        isLifted,
        isSnappedToContainers: false,
        x: event.clientX - current.pointerOffsetX,
        y: event.clientY - current.pointerOffsetY,
      };
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    clearPackHoldTimers();

    if (isTapFillRound) {
      return;
    }

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

    const hitIndex = isPointNearContainerStrip(event.clientX, event.clientY)
      ? 0
      : -1;

    if (hitIndex >= 0) {
      if (dragState.origin === "source") {
        const comboId = dragState.comboId ?? nextComboIdRef.current;
        const orderedDragItemIds = getAnchoredGroupItemIds(
          dragState.anchorItemId,
          dragState.itemIds,
        );
        stageComboIntoTopBox(
          orderedDragItemIds,
          orderedDragItemIds.map((_, index) => index),
          comboId,
          { x: dragState.x, y: dragState.y },
          { alreadyExpanded: dragState.isSnappedToContainers },
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
    setSelectedItemIds([]);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    dragSoundPointRef.current = null;

    if (originStates.some((state) => state.originRect)) {
      requestAnimationFrame(() => {
        setReturnStates(
          originStates
            .map(({ itemId, originRect }) =>
              originRect
                ? {
                    itemId,
                    x: originRect.left + originRect.width / 2 - itemHalfPx,
                    y: originRect.top + originRect.height / 2 - itemHalfPx,
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
    const size = Math.max(
      120,
      Math.min(Math.min(rect.width, rect.height) * 0.42, 280),
    );
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

  function getItemPickupPoint(
    node: HTMLElement | null,
  ): { x: number; y: number } | null {
    if (!node) {
      return null;
    }

    const rect = node.getBoundingClientRect();
    return {
      x: rect.right - Math.min(12, rect.width * 0.18),
      y: rect.top + rect.height * 0.56,
    };
  }

  function getSubmitButtonCenter(): { x: number; y: number } | null {
    const submitButton = document.querySelector<HTMLButtonElement>(
      '[data-autopilot-key="submit"]',
    );
    return getScreenCenter(submitButton ?? null);
  }

  function getKeypadButtonCenter(key: string): { x: number; y: number } | null {
    const button = document.querySelector<HTMLButtonElement>(
      `[data-autopilot-key="${key}"]`,
    );
    return getScreenCenter(button ?? null);
  }

  function isCurrentBoardCorrect() {
    const currentItems = itemsRef.current;
    if (currentItems.some((item) => item.containerIndex === null)) {
      return false;
    }

    return Array.from(
      { length: question.groupsA },
      (_, containerIndex) =>
        currentItems.filter((item) => item.containerIndex === containerIndex)
          .length,
    ).every((count) => count === question.unitRate);
  }

  function solveCurrentQuestion() {
    runQuestionAutopilot("retry");
  }

  function animateItemsBackToSource(onComplete?: () => void) {
    const packedItems = items.filter((item) => item.containerIndex !== null);

    if (packedItems.length === 0) {
      setShowUnitReveal(false);
      setTypedStepLengths([]);
      setShowNextQuestionButton(false);
      setRevealCtaMode(null);
      onComplete?.();
      return;
    }

    setShowUnitReveal(false);
    setTypedStepLengths([]);
    setShowNextQuestionButton(false);
    setRevealCtaMode(null);

    const startStates = packedItems
      .map((item) => {
        const center = getScreenCenter(itemRefs.current[item.id]);
        return center
          ? {
              itemId: item.id,
              x: center.x - itemHalfPx,
              y: center.y - itemHalfPx,
            }
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
              ? {
                  itemId: item.id,
                  x: center.x - itemHalfPx,
                  y: center.y - itemHalfPx,
                }
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
      returnTimerRef.current = null;
      setReturnStates([]);
      onComplete?.();
    }, RETURN_ANIMATION_MS);
  }

  function goToNextQuestion() {
    if (
      isContinuousAutopilot &&
      solvedQuestionCount >= AUTOPILOT_QUESTION_COUNT
    ) {
      setIsRoundComplete(true);
      playLevelComplete();
      return;
    }

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
    setReturnStates([]);
    setPhantomPos(null);
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setShowInsufficientItemNotice(false);
    setForceAnswerBanner(false);
    setIsCalculatorAdjusting(false);
    clearKeypadAdjustTimers();
  }

  function handleNowYourTurn() {
    handleRestart();
  }

  function handleKeypadEnterPress() {
    if (!showNextQuestionButton) {
      return false;
    }

    if (revealCtaMode === "retry") {
      handleNowYourTurn();
      return true;
    }

    if (revealCtaMode === "next") {
      goToNextQuestion();
      return true;
    }

    return false;
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
        setShowInsufficientItemNotice(false);
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

    if (isRoundComplete) {
      setPhantomPos(null);
      setPhantomDragState(null);
      clearAutopilotSfxTimers();
      return;
    }

    if (questionSolved && showNextQuestionButton && revealCtaMode === "next") {
      if (autopilotAdvanceTimerRef.current !== null) {
        window.clearTimeout(autopilotAdvanceTimerRef.current);
      }
      autopilotAdvanceTimerRef.current = window.setTimeout(() => {
        autopilotAdvanceTimerRef.current = null;
        const nextButtonCenter = getScreenCenter(nextQuestionButtonRef.current);
        if (nextButtonCenter) {
          setPhantomPos({
            ...nextButtonCenter,
            isClicking: false,
            durationMs: 220,
          });
        }
        window.setTimeout(() => {
          if (nextButtonCenter) {
            setPhantomPos({
              ...nextButtonCenter,
              isClicking: true,
              durationMs: 120,
            });
          }
          window.setTimeout(() => {
            setPhantomPos(null);
            goToNextQuestion();
          }, 1000);
        }, 220);
      }, 1000);
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

  useEffect(() => {
    if (!showNextQuestionButton) {
      return;
    }

    function handleNextButtonEnter(event: KeyboardEvent) {
      if (event.key !== "Enter") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      if (revealCtaMode === "retry") {
        handleNowYourTurn();
        return;
      }
      if (revealCtaMode === "next") {
        goToNextQuestion();
      }
    }

    window.addEventListener("keydown", handleNextButtonEnter);
    return () => {
      window.removeEventListener("keydown", handleNextButtonEnter);
    };
  }, [
    goToNextQuestion,
    handleNowYourTurn,
    revealCtaMode,
    showNextQuestionButton,
  ]);

  useEffect(() => {
    if (!isRoundComplete) {
      return;
    }

    function handleRoundCompleteEnter(event: KeyboardEvent) {
      if (event.key !== "Enter") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      handleRoundCompleteContinue();
    }

    window.addEventListener("keydown", handleRoundCompleteEnter);
    return () => {
      window.removeEventListener("keydown", handleRoundCompleteEnter);
    };
  }, [isRoundComplete, roundName]);

  const visibleStepLines = showUnitReveal
    ? isDesktopLayout
      ? localizedBlackboardSteps
          .slice(0, desktopRevealLineCount)
          .map(stripTrailingPeriod)
      : localizedBlackboardSteps
          .map((line, index) => line.slice(0, typedStepLengths[index] ?? 0))
          .filter((line) => line.length > 0)
    : [];
  const visibleQuestionText = localizedQuestionText.slice(
    0,
    typedQuestionLength,
  );
  const nextRoundName =
    ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(roundName) + 1] ?? null;
  const roundLabels: Record<RoundName, string> = {
    load: t("game.roundLoad"),
    pack: t("game.roundPack"),
    ship: t("game.roundShip"),
  };

  function handleRoundCompleteContinue() {
    if (nextRoundName) {
      handleRoundChange(nextRoundName, {
        preserveContinuousAutopilot: isContinuousAutopilot,
      });
      return;
    }

    setIsContinuousAutopilot(false);
    setPhantomPos(null);
    setPhantomDragState(null);
    handleRestart();
  }

  useEffect(() => {
    if (!isRoundComplete || !isContinuousAutopilot || !nextRoundName) {
      return;
    }

    if (autopilotAdvanceTimerRef.current !== null) {
      window.clearTimeout(autopilotAdvanceTimerRef.current);
    }

    autopilotAdvanceTimerRef.current = window.setTimeout(() => {
      autopilotAdvanceTimerRef.current = null;
      const nextButtonCenter = getScreenCenter(roundCompleteButtonRef.current);
      if (nextButtonCenter) {
        setPhantomPos({
          ...nextButtonCenter,
          isClicking: false,
          durationMs: 220,
        });
      }
      window.setTimeout(() => {
        if (nextButtonCenter) {
          setPhantomPos({
            ...nextButtonCenter,
            isClicking: true,
            durationMs: 120,
          });
        }
        window.setTimeout(() => {
          setPhantomPos(null);
          handleRoundCompleteContinue();
        }, 1000);
      }, 320);
    }, 1100);

    return () => {
      if (autopilotAdvanceTimerRef.current !== null) {
        window.clearTimeout(autopilotAdvanceTimerRef.current);
        autopilotAdvanceTimerRef.current = null;
      }
    };
  }, [
    handleRoundCompleteContinue,
    isContinuousAutopilot,
    isRoundComplete,
    nextRoundName,
  ]);

  const questionPanel = ({
    calculatorMinimized,
    toggleCalculatorMinimized,
  }: {
    calculatorMinimized: boolean;
    toggleCalculatorMinimized: () => void;
  }) => {
    const messageTheme = chromeTheme.messagePanel;
    const showBoxCornerCta = showNextQuestionButton && !isDesktopLayout;
    const isDesktopExpanded = !isMobile && !calculatorMinimized;
    const questionPanelHeight = calculatorMinimized
      ? isMobileLandscape
        ? "calc(4.5rem + 2px)"
        : "calc(4.5rem - 4px)"
      : isMobileLandscape
        ? "calc(100% + 4px)"
        : isDesktopExpanded
          ? "calc(100% - 0.4rem)"
          : undefined;
    const questionPanelMinHeight = calculatorMinimized
      ? isMobileLandscape
        ? "calc(4.5rem + 2px)"
        : "calc(4.5rem - 4px)"
      : isMobileLandscape
        ? "calc(100% + 4px)"
        : isDesktopExpanded
          ? "calc(100% - 0.4rem)"
          : "10.5rem";

    return (
      <div
        className="flex h-full items-end gap-0"
        style={{
          height: questionPanelHeight,
          minHeight: questionPanelMinHeight,
          marginTop: isDesktopExpanded ? "0.4rem" : undefined,
          transform:
            isMobileLandscape && calculatorMinimized
              ? "translateY(2px)"
              : undefined,
          transition: `height ${DOCK_TRANSITION}, min-height ${DOCK_TRANSITION}`,
        }}
      >
        <div
          className="relative font-arcade flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-[3px]"
          style={{
            background: messageTheme.headerBackground,
            borderColor: messageTheme.outerBorder,
            boxShadow: messageTheme.outerShadow,
          }}
        >
          <div
            className={`relative block cursor-pointer px-5 font-semibold ${
              isMobileLandscape
                ? "text-[1rem] leading-snug"
                : "text-[1.15rem] leading-relaxed"
            }`}
            onClick={toggleCalculatorMinimized}
            style={{
              minHeight: calculatorMinimized ? "100%" : "4.25rem",
              paddingTop: calculatorMinimized ? "0.25rem" : "0.5rem",
              paddingBottom:
                calculatorMinimized && showBoxCornerCta
                  ? "2.1rem"
                  : calculatorMinimized
                    ? "0.25rem"
                    : "0.5rem",
              paddingRight:
                calculatorMinimized && showBoxCornerCta ? "5.5rem" : undefined,
              transition: `min-height ${DOCK_TRANSITION}, padding ${DOCK_TRANSITION}`,
              letterSpacing: "0.015em",
              background: "transparent",
              color: messageTheme.text,
              whiteSpace: "normal",
              overflowWrap: "normal",
              wordBreak: "normal",
              textAlign: "left",
            }}
          >
            {renderHighlightedQuestion(visibleQuestionText, {
              normal: messageTheme.text,
              highlight: QUESTION_KEYWORD_COLOR,
              symbol: QUESTION_SYMBOL_COLOR,
            })}
          </div>
          <div
            className="flex-1"
            style={{
              background: "transparent",
              maxHeight:
                calculatorMinimized || isDesktopLayout ? "0px" : "14rem",
              opacity: calculatorMinimized || isDesktopLayout ? 0 : 1,
              overflow: "hidden",
              transition: `max-height ${DOCK_TRANSITION}, opacity ${DOCK_TRANSITION}`,
            }}
          >
            <div className="border-t" style={{ borderColor: "transparent" }} />
            <div
              className="min-h-[5.6rem] h-full px-5 py-4 text-[1.05rem] font-semibold leading-relaxed"
              style={{
                background: "transparent",
                color: messageTheme.text,
                paddingBottom: showBoxCornerCta ? "3.5rem" : undefined,
                paddingRight: showBoxCornerCta ? "6.25rem" : undefined,
              }}
            >
              {visibleStepLines.length > 0
                ? visibleStepLines.map((line, index) => {
                    return (
                      <div key={`${index}-${line}`}>
                        {renderHighlightedQuestion(line, {
                          normal: messageTheme.text,
                          highlight: messageTheme.highlight,
                          symbol: QUESTION_SYMBOL_COLOR,
                        })}
                      </div>
                    );
                  })
                : null}
            </div>
          </div>
          {showBoxCornerCta ? (
            <button
              ref={nextQuestionButtonRef}
              type="button"
              onClick={
                revealCtaMode === "retry" ? handleNowYourTurn : goToNextQuestion
              }
              className={`arcade-button absolute right-2 z-[2] inline-flex items-center rounded-full font-arcade font-bold leading-none text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 ${
                calculatorMinimized
                  ? "top-1/2 -translate-y-1/2 active:scale-[0.98]"
                  : "bottom-2 active:scale-[0.98]"
              } ${
                isMobile
                  ? isMobileLandscape
                    ? "h-[44px] px-4 text-[0.82rem]"
                    : "h-[38px] px-4 text-[0.82rem]"
                  : "h-[38px] px-4 text-[0.82rem]"
              }`}
            >
              {revealCtaMode === "retry" ? t("game.tryOnYourOwn") : t("game.next")}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const desktopRailTop = isDesktopLayout ? (
    <div className="flex flex-col gap-3" style={{ marginTop: "2rem" }}>
      <div className="flex items-center justify-center gap-2">
        {ROUND_SEQUENCE.map((candidateRound, index) => {
          const levelNumber = index + 1;
          const locked = levelNumber > currentRoundLevel;
          return (
            <MobileLevelButton
              key={`desktop-${candidateRound}`}
              label={String(levelNumber)}
              active={candidateRound === roundName}
              locked={locked}
              onClick={() => handleRoundChange(candidateRound)}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-x-2 gap-y-3 justify-items-center">
        {Array.from({ length: progressTotal }, (_, index) => {
          const filled = index < autopilotProgress;
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDevProgressDotClick(index)}
              disabled={!import.meta.env.DEV}
              className="inline-flex h-7 w-7 items-center justify-center transition-all duration-300 disabled:cursor-default"
              style={{
                transform: filled ? "scale(1.05)" : "scale(1)",
                cursor: import.meta.env.DEV ? "pointer" : "default",
              }}
            >
              <ProgressApple active={filled} />
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      <GameLayout
        muted={muted}
        onToggleMute={handleToggleMute}
        onRestart={handleToolbarRefresh}
        keypadValue={
          calculatorOverride ? calculatorInput : String(displayTopBoxCount)
        }
        onKeypadChange={handleCalculatorChange}
        onKeypadKeyInput={handleCalculatorKeyInput}
        onCapture={showDevCaptureControls ? handleCapture : undefined}
        onToggleSquareSnip={
          showDevCaptureControls ? toggleSquareSnip : undefined
        }
        squareSnipActive={showDevCaptureControls && snipMode}
        onRecordDemo={showDevCaptureControls ? handleRecordDemo : undefined}
        isRecordingDemo={isRecordingDemo}
        onQuestionDemo={solveCurrentQuestion}
        isQuestionDemo={isQuestionDemo}
        forceKeypadExpanded={isQuestionDemo}
        autoExpandCalculator={autoExpandCalculator}
        onKeypadSubmit={handleSubmitAnswer}
        onKeypadEnterPress={handleKeypadEnterPress}
        canSubmit={canSubmit}
        minimizeOnSubmit={shouldMinimizeOnSubmit}
        calculatorTopBanner={calculatorTopBanner}
        chromeTheme={chromeTheme}
        mobileMinimizeResetKey={`${roundName}-${questionIndex}`}
        mobileWrongAnswerRevealKey={mobileWrongAnswerRevealKey}
        levelCount={4}
        currentLevel={1}
        unlockedLevel={1}
        questionPanel={questionPanel}
        desktopRailTop={desktopRailTop}
        sceneBackdrop={renderSceneAtmosphere(question.pair.item)}
        children={({ calculatorMinimized }) => {
          const hideSceneForExpandedMobileKeypad =
            isMobileLandscape && !calculatorMinimized;

          return (
            <div
              ref={rootRef}
              data-pack-it-capture-root="true"
              className="h-full w-full overflow-hidden bg-transparent"
              onPointerDownCapture={ensureAudioReady}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: "none" }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex justify-center pt-[4px]">
                <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <div
                    className="flex items-center gap-2"
                    style={{
                      opacity: isDesktopLayout ? 0 : 1,
                      pointerEvents: isDesktopLayout ? "none" : "auto",
                      visibility: isDesktopLayout ? "hidden" : "visible",
                    }}
                  >
                    {ROUND_SEQUENCE.map((candidateRound, index) => {
                      const levelNumber = index + 1;
                      const locked = levelNumber > currentRoundLevel;
                      return (
                        <MobileLevelButton
                          key={candidateRound}
                          label={String(levelNumber)}
                          active={candidateRound === roundName}
                          locked={locked}
                          onClick={() => handleRoundChange(candidateRound)}
                        />
                      );
                    })}
                  </div>
                  <div
                    className="flex items-center justify-center gap-1.5"
                    style={{
                      opacity: isDesktopLayout ? 0 : 1,
                      pointerEvents: isDesktopLayout ? "none" : "auto",
                      visibility: isDesktopLayout ? "hidden" : "visible",
                    }}
                  >
                    {Array.from({ length: progressTotal }, (_, index) => {
                      const filled = index < autopilotProgress;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDevProgressDotClick(index)}
                          disabled={!import.meta.env.DEV}
                          className="inline-flex h-7 w-7 items-center justify-center transition-all duration-300 disabled:cursor-default"
                          style={{
                            transform: filled ? "scale(1.05)" : "scale(1)",
                            cursor: import.meta.env.DEV ? "pointer" : "default",
                          }}
                        >
                          <ProgressApple active={filled} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div
                className="flex h-full flex-col px-0 pb-0"
                style={{
                  paddingTop: isDesktopLayout ? 0 : "3.6rem",
                  opacity: hideSceneForExpandedMobileKeypad ? 0 : 1,
                  pointerEvents: hideSceneForExpandedMobileKeypad
                    ? "none"
                    : "auto",
                  visibility: hideSceneForExpandedMobileKeypad
                    ? "hidden"
                    : "visible",
                }}
              >
                <div className="relative flex-1 overflow-hidden bg-transparent">
                  <div
                    ref={captureSceneRef}
                    className="absolute inset-0 bg-transparent"
                    data-pack-it-capture-root="true"
                  >
                    {renderSceneAtmosphere(question.pair.item)}
                    {(() => {
                      const previewFrame = getGroupingPreviewFrame();
                      return previewFrame ? (
                        <>
                          <div
                            aria-hidden="true"
                            className="pointer-events-none fixed z-[60] rounded-full"
                            style={{
                              left: previewFrame.left,
                              top: previewFrame.top,
                              width: previewFrame.width,
                              height: previewFrame.height,
                              boxShadow:
                                "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                              background: "none",
                              backgroundColor: "transparent",
                              backgroundImage: "none",
                              transition:
                                "width 180ms cubic-bezier(0.22,0.72,0.2,1), left 180ms cubic-bezier(0.22,0.72,0.2,1), top 180ms cubic-bezier(0.22,0.72,0.2,1)",
                            }}
                          />
                          {groupingAnchorItemId !== null
                            ? getAnchoredGroupItemIds(
                                groupingAnchorItemId,
                                selectedItemIds,
                              ).map((itemId) => {
                                const previewItem =
                                  getGroupingPreviewItemState(itemId);
                                return previewItem ? (
                                  <div
                                    key={`grouping-preview-${itemId}`}
                                    aria-hidden="true"
                                    className="pointer-events-none fixed z-[61] flex items-center justify-center leading-none"
                                    style={{
                                      left: previewItem.left,
                                      top: previewItem.top,
                                      transform: previewItem.transform,
                                      transition:
                                        "transform 180ms cubic-bezier(0.22,0.72,0.2,1)",
                                      ...itemBoxStyle,
                                    }}
                                  >
                                    <span style={{ transform: itemTranslateY }}>
                                      {question.pair.itemEmoji}
                                    </span>
                                  </div>
                                ) : null;
                              })
                            : null}
                        </>
                      ) : null;
                    })()}
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
                          onClick={() => {
                            animateItemsBackToSource();
                          }}
                        >
                          {t("game.tryOnYourOwn")}
                        </button>
                      </div>
                    ) : null}
                    <div
                      className="relative z-[3] grid h-full gap-0 px-0 pb-0"
                      style={{
                        paddingTop: isDesktopLayout ? 0 : "1.75rem",
                        gridTemplateColumns: `${sourcePanelWidthPercent}% ${containerPanelWidthPercent}%`,
                      }}
                    >
                      <div
                        ref={sourceAreaRef}
                        className="relative flex h-full items-center bg-transparent"
                        style={{
                          boxShadow: "none",
                          marginLeft: isDesktopLayout ? "1rem" : undefined,
                          paddingLeft: `${sourcePaddingX}px`,
                          paddingRight: `${sourcePaddingX}px`,
                          paddingTop: `${sourcePaddingTop}px`,
                        }}
                      >
                        {showInsufficientItemNotice &&
                        remainingItems.length === 0 ? (
                          <div
                            className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center"
                            style={{
                              left: 0,
                              right: 0,
                              top: 0,
                              bottom: 0,
                            }}
                          >
                            <div
                              className="rounded-2xl px-5 py-3 text-center font-arcade text-[1.2rem] font-bold leading-tight text-white"
                              style={{
                                maxWidth: "calc(100% - 2rem)",
                                background:
                                  "linear-gradient(180deg, rgba(220,38,38,0.96), rgba(153,27,27,0.98))",
                                border: "2px solid rgba(254,202,202,0.68)",
                                boxShadow:
                                  "0 0 18px rgba(239,68,68,0.52), 0 0 32px rgba(127,29,29,0.34), inset 0 1px 0 rgba(255,255,255,0.18)",
                                textShadow:
                                  "0 1px 0 rgba(127,29,29,0.65), 0 0 8px rgba(255,255,255,0.18)",
                              }}
                            >
                              {localizedInsufficientItemsText}
                            </div>
                          </div>
                        ) : null}
                        <div
                          className="flex min-h-[7rem] flex-wrap content-start justify-start"
                          style={{ gap: `${sourceGapPx}px` }}
                        >
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
                                  className="relative flex items-center justify-center rounded-full border-0 bg-transparent outline-none transition-transform active:scale-95 focus:outline-none"
                                  style={{
                                    ...itemBoxStyle,
                                    appearance: "none",
                                    WebkitAppearance: "none",
                                    boxShadow: "none",
                                    touchAction: "none",
                                    zIndex:
                                      selectedItemIdSet.has(item.id) &&
                                      isGroupingPreviewActive
                                        ? 61
                                        : undefined,
                                    opacity:
                                      (dragState?.isLifted &&
                                        draggedItemIds.has(item.id)) ||
                                      (phantomDragState &&
                                        selectedItemIdSet.has(item.id)) ||
                                      (isGroupingPreviewActive &&
                                        selectedItemIdSet.has(item.id)) ||
                                      returningItemIds.has(item.id)
                                        ? 0
                                        : 1,
                                    pointerEvents:
                                      revealCtaMode === "retry" ||
                                      isQuestionDemo ||
                                      isTapFillRound
                                        ? "none"
                                        : "auto",
                                  }}
                                >
                                  <span
                                    className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                                    style={{
                                      transform: selectedItemIdSet.has(item.id)
                                        ? itemTranslateY
                                        : undefined,
                                    }}
                                  >
                                    {question.pair.itemEmoji}
                                  </span>
                                </button>
                              ) : (
                                <div
                                  key={item.id}
                                  aria-hidden="true"
                                  className="shrink-0"
                                  style={{
                                    width: `${itemSizePx}px`,
                                    height: `${itemSizePx}px`,
                                  }}
                                />
                              ),
                            )}
                        </div>
                        {isDesktopLayout && showUnitReveal ? (
                          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                            <div className="flex w-full flex-col items-stretch">
                              <div
                                className="ml-[7%] mr-[7%] flex max-w-[86%] flex-col items-start text-left"
                                style={{ gap: "0.35rem" }}
                              >
                                {localizedBlackboardSteps.map((line, index) => (
                                  <div
                                    key={`desktop-answer-${index}`}
                                    className="w-full"
                                  >
                                    <div
                                      className="font-arcade w-full font-semibold leading-relaxed"
                                      style={{
                                        fontSize: "1.15rem",
                                        color: chromeTheme.messagePanel.text,
                                        opacity:
                                          index < desktopRevealLineCount
                                            ? 1
                                            : 0,
                                        transition:
                                          "opacity 220ms cubic-bezier(0.22,0.72,0.2,1)",
                                        textShadow:
                                          "0 2px 12px rgba(2,6,23,0.34)",
                                      }}
                                    >
                                      {renderHighlightedQuestion(
                                        stripTrailingPeriod(line),
                                        {
                                          normal: chromeTheme.messagePanel.text,
                                          highlight:
                                            chromeTheme.messagePanel.highlight,
                                          symbol: QUESTION_SYMBOL_COLOR,
                                        },
                                      )}
                                    </div>
                                    {index === 1 ? (
                                      <div
                                        aria-hidden="true"
                                        className="w-full"
                                        style={{
                                          marginTop: "0.45rem",
                                          paddingTop: "0.45rem",
                                          borderTop:
                                            "2px solid rgba(148,163,184,0.35)",
                                          opacity:
                                            index < desktopRevealLineCount
                                              ? 1
                                              : 0,
                                          transition:
                                            "opacity 220ms cubic-bezier(0.22,0.72,0.2,1)",
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              {showNextQuestionButton ? (
                                <div
                                  className="pointer-events-auto flex w-full justify-end"
                                  style={{ marginTop: "2rem" }}
                                >
                                  <button
                                    ref={nextQuestionButtonRef}
                                    type="button"
                                    onClick={
                                      revealCtaMode === "retry"
                                        ? handleNowYourTurn
                                        : goToNextQuestion
                                    }
                                    className="arcade-button inline-flex h-[42px] items-center rounded-full px-5 font-arcade text-[0.86rem] font-bold leading-none text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 active:scale-[0.98]"
                                  >
                                    {revealCtaMode === "retry"
                                      ? t("game.tryOnYourOwn")
                                      : t("game.next")}
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="flex w-full justify-end"
                                  style={{
                                    marginTop: "2rem",
                                    opacity: 0,
                                    pointerEvents: "none",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="arcade-button inline-flex h-[42px] items-center rounded-full px-5 font-arcade text-[0.86rem] font-bold leading-none text-white"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                  >
                                    Next
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="flex justify-center"
                        style={{
                          height: isDesktopLayout ? "100%" : undefined,
                          gap: `${containerStripGapPx}px`,
                          paddingLeft: `${containerColumnPaddingX}px`,
                          paddingRight: `${containerColumnPaddingX}px`,
                          paddingTop: `${containerColumnPaddingTop}px`,
                          paddingBottom: `${containerStripBottomOffsetPx}px`,
                          alignItems: isDesktopLayout ? "center" : "flex-end",
                        }}
                      >
                        <div
                          className="flex justify-center"
                          style={{
                            gap: `${containerStripGapPx}px`,
                            background: "transparent",
                            alignItems: isDesktopLayout ? "center" : "flex-end",
                          }}
                        >
                          {containers.map((containerItems, index) =>
                            (() => {
                              return (
                                <div
                                  key={`${questionIndex}-${index}`}
                                  ref={(node) => {
                                    containerRefs.current[index] = node;
                                  }}
                                  onPointerDown={(event) =>
                                    isTapFillRound
                                      ? handleContainerPointerDown(index, event)
                                      : undefined
                                  }
                                  className="relative overflow-visible"
                                  style={{
                                    borderLeft: `3px solid ${containerBorderColor}`,
                                    borderRight: `3px solid ${containerBorderColor}`,
                                    borderBottom: `3px solid ${containerBorderColor}`,
                                    borderTop: "0",
                                    borderTopLeftRadius: "0",
                                    borderTopRightRadius: "0",
                                    borderBottomLeftRadius: "2.4rem",
                                    borderBottomRightRadius: "2.4rem",
                                    background: "transparent",
                                    boxShadow: containerBorderGlow,
                                    opacity: 1,
                                    width: `${containerWidthPx}px`,
                                    minHeight: `${containerMinHeightPx}px`,
                                    paddingLeft: `${containerPaddingX}px`,
                                    paddingRight: `${containerPaddingX}px`,
                                    paddingTop: `${containerPaddingY}px`,
                                    paddingBottom: `${containerPaddingY}px`,
                                    backdropFilter: "none",
                                  }}
                                >
                                  <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-[12px] -top-[10px]"
                                    style={{
                                      width: "12px",
                                      height: "14px",
                                      borderRight: `3px solid ${containerBorderColor}`,
                                      borderTop: isMobile
                                        ? "0"
                                        : `3px solid ${containerBorderColor}`,
                                      borderTopRightRadius: isMobile
                                        ? "0"
                                        : "14px",
                                      boxShadow: `-4px -2px 8px -8px ${question.pair.palette}aa`,
                                      opacity: 0.95,
                                    }}
                                  />
                                  <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -right-[12px] -top-[10px]"
                                    style={{
                                      width: "12px",
                                      height: "14px",
                                      borderLeft: `3px solid ${containerBorderColor}`,
                                      borderTop: isMobile
                                        ? "0"
                                        : `3px solid ${containerBorderColor}`,
                                      borderTopLeftRadius: isMobile
                                        ? "0"
                                        : "14px",
                                      boxShadow: `4px -2px 8px -8px ${question.pair.palette}aa`,
                                      opacity: 0.95,
                                    }}
                                  />
                                  <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-3 left-[10%] w-[18%] rounded-full"
                                    style={{
                                      background:
                                        "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.03))",
                                      opacity: 0.8,
                                    }}
                                  />
                                  <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-3 bottom-3 rounded-b-[2rem]"
                                    style={{
                                      height: "18%",
                                      background: `linear-gradient(180deg, ${question.pair.palette}18, ${question.pair.palette}30)`,
                                      opacity: 0.7,
                                    }}
                                  />
                                  <div
                                    className="absolute inset-x-0 flex items-end justify-center"
                                    style={{
                                      width: "100%",
                                      minHeight: `${containerInnerMinHeightPx}px`,
                                      bottom: `${containerPaddingY + containerStackLiftPx}px`,
                                    }}
                                  >
                                    {containerItems.map((item, stackIndex) => (
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
                                        className="absolute left-0 flex items-center justify-center bg-transparent leading-none"
                                        style={{
                                          ...itemBoxStyle,
                                          left: `calc(50% - ${itemSizePx / 2}px)`,
                                          bottom: `${stackIndex * containerStackStepPx}px`,
                                          touchAction: "none",
                                          zIndex: stackIndex + 1,
                                          opacity:
                                            (dragState?.isLifted &&
                                              draggedItemIds.has(item.id)) ||
                                            returningItemIds.has(item.id)
                                              ? 0
                                              : 1,
                                          pointerEvents:
                                            revealCtaMode === "retry" ||
                                            isQuestionDemo ||
                                            isTapFillRound
                                              ? "none"
                                              : "auto",
                                        }}
                                      >
                                        <span
                                          className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                                          style={{ transform: itemTranslateY }}
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
                    </div>

                    {!isMobileLandscape ? (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-[20]"
                        style={lowerCountsStyle}
                      >
                        <div className="flex">
                          <div
                            className="flex justify-center"
                            style={{ width: `${sourcePanelWidthPercent}%` }}
                          >
                            <DigitalCount value={remainingItems.length} />
                          </div>
                          <div
                            className="flex justify-center"
                            style={{ width: `${containerPanelWidthPercent}%` }}
                          >
                            <DigitalCount value={packedItemsTotal} />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {dragState?.isLifted
                      ? (() => {
                          const previewPositions =
                            dragState.isSnappedToContainers
                              ? getSnappedDragPreviewPositions(
                                  dragState.itemIds,
                                )
                              : getAnchoredGroupItemIds(
                                  dragState.anchorItemId,
                                  dragState.itemIds,
                                ).map((itemId, index) => ({
                                  itemId,
                                  x:
                                    dragState.x +
                                    index *
                                      (itemSizePx +
                                        (dragState.origin === "container"
                                          ? containerGapPx
                                          : sourceGapPx)),
                                }));
                          const minX = Math.min(
                            ...previewPositions.map((position) => position.x),
                          );
                          const maxX = Math.max(
                            ...previewPositions.map((position) => position.x),
                          );
                          const gapPx =
                            dragState.origin === "container"
                              ? containerGapPx
                              : sourceGapPx;

                          return (
                            <div
                              aria-hidden="true"
                              className="pointer-events-none fixed z-[70] rounded-full"
                              style={{
                                left: minX - gapPx * 0.5,
                                top: dragState.y,
                                width: maxX - minX + itemSizePx + gapPx,
                                height: itemSizePx,
                                background: "none",
                                backgroundColor: "transparent",
                                backgroundImage: "none",
                                transition: dragState.isSnappedToContainers
                                  ? "left 180ms cubic-bezier(0.22,0.72,0.2,1), top 180ms cubic-bezier(0.22,0.72,0.2,1), width 180ms cubic-bezier(0.22,0.72,0.2,1)"
                                  : undefined,
                              }}
                            >
                              <span
                                className="pointer-events-none absolute inset-0 rounded-full"
                                style={{
                                  boxShadow:
                                    "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                                  background: "none",
                                  backgroundColor: "transparent",
                                  backgroundImage: "none",
                                }}
                              />
                              {previewPositions.map(({ itemId, x }) => (
                                <span
                                  key={`drag-${itemId}`}
                                  className="absolute flex items-center justify-center rounded-full bg-transparent"
                                  style={{
                                    ...itemBoxStyle,
                                    left: x - minX + gapPx * 0.5,
                                    top: 0,
                                    transition: dragState.isSnappedToContainers
                                      ? "left 180ms cubic-bezier(0.22,0.72,0.2,1)"
                                      : undefined,
                                  }}
                                >
                                  <span
                                    className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                                    style={{ transform: itemTranslateY }}
                                  >
                                    {question.pair.itemEmoji}
                                  </span>
                                </span>
                              ))}
                            </div>
                          );
                        })()
                      : null}

                    {phantomDragState ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none fixed z-[190] flex items-center rounded-full"
                        style={{
                          left: phantomDragState.x,
                          top: phantomDragState.y,
                          gap: `${sourceGapPx}px`,
                          background: "none",
                          backgroundColor: "transparent",
                          backgroundImage: "none",
                          transition:
                            "left 920ms ease-in-out, top 920ms ease-in-out",
                        }}
                      >
                        <span
                          className="pointer-events-none absolute inset-y-0 -inset-x-2 rounded-full"
                          style={{
                            boxShadow:
                              "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                            background: "none",
                            backgroundColor: "transparent",
                            backgroundImage: "none",
                          }}
                        />
                        {getAnchoredGroupItemIds(
                          phantomDragState.anchorItemId,
                          phantomDragState.itemIds,
                        ).map((itemId) => (
                          <span
                            key={`phantom-drag-${itemId}`}
                            className="relative flex items-center justify-center rounded-full bg-transparent"
                            style={itemBoxStyle}
                          >
                            <span
                              className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                              style={{ transform: itemTranslateY }}
                            >
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
                        className="pointer-events-none fixed z-[69] flex items-center justify-center rounded-full bg-transparent"
                        style={{
                          left: returnState.x,
                          top: returnState.y,
                          transition: `left ${returnState.durationMs ?? 220}ms cubic-bezier(0.22,0.72,0.2,1), top ${returnState.durationMs ?? 220}ms cubic-bezier(0.22,0.72,0.2,1)`,
                          ...itemBoxStyle,
                        }}
                      >
                        <span
                          className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                          style={{ transform: itemTranslateY }}
                        >
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
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-full w-full"
                          >
                            <path
                              d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12.5"
                              r="3.25"
                              stroke="white"
                              strokeWidth="2"
                            />
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
                          style={{
                            boxShadow: "0 0 18px rgba(56,189,248,0.45)",
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <PhantomHand pos={phantomPos} />
            </div>
          );
        }}
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
      {isRoundComplete && (
        <div
          className="absolute inset-0 z-[130] flex items-center justify-center p-6"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(15,23,42,0.985) 0%, rgba(2,6,23,0.995) 78%)",
          }}
        >
          <div
            className="arcade-panel w-full max-w-3xl p-6 text-center md:p-10"
            style={{
              background: "rgba(15, 23, 42, 0.84)",
            }}
          >
            <div className="text-4xl font-black uppercase tracking-[0.18em] text-yellow-300 md:text-5xl">
              {roundLabels[roundName]} {t("game.complete")}
            </div>
            <div className="mt-3 text-base font-bold text-cyan-200 md:text-lg">
              Score: {roundCompletionScore}/{roundCompletionTotal}
            </div>
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {Array.from({ length: roundCompletionTotal }, (_, index) => {
                const filled = index < roundCompletionScore;
                return (
                  <div
                    key={index}
                    className="h-4 w-4 rounded-full border-2"
                    style={{
                      background: filled ? "#67e8f9" : "transparent",
                      borderColor: filled
                        ? "#67e8f9"
                        : "rgba(255,255,255,0.26)",
                      boxShadow: filled
                        ? "0 0 10px rgba(103,232,249,0.8)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-8">
              <button
                ref={roundCompleteButtonRef}
                type="button"
                onClick={handleRoundCompleteContinue}
                className="arcade-button inline-flex h-12 items-center rounded-full px-6 font-arcade text-base font-bold uppercase tracking-[0.08em] text-white"
              >
                {nextRoundName
                  ? `${t("game.nextRound")}: ${roundLabels[nextRoundName]}`
                  : "Play Again"}
              </button>
            </div>
          </div>
        </div>
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
