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

const LOCALIZED_PAIR_TEXT: Record<
  Exclude<DynamicQuestionLocale, "en">,
  Record<
    string,
    {
      item: string;
      itemPlural: string;
      container: string;
      containerPlural: string;
    }
  >
> = {
  hi: {
    apple: { item: "सेब", itemPlural: "सेब", container: "टोकरा", containerPlural: "टोकरियाँ" },
    fish: { item: "मछली", itemPlural: "मछलियाँ", container: "कटोरा", containerPlural: "कटोरे" },
    egg: { item: "अंडा", itemPlural: "अंडे", container: "कार्टन", containerPlural: "कार्टन" },
    cookie: { item: "कुकी", itemPlural: "कुकीज़", container: "जार", containerPlural: "जार" },
    cupcake: { item: "कपकेक", itemPlural: "कपकेक", container: "ट्रे", containerPlural: "ट्रे" },
    gem: { item: "रत्न", itemPlural: "रत्न", container: "संदूक", containerPlural: "संदूक" },
  },
  zh: {
    apple: { item: "苹果", itemPlural: "苹果", container: "板条箱", containerPlural: "板条箱" },
    fish: { item: "鱼", itemPlural: "鱼", container: "碗", containerPlural: "碗" },
    egg: { item: "鸡蛋", itemPlural: "鸡蛋", container: "纸盒", containerPlural: "纸盒" },
    cookie: { item: "曲奇", itemPlural: "曲奇", container: "罐子", containerPlural: "罐子" },
    cupcake: { item: "纸杯蛋糕", itemPlural: "纸杯蛋糕", container: "托盘", containerPlural: "托盘" },
    gem: { item: "宝石", itemPlural: "宝石", container: "箱子", containerPlural: "箱子" },
  },
};

function getPairText(pair: GroupingPair, locale: DynamicQuestionLocale) {
  if (locale === "en") {
    return pair;
  }

  return LOCALIZED_PAIR_TEXT[locale][pair.item] ?? pair;
}

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
  const normalizedLocale = (locale === "hi" || locale === "zh" ? locale : "en") as DynamicQuestionLocale;
  const pairText = getPairText(question.pair, normalizedLocale);

  if (normalizedLocale === "hi") {
    const templates = [
      `यदि 1 ${pairText.container} में ${question.unitRate} ${pairText.itemPlural} हैं, तो ${question.groupsA} ${pairText.containerPlural} में कितने ${pairText.itemPlural} होंगे?`,
      `एक ${pairText.container} में ${question.unitRate} ${pairText.itemPlural} हैं। ${question.groupsA} ${pairText.containerPlural} में कितने ${pairText.itemPlural} होंगे?`,
      `हर ${pairText.container} में ${question.unitRate} ${pairText.itemPlural} हैं। ${question.groupsA} ${pairText.containerPlural} में कुल कितने ${pairText.itemPlural} होंगे?`,
      `एक ${pairText.container} में ${question.unitRate} ${pairText.itemPlural} भरे हैं। ${question.groupsA} ${pairText.containerPlural} भरने के लिए कितने ${pairText.itemPlural} चाहिए?`,
      `यदि एक ${pairText.container} में ${question.unitRate} ${pairText.itemPlural} हैं, तो ${question.groupsA} ${pairText.containerPlural} में कुल कितने ${pairText.itemPlural} होंगे?`,
      `${question.unitRate} ${pairText.itemPlural} 1 ${pairText.container} भरते हैं। ${question.groupsA} ${pairText.containerPlural} भरने के लिए कितने ${pairText.itemPlural} चाहिए?`,
      `एक ${pairText.container} में ठीक ${question.unitRate} ${pairText.itemPlural} आते हैं। ${question.groupsA} ${pairText.containerPlural} में कुल कितने ${pairText.itemPlural} होंगे?`,
      `${question.groupsA} ${pairText.containerPlural} में हर एक में ${question.unitRate} ${pairText.itemPlural} हैं। कुल कितने ${pairText.itemPlural} हैं?`,
    ];
    return templates[question.questionTemplateIndex] ?? templates[0];
  }

  if (normalizedLocale === "zh") {
    const templates = [
      `如果1个${pairText.container}里有${question.unitRate}${pairText.itemPlural}，那么${question.groupsA}${pairText.containerPlural}里一共有多少${pairText.itemPlural}？`,
      `一个${pairText.container}里有${question.unitRate}${pairText.itemPlural}。${question.groupsA}${pairText.containerPlural}里有多少${pairText.itemPlural}？`,
      `每个${pairText.container}里有${question.unitRate}${pairText.itemPlural}。${question.groupsA}${pairText.containerPlural}里总共有多少${pairText.itemPlural}？`,
      `一个${pairText.container}装有${question.unitRate}${pairText.itemPlural}。装满${question.groupsA}${pairText.containerPlural}需要多少${pairText.itemPlural}？`,
      `如果一个${pairText.container}里有${question.unitRate}${pairText.itemPlural}，那么${question.groupsA}${pairText.containerPlural}里一共有多少${pairText.itemPlural}？`,
      `${question.unitRate}${pairText.itemPlural}装满1个${pairText.container}。装满${question.groupsA}${pairText.containerPlural}需要多少${pairText.itemPlural}？`,
      `一个${pairText.container}正好能装${question.unitRate}${pairText.itemPlural}。${question.groupsA}${pairText.containerPlural}一共能装多少${pairText.itemPlural}？`,
      `${question.groupsA}${pairText.containerPlural}里每个都装有${question.unitRate}${pairText.itemPlural}。总共有多少${pairText.itemPlural}？`,
    ];
    return templates[question.questionTemplateIndex] ?? templates[0];
  }

  const template =
    LEVEL_ONE_QUESTION_TEMPLATES[question.questionTemplateIndex] ??
    LEVEL_ONE_QUESTION_TEMPLATES[0];
  return template(question.pair, question.unitRate, question.groupsA);
}

export function getLocalizedLevelOneBlackboardSteps(
  question: Pick<PackQuestion, "pair" | "totalA" | "groupsA" | "unitRate">,
  locale: string,
) {
  const normalizedLocale = (locale === "hi" || locale === "zh" ? locale : "en") as DynamicQuestionLocale;
  const pairText = getPairText(question.pair, normalizedLocale);

  if (normalizedLocale === "hi") {
    return [
      `1 ${pairText.container} = ${question.unitRate} ${pairText.itemPlural}.`,
      `${question.groupsA} ${pairText.containerPlural} = ${question.groupsA} × ${question.unitRate} = ${question.totalA} ${pairText.itemPlural}.`,
    ];
  }

  if (normalizedLocale === "zh") {
    return [
      `1个${pairText.container} = ${question.unitRate}${pairText.itemPlural}。`,
      `${question.groupsA}${pairText.containerPlural} = ${question.groupsA} × ${question.unitRate} = ${question.totalA}${pairText.itemPlural}。`,
    ];
  }

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
