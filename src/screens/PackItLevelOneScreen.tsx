import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import PhantomHand from "../components/PhantomHand";
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
  playCameraShutter,
  playCorrect,
  playDragStep,
  playKeyClick,
  playLevelComplete,
  playRipple,
  playTypewriterTick,
  playWrong,
  startMusic,
  toggleMute,
} from "../sound";
import type { PhantomPos } from "../hooks/useAutopilot";

const DOCK_TRANSITION = "320ms cubic-bezier(0.22,0.72,0.2,1)";
const ROUND_SEQUENCE: RoundName[] = ["load", "pack", "ship"];
const QUESTIONS_PER_ROUND = 10;
const DESKTOP_RIGHT_RAIL_WIDTH_PX = 17 * 16;

const L1_QUESTION_KEYWORDS = ["one", "a", "an", "each", "every", "per"];

const L1_KEYWORD_PATTERN = L1_QUESTION_KEYWORDS.slice()
  .sort((a, b) => b.length - a.length)
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const L1_KEYWORD_REGEX = new RegExp(`\\b(?:${L1_KEYWORD_PATTERN})\\b`, "giu");
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
  activeColor,
  onClick,
}: {
  label: string;
  active: boolean;
  locked: boolean;
  activeColor: { background: string; border: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className="h-8 w-10 rounded-lg border-2 text-sm font-black transition-colors disabled:cursor-not-allowed"
      style={{
        background: locked
          ? "#0f172a"
          : active
            ? activeColor.background
            : "#1e293b",
        borderColor: locked
          ? "#1e293b"
          : active
            ? activeColor.border
            : "#475569",
        color: locked ? "#64748b" : "#ffffff",
        opacity: locked ? 0.7 : 1,
      }}
    >
      {locked ? "\u{1F512}" : label}
    </button>
  );
}

function buildChromeTheme(item: string, palette: string) {
  switch (item) {
    case "apple":
      return {
        messagePanel: {
          outerBorder: "rgba(248,113,113,0.62)",
          outerShadow:
            "0 0 0 2px rgba(69,10,10,0.4), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(50,23,25,0.96)",
          bodyBackground: "rgba(28,12,15,0.98)",
          text: "#fff7ed",
          highlight: "#fdba74",
        },
        questionBoxStyle: {
          background: "rgba(34,17,18,0.96)",
          borderColor: "rgba(248,113,113,0.62)",
          boxShadow:
            "0 0 26px rgba(127,29,29,0.24), inset 0 0 18px rgba(69,10,10,0.32)",
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
          outerBorder: "rgba(45,212,191,0.52)",
          outerShadow:
            "0 0 0 2px rgba(8,47,73,0.44), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(10,30,40,0.96)",
          bodyBackground: "rgba(6,18,26,0.98)",
          text: "#ecfeff",
          highlight: "#99f6e4",
        },
        questionBoxStyle: {
          background: "rgba(7,22,33,0.96)",
          borderColor: "rgba(45,212,191,0.52)",
          boxShadow:
            "0 0 26px rgba(8,145,178,0.16), inset 0 0 18px rgba(8,47,73,0.34)",
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
    case "egg":
      return {
        messagePanel: {
          outerBorder: "rgba(250,204,21,0.52)",
          outerShadow:
            "0 0 0 2px rgba(120,53,15,0.38), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(50,34,18,0.96)",
          bodyBackground: "rgba(26,18,12,0.98)",
          text: "#fff7ed",
          highlight: "#fde047",
        },
        questionBoxStyle: {
          background: "rgba(34,24,16,0.96)",
          borderColor: "rgba(250,204,21,0.52)",
          boxShadow:
            "0 0 26px rgba(202,138,4,0.18), inset 0 0 18px rgba(120,53,15,0.32)",
        },
        keypadTheme: {
          panelBackground: "rgba(18,12,8,0.97)",
          panelBorder: "rgba(250,204,21,0.38)",
          panelGlow:
            "0 0 18px rgba(250,204,21,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
          digitBackground: "rgba(28,20,12,0.94)",
          digitBorder: "rgba(250,204,21,0.34)",
          operatorBackground: "rgba(36,25,14,0.94)",
          operatorBorder: "rgba(250,204,21,0.44)",
          displayBorder: "rgba(250,204,21,0.22)",
          displayColor: "#67e8f9",
          displayGlow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        },
      };
    case "cookie":
      return {
        messagePanel: {
          outerBorder: "rgba(251,146,60,0.52)",
          outerShadow:
            "0 0 0 2px rgba(67,20,7,0.44), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(46,26,18,0.96)",
          bodyBackground: "rgba(22,13,10,0.98)",
          text: "#fff7ed",
          highlight: "#fdba74",
        },
        questionBoxStyle: {
          background: "rgba(32,18,12,0.96)",
          borderColor: "rgba(251,146,60,0.52)",
          boxShadow:
            "0 0 26px rgba(146,64,14,0.18), inset 0 0 18px rgba(67,20,7,0.34)",
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
          outerBorder: "rgba(244,114,182,0.5)",
          outerShadow:
            "0 0 0 2px rgba(80,7,36,0.42), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(50,20,43,0.96)",
          bodyBackground: "rgba(22,10,24,0.98)",
          text: "#fff1f2",
          highlight: "#f9a8d4",
        },
        questionBoxStyle: {
          background: "rgba(35,15,34,0.96)",
          borderColor: "rgba(244,114,182,0.5)",
          boxShadow:
            "0 0 26px rgba(190,24,93,0.16), inset 0 0 18px rgba(80,7,36,0.34)",
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
          outerBorder: "rgba(167,139,250,0.48)",
          outerShadow:
            "0 0 0 2px rgba(30,41,59,0.46), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(22,30,48,0.96)",
          bodyBackground: "rgba(12,17,30,0.98)",
          text: "#eff6ff",
          highlight: "#a5b4fc",
        },
        questionBoxStyle: {
          background: "rgba(18,23,38,0.96)",
          borderColor: "rgba(167,139,250,0.48)",
          boxShadow:
            "0 0 26px rgba(76,29,149,0.18), inset 0 0 18px rgba(30,41,59,0.34)",
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
          outerBorder: `${palette}88`,
          outerShadow:
            "0 0 0 2px rgba(15,23,42,0.4), 0 10px 24px rgba(2,6,23,0.38)",
          headerBackground: "rgba(30,41,59,0.96)",
          bodyBackground: "rgba(15,23,42,0.98)",
          text: "#ffffff",
          highlight: "#facc15",
        },
        questionBoxStyle: {
          background: "rgba(15,23,42,0.96)",
          borderColor: `${palette}88`,
          boxShadow:
            "0 0 26px rgba(56,189,248,0.12), inset 0 0 18px rgba(15,23,42,0.34)",
        },
        keypadTheme: {
          panelBackground: "rgba(2,6,23,0.97)",
          panelBorder: `${palette}66`,
          panelGlow:
            "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.42)",
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

function renderSceneBackdrop(item: string, _palette: string): ReactNode {
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
              <g fill="rgba(129,140,248,0.08)">
                <polygon points="162,154 204,118 246,154 204,228" />
                <polygon points="758,194 792,162 828,194 792,258" />
              </g>
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

function getSceneBackdropBaseBackground(item: string, _palette: string) {
  switch (item) {
    case "apple":
      return "radial-gradient(circle at 18% 14%, rgba(248,113,113,0.18), transparent 24%), radial-gradient(circle at 82% 16%, rgba(251,146,60,0.14), transparent 22%), linear-gradient(180deg, rgba(120,53,15,0.12) 0%, rgba(2,6,23,0) 28%), linear-gradient(180deg, #101827 0%, #08111d 100%)";
    case "fish":
      return "radial-gradient(circle at 16% 14%, rgba(34,211,238,0.12), transparent 18%), radial-gradient(circle at 84% 16%, rgba(45,212,191,0.1), transparent 18%), linear-gradient(180deg, #092033 0%, #08131f 44%, #040b12 100%)";
    case "egg":
      return "radial-gradient(circle at 18% 16%, rgba(250,204,21,0.16), transparent 18%), radial-gradient(circle at 80% 18%, rgba(245,158,11,0.12), transparent 20%), linear-gradient(180deg, #2a1d11 0%, #120f11 100%)";
    case "cookie":
      return "radial-gradient(circle at 18% 14%, rgba(251,191,36,0.14), transparent 16%), radial-gradient(circle at 78% 16%, rgba(180,83,9,0.14), transparent 16%), linear-gradient(180deg, #24180f 0%, #0c0d12 100%)";
    case "cupcake":
      return "radial-gradient(circle at 18% 14%, rgba(244,114,182,0.18), transparent 16%), radial-gradient(circle at 82% 18%, rgba(251,191,36,0.1), transparent 18%), linear-gradient(180deg, #2a1330 0%, #0b0d14 100%)";
    case "gem":
      return "radial-gradient(circle at 18% 14%, rgba(34,211,238,0.14), transparent 18%), radial-gradient(circle at 82% 16%, rgba(192,132,252,0.12), transparent 18%), linear-gradient(180deg, #171c34 0%, #0a0d14 100%)";
    default:
      return `radial-gradient(circle at 18% 14%, rgba(148,163,184,0.06), transparent 18%), radial-gradient(circle at 82% 18%, rgba(56,189,248,0.05), transparent 20%), linear-gradient(180deg, #101827 0%, #08111d 100%)`;
  }
}

const DESKTOP_TUBE_MIN_CAPACITY = 6;
const DESKTOP_TUBE_MAX_CAPACITY = 10;
const MOBILE_VISIBLE_TUBE_CAPACITY = 5;

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

function getTubeStripCapacityForViewportWidth(
  viewportWidth: number,
  isDesktopLayout: boolean,
  tubeWidth: number,
  tubeGap: number,
) {
  const playfieldWidth = isDesktopLayout
    ? Math.max(0, viewportWidth - DESKTOP_RIGHT_RAIL_WIDTH_PX)
    : viewportWidth;
  const horizontalPadding = isDesktopLayout ? 84 : 52;
  const availableWidth = Math.max(0, playfieldWidth - horizontalPadding);
  const estimatedCapacity = Math.floor(
    (availableWidth + tubeGap) / (tubeWidth + tubeGap),
  );

  return Math.max(1, estimatedCapacity);
}

function getTubeFillCounts(total: number, unitRate: number) {
  const safeTotal = Math.max(0, total);
  const fullTubeCount = Math.floor(safeTotal / unitRate);
  const partialTubeCount = safeTotal % unitRate;
  const fills = Array.from({ length: fullTubeCount }, () => unitRate);
  if (partialTubeCount > 0) fills.push(partialTubeCount);
  return fills.length > 0 ? fills : [0];
}

async function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string) {
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clampSnipSelection(root: HTMLDivElement | null, next: SquareSnip) {
  const rect = root?.getBoundingClientRect();
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
      return rawBackground;
    }
    current = current.parentElement;
  }

  return "#020617";
}

function L1ProgressBar({
  current,
  target,
  onOvershoot,
  forceRed = false,
}: {
  current: number;
  target: number;
  onOvershoot: () => void;
  forceRed?: boolean;
}) {
  const ratio = target === 0 ? 0 : current / target;
  const isDanger = forceRed || ratio > 1;
  const state: "blue" | "green" | "red" =
    isDanger ? "red" : ratio === 1 ? "green" : "blue";
  const color =
    state === "red" ? "#ef4444" : state === "green" ? "#22c55e" : "#3b82f6";
  const prevDangerRef = useRef(isDanger);

  useEffect(() => {
    if (!prevDangerRef.current && isDanger) onOvershoot();
    prevDangerRef.current = isDanger;
  }, [isDanger, onOvershoot]);

  const filledStyle: CSSProperties = {
    width: `${(forceRed ? 1 : Math.min(Math.max(ratio, 0), 1)) * 100}%`,
    background: color,
    height: "100%",
    borderRadius: 12,
    transition: "width 220ms ease-out, background 220ms",
  };

  return (
    <div
      aria-label={`progress ${current} of ${target}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={current}
      style={{
        flex: 1,
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        position: "relative",
        height: 22,
        borderRadius: 12,
        background: "#0f172a",
        border: "2px solid rgba(148,163,184,0.7)",
        overflow: "hidden",
        animation:
          state === "red"
            ? "packit-l1-progress-danger 1.8s ease-in-out infinite"
            : "none",
        boxShadow: state === "red" ? "0 0 12px rgba(239,68,68,0.35)" : "none",
      }}
    >
      <div style={filledStyle} />
      <div
        data-capture-ignore="true"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e2e8f0",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textShadow: "0 1px 2px rgba(0,0,0,0.7)",
        }}
      >
        {current}/{target}
      </div>
    </div>
  );
}

function TestTube({
  filledCount,
  capacity,
  itemEmoji,
  palette,
  showErrorTint,
  disabled,
  tubeHeight,
  itemSize,
  tubeWidth,
  ariaLabel,
}: {
  filledCount: number;
  capacity: number;
  itemEmoji: string;
  palette: string;
  showErrorTint: boolean;
  disabled: boolean;
  tubeHeight: number;
  itemSize: number;
  tubeWidth: number;
  ariaLabel: string;
}) {
  const items = Array.from({ length: Math.max(0, filledCount) }, (_, i) => i);
  const paddingX = Math.max(10, Math.round(itemSize * 0.25));
  const paddingY = Math.max(4, Math.round(itemSize * 0.08));
  const stackLiftPx = 12;
  const stackGapPx = 8;
  const stackStepPx = itemSize + stackGapPx;
  const innerMinHeightPx = itemSize + Math.max(0, capacity - 1) * stackStepPx;

  return (
    <div
      aria-label={ariaLabel}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        maxWidth: `${tubeWidth}px`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: `${tubeWidth}px`,
          minHeight: tubeHeight,
          borderLeft: `3px solid ${palette}`,
          borderRight: `3px solid ${palette}`,
          borderBottom: `3px solid ${palette}`,
          borderTop: "0",
          borderTopLeftRadius: "0",
          borderTopRightRadius: "0",
          borderBottomLeftRadius: "2.4rem",
          borderBottomRightRadius: "2.4rem",
          paddingLeft: `${paddingX}px`,
          paddingRight: `${paddingX}px`,
          paddingTop: `${paddingY}px`,
          paddingBottom: `${paddingY}px`,
          background: showErrorTint ? "rgba(239,68,68,0.4)" : "transparent",
          boxShadow: `-10px 12px 16px -12px ${palette}88, 10px 12px 16px -12px ${palette}88, 0 14px 18px -14px ${palette}88`,
          opacity: disabled ? 0.55 : 1,
          transition: "opacity 160ms, background 180ms ease-out",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: "transparent",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: "transparent",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: "transparent",
            borderBottomLeftRadius: "2.4rem",
            borderBottomRightRadius: "2.4rem",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -12,
            top: -10,
            width: 12,
            height: 14,
            borderRight: `3px solid ${palette}`,
            borderTop: "0",
            borderTopRightRadius: "0",
            boxShadow: `-4px -2px 8px -8px ${palette}aa`,
            opacity: 0.95,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -12,
            top: -10,
            width: 12,
            height: 14,
            borderLeft: `3px solid ${palette}`,
            borderTop: "0",
            borderTopLeftRadius: "0",
            boxShadow: `4px -2px 8px -8px ${palette}aa`,
            opacity: 0.95,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "12px auto 12px 10%",
            width: "18%",
            borderRadius: "999px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.03))",
            opacity: 0.8,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            height: "18%",
            borderRadius: "0 0 2rem 2rem",
            background: `linear-gradient(180deg, ${palette}18, ${palette}30)`,
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            minHeight: `${innerMinHeightPx}px`,
            width: "100%",
          }}
        >
          {items.map((i) => (
            <span
              key={i}
              data-screenshot-lift-item="true"
              style={{
                position: "absolute",
                left: "50%",
                bottom: `${i * stackStepPx + stackLiftPx}px`,
                transform: "translateX(-50%)",
                fontSize: itemSize,
                lineHeight: 1,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}
            >
              {itemEmoji}
            </span>
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 26,
        }}
      >
        <DigitalReadout value={filledCount} compact />
      </div>
    </div>
  );
}

function DigitalReadout({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        style={{
          fontFamily: "'DSEG7Classic', 'Courier New', monospace",
          fontSize: "1.6rem",
          fontWeight: 800,
          color: "#67e8f9",
          letterSpacing: "0.08em",
          lineHeight: 1,
          textShadow:
            "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
        }}
      >
        {compact ? String(value) : String(value).padStart(2, "0")}
      </div>
    );
  }

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

type Phase = "playing" | "correct" | "shipAnimating";
type FlashFeedback = { ok: boolean; icon: true } | null;
type RevealCtaMode = "next" | "retry" | null;

export default function PackItLevelOneScreen() {
  const { locale } = useLocale();
  const t = useT();
  const isMobileLandscape = useIsMobileLandscape();
  const isMobile = useIsCoarsePointer();
  const isDesktopLayout = !isMobile;

  const [muted, setMuted] = useState(isMuted());
  const [desktopTubeCapacity, setDesktopTubeCapacity] = useState(() =>
    typeof window === "undefined"
      ? DESKTOP_TUBE_MAX_CAPACITY
      : getDesktopTubeCapacityForSceneHeight(window.innerHeight),
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const [roundName, setRoundName] = useState<RoundName>("load");
  const [round, setRound] = useState(() => makeRound(1, "load", isMobile));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [tubeCount, setTubeCount] = useState(1);
  const [calculatorInput, setCalculatorInput] = useState("0");
  const [submittedShipTotal, setSubmittedShipTotal] = useState<number | null>(
    null,
  );
  const [shipCommitted, setShipCommitted] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);
  const [typedQuestionLength, setTypedQuestionLength] = useState(0);
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [showNextButton, setShowNextButton] = useState(false);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [snipMode, setSnipMode] = useState(false);
  const [snipSelection, setSnipSelection] = useState<SquareSnip>({
    x: 120,
    y: 120,
    size: 220,
  });
  const [captureFlashVisible, setCaptureFlashVisible] = useState(false);
  const [devPassedQuestionIndex, setDevPassedQuestionIndex] = useState<
    number | null
  >(null);
  const [flash, setFlash] = useState<FlashFeedback>(null);
  const [revealCtaMode, setRevealCtaMode] = useState<RevealCtaMode>(null);
  const [forceAnswerBanner, setForceAnswerBanner] = useState(false);
  const [isQuestionDemo, setIsQuestionDemo] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);
  const pointsDeductedRef = useRef(false);
  const overshotOnceRef = useRef(false);
  const robotSolvedQuestionRef = useRef(false);
  const shipTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const nextButtonTimerRef = useRef<number | null>(null);
  const questionTypeIntervalRef = useRef<number | null>(null);
  const captureFlashTimerRef = useRef<number | null>(null);
  const autopilotTimerRefs = useRef<number[]>([]);
  const cheatBufferRef = useRef("");
  const rootRef = useRef<HTMLDivElement>(null);
  const snipDragRef = useRef<SnipDragState | null>(null);
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
  const isLocalDev =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const roundLabels: Record<RoundName, string> = {
    load: t("game.roundLoad"),
    pack: t("game.roundPack"),
    ship: t("game.roundShip"),
  };
  const roundAccentByName: Record<
    RoundName,
    { background: string; border: string; glow: string }
  > = {
    load: {
      background: "#0ea5e9",
      border: "#38bdf8",
      glow: "0 0 18px rgba(56,189,248,0.24)",
    },
    pack: {
      background: "#f59e0b",
      border: "#fbbf24",
      glow: "0 0 18px rgba(251,191,36,0.24)",
    },
    ship: {
      background: "#ec4899",
      border: "#f472b6",
      glow: "0 0 18px rgba(244,114,182,0.24)",
    },
  };
  const completedQuestionCount = isRoundComplete
    ? round.questions.length
    : Math.min(
        round.questions.length,
        questionIndex + (phase === "correct" || showNextButton ? 1 : 0),
      );
  const visibleApplesEarned =
    devPassedQuestionIndex === null
      ? completedQuestionCount
      : Math.max(completedQuestionCount, devPassedQuestionIndex + 1);
  const isShipLocked = roundName === "ship" && !shipCommitted;
  const tubesDisabled =
    isShipLocked ||
    phase === "correct" ||
    phase === "shipAnimating" ||
    isQuestionDemo;
  const questionResetKey = `${locale}-${roundName}-${questionIndex}`;

  const clearAutopilotTimers = useCallback(() => {
    autopilotTimerRefs.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    autopilotTimerRefs.current = [];
  }, []);

  const resetQuestionState = useCallback(() => {
    clearAutopilotTimers();
    setTubeCount(1);
    setCalculatorInput("0");
    setSubmittedShipTotal(null);
    setShipCommitted(false);
    setRevealCtaMode(null);
    setForceAnswerBanner(false);
    setIsQuestionDemo(false);
    setPhantomPos(null);
    pointsDeductedRef.current = false;
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
    if (questionTypeIntervalRef.current !== null) {
      window.clearInterval(questionTypeIntervalRef.current);
      questionTypeIntervalRef.current = null;
    }
  }, [question.unitRate, roundName]);

  useLayoutEffect(() => {
    resetQuestionState();
  }, [questionIndex, roundName, resetQuestionState]);

  useEffect(() => {
    robotSolvedQuestionRef.current = false;
  }, [questionIndex, roundName]);

  useEffect(() => {
    setDevPassedQuestionIndex(null);
  }, [roundName]);

  useEffect(() => {
    if (isMobile || typeof window === "undefined") {
      return;
    }

    const measureDesktopTubeCapacity = () => {
      const nextCapacity = getDesktopTubeCapacityForSceneHeight(
        window.innerHeight,
      );
      setDesktopTubeCapacity((current) =>
        current === nextCapacity ? current : nextCapacity,
      );
      setViewportWidth((current) =>
        current === window.innerWidth ? current : window.innerWidth,
      );
    };

    measureDesktopTubeCapacity();
    window.addEventListener("resize", measureDesktopTubeCapacity);
    return () => {
      window.removeEventListener("resize", measureDesktopTubeCapacity);
    };
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined" || isDesktopLayout) return;

    const measureViewportWidth = () => {
      setViewportWidth((current) =>
        current === window.innerWidth ? current : window.innerWidth,
      );
    };

    measureViewportWidth();
    window.addEventListener("resize", measureViewportWidth);
    return () => {
      window.removeEventListener("resize", measureViewportWidth);
    };
  }, [isDesktopLayout]);

  useEffect(() => {
    return () => {
      if (shipTimerRef.current !== null)
        window.clearTimeout(shipTimerRef.current);
      if (revealTimerRef.current !== null)
        window.clearTimeout(revealTimerRef.current);
      if (nextButtonTimerRef.current !== null)
        window.clearTimeout(nextButtonTimerRef.current);
      if (questionTypeIntervalRef.current !== null)
        window.clearInterval(questionTypeIntervalRef.current);
      if (captureFlashTimerRef.current !== null)
        window.clearTimeout(captureFlashTimerRef.current);
      clearAutopilotTimers();
    };
  }, [clearAutopilotTimers]);

  useEffect(() => {
    if (!snipMode) {
      snipDragRef.current = null;
      return;
    }

    function onMove(event: PointerEvent) {
      const drag = snipDragRef.current;
      if (!drag) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (drag.mode === "move") {
        setSnipSelection((current) =>
          clampSnipSelection(rootRef.current, {
            ...current,
            x: drag.initial.x + deltaX,
            y: drag.initial.y + deltaY,
          }),
        );
        return;
      }

      setSnipSelection((current) =>
        clampSnipSelection(rootRef.current, {
          ...current,
          size: Math.max(drag.initial.size + Math.max(deltaX, deltaY), 96),
        }),
      );
    }

    function onUp(event: PointerEvent) {
      if (snipDragRef.current?.pointerId !== event.pointerId) return;
      snipDragRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [snipMode]);

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
    const fullText = questionText;
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
  }, [isRoundComplete, questionResetKey, questionText]);

  useEffect(() => {
    if (!flash?.icon) {
      return;
    }

    const timer = window.setTimeout(() => setFlash(null), 1200);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!showNextButton) {
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
        handleTryAgain();
        return;
      }

      advanceQuestion();
    }

    window.addEventListener("keydown", handleNextButtonEnter);
    return () => {
      window.removeEventListener("keydown", handleNextButtonEnter);
    };
  }, [revealCtaMode, showNextButton]);

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
  }, [isRoundComplete]);

  const beginMusic = useCallback(() => {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    ensureAudioReady();
    if (!isMuted()) startMusic();
  }, []);

  function revealStepsSequentially(nextMode: RevealCtaMode = "next") {
    const lines = stepsText.length;
    let i = 0;
    const tick = () => {
      i += 1;
      setRevealedSteps(i);
      if (i < lines) {
        revealTimerRef.current = window.setTimeout(tick, 900);
      } else {
        nextButtonTimerRef.current = window.setTimeout(
          () => {
            setRevealCtaMode(nextMode);
            setShowNextButton(true);
          },
          900,
        );
      }
    };
    tick();
  }

  function onCorrect(nextMode: RevealCtaMode = "next") {
    setPhase("correct");
    setFlash({ ok: true, icon: true });
    playCorrect();
    if (
      nextMode !== "retry" &&
      !robotSolvedQuestionRef.current &&
      !pointsDeductedRef.current
    ) {
      setScore((current) => current + 1);
    }
    revealStepsSequentially(nextMode);
  }

  function onWrong(options?: { suppressScore?: boolean }) {
    setFlash({ ok: false, icon: true });
    playWrong();
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
    if (!options?.suppressScore && !pointsDeductedRef.current) {
      setScore((current) => Math.max(0, current - 1));
      pointsDeductedRef.current = true;
    }
  }

  function handlePlus() {
    if (tubesDisabled) return;
    beginMusic();
    if (roundName === "load") {
      setCalculatorInput(String(currentProgressTotal + question.unitRate));
      playDragStep();
      return;
    }
    if (tubeCount >= maxTubeCount) return;
    const nextCount = tubeCount + 1;
    setTubeCount(nextCount);
    playDragStep();
  }

  function handleMinus() {
    if (tubesDisabled) return;
    beginMusic();
    if (roundName === "load") {
      const fills = getTubeFillCounts(currentProgressTotal, question.unitRate);
      if (fills.length <= 1) {
        playRipple(320);
        return;
      }
      const nextTotal = Math.max(0, currentProgressTotal - fills[fills.length - 1]);
      setCalculatorInput(String(nextTotal));
      playRipple(320);
      return;
    }
    if (displayedTubeCounts.length <= 1) return;
    setTubeCount((n) => Math.max(1, n - 1));
    playRipple(320);
  }

  function handleOvershoot() {
    if (overshotOnceRef.current) return;
    overshotOnceRef.current = true;
    playWrong();
  }

  function canSubmitKeypad() {
    if (showNextButton || isRoundComplete) return false;
    if (phase !== "playing") return false;
    if (isQuestionDemo) return false;
    if (roundName === "load") return true;
    const parsed = Number.parseFloat(calculatorInput);
    return !Number.isNaN(parsed) && calculatorInput.trim() !== "";
  }

  function handleCalculatorChange(value: string) {
    setCalculatorInput(value);
  }

  function handleSubmit(submitMode: RevealCtaMode = "next") {
    if (phase !== "playing") return;
    beginMusic();

    if (roundName === "load") {
      const correct = currentProgressTotal === question.answer;
      if (correct) onCorrect(submitMode);
      else onWrong({ suppressScore: submitMode === "retry" });
      return;
    }

    if (roundName === "pack") {
      const correct = currentProgressTotal === question.answer;
      if (correct) onCorrect(submitMode);
      else onWrong({ suppressScore: submitMode === "retry" });
      return;
    }

    const submittedTotal = Math.max(
      0,
      Number.isNaN(Number.parseInt(calculatorInput, 10))
        ? 0
        : Number.parseInt(calculatorInput, 10),
    );
    setShipCommitted(true);
    setSubmittedShipTotal(submittedTotal);
    const correct = submittedTotal === question.answer;
    if (correct) {
      onCorrect(submitMode);
      return;
    }

    setPhase("shipAnimating");
    onWrong({ suppressScore: submitMode === "retry" });
    shipTimerRef.current = window.setTimeout(() => {
      shipTimerRef.current = null;
      setPhase("playing");
    }, 1200);
  }

  function handleRobotSolvedQuestion() {
    beginMusic();
    robotSolvedQuestionRef.current = true;
    setCalculatorInput(String(question.answer));
    if (roundName === "ship") {
      setShipCommitted(true);
      setSubmittedShipTotal(question.answer);
    }
    onCorrect("retry");
  }

  function advanceQuestion() {
    if (questionIndex < round.questions.length - 1) {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setFlash(null);
      return;
    }
    setIsRoundComplete(true);
    playLevelComplete();
  }

  function handleDevAppleClick(index: number) {
    if (!isLocalDev) return;
    const passedIndex = Math.max(index, questionIndex);
    setDevPassedQuestionIndex((current) => Math.max(current ?? -1, passedIndex));

    if (passedIndex >= round.questions.length - 1) {
      setIsRoundComplete(true);
      setFlash(null);
      playLevelComplete();
      return;
    }

    setQuestionIndex(passedIndex + 1);
  }

  function navigateToLevel(level: 1 | 2) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (level === 1) {
      url.searchParams.delete("level");
    } else {
      url.searchParams.set("level", String(level));
    }
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function handleRefreshCurrentQuestion() {
    setFlash(null);
    resetQuestionState();
  }

  function handleTryAgain() {
    handleRefreshCurrentQuestion();
  }

  function handleRoundCompleteContinue() {
    if (nextRoundName) {
      setIsRoundComplete(false);
      setRoundName(nextRoundName);
      setRound(makeRound(1, nextRoundName, isMobile));
      setQuestionIndex(0);
      setScore(0);
      return;
    }

    navigateToLevel(2);
  }

  function handleToggleMute() {
    const next = toggleMute();
    setMuted(next);
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

  function makeDefaultSnipSelection() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
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

  function closeSnipMode() {
    snipDragRef.current = null;
    setSnipMode(false);
  }

  function toggleSquareSnip() {
    setSnipMode((current) => {
      const next = !current;
      if (next) {
        const initial = makeDefaultSnipSelection();
        if (initial) setSnipSelection(initial);
      } else {
        snipDragRef.current = null;
      }
      return next;
    });
  }

  async function handleCapture(closeSnipAfterCapture = false) {
    if (!rootRef.current) return;
    const captureTarget = rootRef.current;
    if (!captureTarget) return;

    triggerCaptureFlash();
    const canvas = await html2canvas(captureTarget, {
      backgroundColor: sourceBackgroundFromRoot(captureTarget),
      scale: window.devicePixelRatio > 1 ? 2 : 1,
      useCORS: true,
      ignoreElements: (element) =>
        element.getAttribute("data-capture-ignore") === "true",
      onclone: (clonedDocument) => {
        clonedDocument
          .querySelectorAll<HTMLElement>("[data-screenshot-lift-item='true']")
          .forEach((element) => {
            element.style.transform = "translateX(-50%) translateY(-10px)";
          });
      },
    });

    let sourceCanvas = canvas;
    if (snipMode) {
      const outputCanvas = document.createElement("canvas");
      const targetRect = captureTarget.getBoundingClientRect();
      const rootRect = rootRef.current.getBoundingClientRect();
      const scaleX = canvas.width / targetRect.width;
      const scaleY = canvas.height / targetRect.height;
      const sx = (rootRect.left - targetRect.left + snipSelection.x) * scaleX;
      const sy = (rootRect.top - targetRect.top + snipSelection.y) * scaleY;
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
      snipMode ? "pack-it-l1-snip.png" : "pack-it-l1-screenshot.png",
    );

    if (closeSnipAfterCapture && snipMode) {
      closeSnipMode();
    }
  }

  async function handleCaptureSnip() {
    await handleCapture(true);
  }

  const chromeTheme = useMemo(
    () => buildChromeTheme(question.pair.item, question.pair.palette),
    [question.pair.item, question.pair.palette],
  );
  const showDevChrome = import.meta.env.DEV;
  const showAnswerBanner = import.meta.env.DEV || forceAnswerBanner;
  const itemSize = isMobile ? 32 : 48;
  const paddingX = Math.max(10, Math.round(itemSize * 0.25));
  const paddingY = Math.max(4, Math.round(itemSize * 0.08));
  const stackLiftPx = 12;
  const stackGapPx = 8;
  const stackStepPx = itemSize + stackGapPx;
  const visibleTubeCapacity = isMobileLandscape
    ? Math.min(question.unitRate, MOBILE_VISIBLE_TUBE_CAPACITY)
    : desktopTubeCapacity;
  const containerWidth = Math.max(
    itemSize + paddingX * 2,
    Math.round(itemSize * 1.9),
  );
  const innerHeight =
    itemSize + Math.max(0, visibleTubeCapacity - 1) * stackStepPx;
  const tubeHeight = isMobileLandscape
    ? 208
    : innerHeight + paddingY * 2 + stackLiftPx;
  const tubeGap = isMobileLandscape ? 10 : 18;
  const maxTubeCount = getTubeStripCapacityForViewportWidth(
    viewportWidth,
    isDesktopLayout,
    containerWidth,
    tubeGap,
  );
  const maxDisplayableTotal = maxTubeCount * question.unitRate;
  const enteredTotal = Math.max(
    0,
    Number.isNaN(Number.parseInt(calculatorInput, 10))
      ? 0
      : Number.parseInt(calculatorInput, 10),
  );
  const resolvedRoundTotal =
    roundName === "ship" ? (submittedShipTotal ?? 0) : enteredTotal;
  const displayOverflow =
    roundName !== "load" && resolvedRoundTotal > maxDisplayableTotal;
  const currentProgressTotal = resolvedRoundTotal;
  const displayTotal = Math.min(resolvedRoundTotal, maxDisplayableTotal);
  const displayedTubeCounts = getTubeFillCounts(displayTotal, question.unitRate);
  const tubeStripMaxWidth =
    maxTubeCount * containerWidth + Math.max(0, maxTubeCount - 1) * tubeGap;
  const barRowWidth = Math.min(620, tubeStripMaxWidth + 32);
  const showTubeErrorTint =
    displayOverflow || currentProgressTotal > question.answer;
  const showTubeControls = roundName === "load" && phase === "playing";
  const nextRoundName =
    ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(roundName) + 1] ?? null;
  const finalRoundCtaLabel = `${t("game.nextRound")}: Level 2`;
  const visibleQuestionText = questionText.slice(0, typedQuestionLength);
  const calculatorTopBanner = showAnswerBanner ? (
    <span className="font-black tracking-[0.06em]">
      <span className="text-white">{t("game.answerLabel")}</span>{" "}
      <span className="text-[#fde047]">{question.answer}</span>
    </span>
  ) : null;

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

  function getSubmitButtonCenter() {
    const submitButton = document.querySelector<HTMLButtonElement>(
      '[data-autopilot-key="submit"]',
    );
    return getScreenCenter(submitButton ?? null);
  }

  function getKeypadButtonCenter(key: string) {
    const button = document.querySelector<HTMLButtonElement>(
      `[data-autopilot-key="${key}"]`,
    );
    return getScreenCenter(button ?? null);
  }

  function getTubeAdjustButtonCenter(action: "plus" | "minus") {
    const button = document.querySelector<HTMLButtonElement>(
      `[data-autopilot-action="${action}"]`,
    );
    return getScreenCenter(button ?? null);
  }

  function revealAnswerForCurrentQuestion() {
    setForceAnswerBanner(true);
  }

  function scheduleAutopilotStep(callback: () => void, delayMs: number) {
    const timerId = window.setTimeout(callback, delayMs);
    autopilotTimerRefs.current.push(timerId);
  }

  function solveCurrentQuestion() {
    if (showNextButton || isRoundComplete || phase !== "playing") {
      return;
    }

    clearAutopilotTimers();
    setForceAnswerBanner(false);
    setIsQuestionDemo(true);
    setPhantomPos(null);

    const MOVE_MS = 280;
    const PRESS_MS = 120;
    const SETTLE_MS = 220;
    let timelineMs = 0;

    if (roundName === "load") {
      const targetCount = Math.max(
        1,
        Math.round(question.answer / Math.max(1, question.unitRate)),
      );
      const currentCount = Math.max(1, displayedTubeCounts.length);
      const action =
        targetCount >= currentCount ? ("plus" as const) : ("minus" as const);
      const pressCount = Math.abs(targetCount - currentCount);

      for (let index = 0; index < pressCount; index += 1) {
        const buttonCenter = getTubeAdjustButtonCenter(action);
        if (!buttonCenter) {
          continue;
        }

        scheduleAutopilotStep(() => {
          setPhantomPos({
            ...buttonCenter,
            isClicking: false,
            durationMs: MOVE_MS,
          });
        }, timelineMs);

        scheduleAutopilotStep(() => {
          setPhantomPos({
            ...buttonCenter,
            isClicking: true,
            durationMs: PRESS_MS,
          });
        }, timelineMs + MOVE_MS);

        scheduleAutopilotStep(() => {
          if (action === "plus") {
            playDragStep();
            setCalculatorInput((current) => {
              const parsed = Number.parseInt(current, 10);
              const currentValue = Number.isNaN(parsed) ? 0 : parsed;
              return String(currentValue + question.unitRate);
            });
            return;
          }

          playRipple(320);
          setCalculatorInput((current) => {
            const parsed = Number.parseInt(current, 10);
            const currentValue = Number.isNaN(parsed) ? 0 : parsed;
            const fills = getTubeFillCounts(currentValue, question.unitRate);
            if (fills.length <= 1) {
              return current;
            }
            return String(Math.max(0, currentValue - fills[fills.length - 1]));
          });
        }, timelineMs + MOVE_MS + PRESS_MS);

        timelineMs += MOVE_MS + PRESS_MS + SETTLE_MS;
      }
    } else {
      setCalculatorInput("0");
      const answerDigits = String(question.answer).split("");
      let autopilotDisplayValue = "0";

      answerDigits.forEach((digit) => {
        const keyCenter = getKeypadButtonCenter(digit);
        if (!keyCenter) {
          return;
        }

        scheduleAutopilotStep(() => {
          setPhantomPos({
            ...keyCenter,
            isClicking: false,
            durationMs: MOVE_MS,
          });
        }, timelineMs);

        scheduleAutopilotStep(() => {
          setPhantomPos({
            ...keyCenter,
            isClicking: true,
            durationMs: PRESS_MS,
          });
        }, timelineMs + MOVE_MS);

        scheduleAutopilotStep(() => {
          playKeyClick();
          autopilotDisplayValue =
            autopilotDisplayValue === "0"
              ? digit
              : `${autopilotDisplayValue}${digit}`;
          setCalculatorInput(autopilotDisplayValue);
        }, timelineMs + MOVE_MS + PRESS_MS);

        timelineMs += MOVE_MS + PRESS_MS + SETTLE_MS;
      });
    }

    const submitButtonCenter = getSubmitButtonCenter();
    if (!submitButtonCenter) {
      setPhantomPos(null);
      setIsQuestionDemo(false);
      return;
    }

    scheduleAutopilotStep(() => {
      setPhantomPos({
        ...submitButtonCenter,
        isClicking: false,
        durationMs: MOVE_MS,
      });
    }, timelineMs);

    scheduleAutopilotStep(() => {
      setPhantomPos({
        ...submitButtonCenter,
        isClicking: true,
        durationMs: PRESS_MS,
      });
      playKeyClick();
    }, timelineMs + MOVE_MS);

    scheduleAutopilotStep(() => {
      handleRobotSolvedQuestion();
    }, timelineMs + MOVE_MS + PRESS_MS);

    scheduleAutopilotStep(() => {
      setPhantomPos(null);
      setIsQuestionDemo(false);
    }, timelineMs + MOVE_MS + PRESS_MS + 900);
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
        cheatBufferRef.current = "";
        solveCurrentQuestion();
      }
    }

    window.addEventListener("keydown", handleCheatCodes);
    return () => {
      window.removeEventListener("keydown", handleCheatCodes);
    };
  }, [
    clearAutopilotTimers,
    displayedTubeCounts.length,
    isRoundComplete,
    phase,
    question.answer,
    question.unitRate,
    roundName,
    showNextButton,
  ]);

  const questionPanel = ({
    calculatorMinimized,
    toggleCalculatorMinimized,
  }: {
    calculatorMinimized: boolean;
    toggleCalculatorMinimized: () => void;
  }) => {
    const messageTheme = chromeTheme.messagePanel;
    const showBoxCornerCta = showNextButton && !isDesktopLayout;
    const ctaLabel = revealCtaMode === "retry" ? "Try again" : t("game.next");
    const ctaAction =
      revealCtaMode === "retry" ? handleTryAgain : advanceQuestion;
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
            } ${shake ? "animate-shake" : ""}`}
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
            {renderHighlighted(visibleQuestionText)}
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
            <div
              className="min-h-[5.6rem] h-full px-5 py-4 text-[1.05rem] font-semibold leading-relaxed"
              style={{
                background: "transparent",
                color: messageTheme.text,
                paddingBottom: showBoxCornerCta ? "3.5rem" : undefined,
                paddingRight: showBoxCornerCta ? "6.25rem" : undefined,
              }}
            >
              {stepsText.slice(0, revealedSteps).map((line, index) => (
                <div key={`${index}-${line}`}>{renderHighlighted(line)}</div>
              ))}
            </div>
          </div>
          {showBoxCornerCta ? (
            <button
              type="button"
              onClick={ctaAction}
              className={`arcade-button absolute right-2 z-[2] inline-flex items-center rounded-full font-arcade font-bold leading-none text-white transition-all duration-150 ${
                calculatorMinimized ? "top-1/2 -translate-y-1/2" : "bottom-2"
              } ${
                isMobile
                  ? isMobileLandscape
                    ? "h-[40px] px-5 text-[0.8rem]"
                    : "h-[34px] px-5 text-[0.8rem]"
                  : "h-[34px] px-5 text-[0.8rem]"
              }`}
            >
              {ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const desktopRailTop = isDesktopLayout ? (
    <div className="flex flex-col gap-3" style={{ marginTop: "2rem" }}>
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((levelNumber) => {
          const locked =
            levelNumber === 1 ? false : levelNumber === 2 ? !isLocalDev : true;
          return (
            <MobileLevelButton
              key={`desktop-level-${levelNumber}`}
              label={String(levelNumber)}
              active={levelNumber === 1}
              locked={locked}
              activeColor={roundAccentByName[roundName]}
              onClick={() => navigateToLevel(levelNumber as 1 | 2)}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-x-2 gap-y-3 justify-items-center">
        {Array.from({ length: QUESTIONS_PER_ROUND }, (_, index) => (
          <button
            type="button"
            key={index}
            className="inline-flex h-7 w-7 items-center justify-center"
            onClick={() => handleDevAppleClick(index)}
            disabled={!isLocalDev}
            style={{
              cursor: isLocalDev ? "pointer" : "default",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <ProgressApple active={index < visibleApplesEarned} />
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <GameLayout
      muted={muted}
      onToggleMute={handleToggleMute}
      onRestart={handleRefreshCurrentQuestion}
      onCapture={showDevChrome ? handleCapture : undefined}
      onToggleSquareSnip={showDevChrome ? toggleSquareSnip : undefined}
      squareSnipActive={showDevChrome && snipMode}
      onQuestionDemo={showDevChrome ? solveCurrentQuestion : undefined}
      onRecordDemo={showDevChrome ? () => {} : undefined}
      isQuestionDemo={isQuestionDemo}
      forceKeypadExpanded={isQuestionDemo}
      keypadValue={calculatorInput}
      onKeypadChange={handleCalculatorChange}
      onKeypadSubmit={handleSubmit}
      canSubmit={canSubmitKeypad()}
      chromeTheme={chromeTheme}
      calculatorTopBanner={calculatorTopBanner}
      questionPanel={questionPanel}
      desktopRailTop={desktopRailTop}
      mobileMinimizeResetKey={`${roundName}-${questionIndex}`}
    >
      <div
        ref={rootRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: getSceneBackdropBaseBackground(
            question.pair.item,
            question.pair.palette,
          ),
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobileLandscape ? 14 : 22,
          padding: isMobileLandscape ? "14px 18px" : "28px 34px",
          boxSizing: "border-box",
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {renderSceneBackdrop(question.pair.item, question.pair.palette)}
        </div>
        <style>{`
          @keyframes packit-l1-progress-danger {
            0% { box-shadow: 0 0 8px rgba(239,68,68,0.2), 0 0 14px rgba(239,68,68,0.1); }
            50% { box-shadow: 0 0 18px rgba(239,68,68,0.55), 0 0 30px rgba(239,68,68,0.3); }
            100% { box-shadow: 0 0 8px rgba(239,68,68,0.2), 0 0 14px rgba(239,68,68,0.1); }
          }
        `}</style>

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
              {[1, 2, 3].map((levelNumber) => {
                const locked =
                  levelNumber === 1
                    ? false
                    : levelNumber === 2
                      ? !isLocalDev
                      : true;
                return (
                  <MobileLevelButton
                    key={`mobile-level-${levelNumber}`}
                    label={String(levelNumber)}
                    active={levelNumber === 1}
                    locked={locked}
                    activeColor={roundAccentByName[roundName]}
                    onClick={() => navigateToLevel(levelNumber as 1 | 2)}
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
              {Array.from({ length: QUESTIONS_PER_ROUND }, (_, index) => (
                <span
                  key={index}
                  className="inline-flex h-6 w-6 items-center justify-center"
                >
                  <ProgressApple active={index < visibleApplesEarned} />
                </span>
              ))}
            </div>
          </div>
        </div>

        {phase === "correct" ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "43%",
              transform: "translate(-50%, -50%)",
              width: "min(760px, calc(100% - 4rem))",
              borderRadius: 18,
              border: `3px solid ${question.pair.palette}88`,
              background: "rgba(15,23,42,0.94)",
              boxShadow:
                "0 16px 34px rgba(2,6,23,0.46), inset 0 0 18px rgba(15,23,42,0.42)",
              color: "#e2e8f0",
              fontSize: isMobileLandscape ? "1rem" : "1.18rem",
              fontWeight: 800,
              minHeight: isMobileLandscape ? 140 : 176,
              padding: isMobileLandscape ? "12px 14px 68px" : "16px 20px 84px",
              zIndex: 12,
            }}
          >
            {stepsText.map((line, i) => (
              <div
                key={i}
                style={{
                  marginBottom: i === stepsText.length - 1 ? 0 : 6,
                  opacity: i < revealedSteps ? 1 : 0,
                  transition: "opacity 220ms cubic-bezier(0.22,0.72,0.2,1)",
                  minHeight: isMobileLandscape ? "1.4rem" : "1.7rem",
                }}
              >
                {renderHighlighted(line)}
              </div>
            ))}
            {showNextButton ? (
              <button
                type="button"
                onClick={
                  revealCtaMode === "retry" ? handleTryAgain : advanceQuestion
                }
                style={{
                  position: "absolute",
                  right: isMobileLandscape ? 14 : 20,
                  bottom: isMobileLandscape ? 12 : 16,
                  width: isMobileLandscape ? "6.5rem" : "7rem",
                  height: isMobileLandscape ? "2.65rem" : "2.85rem",
                  borderRadius: 999,
                  background: "linear-gradient(180deg,#f59e0b,#f97316)",
                  boxShadow: "none",
                  color: "white",
                  fontWeight: 900,
                  border: "3px solid #fde68a",
                  cursor: "pointer",
                  fontSize: isMobileLandscape ? "0.9rem" : "0.95rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {revealCtaMode === "retry"
                  ? "Try again"
                  : t("game.next")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            width: "100%",
            flex: 1,
            minHeight: 0,
            justifyContent: "flex-start",
            alignItems: "center",
            transform: isMobileLandscape
              ? "translateY(0.5rem)"
              : "translateY(1rem)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${displayedTubeCounts.length}, ${containerWidth}px)`,
              gap: tubeGap,
              alignItems: "end",
              width: "fit-content",
              maxWidth: "fit-content",
              maxHeight: "100%",
              paddingLeft: "1rem",
              boxSizing: "border-box",
            }}
          >
            {displayedTubeCounts.map((filledCount, idx) => (
              <div
                key={idx}
                style={{ position: "relative", width: "100%", minWidth: 0 }}
              >
                <TestTube
                  filledCount={filledCount}
                  capacity={visibleTubeCapacity}
                  itemEmoji={question.pair.itemEmoji}
                  palette={question.pair.palette}
                  showErrorTint={showTubeErrorTint}
                  disabled={tubesDisabled}
                  tubeHeight={tubeHeight}
                  itemSize={itemSize}
                  tubeWidth={containerWidth}
                  ariaLabel={`${idx === 0 ? "Starter" : "Replicated"} tube with ${filledCount} ${question.pair.itemPlural}`}
                />
                {idx < displayedTubeCounts.length - 1 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: `calc(100% + ${tubeGap / 2}px)`,
                      bottom: 0,
                      transform: "translate(-50%, -12%)",
                      fontFamily: "'DSEG7Classic', 'Courier New', monospace",
                      fontSize: "1.35rem",
                      fontWeight: 800,
                      color: "#67e8f9",
                      lineHeight: 1,
                      textShadow:
                        "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
                      pointerEvents: "none",
                    }}
                  >
                    +
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            position: "relative",
            zIndex: 6,
            isolation: "isolate",
            width: "100%",
            maxWidth: `${barRowWidth}px`,
            minWidth: 0,
            minHeight: "4.25rem",
            paddingInline: 8,
            boxSizing: "border-box",
            marginBottom: isMobileLandscape ? "0.35rem" : "1.1rem",
          }}
        >
          {showTubeControls ? (
            <button
              data-autopilot-action="minus"
              data-capture-ignore="true"
              type="button"
              onClick={handleMinus}
              disabled={tubesDisabled || displayedTubeCounts.length <= 1}
              aria-label="Remove tube"
              style={{
                width: 52,
                height: 52,
                appearance: "none",
                WebkitAppearance: "none",
                position: "relative",
                zIndex: 1,
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.75)",
                background:
                  tubesDisabled || displayedTubeCounts.length <= 1
                    ? "rgba(127,29,29,0.38)"
                    : "#dc2626",
                color: "white",
                fontSize: 30,
                fontWeight: 900,
                lineHeight: 1,
                cursor:
                  tubesDisabled || displayedTubeCounts.length <= 1
                    ? "not-allowed"
                    : "pointer",
                opacity: displayedTubeCounts.length > 1 ? 1 : 0.45,
                boxShadow: "0 8px 18px rgba(2,6,23,0.36)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                flexShrink: 0,
              }}
            >
              −
            </button>
          ) : null}
          <L1ProgressBar
            current={currentProgressTotal}
            target={question.answer}
            onOvershoot={handleOvershoot}
            forceRed={displayOverflow}
          />
          {showTubeControls ? (
            <button
              data-autopilot-action="plus"
              data-capture-ignore="true"
              type="button"
              onClick={handlePlus}
              disabled={tubesDisabled || tubeCount >= maxTubeCount}
              aria-label="Add tube"
              style={{
                width: 52,
                height: 52,
                appearance: "none",
                WebkitAppearance: "none",
                position: "relative",
                zIndex: 1,
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.75)",
                background:
                  tubesDisabled || tubeCount >= maxTubeCount
                    ? "rgba(21,128,61,0.38)"
                    : "#16a34a",
                color: "white",
                fontSize: 28,
                fontWeight: 900,
                lineHeight: 1,
                cursor:
                  tubesDisabled || tubeCount >= maxTubeCount
                    ? "not-allowed"
                    : "pointer",
                opacity: tubeCount < maxTubeCount ? 1 : 0.45,
                boxShadow: "0 8px 18px rgba(2,6,23,0.36)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                flexShrink: 0,
              }}
            >
              +
            </button>
          ) : null}
        </div>

        {isRoundComplete ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(15,23,42,0.985) 0%, rgba(2,6,23,0.995) 78%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 760,
                padding: isMobileLandscape ? "20px 18px" : "28px 26px",
                textAlign: "center",
                borderRadius: 22,
                border: `3px solid ${roundAccentByName[roundName].border}`,
                background: "rgba(15,23,42,0.84)",
                boxShadow: roundAccentByName[roundName].glow,
              }}
            >
              <div
                style={{
                  color: roundAccentByName[roundName].border,
                  fontSize: isMobileLandscape ? "1.7rem" : "2.2rem",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {roundLabels[roundName]} {t("game.complete")}
              </div>
              <div
                style={{
                  marginTop: 12,
                  color: "#e2e8f0",
                  fontSize: isMobileLandscape ? "1rem" : "1.15rem",
                  fontWeight: 700,
                }}
              >
                {nextRoundName
                  ? `Next: ${roundLabels[nextRoundName]}`
                  : finalRoundCtaLabel}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: "#94a3b8",
                  fontSize: isMobileLandscape ? "0.95rem" : "1rem",
                  fontWeight: 700,
                }}
              >
                Completed: {round.questions.length}/{round.questions.length}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#94a3b8",
                  fontSize: isMobileLandscape ? "0.95rem" : "1rem",
                  fontWeight: 700,
                }}
              >
                Score: {score}
              </div>
              <button
                type="button"
                onClick={handleRoundCompleteContinue}
                style={{
                  marginTop: 24,
                  padding: "10px 26px",
                  borderRadius: 999,
                  background: roundAccentByName[roundName].background,
                  color: "white",
                  fontWeight: 900,
                  border: `2px solid ${roundAccentByName[roundName].border}`,
                  cursor: "pointer",
                  fontSize: "1rem",
                  boxShadow: roundAccentByName[roundName].glow,
                }}
              >
                {nextRoundName
                  ? `${t("game.nextRound")}: ${roundLabels[nextRoundName]}`
                  : finalRoundCtaLabel}
              </button>
            </div>
          </div>
        ) : null}
        <PhantomHand pos={phantomPos} />
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
    </GameLayout>
  );
}
