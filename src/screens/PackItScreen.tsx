import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import PhantomHand from "../components/PhantomHand";
import GameLayout from "../components/GameLayout";
import { makeRound } from "../game/packItGame";
import type { PackQuestion } from "../calculations/types.ts";
import { getDemoConfig } from "../demoMode";
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
  anchorItemId: number;
  origin: "source" | "container";
  comboId: number | null;
  isLifted: boolean;
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

function renderHighlightedQuestion(
  text: string,
  colors?: {
    normal?: string;
    highlight?: string;
    symbol?: string;
  },
): ReactNode {
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
            ? { color: colors?.symbol ?? "#86efac" }
            : isHighlightedToken(part)
              ? { color: colors?.highlight ?? "#facc15" }
              : colors?.normal
                ? { color: colors.normal }
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
          background: "rgba(54,28,22,0.92)",
          borderColor: "rgba(248,113,113,0.9)",
          color: "#fca5a5",
          boxShadow:
            "0 0 18px rgba(248,113,113,0.16), inset 0 0 16px rgba(127,29,29,0.24)",
        },
        keypadTheme: {
          panelBackground: "rgba(18,10,12,0.97)",
          panelBorder: "rgba(248,113,113,0.44)",
          panelGlow:
            "0 0 18px rgba(248,113,113,0.14), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(54,28,22,0.92)",
          digitBorder: "rgba(248,113,113,0.42)",
          operatorBackground: "rgba(75,35,28,0.92)",
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
          background: "rgba(10,33,38,0.92)",
          borderColor: "rgba(45,212,191,0.82)",
          color: "#99f6e4",
          boxShadow:
            "0 0 18px rgba(45,212,191,0.14), inset 0 0 16px rgba(15,118,110,0.2)",
        },
        keypadTheme: {
          panelBackground: "rgba(5,18,24,0.97)",
          panelBorder: "rgba(45,212,191,0.4)",
          panelGlow:
            "0 0 18px rgba(45,212,191,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(10,33,38,0.92)",
          digitBorder: "rgba(45,212,191,0.36)",
          operatorBackground: "rgba(12,46,50,0.92)",
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
          background: "rgba(53,31,18,0.92)",
          borderColor: "rgba(251,146,60,0.82)",
          color: "#fdba74",
          boxShadow:
            "0 0 18px rgba(251,146,60,0.14), inset 0 0 16px rgba(120,53,15,0.22)",
        },
        keypadTheme: {
          panelBackground: "rgba(24,14,10,0.97)",
          panelBorder: "rgba(251,146,60,0.4)",
          panelGlow:
            "0 0 18px rgba(251,146,60,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(53,31,18,0.92)",
          digitBorder: "rgba(251,146,60,0.38)",
          operatorBackground: "rgba(72,41,20,0.92)",
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
          background: "rgba(54,24,44,0.92)",
          borderColor: "rgba(244,114,182,0.8)",
          color: "#f9a8d4",
          boxShadow:
            "0 0 18px rgba(244,114,182,0.12), inset 0 0 16px rgba(157,23,77,0.2)",
        },
        keypadTheme: {
          panelBackground: "rgba(24,10,24,0.97)",
          panelBorder: "rgba(244,114,182,0.38)",
          panelGlow:
            "0 0 18px rgba(244,114,182,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(54,24,44,0.92)",
          digitBorder: "rgba(244,114,182,0.36)",
          operatorBackground: "rgba(74,29,57,0.92)",
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
          background: "rgba(24,33,46,0.92)",
          borderColor: "rgba(45,212,191,0.8)",
          color: "#99f6e4",
          boxShadow:
            "0 0 18px rgba(45,212,191,0.14), inset 0 0 16px rgba(13,148,136,0.18)",
        },
        keypadTheme: {
          panelBackground: "rgba(13,17,28,0.97)",
          panelBorder: "rgba(45,212,191,0.38)",
          panelGlow:
            "0 0 18px rgba(45,212,191,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(24,33,46,0.92)",
          digitBorder: "rgba(45,212,191,0.34)",
          operatorBackground: "rgba(30,46,58,0.92)",
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
          background: "rgba(30,41,59,0.92)",
          borderColor: `${palette}cc`,
          color: "#e2e8f0",
        },
        keypadTheme: {
          panelBackground: "rgba(2,6,23,0.97)",
          panelBorder: `${palette}66`,
          panelGlow:
            "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
          digitBackground: "rgba(30,41,59,0.92)",
          digitBorder: `${palette}55`,
          operatorBackground: "rgba(51,65,85,0.92)",
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
  const [forceAnswerBanner, setForceAnswerBanner] = useState(false);
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
  const [phantomDragState, setPhantomDragState] =
    useState<PhantomDragState | null>(null);
  const [groupingAnchorItemId, setGroupingAnchorItemId] = useState<
    number | null
  >(null);
  const [isGroupingPreviewAnimating, setIsGroupingPreviewAnimating] =
    useState(false);
  const [hoveredSourceArea, setHoveredSourceArea] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const nextComboIdRef = useRef(1);
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sourceAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const nextQuestionButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const showAnswerBanner =
    !isQuestionDemo &&
    !isContinuousAutopilot &&
    (import.meta.env.DEV || demoConfig.showAnswers || forceAnswerBanner);
  const chromeTheme = useMemo(
    () => getChromeTheme(question.pair.item, question.pair.palette),
    [question.pair.item, question.pair.palette],
  );
  const calculatorTopBanner = showAnswerBanner ? (
    <span className="font-black tracking-[0.06em]">
      <span className="text-white">Answer:</span>{" "}
      <span className="text-[#fde047]">{question.answer}</span>
    </span>
  ) : null;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
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
    setForceAnswerBanner(true);
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

  function getTopBoxLeadDropPosition(): { x: number; y: number } | null {
    const DROP_TARGET_OFFSET_X = 30;
    const topItems = getCurrentItemsInContainer(0);
    const lastTopItem = topItems[topItems.length - 1];
    const lastTopItemRect = lastTopItem
      ? itemRefs.current[lastTopItem.id]?.getBoundingClientRect()
      : null;

    if (lastTopItemRect) {
      return {
        x: lastTopItemRect.left + lastTopItemRect.width + 8 - 32 + DROP_TARGET_OFFSET_X,
        y: lastTopItemRect.top + lastTopItemRect.height / 2 - 32,
      };
    }

    const topContainerRect = containerRefs.current[0]?.getBoundingClientRect();
    if (!topContainerRect) {
      return null;
    }

    return {
      x: topContainerRect.left + 18 + DROP_TARGET_OFFSET_X,
      y: topContainerRect.top + topContainerRect.height / 2 - 32,
    };
  }

  function getGroupingPreviewFrame() {
    if (!isGroupingPreviewActive || groupingAnchorItemId === null) {
      return null;
    }

    const anchorRect = itemRefs.current[groupingAnchorItemId]?.getBoundingClientRect();
    if (!anchorRect) {
      return null;
    }

    return {
      left: anchorRect.left - 8,
      top: anchorRect.top + 4,
      width: selectedItemIds.length * 64 + Math.max(0, selectedItemIds.length - 1) * 8 + 16,
      height: 56,
    };
  }

  function getGroupingPreviewTransform(itemId: number) {
    if (!isGroupingPreviewActive || groupingAnchorItemId === null) {
      return undefined;
    }

    const anchorRect = itemRefs.current[groupingAnchorItemId]?.getBoundingClientRect();
    const itemRect = itemRefs.current[itemId]?.getBoundingClientRect();
    if (!anchorRect || !itemRect) {
      return undefined;
    }

    const orderedIds = getAnchoredGroupItemIds(groupingAnchorItemId, selectedItemIds);
    const targetIndex = orderedIds.indexOf(itemId);
    if (targetIndex < 0) {
      return undefined;
    }

    return `translate(${anchorRect.left + targetIndex * 72 - itemRect.left}px, ${anchorRect.top - itemRect.top}px)`;
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
    const DEMO_SELECTION_CLEAR_MS = 700;

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
              x: leadItemRect ? leadItemRect.left : leadItemCenter.x - 32,
              y: leadItemRect ? leadItemRect.top : leadItemCenter.y - 32,
            });
          }

          const targetLeadPosition = getTopBoxLeadDropPosition();
          window.setTimeout(() => {
            if (targetLeadPosition) {
              setPhantomPos({
                x: targetLeadPosition.x + 32,
                y: targetLeadPosition.y + 32,
                isClicking: false,
                durationMs: DEMO_DRAG_TRAVEL_MS,
              });
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
                  x: targetLeadPosition.x + 32,
                  y: targetLeadPosition.y + 32,
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
                window.setTimeout(() => {
                  setSelectedItemIds([]);
                  setGroupingAnchorItemId(null);
                  setIsGroupingPreviewAnimating(false);
                }, DEMO_SELECTION_CLEAR_MS);
              }, DEMO_DROP_HOLD_MS);
            }, DEMO_DRAG_TRAVEL_MS);
          }, DEMO_DRAG_TRAVEL_MS);
        }, DEMO_PICKUP_PRESS_MS + DEMO_DRAG_START_DELAY_MS);
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
        setPhantomDragState(null);
        setIsQuestionDemo(false);
        if (mode === "solve") {
          setQuestionSolved(true);
          setFlash({ ok: true, icon: true });
          playCorrect();
        }
      },
      comboAssignments.length * DEMO_STEP_MS + 1250,
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
    setGroupingAnchorItemId(itemId);
    setDragState({
      itemIds,
      anchorItemId: itemId,
      origin,
      comboId,
      isLifted: false,
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
                event.clientX - (current.x + current.pointerOffsetX),
                event.clientY - (current.y + current.pointerOffsetY),
              ) > 6,
            x: event.clientX - current.pointerOffsetX,
            y: event.clientY - current.pointerOffsetY,
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
    setPhantomDragState(null);
    setGroupingAnchorItemId(null);
    setIsGroupingPreviewAnimating(false);
    setIsQuestionDemo(false);
    setHoveredSourceArea(false);
    setSelectedItemIds([]);
    setDisplayTopBoxCount(0);
    setCalculatorInput("0");
    setCalculatorOverride(false);
    setForceAnswerBanner(false);
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
      setPhantomDragState(null);
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
      const nextButtonCenter = getScreenCenter(nextQuestionButtonRef.current);
      if (nextButtonCenter) {
        setPhantomPos({
          ...nextButtonCenter,
          isClicking: false,
          durationMs: 260,
        });
      }
      autopilotAdvanceTimerRef.current = window.setTimeout(() => {
        autopilotAdvanceTimerRef.current = null;
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
        }, 180);
      }, 320);
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
  }) => {
    const messageTheme = chromeTheme.messagePanel;

    return (
      <div
        className="flex h-full gap-0"
        style={{
          height: calculatorMinimized ? "4.5rem" : undefined,
          minHeight: calculatorMinimized ? "4.5rem" : "10.5rem",
          transition: `height ${DOCK_TRANSITION}, min-height ${DOCK_TRANSITION}`,
        }}
      >
        <div
          className="font-arcade flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[1.1rem] border-[3px]"
          style={{
            background: messageTheme.outerBackground,
            borderColor: messageTheme.outerBorder,
            boxShadow: messageTheme.outerShadow,
          }}
        >
          <div
            className="flex cursor-pointer items-center px-5 text-[1.15rem] font-semibold leading-relaxed"
            onClick={toggleCalculatorMinimized}
            style={{
              minHeight: calculatorMinimized ? "100%" : "4.25rem",
              paddingTop: calculatorMinimized ? "0.25rem" : "0.5rem",
              paddingBottom: calculatorMinimized ? "0.25rem" : "0.5rem",
              transition: `min-height ${DOCK_TRANSITION}, padding ${DOCK_TRANSITION}`,
              letterSpacing: "0.015em",
              background: messageTheme.headerBackground,
              color: messageTheme.text,
            }}
          >
            {isRoundComplete ? (
              <span style={{ color: messageTheme.complete }}>
                Round complete. Score: {score}/{round.questions.length}
              </span>
            ) : (
              renderHighlightedQuestion(visibleQuestionText, {
                normal: messageTheme.text,
                highlight: messageTheme.highlight,
                symbol: messageTheme.symbol,
              })
            )}
          </div>
          <div
            className="flex-1"
            style={{
              background: messageTheme.bodyBackground,
              maxHeight: calculatorMinimized ? "0px" : "14rem",
              opacity: calculatorMinimized ? 0 : 1,
              overflow: "hidden",
              transition: `max-height ${DOCK_TRANSITION}, opacity ${DOCK_TRANSITION}`,
            }}
          >
            <div
              className="border-t"
              style={{ borderColor: messageTheme.divider }}
            />
            <div
              className="min-h-[5.6rem] h-full px-5 py-4 text-[1.05rem] font-semibold leading-relaxed"
              style={{
                background: messageTheme.bodyBackground,
                color: messageTheme.text,
              }}
            >
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
                        {renderHighlightedQuestion(line, {
                          normal: messageTheme.text,
                          highlight: messageTheme.highlight,
                          symbol: messageTheme.symbol,
                        })}
                        {isLastVisibleLine &&
                        isFinalLine &&
                        showNextQuestionButton ? (
                          <button
                            ref={nextQuestionButtonRef}
                            type="button"
                            onClick={
                              revealCtaMode === "retry"
                                ? handleNowYourTurn
                                : goToNextQuestion
                            }
                            className="ml-4 inline-flex h-[2rem] items-center rounded-full border-[3px] px-4 font-arcade text-[0.82rem] font-bold leading-none text-white align-middle"
                            style={{
                              borderColor: messageTheme.highlight,
                              background: messageTheme.symbol,
                              color: messageTheme.outerBackground,
                              boxShadow: `0 0 10px ${messageTheme.highlight}33, 0 0 0 2px ${messageTheme.outerBorder}`,
                            }}
                          >
                            {revealCtaMode === "retry"
                              ? "Now you try it"
                              : "Next"}
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
  };

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
        calculatorTopBanner={calculatorTopBanner}
        chromeTheme={chromeTheme}
        progress={autopilotProgress}
        progressTotal={progressTotal}
        levelCount={4}
        currentLevel={1}
        unlockedLevel={1}
        questionPanel={questionPanel}
        sceneBackdrop={renderSceneAtmosphere(question.pair.item)}
        children={() => (
          <div
            ref={rootRef}
            data-pack-it-capture-root="true"
            className="h-full w-full overflow-hidden bg-transparent"
            onPointerDownCapture={ensureAudioReady}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="flex h-full flex-col px-0 pb-0 pt-[3.6rem]">
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
                            background: "rgba(28,25,23,0.94)",
                            transition:
                              "width 180ms cubic-bezier(0.22,0.72,0.2,1), left 180ms cubic-bezier(0.22,0.72,0.2,1), top 180ms cubic-bezier(0.22,0.72,0.2,1)",
                          }}
                        />
                        {groupingAnchorItemId !== null
                          ? getAnchoredGroupItemIds(
                              groupingAnchorItemId,
                              selectedItemIds,
                            ).map((itemId) => {
                              const previewItem = getGroupingPreviewItemState(
                                itemId,
                              );
                              return previewItem ? (
                                <div
                                  key={`grouping-preview-${itemId}`}
                                  aria-hidden="true"
                                  className="pointer-events-none fixed z-[61] flex h-16 w-16 items-center justify-center text-[3.1rem] leading-none"
                                  style={{
                                    left: previewItem.left,
                                    top: previewItem.top,
                                    transform: previewItem.transform,
                                    transition:
                                      "transform 180ms cubic-bezier(0.22,0.72,0.2,1)",
                                  }}
                                >
                                  <span style={{ transform: "translateY(4px)" }}>
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

                  <div className="relative z-[3] grid h-full grid-cols-[45.5%_calc(54.5%-2rem)] gap-8 px-0 pb-0 pt-7">
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
                                  zIndex:
                                    selectedItemIdSet.has(item.id) &&
                                    isGroupingPreviewActive
                                      ? 61
                                      : undefined,
                                  opacity:
                                    ((dragState?.isLifted &&
                                      draggedItemIds.has(item.id)) ||
                                      (phantomDragState &&
                                        selectedItemIdSet.has(item.id)) ||
                                      (isGroupingPreviewActive &&
                                        selectedItemIdSet.has(item.id)) ||
                                      returningItemIds.has(item.id))
                                      ? 0
                                      : 1,
                                  pointerEvents:
                                    revealCtaMode === "retry" || isQuestionDemo
                                      ? "none"
                                      : "auto",
                                }}
                              >
                                {selectedItemIdSet.has(item.id) &&
                                !dragState?.isLifted &&
                                !phantomDragState &&
                                !isGroupingPreviewActive ? (
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
                                            ? 0.65
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
                      <span
                        className="pointer-events-none absolute inset-y-1 -inset-x-2 rounded-full"
                        style={{
                          boxShadow:
                            "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                          background: "rgba(28,25,23,0.94)",
                        }}
                      />
                      {getAnchoredGroupItemIds(
                        dragState.anchorItemId,
                        dragState.itemIds,
                      ).map((itemId) => (
                        <span
                          key={`drag-${itemId}`}
                          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                        >
                          <span
                            className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                            style={{ transform: "translateY(4px)" }}
                          >
                            {question.pair.itemEmoji}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {phantomDragState ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none fixed z-[190] flex items-center gap-2 rounded-full bg-transparent"
                      style={{
                        left: phantomDragState.x,
                        top: phantomDragState.y,
                        transition:
                          "left 920ms ease-in-out, top 920ms ease-in-out",
                      }}
                    >
                      <span
                        className="pointer-events-none absolute inset-y-1 -inset-x-2 rounded-full"
                        style={{
                          boxShadow:
                            "0 0 0 4px rgba(250,204,21,0.86), 0 0 0 14px rgba(250,204,21,0.16), 0 0 24px rgba(250,204,21,0.42), 0 0 42px rgba(250,204,21,0.3)",
                          background: "rgba(28,25,23,0.94)",
                        }}
                      />
                      {getAnchoredGroupItemIds(
                        phantomDragState.anchorItemId,
                        phantomDragState.itemIds,
                      ).map((itemId) => (
                        <span
                          key={`phantom-drag-${itemId}`}
                          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-transparent text-[3.1rem]"
                        >
                          <span
                            className="relative z-[1] flex h-full w-full items-center justify-center leading-none text-center"
                            style={{ transform: "translateY(4px)" }}
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
