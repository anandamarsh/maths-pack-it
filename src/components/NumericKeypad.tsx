import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useIsCoarsePointer, useIsMobileLandscape } from "../hooks/useMediaQuery";
import { playKeyClick } from "../sound";

const DISPLAY_FONT_SIZE = "2.1rem";
const DOCK_TRANSITION = "320ms cubic-bezier(0.22,0.72,0.2,1)";
const KEYPAD_PANEL_BORDER_WIDTH_PX = 3;

function toOpaqueColor(color: string | undefined) {
  if (!color) return color;
  return color.replace(
    /rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)/g,
    "rgb($1,$2,$3)",
  );
}

interface NumericKeypadProps {
  value: string;
  onChange?: (v: string) => void;
  onKeyInput?: (key: string) => boolean;
  onSubmit?: () => void;
  onEnterPress?: () => boolean;
  canSubmit?: boolean;
  /** Controlled from outside (GameLayout lifts this state) */
  minimized: boolean;
  onToggleMinimized: () => void;
  theme?: {
    panelBackground?: string;
    panelBorder?: string;
    panelGlow?: string;
    digitBackground?: string;
    digitBorder?: string;
    digitColor?: string;
    operatorBackground?: string;
    operatorBorder?: string;
    operatorColor?: string;
    displayBorder?: string;
    displayColor?: string;
    displayGlow?: string;
  };
}

export default function NumericKeypad({
  value,
  onChange,
  onKeyInput,
  onSubmit,
  onEnterPress,
  canSubmit = false,
  minimized,
  onToggleMinimized,
  theme,
}: NumericKeypadProps) {
  const isCoarsePointer = useIsCoarsePointer();
  const isMobileLandscape = useIsMobileLandscape();
  const isDesktopLayout = !isCoarsePointer;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeKeyTimeoutRef = useRef<number | null>(null);

  function flashKey(key: string) {
    setActiveKey(key);
    if (activeKeyTimeoutRef.current !== null) window.clearTimeout(activeKeyTimeoutRef.current);
    activeKeyTimeoutRef.current = window.setTimeout(() => {
      setActiveKey((c) => (c === key ? null : c));
      activeKeyTimeoutRef.current = null;
    }, 140);
  }

  function press(key: string) {
    if (!onChange) return;
    playKeyClick();
    flashKey(key);
    if (onKeyInput?.(key)) return;
    if (key === "⌫") { onChange(value.slice(0, -1)); return; }
    if (key === "±") {
      if (value.startsWith("-")) onChange(value.slice(1));
      else onChange("-" + (value || "0"));
      return;
    }
    if (key === ".") { if (!value.includes(".")) onChange(value === "" ? "0." : `${value}.`); return; }
    if (value === "0") onChange(key);
    else if (value === "-0") onChange("-" + key);
    else onChange(`${value}${key}`);
  }

  const display = value === "" ? "0" : value;
  const rows = [["7", "8", "9", "⌫"], ["4", "5", "6", "±"], ["1", "2", "3", "."]];
  const buttonHeightClass = isMobileLandscape
    ? "h-[56px]"
    : isDesktopLayout
      ? "h-[54px]"
      : "h-[45px]";
  const base = `rounded flex cursor-pointer items-center justify-center font-black select-none transition-all duration-150 hover:scale-[1.03] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 ${isMobileLandscape ? "text-[1.6875rem]" : isDesktopLayout ? "text-[1.45rem]" : "text-[1.5rem]"} ${buttonHeightClass}`;
  const digit = `${base} ${isMobileLandscape ? "text-[1.875rem]" : isDesktopLayout ? "text-[1.6rem]" : "text-[1.7rem]"} border`;
  const op = `${base} border`;
  const mobileBottomButtonHeightClass = isMobileLandscape ? "h-[52px]" : "";
  const pressedKeyStyle: React.CSSProperties = {
    background: "#67e8f9", color: "#020617", borderColor: "#67e8f9",
    boxShadow: "0 0 16px rgba(103,232,249,0.45)",
  };
  const width = isMobileLandscape
    ? "w-[16.25rem]"
    : isDesktopLayout
      ? "w-full min-w-0"
      : "w-[12.5rem]";
  const keypadPanelStyle: CSSProperties = {
    background: toOpaqueColor(theme?.panelBackground) ?? "rgb(2,6,23)",
    border: `${KEYPAD_PANEL_BORDER_WIDTH_PX}px solid ${theme?.panelBorder ?? "rgba(56,189,248,0.45)"}`,
    boxShadow:
      theme?.panelGlow ??
      "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
  };
  const keypadDisplayStyle: CSSProperties = {
    fontFamily: "'DSEG7Classic', 'Courier New', monospace",
    fontWeight: 700,
    fontSize: DISPLAY_FONT_SIZE,
    lineHeight: 1,
    background: "rgba(0,8,4,0.95)",
    border: minimized ? "none" : `2px solid ${theme?.displayBorder ?? "rgba(56,189,248,0.28)"}`,
    color: theme?.displayColor ?? "#67e8f9",
    textShadow:
      theme?.displayGlow ??
      "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
    letterSpacing: "0.08em",
  };
  const digitKeyStyle: CSSProperties = {
    background: theme?.digitBackground ?? "rgba(30,41,59,0.96)",
    borderColor: theme?.digitBorder ?? theme?.panelBorder ?? "rgba(71,85,105,0.6)",
    color: theme?.digitColor ?? "#f8fafc",
  };
  const operatorKeyStyle: CSSProperties = {
    background: theme?.operatorBackground ?? theme?.digitBackground ?? "rgba(51,65,85,0.92)",
    borderColor:
      theme?.operatorBorder ??
      theme?.digitBorder ??
      theme?.panelBorder ??
      "rgba(100,116,139,0.6)",
    color: theme?.operatorColor ?? theme?.digitColor ?? "#f8fafc",
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        press("⌫");
        return;
      }

      if (event.key === "." || event.key === "Decimal") {
        event.preventDefault();
        press(".");
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        if (onEnterPress?.()) {
          event.preventDefault();
          return;
        }
        if (!canSubmit) {
          return;
        }
        event.preventDefault();
        playKeyClick();
        onSubmit?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canSubmit, onEnterPress, onSubmit, value]);

  return (
    <div
      className={`relative flex h-full min-h-0 min-w-0 ${width} shrink-0 self-stretch flex-col rounded-xl p-1.5 gap-1`}
      style={keypadPanelStyle}
    >
      {/* Digital display — click toggles minimized */}
      <div
        className={`relative rounded-lg px-3.5 flex shrink-0 items-center justify-end overflow-visible cursor-pointer ${
          isDesktopLayout ? "h-14" : "h-14 md:h-12"
        }`}
        onClick={onToggleMinimized}
        style={keypadDisplayStyle}
      >
        {display}
      </div>

      {/* Number grid — collapses without affecting canvas layout */}
      <div
        className="flex min-h-0 flex-col gap-0.5"
        style={{
          overflow: "hidden",
          maxHeight: minimized ? "0px" : "400px",
          opacity: minimized ? 0 : 1,
          pointerEvents: minimized ? "none" : "auto",
          transition: `max-height ${DOCK_TRANSITION}, opacity ${DOCK_TRANSITION}`,
        }}
      >
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-0.5">
            {row.map((btn) => (
              <button
                key={btn} type="button" onClick={() => press(btn)}
                data-autopilot-key={btn}
                className={/[0-9]/.test(btn) ? digit : op}
                style={
                  activeKey === btn
                    ? pressedKeyStyle
                    : /[0-9]/.test(btn)
                      ? digitKeyStyle
                      : operatorKeyStyle
                }
              >
                {btn === "±" ? <span className={`${isMobileLandscape ? "text-[2.25rem]" : isDesktopLayout ? "text-[2rem]" : "text-[2.4rem]"} leading-none`}>±</span>
                  : btn === "⌫" ? <span className={`${isMobileLandscape ? "text-[2.475rem]" : isDesktopLayout ? "text-[2.2rem]" : "text-[2.8rem]"} leading-none`}>⌫</span>
                  : btn === "." ? <span className={`${isMobileLandscape ? "text-[2.475rem]" : isDesktopLayout ? "text-[2.2rem]" : "text-[2.8rem]"} leading-none`}>.</span>
                  : btn}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-0.5 mt-0.5">
          <button
            type="button"
            onClick={() => press("0")}
            data-autopilot-key="0"
            className={`${digit} flex-[2] ${mobileBottomButtonHeightClass}`}
            style={activeKey === "0" ? pressedKeyStyle : digitKeyStyle}
          >
            0
          </button>
          <button type="button" onClick={onSubmit} disabled={!canSubmit}
            data-autopilot-key="submit"
              className={`${base} flex-[2] ${mobileBottomButtonHeightClass} arcade-button disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100`}>
            <svg viewBox="0 0 24 24" fill="none"
              className={isMobileLandscape ? "w-[1.6875rem] h-[1.6875rem]" : isDesktopLayout ? "w-7 h-7" : "w-8 h-8"}
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
