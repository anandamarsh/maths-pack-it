import type { ReactNode } from "react";
import type { CSSProperties } from "react";

interface QuestionBoxProps {
  children: ReactNode;
  shake?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export default function QuestionBox({
  children,
  shake,
  onClick,
  style,
}: QuestionBoxProps) {
  return (
    <div
      className={`arcade-panel font-i18n flex min-w-0 h-full items-center gap-2 px-4 py-2 text-lg font-bold leading-tight text-white ${shake ? "animate-shake" : ""} ${onClick ? "cursor-pointer select-none" : ""}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
