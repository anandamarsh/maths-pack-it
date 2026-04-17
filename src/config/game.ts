const DEFAULT_GAME_SLUG = "pack-it";
const DEFAULT_GAME_NAME = "Pack It!";
const DEFAULT_SITE_URL = "https://maths-pack-it.vercel.app";

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name] as string | undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const GAME_SLUG = readEnv("VITE_GAME_SLUG") ?? DEFAULT_GAME_SLUG;
export const GAME_NAME = readEnv("VITE_GAME_NAME") ?? DEFAULT_GAME_NAME;
export const GAME_SITE_URL = (readEnv("VITE_SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/$/, "");
export const GAME_STORAGE_PREFIX = `maths-game:${GAME_SLUG}`;

export function getGamePageUrl() {
  if (typeof window === "undefined") {
    return `${GAME_SITE_URL}/`;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("level");
    url.searchParams.delete("demo");
    url.hash = "";
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function getGameShareUrl() {
  if (typeof window === "undefined") {
    return `${GAME_SITE_URL}/`;
  }

  try {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  } catch {
    return `${window.location.origin}/`;
  }
}
