import { useEffect, useRef, useState } from "react";
import { useIsCoarsePointer, useIsMobileLandscape } from "../hooks/useMediaQuery";
import { playKeyClick } from "../sound";

const DISPLAY_FONT_SIZE = "2.1rem";
const DOCK_TRANSITION = "320ms cubic-bezier(0.22,0.72,0.2,1)";

interface NumericKeypadProps {
  value: string;
  onChange?: (v: string) => void;
  onKeyInput?: (key: string) => boolean;
  onSubmit?: () => void;
  canSubmit?: boolean;
  /** Controlled from outside (GameLayout lifts this state) */
  minimized: boolean;
  onToggleMinimized: () => void;
}

export default function NumericKeypad({
  value,
  onChange,
  onKeyInput,
  onSubmit,
  canSubmit = false,
  minimized,
  onToggleMinimized,
}: NumericKeypadProps) {
  const isCoarsePointer = useIsCoarsePointer();
  const isMobileLandscape = useIsMobileLandscape();
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
  const buttonHeightClass = isMobileLandscape ? "h-[56px]" : isCoarsePointer ? "h-[45px]" : "h-[55px] md:h-10";
  const base = `rounded flex items-center justify-center font-black select-none transition-transform active:scale-95 ${isMobileLandscape ? "text-[1.6875rem]" : "text-[1.5rem] md:text-[1.3125rem]"} ${buttonHeightClass}`;
  const digit = `${base} ${isMobileLandscape ? "text-[1.875rem]" : "text-[1.7rem] md:text-[1.5rem]"} bg-slate-800 text-slate-100 border border-slate-600/60`;
  const op = `${base} bg-slate-700/80 text-slate-100 border border-slate-500/60`;
  const pressedKeyStyle: React.CSSProperties = {
    background: "#67e8f9", color: "#020617", borderColor: "#67e8f9",
    boxShadow: "0 0 16px rgba(103,232,249,0.45)",
  };
  const width = isMobileLandscape ? "w-[16.25rem]" : "w-[12.5rem] md:w-[13.75rem]";

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
  }, [canSubmit, onSubmit, value]);

  return (
    <div
      className={`relative flex min-h-0 min-w-0 ${width} shrink-0 flex-col rounded-xl p-1.5 gap-1`}
      style={{
        background: "rgba(2,6,23,0.97)",
        border: "4px solid rgba(56,189,248,0.45)",
        boxShadow: "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* Digital display — click toggles minimized */}
      <div
        className="relative rounded-lg px-3.5 flex shrink-0 items-center justify-end overflow-visible h-14 md:h-12 cursor-pointer"
        onClick={onToggleMinimized}
        style={{
          fontFamily: "'DSEG7Classic', 'Courier New', monospace",
          fontWeight: 700,
          fontSize: DISPLAY_FONT_SIZE,
          lineHeight: 1,
          background: "rgba(0,8,4,0.95)",
          /* Inner border only when expanded — minimized shows only the outer thick border */
          border: minimized ? "none" : "2px solid rgba(56,189,248,0.28)",
          color: "#67e8f9",
          textShadow: "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
          letterSpacing: "0.08em",
        }}
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
                style={activeKey === btn ? pressedKeyStyle : undefined}
              >
                {btn === "±" ? <span className={`${isMobileLandscape ? "text-[2.25rem]" : "text-[2.4rem] md:text-[2.1rem]"} leading-none`}>±</span>
                  : btn === "⌫" ? <span className={`${isMobileLandscape ? "text-[2.475rem]" : "text-[2.8rem] md:text-[2.4rem]"} leading-none`}>⌫</span>
                  : btn === "." ? <span className={`${isMobileLandscape ? "text-[2.475rem]" : "text-[2.8rem] md:text-[2.4rem]"} leading-none`}>.</span>
                  : btn}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-0.5 mt-0.5">
          <button type="button" onClick={() => press("0")} data-autopilot-key="0" className={`${digit} flex-[2]`} style={activeKey === "0" ? pressedKeyStyle : undefined}>0</button>
          <button type="button" onClick={onSubmit} disabled={!canSubmit}
            data-autopilot-key="submit"
            className={`${base} flex-[2] arcade-button disabled:opacity-40 disabled:cursor-not-allowed`}>
            <svg viewBox="0 0 24 24" fill="none"
              className={isMobileLandscape ? "w-[1.6875rem] h-[1.6875rem]" : "w-8 h-8 md:w-7 md:h-7"}
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
