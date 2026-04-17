export type Level = 1 | 2 | 3 | 4;

export type RoundName = "load" | "pack" | "ship";

export type QuestionSubtype =
  | "find-unit"
  | "find-total"
  | "find-groups"
  | "apply-unit-groups"
  | "apply-unit-total";

export interface GroupingPair {
  item: string;
  itemPlural: string;
  container: string;
  containerPlural: string;
  itemEmoji: string;
  containerEmoji: string;
  palette: string;
}

export interface PackQuestion {
  level: Level;
  round: RoundName;
  subtype: QuestionSubtype;
  pair: GroupingPair;
  totalA: number;
  groupsA: number;
  unitRate: number;
  totalB?: number;
  groupsB?: number;
  answer: number;
  answerUnit: string;
  questionText: string;
  blackboardSteps: string[];
  isFraction: boolean;
}

export interface RoundConfig {
  level: Level;
  round: RoundName;
  questions: PackQuestion[];
}

export interface RoundGenerationProfile {
  minTotalCount: number;
  maxTotalCount: number;
  maxGroupCount: number;
}
