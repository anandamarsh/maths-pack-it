import { useT } from "../i18n";

interface LevelButtonsProps {
  levelCount: number;
  currentLevel: number;
  unlockedLevel: number;
  onSelect: (level: number) => void;
}

export default function LevelButtons({
  levelCount,
  currentLevel,
  unlockedLevel,
  onSelect,
}: LevelButtonsProps) {
  const t = useT();
  const levels = Array.from({ length: levelCount }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1.5">
      {levels.map((lv) => {
        const locked = lv > unlockedLevel && lv > currentLevel;
        const isActive = lv === currentLevel;
        const isDone = lv < currentLevel;

        return (
          <button
            key={lv}
            onClick={() => !locked && onSelect(lv)}
            disabled={locked}
            title={locked ? t("level.completePrev", { n: lv - 1 }) : undefined}
            className="w-9 h-8 rounded text-xs font-black border-2 transition-colors"
            style={{
              background: locked ? "#0f172a" : isActive ? "#0ea5e9" : isDone ? "#78350f" : "#1e293b",
              borderColor: locked ? "#1e293b" : isActive ? "#38bdf8" : isDone ? "#fbbf24" : "#475569",
              color: locked ? "#334155" : isActive ? "white" : isDone ? "#fde047" : "#64748b",
              boxShadow: isDone ? "0 0 8px rgba(251,191,36,0.45)" : undefined,
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.5 : 1,
            }}
          >
            {locked ? "\u{1F512}" : lv}
          </button>
        );
      })}
    </div>
  );
}
