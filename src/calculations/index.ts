import {
  createLevelOneLoadRound,
  createLevelOnePackRound,
  createLevelOneShipRound,
} from "./level-1/index.ts";
import type { Level, RoundConfig, RoundName } from "./types.ts";

export function createRound(
  level: Level,
  round: RoundName,
  isMobileOrRandom: boolean | (() => number) = false,
  random: () => number = Math.random,
): RoundConfig {
  const isMobile = typeof isMobileOrRandom === "boolean" ? isMobileOrRandom : false;
  const resolvedRandom =
    typeof isMobileOrRandom === "function" ? isMobileOrRandom : random;

  if (level === 1 && round === "load") {
    return createLevelOneLoadRound(isMobile, resolvedRandom);
  }
  if (level === 1 && round === "pack") {
    return createLevelOnePackRound(isMobile, resolvedRandom);
  }
  if (level === 1 && round === "ship") {
    return createLevelOneShipRound(isMobile, resolvedRandom);
  }

  throw new Error(`Round not implemented yet: level ${level} / ${round}`);
}

export type {
  GroupingPair,
  Level,
  PackQuestion,
  RoundConfig,
  RoundGenerationProfile,
  RoundName,
} from "./types.ts";
