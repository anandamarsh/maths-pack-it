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
  minTotalCount: 20,
  maxTotalCount: 40,
  maxGroupCount: 5,
  maxUnitCount: 5,
};

const DESKTOP_ROUND_PROFILE: RoundGenerationProfile = {
  minTotalCount: 20,
  maxTotalCount: 80,
  maxGroupCount: 8,
  maxUnitCount: 10,
};

function getLevelTwoRoundProfile(
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

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LEVEL_TWO_LOAD_QUESTION_TEMPLATES = [
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
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} are packed into ${groups} equal ${pair.containerPlural}. How many ${pair.itemPlural} are in one ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `There are ${groups} ${pair.containerPlural} to fill and ${total} ${pair.itemPlural} altogether. How many ${pair.itemPlural} go into each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${total} ${pair.itemPlural} are shared into ${groups} equal groups. Find how many ${pair.itemPlural} each ${pair.container} gets.`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `A total of ${total} ${pair.itemPlural} must be placed equally into ${groups} ${pair.containerPlural}. What is the number in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `${groups} ${pair.containerPlural} hold the same number of ${pair.itemPlural}. If there are ${total} ${pair.itemPlural}, how many are in each ${pair.container}?`,
  (
    pair: GroupingPair,
    total: number,
    groups: number,
  ) =>
    `When ${total} ${pair.itemPlural} are divided equally among ${groups} ${pair.containerPlural}, how many ${pair.itemPlural} does each ${pair.container} contain?`,
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
  const templateCount = LEVEL_TWO_LOAD_QUESTION_TEMPLATES.length;

  if (templateCount <= 1) {
    return 0;
  }

  let templateIndex = randInt(0, templateCount - 1, random);
  if (previousTemplateIndex !== null && templateIndex === previousTemplateIndex) {
    templateIndex = (templateIndex + 1) % templateCount;
  }
  return templateIndex;
}

function buildLevelTwoBlackboardSteps(
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

export function getLocalizedLevelTwoQuestionText(
  question: Pick<
    PackQuestion,
    "pair" | "questionTemplateIndex" | "totalA" | "groupsA"
  >,
  locale: string,
) {
  const normalizedLocale = (locale === "hi" || locale === "zh" ? locale : "en") as DynamicQuestionLocale;
  const pairText = getPairText(question.pair, normalizedLocale);

  if (normalizedLocale === "hi") {
    const templates = [
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर-बराबर रखना है। हर ${pairText.container} में कितने ${pairText.itemPlural} होंगे?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर बाँटा गया है। हर ${pairText.container} में कितने ${pairText.itemPlural} होंगे?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में समान रूप से बाँटना है। हर ${pairText.container} में कितने ${pairText.itemPlural} आएँगे?`,
      `एक कामगार ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर भरता है। 1 ${pairText.container} में कितने ${pairText.itemPlural} जाएँगे?`,
      `${question.groupsA} ${pairText.containerPlural} का उपयोग ${question.totalA} ${pairText.itemPlural} को बराबर पैक करने के लिए किया जाता है। हर ${pairText.container} में कितने ${pairText.itemPlural} होंगे?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर पैक किया गया। हर ${pairText.container} में कितने ${pairText.itemPlural} रखे गए?`,
      `एक दुकानदार ने ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर सजाया। हर ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `${question.totalA} ${pairText.itemPlural} से ${question.groupsA} ${pairText.containerPlural} बराबर भरते हैं। 1 ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `यदि ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर बाँटा जाए, तो हर ${pairText.container} में कितने ${pairText.itemPlural} जाएँगे?`,
      `${question.groupsA} ${pairText.containerPlural} में समान संख्या में ${pairText.itemPlural} हैं। यदि कुल ${question.totalA} ${pairText.itemPlural} हैं, तो हर ${pairText.container} में कितने जाएँगे?`,
      `एक बेकरी को ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर पैक करना है। हर ${pairText.container} में कितने ${pairText.itemPlural} पैक होंगे?`,
      `${question.groupsA} ${pairText.containerPlural} और ${question.totalA} ${pairText.itemPlural} हैं जिन्हें बराबर बाँटना है। हर ${pairText.container} को कितने ${pairText.itemPlural} मिलेंगे?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर बाँटा जा रहा है। हर ${pairText.container} में ${pairText.itemPlural} की संख्या क्या है?`,
      `कुल ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में समान रूप से रखा गया है। हर ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर समूहों में रखना है। हर समूह में कितने ${pairText.itemPlural} हैं?`,
      `कामगारों ने ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में रखा, और हर ${pairText.container} में समान मात्रा है। हर ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `सभी ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर बाँटना है। हर ${pairText.container} में कितने ${pairText.itemPlural} होंगे?`,
      `${question.groupsA} ${pairText.containerPlural} को ${question.totalA} ${pairText.itemPlural} से बराबर भरा जाता है। हर ${pairText.container} में ${pairText.itemPlural} की संख्या ज्ञात कीजिए।`,
      `${question.totalA} ${pairText.itemPlural} और ${question.groupsA} ${pairText.containerPlural} का उपयोग करके समान समूह बनाए जाते हैं। हर ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} बराबर ${pairText.containerPlural} में पैक किया गया है। 1 ${pairText.container} में कितने ${pairText.itemPlural} हैं?`,
      `${question.groupsA} ${pairText.containerPlural} भरने हैं और कुल ${question.totalA} ${pairText.itemPlural} हैं। हर ${pairText.container} में कितने ${pairText.itemPlural} जाएँगे?`,
      `${question.totalA} ${pairText.itemPlural} को ${question.groupsA} बराबर समूहों में बाँटा गया है। हर ${pairText.container} को कितने ${pairText.itemPlural} मिलते हैं, ज्ञात कीजिए।`,
      `कुल ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर रखना है। हर ${pairText.container} में कितने होंगे?`,
      `${question.groupsA} ${pairText.containerPlural} में ${pairText.itemPlural} की संख्या समान है। यदि कुल ${question.totalA} ${pairText.itemPlural} हैं, तो हर ${pairText.container} में कितने हैं?`,
      `जब ${question.totalA} ${pairText.itemPlural} को ${question.groupsA} ${pairText.containerPlural} में बराबर बाँटा जाता है, तब हर ${pairText.container} में कितने ${pairText.itemPlural} होते हैं?`,
    ];

    return templates[question.questionTemplateIndex];
  }

  if (normalizedLocale === "zh") {
    const templates = [
      `${question.totalA}${pairText.itemPlural}要平均放入${question.groupsA}${pairText.containerPlural}中。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}平均分到${question.groupsA}${pairText.containerPlural}中。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}需要平均分进${question.groupsA}${pairText.containerPlural}。每个${pairText.container}能装多少${pairText.itemPlural}？`,
      `一位工人把${question.totalA}${pairText.itemPlural}平均装入${question.groupsA}${pairText.containerPlural}。1个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.groupsA}${pairText.containerPlural}用来平均装${question.totalA}${pairText.itemPlural}。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}被平均装进${question.groupsA}${pairText.containerPlural}。每个${pairText.container}里放了多少${pairText.itemPlural}？`,
      `店主把${question.totalA}${pairText.itemPlural}平均摆进${question.groupsA}${pairText.containerPlural}。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}平均装满${question.groupsA}${pairText.containerPlural}。1个${pairText.container}里有多少${pairText.itemPlural}？`,
      `如果把${question.totalA}${pairText.itemPlural}平均分到${question.groupsA}${pairText.containerPlural}中，每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.groupsA}${pairText.containerPlural}里都有相同数量的${pairText.itemPlural}。如果一共有${question.totalA}${pairText.itemPlural}，每个${pairText.container}里有多少？`,
      `一家烘焙店需要把${question.totalA}${pairText.itemPlural}平均装进${question.groupsA}${pairText.containerPlural}。每个${pairText.container}要装多少${pairText.itemPlural}？`,
      `有${question.groupsA}${pairText.containerPlural}和${question.totalA}${pairText.itemPlural}需要平均分。每个${pairText.container}应分到多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}正在平均分进${question.groupsA}${pairText.containerPlural}。每个${pairText.container}中的${pairText.itemPlural}数量是多少？`,
      `总共${question.totalA}${pairText.itemPlural}被平均放入${question.groupsA}${pairText.containerPlural}。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}必须平均分成${question.groupsA}${pairText.containerPlural}。每组有多少${pairText.itemPlural}？`,
      `工人们把${question.totalA}${pairText.itemPlural}放进${question.groupsA}${pairText.containerPlural}，每个${pairText.container}里的数量都相同。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `全部${question.totalA}${pairText.itemPlural}要平均分到${question.groupsA}${pairText.containerPlural}里。每个${pairText.container}里会有多少${pairText.itemPlural}？`,
      `${question.groupsA}${pairText.containerPlural}都被${question.totalA}${pairText.itemPlural}平均装满。求每个${pairText.container}中的${pairText.itemPlural}数量。`,
      `用${question.totalA}${pairText.itemPlural}和${question.groupsA}${pairText.containerPlural}组成相等的组。每个${pairText.container}里有多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}被装入${question.groupsA}个相等的${pairText.containerPlural}中。1个${pairText.container}里有多少${pairText.itemPlural}？`,
      `有${question.groupsA}${pairText.containerPlural}要装满，一共有${question.totalA}${pairText.itemPlural}。每个${pairText.container}里要放多少${pairText.itemPlural}？`,
      `${question.totalA}${pairText.itemPlural}被分成${question.groupsA}个相等的组。求每个${pairText.container}分到多少${pairText.itemPlural}。`,
      `总共${question.totalA}${pairText.itemPlural}必须平均放入${question.groupsA}${pairText.containerPlural}。每个${pairText.container}里有多少？`,
      `${question.groupsA}${pairText.containerPlural}里装着相同数量的${pairText.itemPlural}。如果总共有${question.totalA}${pairText.itemPlural}，那么每个${pairText.container}里有多少？`,
      `当${question.totalA}${pairText.itemPlural}平均分给${question.groupsA}${pairText.containerPlural}时，每个${pairText.container}里有多少${pairText.itemPlural}？`,
    ];

    return templates[question.questionTemplateIndex];
  }

  return LEVEL_TWO_LOAD_QUESTION_TEMPLATES[question.questionTemplateIndex](
    question.pair,
    question.totalA,
    question.groupsA,
  );
}

export function getLocalizedLevelTwoBlackboardSteps(
  question: Pick<PackQuestion, "pair" | "totalA" | "groupsA" | "unitRate">,
  locale: string,
) {
  const normalizedLocale = (locale === "hi" || locale === "zh" ? locale : "en") as DynamicQuestionLocale;
  const pairText = getPairText(question.pair, normalizedLocale);

  if (normalizedLocale === "hi") {
    return [
      `कुल ${pairText.itemPlural} = ${question.totalA}.`,
      `कुल ${pairText.containerPlural} = ${question.groupsA}.`,
      `∴ प्रति ${pairText.container} ${pairText.itemPlural} = ${question.totalA} ÷ ${question.groupsA} = ${question.unitRate}.`,
    ];
  }

  if (normalizedLocale === "zh") {
    return [
      `${pairText.itemPlural}总数 = ${question.totalA}。`,
      `${pairText.containerPlural}总数 = ${question.groupsA}。`,
      `∴ 每个${pairText.container}中的${pairText.itemPlural} = ${question.totalA} ÷ ${question.groupsA} = ${question.unitRate}。`,
    ];
  }

  return buildLevelTwoBlackboardSteps(
    question.pair,
    question.totalA,
    question.groupsA,
    question.unitRate,
  );
}

export function getLocalizedInsufficientItemsLabel(
  pair: GroupingPair,
  locale: string,
) {
  const normalizedLocale = (locale === "hi" || locale === "zh" ? locale : "en") as DynamicQuestionLocale;
  const pairText = getPairText(pair, normalizedLocale);

  if (normalizedLocale === "hi") {
    return `पर्याप्त ${pairText.itemPlural} नहीं हैं`;
  }

  if (normalizedLocale === "zh") {
    return `${pairText.itemPlural}不足`;
  }

  return `Insufficient ${pair.itemPlural}`;
}

export function createLevelTwoQuestion(
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
  const questionText = LEVEL_TWO_LOAD_QUESTION_TEMPLATES[templateIndex](
    pair,
    total,
    groups,
  );

  return {
    level: 2,
    round,
    subtype: "find-unit",
    questionTemplateIndex: templateIndex,
    pair,
    totalA: total,
    groupsA: groups,
    unitRate: unit,
    answer: unit,
    answerUnit: `${pair.itemPlural} per ${pair.container}`,
    questionText,
    blackboardSteps: buildLevelTwoBlackboardSteps(pair, total, groups, unit),
    isFraction: false,
  };
}

function createLevelTwoRound(
  round: RoundName,
  profile: RoundGenerationProfile,
  random: () => number = Math.random,
): RoundConfig {
  const usedPairs: GroupingPair[] = [];
  let previousTemplateIndex: number | null = null;
  const questions = Array.from({ length: 10 }, () => {
    const question = createLevelTwoQuestion(
      round,
      profile,
      usedPairs,
      random,
      previousTemplateIndex,
    );
    usedPairs.push(question.pair);
    previousTemplateIndex = LEVEL_TWO_LOAD_QUESTION_TEMPLATES.findIndex(
      (template) =>
        template(question.pair, question.totalA, question.groupsA) ===
        question.questionText,
    );
    return question;
  });

  return {
    level: 2,
    round,
    questions,
  };
}

export function createLevelTwoLoadQuestion(
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
  return createLevelTwoQuestion(
    "load",
    getLevelTwoRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelTwoPackQuestion(
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
  return createLevelTwoQuestion(
    "pack",
    getLevelTwoRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelTwoShipQuestion(
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
  return createLevelTwoQuestion(
    "ship",
    getLevelTwoRoundProfile(isMobile),
    usedPairs,
    random,
    resolvedPreviousTemplateIndex,
  );
}

export function createLevelTwoLoadRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelTwoRound(
    "load",
    getLevelTwoRoundProfile(isMobile, overrides),
    random,
  );
}

export function createLevelTwoPackRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelTwoRound(
    "pack",
    getLevelTwoRoundProfile(isMobile, overrides),
    random,
  );
}

export function createLevelTwoShipRound(
  isMobile = false,
  random: () => number = Math.random,
  overrides?: RoundGenerationOverrides,
): RoundConfig {
  return createLevelTwoRound(
    "ship",
    getLevelTwoRoundProfile(isMobile, overrides),
    random,
  );
}
