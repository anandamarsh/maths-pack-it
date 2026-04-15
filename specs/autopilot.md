# Autopilot — Pack It!

## Cheat codes (inherited from platform)
- `198081` — continuous autopilot: runs through all questions automatically
- `197879` — reveal answer: fills in correct answer for current question

## Scoring rule for autopilot
Max 1 point deducted per question regardless of how autopilot is invoked. See `game-logic.md` scoring rule section.

## Autopilot interaction per round

### L1 Load — drag autopilot
- Ghost cursor appears at items zone
- For each item to place: ghost drags item to target container with 200ms delay between items
- Container fill counter increments visually per drag
- Blackboard lines appear at normal pace as containers fill
- Total duration: ~(unitRate × groups × 200ms) per question

### L1 Pack — tap autopilot
- Ghost cursor taps each container in sequence
- 150ms between taps
- Holds on last tap to trigger streaming fill for remaining items

### L2–L3 — keypad autopilot
- Ghost cursor moves to keypad area
- Types correct answer digit by digit (100ms between digits)
- Taps Submit
- Animation plays normally

### L4 — keypad autopilot
- Same as L2–L3 but no animation follows

## Timing constants
```typescript
const AUTOPILOT_DRAG_DELAY_MS = 200;     // between each item drag
const AUTOPILOT_TAP_DELAY_MS = 150;      // between container taps
const AUTOPILOT_TYPE_DELAY_MS = 100;     // between keypad digits
const AUTOPILOT_SUBMIT_DELAY_MS = 400;   // after last digit before submit
const AUTOPILOT_NEXT_Q_DELAY_MS = 800;   // after feedback before next question
```

## Challenge-round autopilot notes
- **Ship round**: autopilot types answer then commits — same as other rounds, no special handling needed (the "commit first" mechanic is just submit-before-animate, which autopilot already does)
- No separate challenge round in this game — all rounds handled by the same autopilot logic
