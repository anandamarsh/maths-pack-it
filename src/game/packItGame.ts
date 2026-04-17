import { createRound, type Level, type RoundConfig, type RoundName } from "../calculations/index.ts";

export function makeRound(level: Level, round: RoundName, isMobile = false): RoundConfig {
  return createRound(level, round, isMobile);
}

export type { Level, RoundConfig, RoundName } from "../calculations/index.ts";
