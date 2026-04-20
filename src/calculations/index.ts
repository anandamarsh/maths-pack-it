import {
  createLevelOneLoadRound,
  createLevelOnePackRound,
  createLevelOneShipRound,
} from "./level-1/index.ts";
import {
  createLevelTwoLoadRound,
  createLevelTwoPackRound,
  createLevelTwoShipRound,
} from "./level-2/index.ts";
import type {
  Level,
  RoundConfig,
  RoundGenerationOverrides,
  RoundName,
} from "./types.ts";

export function createRound(
  level: Level,
  round: RoundName,
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  if (level === 1 && round === "load") {
    return createLevelOneLoadRound(isMobile, random, overrides);
  }
  if (level === 1 && round === "pack") {
    return createLevelOnePackRound(isMobile, random, overrides);
  }
  if (level === 1 && round === "ship") {
    return createLevelOneShipRound(isMobile, random, overrides);
  }
  if (level === 2 && round === "load") {
    return createLevelTwoLoadRound(isMobile, random, overrides);
  }
  if (level === 2 && round === "pack") {
    return createLevelTwoPackRound(isMobile, random, overrides);
  }
  if (level === 2 && round === "ship") {
    return createLevelTwoShipRound(isMobile, random, overrides);
  }

  throw new Error(`Round not implemented yet: level ${level} / ${round}`);
}

export type {
  GroupingPair,
  Level,
  PackQuestion,
  RoundConfig,
  RoundGenerationOverrides,
  RoundGenerationProfile,
  RoundName,
} from "./types.ts";
