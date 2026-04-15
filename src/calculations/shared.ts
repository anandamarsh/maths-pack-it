import type { GroupingPair } from "./types.ts";

export const GROUPING_PAIRS: GroupingPair[] = [
  {
    item: "apple",
    itemPlural: "apples",
    container: "crate",
    containerPlural: "crates",
    itemEmoji: "🍎",
    containerEmoji: "📦",
    palette: "#dc2626",
  },
  {
    item: "fish",
    itemPlural: "fish",
    container: "bowl",
    containerPlural: "bowls",
    itemEmoji: "🐟",
    containerEmoji: "🥣",
    palette: "#0284c7",
  },
  {
    item: "egg",
    itemPlural: "eggs",
    container: "carton",
    containerPlural: "cartons",
    itemEmoji: "🥚",
    containerEmoji: "📦",
    palette: "#ca8a04",
  },
  {
    item: "cookie",
    itemPlural: "cookies",
    container: "jar",
    containerPlural: "jars",
    itemEmoji: "🍪",
    containerEmoji: "🫙",
    palette: "#b45309",
  },
  {
    item: "cupcake",
    itemPlural: "cupcakes",
    container: "tray",
    containerPlural: "trays",
    itemEmoji: "🧁",
    containerEmoji: "🧺",
    palette: "#db2777",
  },
  {
    item: "gem",
    itemPlural: "gems",
    container: "chest",
    containerPlural: "chests",
    itemEmoji: "💎",
    containerEmoji: "🪙",
    palette: "#0f766e",
  },
];

export function randInt(min: number, max: number, random: () => number = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function pickPair(usedPairs: GroupingPair[], random: () => number = Math.random): GroupingPair {
  const pool = GROUPING_PAIRS.filter(
    (pair) => !usedPairs.some((used) => used.item === pair.item && used.container === pair.container),
  );
  const candidates = pool.length > 0 ? pool : GROUPING_PAIRS;
  return candidates[randInt(0, candidates.length - 1, random)];
}
