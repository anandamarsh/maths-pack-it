import { pickPair, randInt } from "../shared.ts";
import type {
  GroupingPair,
  PackQuestion,
  RoundConfig,
  RoundGenerationOverrides,
  RoundGenerationProfile,
  RoundName,
} from "../types.ts";

type DynamicQuestionLocale = "en" | "hi" | "zh";

// TODO(L1): Hindi/Chinese question text templates are not yet localised.
// For now `getLocalizedLevelOneQuestionText` returns the English template
// for hi/zh locales. Mirror the level-2 structure when adding translations.

const MOBILE_ROUND_PROFILE: RoundGenerationProfile = {
  // Level 1 constraints: unit 3–8, groups 3–8, total ≤ 64.
  minTotalCount: 9,
  maxTotalCount: 64,
  maxGroupCount: 8,
  maxUnitCount: 8,
};

const DESKTOP_ROUND_PROFILE: RoundGenerationProfile = {
  minTotalCount: 9,
  maxTotalCount: 64,
  maxGroupCount: 8,
  maxUnitCount: 8,
};

function getLevelOneRoundProfile(
  isMobile: boolean,
  overrides?: RoundGenerationOverrides,
): RoundGenerationProfile {
  const baseProfile = isMobile ? MOBILE_ROUND_PROFILE : DESKTOP_ROUND_PROFILE;
  return {
    ...baseProfile,
    maxGroupCount: overrides?.maxGroupCount ?? baseProfile.maxGroupCount,
    maxUnitCount: overrides?.maxUnitCount ?? baseProfile.maxUnitCount,
  };
}

const LEVEL_ONE_QUESTION_TEMPLATES = [
  (pair: GroupingPair, unit: number, groups: number) =>
    `If 1 ${pair.container} holds ${unit} ${pair.itemPlural}, how many ${pair.itemPlural} would be in ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `One ${pair.container} holds ${unit} ${pair.itemPlural}. How many ${pair.itemPlural} are in ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `Each ${pair.container} holds ${unit} ${pair.itemPlural}. How many ${pair.itemPlural} fit in ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `A ${pair.container} is packed with ${unit} ${pair.itemPlural}. How many ${pair.itemPlural} are needed to fill ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `If a single ${pair.container} contains ${unit} ${pair.itemPlural}, how many ${pair.itemPlural} are there in ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `${unit} ${pair.itemPlural} fill 1 ${pair.container}. How many ${pair.itemPlural} fill ${groups} ${pair.containerPlural}?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `A ${pair.container} fits exactly ${unit} ${pair.itemPlural}. How many ${pair.itemPlural} will ${groups} ${pair.containerPlural} hold in total?`,
  (pair: GroupingPair, unit: number, groups: number) =>
    `${groups} ${pair.containerPlural} are each filled with ${unit} ${pair.itemPlural}. How many ${pair.itemPlural} are there altogether?`,
] as const;

function pickQuestionTemplateIndex(
  previousTemplateIndex: number | null,
  random: () => number,
) {
  const templateCount = LEVEL_ONE_QUESTION_TEMPLATES.length;

  if (templateCount <= 1) {
    return 0;
  }

  let templateIndex = randInt(0, templateCount - 1, random);
  if (previousTemplateIndex !== null && templateIndex === previousTemplateIndex) {
    templateIndex = (templateIndex + 1) % templateCount;
  }
  return templateIndex;
}

function buildLevelOneBlackboardSteps(
  pair: GroupingPair,
  total: number,
  groups: number,
  unit: number,
) {
  return [
    `1 ${pair.container} = ${unit} ${pair.itemPlural}.`,
    `${groups} ${pair.containerPlural} = ${groups} × ${unit} = ${total} ${pair.itemPlural}.`,
  ];
}

export function getLocalizedLevelOneQuestionText(
  question: Pick<
    PackQuestion,
    "pair" | "questionTemplateIndex" | "unitRate" | "groupsA"
  >,
  locale: string,
) {
  // TODO(L1): Add Hindi / Chinese templates. For now fall back to English.
  void locale;
  void (null as DynamicQuestionLocale | null);
  const template =
    LEVEL_ONE_QUESTION_TEMPLATES[question.questionTemplateIndex] ??
    LEVEL_ONE_QUESTION_TEMPLATES[0];
  return template(question.pair, question.unitRate, question.groupsA);
}

export function getLocalizedLevelOneBlackboardSteps(
  question: Pick<PackQuestion, "pair" | "totalA" | "groupsA" | "unitRate">,
  locale: string,
) {
  // TODO(L1): Add Hindi / Chinese blackboard steps. For now fall back to English.
  void locale;
  void (null as DynamicQuestionLocale | null);
  return buildLevelOneBlackboardSteps(
    question.pair,
    question.totalA,
    question.groupsA,
    question.unitRate,
  );
}

export function createLevelOneQuestion(
  round: RoundName,
  profile: RoundGenerationProfile,
  usedPairs: GroupingPair[] = [],
  random: () => number = Math.random,
  previousTemplateIndex: number | null = null,
): PackQuestion {
  const minUnit = Math.max(3, 3);
  const maxUnit = Math.min(profile.maxUnitCount, 8);
  const minGroups = Math.max(3, 3);
  const maxGroups = Math.min(profile.maxGroupCount, 8);

  const unit = randInt(minUnit, Math.max(minUnit, maxUnit), random);
  const groups = randInt(minGroups, Math.max(minGroups, maxGroups), random);
  const total = groups * unit;
  const pair = pickPair(usedPairs, random);
  const templateIndex = pickQuestionTemplateIndex(previousTemplateIndex, random);
  const questionText = LEVEL_ONE_QUESTION_TEMPLATES[templateIndex](
    pair,
    unit,
    groups,
  );

  return {
    level: 1,
    round,
    subtype: "find-total",
    questionTemplateIndex: templateIndex,
    pair,
    totalA: total,
    groupsA: groups,
    unitRate: unit,
    answer: total,
    answerUnit: pair.itemPlural,
    questionText,
    blackboardSteps: buildLevelOneBlackboardSteps(pair, total, groups, unit),
    isFraction: false,
  };
}

function createLevelOneRound(
  round: RoundName,
  profile: RoundGenerationProfile,
  random: () => number = Math.random,
): RoundConfig {
  const usedPairs: GroupingPair[] = [];
  let previousTemplateIndex: number | null = null;
  const questions = Array.from({ length: 10 }, () => {
    const question = createLevelOneQuestion(
      round,
      profile,
      usedPairs,
      random,
      previousTemplateIndex,
    );
    usedPairs.push(question.pair);
    previousTemplateIndex = question.questionTemplateIndex;
    return question;
  });

  return {
    level: 1,
    round,
    questions,
  };
}

export function createLevelOneLoadQuestion(
  isMobileOrUsedPairs: boolean | GroupingPair[] = false,
  usedPairsOrRandom: GroupingPair[] | (() => number) = [],
  randomOrPreviousTemplateIndex: (() => number) | number | null = Math.random,
  previousTemplateIndex: number | null = null,
): PackQuestion {
  const isMobile = typeof isMobileOrUsedPairs === "boolean" ? isMobileOrUsedPairs : false;
  const usedPairs = Array.isArray(isMobileOrUsedPairs)
    ? isMobileOrUsedPairs
    : Array.isArray(usedPairsOrRandom)
      ? usedPairsOrRandom
      : [];
  const random = typeof usedPairsOrRandom === "function"
    ? usedPairsOrRandom
    : typeof randomOrPreviousTemplateIndex === "function"
      ? randomOrPreviousTemplateIndex
      : Math.random;
  const resolvedPreviousTemplateIndex =
    typeof randomOrPreviousTemplateIndex === "number"
      ? randomOrPreviousTemplateIndex
      : previousTemplateIndex;
  return createLevelOneQuestion(
    "load",
    getLevelOneRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelOnePackQuestion(
  isMobileOrUsedPairs: boolean | GroupingPair[] = false,
  usedPairsOrRandom: GroupingPair[] | (() => number) = [],
  randomOrPreviousTemplateIndex: (() => number) | number | null = Math.random,
  previousTemplateIndex: number | null = null,
): PackQuestion {
  const isMobile = typeof isMobileOrUsedPairs === "boolean" ? isMobileOrUsedPairs : false;
  const usedPairs = Array.isArray(isMobileOrUsedPairs)
    ? isMobileOrUsedPairs
    : Array.isArray(usedPairsOrRandom)
      ? usedPairsOrRandom
      : [];
  const random = typeof usedPairsOrRandom === "function"
    ? usedPairsOrRandom
    : typeof randomOrPreviousTemplateIndex === "function"
      ? randomOrPreviousTemplateIndex
      : Math.random;
  const resolvedPreviousTemplateIndex =
    typeof randomOrPreviousTemplateIndex === "number"
      ? randomOrPreviousTemplateIndex
      : previousTemplateIndex;
  return createLevelOneQuestion(
    "pack",
    getLevelOneRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelOneShipQuestion(
  isMobileOrUsedPairs: boolean | GroupingPair[] = false,
  usedPairsOrRandom: GroupingPair[] | (() => number) = [],
  randomOrPreviousTemplateIndex: (() => number) | number | null = Math.random,
  previousTemplateIndex: number | null = null,
): PackQuestion {
  const isMobile = typeof isMobileOrUsedPairs === "boolean" ? isMobileOrUsedPairs : false;
  const usedPairs = Array.isArray(isMobileOrUsedPairs)
    ? isMobileOrUsedPairs
    : Array.isArray(usedPairsOrRandom)
      ? usedPairsOrRandom
      : [];
  const random = typeof usedPairsOrRandom === "function"
    ? usedPairsOrRandom
    : typeof randomOrPreviousTemplateIndex === "function"
      ? randomOrPreviousTemplateIndex
      : Math.random;
  const resolvedPreviousTemplateIndex =
    typeof randomOrPreviousTemplateIndex === "number"
      ? randomOrPreviousTemplateIndex
      : previousTemplateIndex;
  return createLevelOneQuestion(
    "ship",
    getLevelOneRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelOneLoadRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelOneRound(
    "load",
    getLevelOneRoundProfile(isMobile, overrides),
    random,
  );
}

export function createLevelOnePackRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelOneRound(
    "pack",
    getLevelOneRoundProfile(isMobile, overrides),
    random,
  );
}

export function createLevelOneShipRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelOneRound(
    "ship",
    getLevelOneRoundProfile(isMobile, overrides),
    random,
  );
}
