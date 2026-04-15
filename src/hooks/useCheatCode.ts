import { useEffect, useRef } from "react";

const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock",
]);

interface UseCheatCodesResult {
  processCheatKey: (key: string) => boolean;
  resetCheatBuffer: () => void;
}

/**
 * Listens for sequences of digit keypresses globally.
 * When the accumulated buffer ends with a registered code, fires its handler.
 * Non-digit, non-modifier keys reset the buffer.
 * Uses capture phase so it fires before phase-specific game listeners.
 */
export function useCheatCodes(
  handlers: Record<string, () => void>,
): UseCheatCodesResult {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const bufferRef = useRef("");

  function processCheatKey(key: string): boolean {
    if (key >= "0" && key <= "9") {
      bufferRef.current = (bufferRef.current + key).slice(-BUFFER_MAX);
      for (const code of Object.keys(handlersRef.current)) {
        if (bufferRef.current.endsWith(code)) {
          bufferRef.current = "";
          handlersRef.current[code]();
          return true;
        }
      }
    } else if (!PASSTHROUGH_KEYS.has(key)) {
      bufferRef.current = "";
    }
    return false;
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (processCheatKey(e.key)) {
        e.stopImmediatePropagation(); // prevent bubble-phase listeners seeing this key
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return {
    processCheatKey,
    resetCheatBuffer: () => {
      bufferRef.current = "";
    },
  };
}
