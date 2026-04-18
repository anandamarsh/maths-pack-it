import {
  createRound,
  type Level,
  type RoundConfig,
  type RoundGenerationOverrides,
  type RoundName,
} from "../calculations/index.ts";

export function makeRound(
  level: Level,
  round: RoundName,
  isMobile = false,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createRound(level, round, isMobile, Math.random, overrides);
}

export type {
  Level,
  RoundConfig,
  RoundGenerationOverrides,
  RoundName,
} from "../calculations/index.ts";
