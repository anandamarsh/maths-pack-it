interface TutorialHintProps {
  show: boolean;
  label: string;
  /** Position from center. Defaults to center of parent. */
  offsetX?: number;
  offsetY?: number;
}

export default function TutorialHint({
  show,
  label,
  offsetX = 0,
  offsetY = 0,
}: TutorialHintProps) {
  if (!show) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex flex-col items-center"
      style={{
        transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        animation: "keypad-display-finger-fade 2.4s ease-in-out infinite",
      }}
    >
      {/* Animated hand */}
      <svg
        viewBox="0 0 80 100"
        width="90"
        height="108"
        overflow="visible"
        style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,0.65))" }}
      >
        <path
          d="M24.76,22.64V12.4c0-3.18,2.59-5.77,5.77-5.77,1.44,0,2.82,.54,3.89,1.51,1.07,1,1.72,2.33,1.85,3.76l.87,10.08c2.12-1.88,3.39-4.59,3.39-7.48,0-5.51-4.49-10-10-10s-10,4.49-10,10c0,3.29,1.62,6.29,4.23,8.14Z"
          fill="#67e8f9"
          stroke="rgba(2,6,23,0.98)"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
        <path
          d="M55.98,69.53c0-.14,.03-.28,.09-.41l4.48-9.92v-18.37c0-1.81-1.08-3.48-2.76-4.26-6.75-3.13-13.8-4.84-20.95-5.08-.51-.01-.92-.41-.97-.91l-1.6-18.5c-.08-.94-.51-1.82-1.2-2.46-.7-.63-1.6-.99-2.54-.99-2.08,0-3.77,1.69-3.77,3.77V48.48h-2v-13.32c-2.61,.46-4.69,2.65-4.91,5.36-.56,6.79-.53,14.06,.08,21.62,.28,3.44,2.42,6.52,5.58,8.05l4.49,2.18c.35,.17,.56,.52,.56,.9v2.23h25.42v-5.97Z"
          fill="#67e8f9"
          stroke="rgba(2,6,23,0.98)"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </svg>

      {/* Label */}
      <div
        className="rounded-full px-3 py-1 text-sm"
        style={{
          marginTop: "-1.5rem",
          background: "rgba(15,23,42,0.88)",
          border: "1px solid rgba(56,189,248,0.35)",
          color: "#67e8f9",
          fontWeight: 900,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}
