import {
  createLevelOneLoadRound,
  createLevelOnePackRound,
  createLevelOneShipRound,
} from "./level-1/index.ts";
import type { Level, RoundConfig, RoundName } from "./types.ts";

export function createRound(level: Level, round: RoundName, random: () => number = Math.random): RoundConfig {
  if (level === 1 && round === "load") {
    return createLevelOneLoadRound(random);
  }
  if (level === 1 && round === "pack") {
    return createLevelOnePackRound(random);
  }
  if (level === 1 && round === "ship") {
    return createLevelOneShipRound(random);
  }

  throw new Error(`Round not implemented yet: level ${level} / ${round}`);
}

export type { GroupingPair, Level, PackQuestion, RoundConfig, RoundName } from "./types.ts";
