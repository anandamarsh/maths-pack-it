# Autopilot Mode — Playbook

> This file documents the autopilot feature as step-by-step test steps.
> They read like a manual QA script but are executed programmatically by
> `useAutopilot.ts` and verified by `tests/autopilot.spec.ts`.

---

## Cheat Codes

| Code     | Action |
|----------|--------|
| `197879` | **Show Answer** — instantly fills the keypad with the correct answer and submits (one-off, does not start autopilot) |
| `198081` | **Toggle Autopilot** — activates or deactivates autopilot mode; clears the calculator display on activation |

Type the digits consecutively on the keyboard. Non-digit keys reset the buffer.
When a code matches, `stopImmediatePropagation()` fires so the final digit is never added to the calculator display.

---

## Step 1 — Activate Autopilot

1. Game is open and in `tapping` phase (waiting for canvas taps).
2. User types `198081` on the keyboard.
3. **VERIFY:** Calculator display is cleared to `0`.
4. **VERIFY:** A green blinking robot icon appears in the toolbar.
5. **VERIFY:** Icon pulses in a fade-in → stay → fade-out cycle (~2 s period).

---

## Step 2 — Tapping Phase (autopilot plays)

Always exactly **3 taps** per round (both levels).

1. Wait `640–1100 ms` before the first tap (human "noticing" delay).
2. Choose a random canvas position: `normX ∈ [0.15, 0.85]`, `normY ∈ [0.15, 0.80]`.
3. Move phantom hand (green) to that screen position.
4. Wait `~100 ms` (hand travel animation).
5. Scale phantom hand down (`0.82×`) to simulate click press.
6. Call `simulateTap(normX, normY)` — creates ripple, plays sound, increments tap counter.
7. Scale hand back to normal.
8. Wait `760–1400 ms` before next tap.
9. Repeat until `tapCount === 3`.

**VERIFY:** Ripples appear at random screen positions.
**VERIFY:** Egg counter increments with each tap (1 egg per tap, 3 eggs total).
**VERIFY:** After the 3rd tap, game transitions to `answering` phase.

---

## Step 3 — Answering Phase (autopilot types and submits)

1. Wait `1400–2400 ms` (simulated reading/thinking time).
2. Roll `Math.random()`: if `< 0.20`, choose a **wrong answer** (`correct ± 1–3`, clamped 1–20); otherwise use the correct answer.
3. Move phantom hand toward the first digit button.
4. For each digit of the chosen answer:
   a. Move phantom hand to that digit's button (`data-autopilot-key="<digit>"`).
   b. Dispatch `el.click()` on the button — fires the full `press()` handler: plays tick sound, flashes the key, updates the display.
   c. Wait `360–680 ms` before next digit.
5. Wait an additional `440–760 ms`.
6. Move phantom hand to submit button (`data-autopilot-key="submit"`).
7. Click animation + call `submitAnswer()`.
8. Hide phantom hand.

**VERIFY:** Keypad display shows digits being typed one by one with tick sounds.
**VERIFY:** 20% of answers are incorrect (wrong answer submitted, counted in accuracy).
**VERIFY:** Feedback message appears ("Correct!" or "Wrong! It was X").

---

## Step 4 — Feedback Phase

1. Game shows feedback for ~1200 ms automatically.
2. Autopilot does nothing during this phase — the game timer handles progression.

**VERIFY:** Feedback message appears and disappears, then a new round begins.

---

## Step 5 — Level Complete

When all 3 eggs are collected the game enters `levelComplete` phase and shows `SessionReportModal`.

1. Wait `2000–3200 ms` (simulated reading delay).
2. Move phantom hand to the email input (`data-autopilot-key="email-input"`).
3. Click the email input to focus it; clear any existing value.
4. Type `AUTOPILOT_EMAIL` character by character (`8–15 ms` per character — near instant).
5. Wait `700–1100 ms` after last character.
6. Move phantom hand to the send button (`data-autopilot-key="email-send"`).
7. Click send — dispatches the report email with PDF attachment.
8. Wait `3600–5000 ms`.
9. **If level < 2:**
   - Move phantom hand to the **Next Level** button (`data-autopilot-key="next-level"`).
   - Click it — game advances to the next level.
10. **If level = 2 (final):**
    - Halt autopilot (robot icon disappears).
    - Leave the Level 2 modal visible for the user.

**VERIFY:** Email is sent to `AUTOPILOT_EMAIL` with PDF report attached.
**VERIFY:** At end of Level 1, phantom hand clicks "Next Level" button.
**VERIFY:** At end of Level 2, robot icon disappears; modal stays on screen.
**VERIFY:** Level 2 report includes all questions from both Level 1 and Level 2 (cumulative).

---

## Step 6 — Cancel Autopilot

**Option A — click robot icon:**
1. Click the green robot icon in the toolbar.
2. **VERIFY:** Icon disappears.
3. **VERIFY:** Phantom hand disappears.
4. **VERIFY:** All scheduled autopilot timers are cancelled.
5. **VERIFY:** Game remains in its current phase, ready for manual play.

**Option B — type `198081` again:**
1. Type `198081` on keyboard while autopilot is active.
2. Same verification as Option A.

---

## Timing Reference

| Action | Delay |
|--------|-------|
| Before first tap | 640–1100 ms |
| Between canvas taps | 760–1400 ms |
| Before typing answer | 1400–2400 ms |
| Between keypad digits | 360–680 ms |
| Before submitting answer | 440–760 ms |
| Before typing email | 2000–3200 ms |
| Between email characters | 8–15 ms |
| After last email char, before send | 700–1100 ms |
| After send, before Next Level click | 3600–5000 ms |

All ranges are uniformly random to simulate human timing variation.

---

## Implementing Autopilot in a New Game

1. Copy these files from the template:
   - `src/hooks/useCheatCode.ts`
   - `src/hooks/useAutopilot.ts`
   - `src/components/PhantomHand.tsx`
   - `src/components/AutopilotIcon.tsx`
2. Add `@keyframes autopilot-blink` to your `index.css`.
3. Add `data-autopilot-key` attributes to interactive elements:
   - `data-autopilot-key="<digit>"` on each digit button (0–9)
   - `data-autopilot-key="submit"` on the submit/check button
   - `data-autopilot-key="email-input"` on the email `<input>` in the report modal
   - `data-autopilot-key="email-send"` on the send button in the report modal
   - `data-autopilot-key="next-level"` on the Next Level button in the report modal
4. In your game screen component:
   - Create an `autopilotCallbacksRef` with: `simulateTap`, `setCalcValue`, `submitAnswer`, `goNextLevel`, `playAgain`, `restartAll`, `emailModalControls`, `onAutopilotComplete`.
   - Call `useAutopilot({ gameState, callbacksRef, canvasRef, autopilotEmail })`.
   - Call `useCheatCodes({ "198081": toggle, "197879": showAnswer })`.
   - Pass `isAutopilot`, `onCancelAutopilot`, `forceKeypadExpanded` to your layout component.
   - Render `<PhantomHand pos={phantomPos} />` outside the layout (fixed overlay).
5. In your report modal:
   - Accept `autopilotControlsRef` prop; on mount populate it with `{ appendChar, setEmail, triggerSend }`.
6. In your layout component:
   - Accept and render `<AutopilotIcon onClick={onCancelAutopilot} />` when `isAutopilot` is true.
   - Pass `forceKeypadExpanded` to your keypad to override its minimized state.
7. Set `AUTOPILOT_EMAIL` constant to the desired recipient.
8. Run `tests/autopilot.spec.ts` to verify end-to-end.
