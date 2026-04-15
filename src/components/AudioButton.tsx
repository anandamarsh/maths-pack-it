import { useT } from "../i18n";

interface AudioButtonProps {
  muted: boolean;
  onToggle: () => void;
}

export default function AudioButton({ muted, onToggle }: AudioButtonProps) {
  const t = useT();

  return (
    <button
      onClick={onToggle}
      title={muted ? t("audio.unmute") : t("audio.mute")}
      className="arcade-button w-10 h-10 flex items-center justify-center p-2"
      style={
        muted
          ? {
              background: "linear-gradient(180deg,#475569,#334155)",
              boxShadow: "0 5px 0 #1e293b",
              borderColor: "#94a3b8",
            }
          : {}
      }
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        {muted ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white" />
            <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
