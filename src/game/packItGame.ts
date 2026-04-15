import { createRound, type Level, type RoundConfig, type RoundName } from "../calculations/index.ts";

export function makeRound(level: Level, round: RoundName): RoundConfig {
  return createRound(level, round);
}

export type { Level, RoundConfig, RoundName } from "../calculations/index.ts";
