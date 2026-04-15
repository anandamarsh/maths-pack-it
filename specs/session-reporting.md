# Session Reporting — Pack It!

## Report reader
Teacher and parent.

## Per-question data fields
```typescript
type PackQuestionRecord = {
  questionNumber: number;
  level: 1 | 2 | 3 | 4;
  round: 'load' | 'pack' | 'ship';
  questionText: string;      // IXL-style word problem, e.g. "36 coins shared equally among 4 piggy banks. How many coins per piggy bank?"
  childAnswer: number | string;
  correctAnswer: number | string;
  isCorrect: boolean;
  pointsDeducted: number;    // 0 or 1
  timeTaken: number;         // seconds
  blackboardSteps: string[]; // the working steps for this question
  pair: string;              // e.g. "coins / piggy banks"
};
```

## Question card diagram spec
Each question card (70×42mm on A4 PDF) shows:
- Left side: the grouping diagram — containers drawn as simple rectangles, items as dots/circles inside, count labelled
- Right side: the 2–3 blackboard working steps in a small chalkboard-style box
- Example for "20 apples, 5 crates, answer = 4":
  ```
  [🍎🍎🍎🍎] [🍎🍎🍎🍎] [🍎🍎🍎🍎] [🍎🍎🍎🍎] [🍎🍎🍎🍎]  │ 5 crates → 20 apples
   crate 1     crate 2     crate 3     crate 4     crate 5   │ 1 crate → 4 apples
  ```
- For fraction questions: half-filled items shown (circle half-shaded)

## Curriculum statement (for share/email copy)
> "Practising the unitary method — NSW Mathematics K–10 Stage 4, Ratios and Rates (MA4-RAT-C-01)"

## Report structure (inherits platform defaults, game-specific additions)
1. Header: Pack It! icon, game name, date, child name (if set)
2. Score summary: total questions, correct, wrong, accuracy %, time spent
3. Level breakdown table: per level × round — questions, correct, accuracy
4. Question cards: one per question (question text, child answer, correct answer, diagram, blackboard steps)
5. Encouragement message: "Great packing! You're getting the hang of the unitary method."
6. Curriculum note: MA4-RAT-C-01 statement
7. Footer: platform branding

## Encouragement copy variants
- ≥90% accuracy: "Outstanding packing! You've mastered the unitary method."
- 70–89%: "Great packing! You're getting the hang of the unitary method."
- 50–69%: "Good effort! Keep practising — you're building strong maths skills."
- <50%: "Keep going! Every question you pack makes you stronger at ratios."
