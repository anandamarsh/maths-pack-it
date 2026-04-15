# Game Loop — Pack It!

## Source file
`src/GameLoop.tsx`

## Top-level screens
```
playing → levelComplete → playing (next level) → ... → gameComplete
```

## Game phases (within each question)

```
waitingForInput
  → (L1 Load) dragging / tapping items
  → (L2–L4) keypadEntry
  → submitting
  → feedbackCorrect   → nextQuestion (or levelComplete)
  → feedbackWrong     → waitingForInput (same question, pointsDeductedThisQuestion = true)
  → phantom           → feedbackCorrect → nextQuestion
```

## Level × round matrix

| Level | Round | Phase sequence | Keypad? |
|-------|-------|---------------|---------|
| L1 | Load | drag/tap → auto-answer → feedbackCorrect | Hidden |
| L1 | Pack | drag/tap → keypadEntry → submit → feedback | Visible |
| L1 | Ship | keypadEntry → submit → drag/tap animation confirms | Visible |
| L2 | Load | keypadEntry → submit → animation plays | Visible |
| L2 | Pack | keypadEntry → submit → animation plays | Visible |
| L2 | Ship | keypadEntry → submit → minimal animation | Visible |
| L3 | Load | keypadEntry step 1 (unit) → auto-shows → keypadEntry step 2 → animation | Visible |
| L3 | Pack | keypadEntry → submit → animation | Visible |
| L3 | Ship | keypadEntry → submit → brief confirmation only | Visible |
| L4 | Load | keypadEntry → submit → no animation (text confirmation) | Visible |
| L4 | Pack | keypadEntry → submit → no animation | Visible |
| L4 | Ship | keypadEntry → submit → no animation, timed | Visible |

## State variables

```typescript
// Session state
const [level, setLevel] = useState<1|2|3|4>(1);
const [round, setRound] = useState<'load'|'pack'|'ship'>('load');
const [questions, setQuestions] = useState<PackQuestion[]>([]);
const [questionIndex, setQuestionIndex] = useState(0);
const [score, setScore] = useState(0);             // running total, max 120
const [phase, setPhase] = useState<Phase>('waitingForInput');
const [screen, setScreen] = useState<'playing'|'levelComplete'|'gameComplete'>('playing');

// Per-question state
const [pointsDeductedThisQuestion, setPointsDeductedThisQuestion] = useState(false);
const [inputValue, setInputValue] = useState('');
const [isWrong, setIsWrong] = useState(false);

// Animation state
const [itemPositions, setItemPositions] = useState<ItemPosition[]>([]);
const [blackboardLines, setBlackboardLines] = useState<string[]>([]);
const [unitRateRevealed, setUnitRateRevealed] = useState(false);
```

## Key refs
```typescript
const autopilotRef = useRef<AutopilotController | null>(null);
const canvasRef = useRef<HTMLDivElement>(null);
const keypadRef = useRef<KeypadHandle>(null);
```

## Core functions

```typescript
// Start a new round
function startRound(level: number, round: RoundName) {
  const gameRound = makeRound(level, round);
  setQuestions(gameRound.questions);
  setQuestionIndex(0);
  setScore(prev => prev); // score carries across rounds
  resetQuestion();
}

// Reset per-question state
function resetQuestion() {
  setPointsDeductedThisQuestion(false);
  setInputValue('');
  setIsWrong(false);
  setBlackboardLines([]);
  setUnitRateRevealed(false);
  setPhase('waitingForInput');
}

// Handle submit (keypad Submit button or Enter key)
function handleSubmit(value: string) {
  const q = questions[questionIndex];
  const correct = validateAnswer(q, value);
  if (correct) {
    handleCorrect();
  } else {
    handleWrong();
  }
}

function handleCorrect() {
  if (!pointsDeductedThisQuestion) setScore(s => s + 1);
  setPhase('feedbackCorrect');
  revealBlackboardFinalStep();
  setTimeout(() => advanceQuestion(), 1200);
}

function handleWrong() {
  if (!pointsDeductedThisQuestion) {
    setScore(s => s - 1);
    setPointsDeductedThisQuestion(true);
    showBlackboardCorrection();
  }
  setIsWrong(true);
  setPhase('feedbackWrong');
  setTimeout(() => setPhase('waitingForInput'), 800);
}

function advanceQuestion() {
  if (questionIndex + 1 >= questions.length) {
    // Round complete
    if (round === 'ship' && level === 4) {
      setScreen('gameComplete');
    } else if (round === 'ship') {
      setScreen('levelComplete');
    } else {
      const nextRound = round === 'load' ? 'pack' : 'ship';
      startRound(level, nextRound);
    }
  } else {
    setQuestionIndex(i => i + 1);
    resetQuestion();
  }
}

// L1 Load: item dropped into container
function handleItemDrop(itemId: string, containerId: string) {
  // Update itemPositions
  // When container reaches target count → trigger auto-correct
  const q = questions[questionIndex];
  if (containerFillCount(containerId) === q.unitRate) {
    appendBlackboardLine(`1 ${q.pair.container} → ${q.unitRate} ${q.pair.itemPlural}`);
    if (allContainersFull()) {
      appendBlackboardLine(`${q.groupsA} ${q.pair.containerPlural} → ${q.totalA} ${q.pair.itemPlural}`);
      handleCorrect(); // L1 Load is auto-correct on completion
    }
  }
}
```

## Physical keyboard support
- `0–9`, `.`: append digit to input
- `Backspace`: delete last character
- `Enter`: submit
- `Escape`: clear input

## Question text per phase

| Phase | L1 Load | L2–L3 | L4 |
|-------|---------|-------|-----|
| waitingForInput | "Pack [N] [items] into [G] [containers]" | Full question text | Full question text |
| feedbackCorrect | "✓ [unit] [items] per [container]" | "✓ [answer] [unit]" | "✓ [answer] [unit]" |
| feedbackWrong | "Try again" | "Not quite — try again" | "Not quite — try again" |

## Secondary HUD elements

### Blackboard panel
- Position: right 25% of canvas
- Background: `#2D5A1B` (dark green)
- Text: chalk-white `#F5F5DC`, font: `Caveat` or `Patrick Hand` (Google Fonts)
- Lines build one at a time with a chalk-write animation (`playChalkWrite` SFX)
- On wrong answer: incorrect step shown in red chalk, then overwritten with correct step
- Lines persist for the question, cleared on `resetQuestion()`

### Item counter badge
- Small pill badge above each container: `"3/5"` (filled/target)
- Appears in L1; hidden in L4

### Unit rate badge
- Appears once unit rate is established (after L1 packing complete, or after step 1 in L3)
- Shows: `"4 apples per crate"`
- Fades out when moving to next question

## Level background theming

```css
/* CSS custom properties set on .game-canvas per level × round */
--bg-l1-load:  #FFF3CD;
--bg-l1-pack:  #FFE082;
--bg-l1-ship:  #F5C842;

--bg-l2-load:  #D4EDDA;
--bg-l2-pack:  #A8D5B5;
--bg-l2-ship:  #4CAF7D;

--bg-l3-load:  #D1ECF1;
--bg-l3-pack:  #9FD8E4;
--bg-l3-ship:  #2196A8;

--bg-l4-load:  #E8D5F5;
--bg-l4-pack:  #C9A7E8;
--bg-l4-ship:  #7B2FBE;
```

## Game-complete screen
Shows:
1. Animation: full blackboard with representative working steps from the session (3–5 examples, one per level)
2. Final score: `[correct] / 120 correct — [accuracy]% accuracy`
3. PDF report button
4. Share button

## Scroll prevention
`document.body.style.overflow = 'hidden'` on mount. Touch events on canvas use `e.preventDefault()` to block scroll.

## JSX structure

```jsx
<div className="pack-it-game">
  <Toolbar />
  <div className="game-canvas" style={{ background: currentBackground }}>
    <div className="items-zone">
      {/* Draggable/tappable item sprites */}
    </div>
    <div className="containers-zone">
      {/* Container sprites with fill counters */}
    </div>
    <div className="blackboard-panel">
      <BlackboardDisplay lines={blackboardLines} />
    </div>
    {unitRateRevealed && <UnitRateBadge rate={currentUnitRate} pair={currentPair} />}
  </div>
  <QuestionBox text={questionText} isWrong={isWrong} />
  <ProgressRow count={10} filled={correctThisRound} emoji={currentPair.itemEmoji} />
  {showKeypad && (
    <NumericKeypad
      ref={keypadRef}
      value={inputValue}
      onChange={setInputValue}
      onSubmit={handleSubmit}
      allowDecimal={level >= 3}
      allowFraction={level >= 3}
    />
  )}
</div>
```

## Autopilot wiring
- Cheat code `198081`: continuous autopilot — runs `makeAutopilotSteps()` for each question, executes ghost interaction
- Cheat code `197879`: reveal answer — types correct answer into keypad
- Both: score deduction applies per standard scoring rule (max 1 per question)
- L1 Load autopilot: ghost drag items one by one with 200ms delay each
- L1 Pack autopilot: ghost taps containers
- L2–L4 autopilot: ghost types answer + submit
