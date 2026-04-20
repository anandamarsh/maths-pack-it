# Game Logic — Pack It!

## Source file
`src/game-logic.ts`

## Types

```typescript
type GroupingPair = {
  item: string;          // e.g. 'apple'
  itemPlural: string;    // e.g. 'apples'
  container: string;     // e.g. 'crate'
  containerPlural: string; // e.g. 'crates'
  itemEmoji: string;     // e.g. '🍎'
  containerEmoji: string;// e.g. '📦'
  palette: string;       // CSS colour for this pair's accent
};

type PackQuestion = {
  level: 1 | 2 | 3 | 4;
  round: 'load' | 'pack' | 'ship';
  subtype: 'find-unit' | 'find-total' | 'find-groups' | 'apply-unit-groups' | 'apply-unit-total';
  pair: GroupingPair;
  // The three quantities — always two given, one is the answer
  totalA: number;        // known total (L1/L3 source)
  groupsA: number;       // known groups (L1/L3 source)
  unitRate: number;      // items per container (may be fraction: 0.5, 0.25, 0.333)
  // For L3/L4: the scaling scenario
  totalB?: number;       // new total (given or to find)
  groupsB?: number;      // new groups (given or to find)
  answer: number;        // the correct answer
  answerUnit: string;    // e.g. 'apples' or 'crates'
  questionText: string;  // bottom-dock question string
  blackboardSteps: string[]; // lines to display in the bottom steps panel, built progressively
  isFraction: boolean;
};

type GameRound = {
  level: 1 | 2 | 3 | 4;
  round: 'load' | 'pack' | 'ship';
  questions: PackQuestion[];
};
```

## Grouping pairs registry

```typescript
const GROUPING_PAIRS: GroupingPair[] = [
  { item: 'apple',      itemPlural: 'apples',      container: 'crate',       containerPlural: 'crates',        itemEmoji: '🍎', containerEmoji: '📦', palette: '#E74C3C' },
  { item: 'coin',       itemPlural: 'coins',        container: 'piggy bank',  containerPlural: 'piggy banks',   itemEmoji: '🪙', containerEmoji: '🐷', palette: '#F39C12' },
  { item: 'child',      itemPlural: 'children',     container: 'bus',         containerPlural: 'buses',         itemEmoji: '👧', containerEmoji: '🚌', palette: '#F1C40F' },
  { item: 'monkey',     itemPlural: 'monkeys',      container: 'cage',        containerPlural: 'cages',         itemEmoji: '🐒', containerEmoji: '🔲', palette: '#8E44AD' },
  { item: 'fish',       itemPlural: 'fish',         container: 'bowl',        containerPlural: 'bowls',         itemEmoji: '🐟', containerEmoji: '🫙', palette: '#2980B9' },
  { item: 'egg',        itemPlural: 'eggs',         container: 'carton',      containerPlural: 'cartons',       itemEmoji: '🥚', containerEmoji: '📋', palette: '#BDC3C7' },
  { item: 'cookie',     itemPlural: 'cookies',      container: 'jar',         containerPlural: 'jars',          itemEmoji: '🍪', containerEmoji: '🫙', palette: '#D35400' },
  { item: 'gem',        itemPlural: 'gems',         container: 'chest',       containerPlural: 'chests',        itemEmoji: '💎', containerEmoji: '🎁', palette: '#1ABC9C' },
  { item: 'cupcake',    itemPlural: 'cupcakes',     container: 'tray',        containerPlural: 'trays',         itemEmoji: '🧁', containerEmoji: '🗂️', palette: '#E91E63' },
  { item: 'puppy',      itemPlural: 'puppies',      container: 'basket',      containerPlural: 'baskets',       itemEmoji: '🐶', containerEmoji: '🧺', palette: '#795548' },
  { item: 'book',       itemPlural: 'books',        container: 'shelf',       containerPlural: 'shelves',       itemEmoji: '📚', containerEmoji: '🪵', palette: '#607D8B' },
  { item: 'strawberry', itemPlural: 'strawberries', container: 'punnet',      containerPlural: 'punnets',       itemEmoji: '🍓', containerEmoji: '🟥', palette: '#C0392B' },
];
```

## Level calculators

### L1 generator — `makeL1Question(round, usedPairs)`

```typescript
// New L1: scaling up a fully filled "1 box".
// Given: unitRate (items per box) and groups (target box count). Unknown: total.
// Subtype: always 'find-total'
// Constraints: unit 3–8, groups 3–8, total = groups × unit, target total ≤ 64
// Round Load: child replicates tubes; count + progress bar update live; answer appears automatically when target reached
// Round Pack: child replicates tubes freely but must type the total into the keypad to commit; count + progress bar still live
// Round Ship: child must commit total on keypad first; tubes then animate to confirm (live count + auto-reveal disabled)

function makeL1Question(round: 'load'|'pack'|'ship', usedPairs: GroupingPair[]): PackQuestion {
  const pair = pickPair(usedPairs);
  const unit = randInt(3, 8);
  const groups = randInt(3, 8);
  const total = groups * unit;
  return {
    level: 1, round, subtype: 'find-total', pair,
    totalA: total, groupsA: groups, unitRate: unit,
    answer: total,
    answerUnit: pair.itemPlural,
    questionText: `If 1 ${pair.container} holds ${unit} ${pair.itemPlural}, how many ${pair.itemPlural} would be in ${groups} ${pair.containerPlural}?`,
    blackboardSteps: [
      `1 ${pair.container} = ${unit} ${pair.itemPlural}.`,
      `${groups} ${pair.containerPlural} = ${groups} × ${unit} = ${total} ${pair.itemPlural}.`,
    ],
    isFraction: false,
  };
}
```

### L2 generator — `makeL2Question(round, usedPairs)`

```typescript
// Former L1 mechanic relocated here: discover the unit by dragging items
// from a left source area into right-hand containers.
// Subtype: always 'find-unit'
// Constraints: groups 2–4, unit 2–6, total = groups × unit ≤ 24, whole numbers only

function makeL2Question(round: 'load'|'pack'|'ship', usedPairs: GroupingPair[]): PackQuestion {
  const pair = pickPair(usedPairs);
  const groups = randInt(2, 4);
  const unit = randInt(2, 6);
  const total = groups * unit;
  return {
    level: 2, round, subtype: 'find-unit', pair,
    totalA: total, groupsA: groups, unitRate: unit,
    answer: unit,
    answerUnit: `${pair.itemPlural} per ${pair.container}`,
    questionText: `There are ${total} ${pair.itemPlural} that have to be packed equally into ${groups} ${pair.containerPlural}. How many shall each ${pair.container} have?`,
    blackboardSteps: [
      `Total ${pair.itemPlural} = ${total}.`,
      `Total ${pair.containerPlural} = ${groups}.`,
      `∴ ${pair.itemPlural} per ${pair.container} = ${total} ÷ ${groups} = ${unit}.`,
    ],
    isFraction: false,
  };
}
```

### L3 generator — `makeL3Question(round, usedPairs)`

```typescript
// Two-step unitary method. Two directions:
//   'apply-unit-groups': given (totalA, groupsA), find groupsB for new totalB
//   'apply-unit-total':  given (totalA, groupsA), find totalB for new groupsB
// Fractions: when totalA < groupsA (e.g. 2 apples, 4 crates → ½ per crate)
// Fraction unit rates: 0.5 (½), 0.25 (¼), 0.333 (⅓)

function makeL3Question(round: 'load'|'pack'|'ship', usedPairs: GroupingPair[]): PackQuestion {
  const pair = pickPair(usedPairs);
  const useFraction = Math.random() < 0.25; // 25% fraction questions at L3
  const subtype = Math.random() < 0.5 ? 'apply-unit-groups' : 'apply-unit-total';

  let groupsA: number, unitRate: number, totalA: number;
  let isFraction = false;

  if (useFraction) {
    // unitRate is ½, ¼, or ⅓
    const fractions = [{ unit: 0.5, num: 1, den: 2 }, { unit: 0.25, num: 1, den: 4 }, { unit: 1/3, num: 1, den: 3 }];
    const f = fractions[randInt(0, 2)];
    groupsA = f.den * randInt(1, 3);     // e.g. 4, 8, 12
    unitRate = f.unit;
    totalA = groupsA * unitRate;         // e.g. 2, 4, 6
    isFraction = true;
  } else {
    groupsA = randInt(2, 10);
    unitRate = randInt(2, 10);
    totalA = groupsA * unitRate;
  }

  if (subtype === 'apply-unit-groups') {
    const groupsB = randInt(2, 12);
    const totalB = groupsB * unitRate;
    return {
      level: 3, round, subtype, pair,
      totalA, groupsA, unitRate,
      totalB, groupsB,
      answer: groupsB,
      answerUnit: pair.containerPlural,
      questionText: `${totalA} ${pair.itemPlural} filled ${groupsA} ${pair.containerPlural} equally. How many ${pair.containerPlural} are needed for ${totalB} ${pair.itemPlural}?`,
      blackboardSteps: [
        `${groupsA} ${pair.containerPlural} → ${totalA} ${pair.itemPlural}`,
        `1 ${pair.container} → ${totalA} ÷ ${groupsA} = ${formatUnit(unitRate)} ${pair.itemPlural}`,
        `${totalB} ${pair.itemPlural} ÷ ${formatUnit(unitRate)} = ${groupsB} ${pair.containerPlural}`,
      ],
      isFraction,
    };
  } else {
    const groupsB = randInt(2, 12);
    const totalB = groupsB * unitRate;
    return {
      level: 3, round, subtype, pair,
      totalA, groupsA, unitRate,
      totalB, groupsB,
      answer: totalB,
      answerUnit: pair.itemPlural,
      questionText: `${totalA} ${pair.itemPlural} filled ${groupsA} ${pair.containerPlural} equally. How many ${pair.itemPlural} fill ${groupsB} ${pair.containerPlural}?`,
      blackboardSteps: [
        `${groupsA} ${pair.containerPlural} → ${totalA} ${pair.itemPlural}`,
        `1 ${pair.container} → ${formatUnit(unitRate)} ${pair.itemPlural}`,
        `${groupsB} ${pair.containerPlural} → ${groupsB} × ${formatUnit(unitRate)} = ${totalB} ${pair.itemPlural}`,
      ],
      isFraction,
    };
  }
}
```

### L4 generator — `makeL4Question(round, usedPairs)`

```typescript
// Pure textbook format. All subtypes mixed randomly.
// Numbers: groups 2–12, unit 2–10, total ≤ 100
// Fractions and decimals included (~30% of questions)
// Question text matches IXL L.5/L.7 wording exactly.

function makeL4Question(round: 'load'|'pack'|'ship', usedPairs: GroupingPair[]): PackQuestion {
  // Same logic as L3 but wider number range, all subtypes, no visual
  // Includes 'find-unit' (L.5 style) mixed with 'apply-unit-*' (L.7 style)
  // ...see makeL3Question for structure; extend number ranges
}
```

## Shared helpers

```typescript
// Pick a pair not used in last 2 questions
function pickPair(recentPairs: GroupingPair[]): GroupingPair

// Random integer inclusive
function randInt(min: number, max: number): number

// Format unit rate as fraction string or integer
function formatUnit(unit: number): string
// 0.5 → '½', 0.25 → '¼', 0.333 → '⅓', 4 → '4'

// Check answer with tolerance for fractions
function checkAnswer(given: number | string, correct: number): boolean
// Accepts: '0.5', '1/2', '½', 0.5 — all match 0.5
```

## Facade contract

```typescript
// Called once per round
export function makeRound(level: 1|2|3|4, round: 'load'|'pack'|'ship'): GameRound

// Called per question to validate child's answer
export function validateAnswer(question: PackQuestion, given: string): boolean

// Called to generate autopilot sequence (ghost clicks/drags)
export function makeAutopilotSteps(question: PackQuestion): AutopilotStep[]
```

## Scoring rule (mandatory — platform-wide)
```typescript
// Per question state:
let pointsDeductedThisQuestion = false;

function onWrongAnswer(question: PackQuestion): ScoreEffect {
  if (!pointsDeductedThisQuestion) {
    pointsDeductedThisQuestion = true;
    return { delta: -1, showBlackboardCorrection: true };
  }
  return { delta: 0, showBlackboardCorrection: false };
}

function onPhantomUsed(question: PackQuestion): ScoreEffect {
  if (!pointsDeductedThisQuestion) {
    pointsDeductedThisQuestion = true;
    return { delta: -1 };
  }
  return { delta: 0 };
}

// Reset at start of each question
function onNextQuestion() {
  pointsDeductedThisQuestion = false;
}
// Question never advances (nextQuestion never called) until answer is correct.
```

## Unit test strategy
- `makeL1Question`: assert total = groups × unit, total ≤ 24, groups ≤ 4
- `makeL2Question`: assert find-total answer = groups × unit; find-groups answer = total ÷ unit
- `makeL3Question`: assert blackboardSteps[1] shows correct unit; answer matches direction
- `makeL4Question`: assert question text parses correctly; answer is correct
- `checkAnswer`: test '1/2', '0.5', '½' all match 0.5; test integer strings
- `validateAnswer` with fraction tolerance: ±0.01 for ⅓ rounding
- No two consecutive questions with same pair: test over 20 questions

## Input contract
Keypad sends a string (e.g. `"4"`, `"0.5"`, `"1/2"`). `validateAnswer` normalises and compares.

## Demo mode contract
`makeAutopilotSteps` returns an array of:
```typescript
type AutopilotStep =
  | { type: 'drag'; itemId: string; toContainerId: string; delay: number }
  | { type: 'tap'; containerId: string; delay: number }
  | { type: 'type'; value: string; delay: number }
  | { type: 'submit'; delay: number }
```
Phantom executes these steps with ghost cursor animation. Points deducted per scoring rule above.
