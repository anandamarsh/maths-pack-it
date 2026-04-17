import { pickPair, randInt } from "../shared.ts";
import type {
  GroupingPair,
  PackQuestion,
  RoundConfig,
  RoundGenerationProfile,
  RoundName,
} from "../types.ts";

const MOBILE_ROUND_PROFILE: RoundGenerationProfile = {
  minTotalCount: 20,
  maxTotalCount: 80,
  maxGroupCount: 8,
  maxUnitCount: 10,
};

const DESKTOP_ROUND_PROFILE: RoundGenerationProfile = {
  minTotalCount: 20,
  maxTotalCount: 80,
  maxGroupCount: 8,
  maxUnitCount: 10,
};

function getLevelOneRoundProfile(isMobile: boolean): RoundGenerationProfile {
  return isMobile ? MOBILE_ROUND_PROFILE : DESKTOP_ROUND_PROFILE;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LEVEL_ONE_LOAD_QUESTION_TEMPLATES = [
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `There are ${total} ${pair.itemPlural} that have to be packed equally into ${groups} ${pair.containerPlural}. How many shall each ${pair.container} have?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} are shared equally among ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} should go in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} need to be divided evenly into ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} will each ${pair.container} hold?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `A worker packs ${total} ${pair.itemPlural} into ${groups} ${pair.containerPlural} equally. How many ${pair.itemPlural} go into 1 ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${groups} ${pair.containerPlural} are used to package ${total} ${pair.itemPlural} equally. How many ${pair.itemPlural} belong in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} were packed into ${groups} ${pair.containerPlural} equally. How many ${pair.itemPlural} were placed in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `A shopkeeper arranged ${total} ${pair.itemPlural} evenly into ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} are in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} fill ${groups} ${pair.containerPlural} equally. How many ${pair.itemPlural} does 1 ${pair.container} hold?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `If ${total} ${pair.itemPlural} are split evenly across ${groups} ${pair.containerPlural}, how many ${pair.itemPlural} go into each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${groups} ${pair.containerPlural} each get the same number of ${pair.itemPlural}. If there are ${total} ${pair.itemPlural} altogether, how many go in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `A bakery needs to pack ${total} ${pair.itemPlural} evenly into ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} should be packed into each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `There are ${groups} ${pair.containerPlural} and ${total} ${pair.itemPlural} to share equally. How many ${pair.itemPlural} should each ${pair.container} get?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} are being distributed evenly into ${groups} ${pair.containerPlural}. What is the number of ${pair.itemPlural} in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `A total of ${total} ${pair.itemPlural} are sorted equally into ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} does each ${pair.container} contain?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} must be grouped equally into ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} are in each group?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `Workers placed ${total} ${pair.itemPlural} into ${groups} ${pair.containerPlural}, with each ${pair.container} holding the same amount. How many ${pair.itemPlural} are in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `All ${total} ${pair.itemPlural} are to be shared evenly between ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} will each ${pair.container} have?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${groups} ${pair.containerPlural} are filled equally with ${total} ${pair.itemPlural}. Find the number of ${pair.itemPlural} in each ${pair.container}.`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `Equal groups are made using ${total} ${pair.itemPlural} and ${groups} ${pair.containerPlural}. How many ${pair.itemPlural} are in each ${pair.container}?`,
] as const;

function pickQuestionTemplateIndex(
  previousTemplateIndex: number | null,
  random: () => number,
) {
  const templateCount = LEVEL_ONE_LOAD_QUESTION_TEMPLATES.length;

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
    `Total ${pair.itemPlural} = ${total}.`,
    `Total ${pair.containerPlural} = ${groups}.`,
    `∴ ${capitalize(pair.itemPlural)} per ${pair.container} = ${total} ÷ ${groups} = ${unit}.`,
  ];
}

export function createLevelOneQuestion(
  round: RoundName,
  profile: RoundGenerationProfile,
  usedPairs: GroupingPair[] = [],
  random: () => number = Math.random,
  previousTemplateIndex: number | null = null,
): PackQuestion {
  const pair = pickPair(usedPairs, random);
  const minGroups = Math.max(
    2,
    Math.ceil(profile.minTotalCount / profile.maxUnitCount),
  );
  const groups = randInt(minGroups, profile.maxGroupCount, random);
  const minUnit = round === "load" ? 2 : 3;
  const minUnitFromTotal = Math.max(minUnit, Math.ceil(profile.minTotalCount / groups));
  const maxUnit = Math.max(
    minUnitFromTotal,
    Math.min(
      profile.maxUnitCount,
      Math.floor(profile.maxTotalCount / groups),
    ),
  );
  const unit = randInt(minUnitFromTotal, maxUnit, random);
  const total = groups * unit;
  const templateIndex = pickQuestionTemplateIndex(previousTemplateIndex, random);
  const questionText = LEVEL_ONE_LOAD_QUESTION_TEMPLATES[templateIndex](
    pair,
    total,
    groups,
  );

  return {
    level: 1,
    round,
    subtype: "find-unit",
    pair,
    totalA: total,
    groupsA: groups,
    unitRate: unit,
    answer: unit,
    answerUnit: `${pair.itemPlural} per ${pair.container}`,
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
    previousTemplateIndex = LEVEL_ONE_LOAD_QUESTION_TEMPLATES.findIndex(
      (template) =>
        template(question.pair, question.totalA, question.groupsA) ===
        question.questionText,
    );
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
  isMobileOrRandom: boolean | (() => number) = false,
  random: () => number = Math.random,
): RoundConfig {
  const isMobile = typeof isMobileOrRandom === "boolean" ? isMobileOrRandom : false;
  const resolvedRandom =
    typeof isMobileOrRandom === "function" ? isMobileOrRandom : random;
  return createLevelOneRound("load", getLevelOneRoundProfile(isMobile), resolvedRandom);
}

export function createLevelOnePackRound(
  isMobileOrRandom: boolean | (() => number) = false,
  random: () => number = Math.random,
): RoundConfig {
  const isMobile = typeof isMobileOrRandom === "boolean" ? isMobileOrRandom : false;
  const resolvedRandom =
    typeof isMobileOrRandom === "function" ? isMobileOrRandom : random;
  return createLevelOneRound("pack", getLevelOneRoundProfile(isMobile), resolvedRandom);
}

export function createLevelOneShipRound(
  isMobileOrRandom: boolean | (() => number) = false,
  random: () => number = Math.random,
): RoundConfig {
  const isMobile = typeof isMobileOrRandom === "boolean" ? isMobileOrRandom : false;
  const resolvedRandom =
    typeof isMobileOrRandom === "function" ? isMobileOrRandom : random;
  return createLevelOneRound("ship", getLevelOneRoundProfile(isMobile), resolvedRandom);
}
