# Game Spec: Pack It!

## Teaching objective
The child masters the **unitary method**: extract the rate from a given (total, groups) pair, then apply it to scale. Specifically:
- Find the value of 1 unit by dividing (A ÷ B)
- Use the unit to find a new total (unit × new groups)
- Use the unit to find new groups (new total ÷ unit)

Target misconception: children (like Jai) can do the arithmetic but don't know which number to divide by which — they lack a felt sense of what a unit rate *is*. The drag-and-pack mechanic makes the direction physically unavoidable: you put apples *into* boxes, never boxes into apples.

## Age group
10–13 (Year 6–7, NSW Stage 3–4)

## Curriculum standard(s)
- **MA3-MR-01** — Stage 3: selects and applies strategies for multiplication and division (L1–L2)
- **MA4-RAT-C-01** — Stage 4: solves problems involving ratios and rates, including the unitary method (L3–L4)

## Mechanic
A **packing / grouping** game. Items arrive on screen and must be packed into containers. The core action — physically placing items into equal groups — makes the unit rate (items per container) tangible before any calculation is required.

A **blackboard panel** on the right side of the canvas displays the unitary method working in chalk notation, built live as the child plays, so the written method is learned implicitly alongside the game action.

## Primary interaction

| Context | Interaction |
|---------|-------------|
| L1 Load round | Drag individual items into containers |
| L1 Pack / Ship rounds | Tap container to add one item; hold to stream |
| L2–L3 all rounds | Type answer on keypad → animation plays |
| L4 all rounds | Type answer on keypad → no animation |

Keypad: standard platform numeric keypad (digits, backspace, decimal, Submit). Visible in L2–L4; hidden in L1 Load.

## Screens

### Playing screen
- **Canvas** (left ~75%): items + containers + blackboard panel
- **Question box**: floating card with question text (hidden in L1 Load — question emerges from play)
- **Progress row**: 10 item icons (theme-matched per grouping pair), filled = correct answers banked
- **Standard toolbar**: mute, restart, level dots, capture/share
- **Keypad**: collapsible, below canvas (hidden in L1 Load)

### Level complete screen
- All items "shipped" with delivery animation
- Score summary for the round
- PDF report option
- "Next Level" button

### Game complete screen
- Full blackboard shown with representative working steps from the session
- Final score and accuracy
- PDF report download + share

## Questions / problems

### L1 — Discover the unit
> "Pack [total] [items] equally into [groups] [containers]."

Child packs physically. Blackboard fills: `[groups] [containers] → [total] [items]` / `1 [container] → [unit] [items]`

Example: "Pack 20 apples equally into 5 crates." → unit = 4 apples per crate.

Numbers: groups 2–4, unit 2–6, total ≤24. Whole numbers only.

### L2 — Use the unit (one step)
Two sub-types, randomly mixed:

**Type A** — find total: "Each [container] holds [unit] [items]. You have [groups] [containers]. How many [items] in total?"
Example: "Each bowl holds 6 fish. You have 7 bowls. How many fish in total?" → 42

**Type B** — find groups: "There are [total] [items] and each [container] holds [unit]. How many [containers] do you need?"
Example: "There are 48 eggs and each carton holds 6. How many cartons?" → 8

Numbers: groups 2–8, unit 2–8, total ≤48. Whole numbers only.

### L3 — Apply the unit (two steps, full unitary method)
> "[Total A] [items] were packed into [groups A] [containers]. How many [containers/items] for [new value]?"

Child must: (1) find unit rate, (2) apply to new scenario.

Two directions:
- Find new groups: "20 apples fill 5 crates. How many crates for 40 apples?" → unit=4, answer=10
- Find new total: "20 apples fill 5 crates. How many apples fill 8 crates?" → unit=4, answer=32

Fractions introduced: "3 cookies fit in 6 jars. How many cookies per jar?" → ½

Numbers: groups 2–10, unit 2–10, total ≤60. Fractions: ½, ¼, ⅓.

### L4 — Textbook (IXL/worksheet format)
Plain text, any direction, any solve-for. No visual. Identical wording to IXL L.5 / L.7:
- "36 coins were shared equally among 4 piggy banks. How many coins per piggy bank?"
- "Each bus holds 9 children. How many buses are needed for 63 children?"
- "15 cookies were baked with 3 scoops of flour. With 7 scoops, how many cookies?"
- "2 puppies shared 4 baskets. How many baskets per puppy?"

Numbers: groups 2–12, unit 2–10, total ≤100. Fractions and decimals included.

## Feedback

| Event | Visual | Audio | Score |
|-------|--------|-------|-------|
| Correct | Items pack cleanly, progress icon fills, blackboard step appears | `playCorrect` + `playItemDrop` | +1 |
| First wrong | Items bounce back to start, blackboard shows correct working in red | `playWrong` + `playItemBounce` | −1 |
| Subsequent wrong | Same bounce, no score change | `playWrong` | 0 |
| Phantom used | Ghost clicks/drags solve it; if first wrong not yet deducted → −1 | `playCorrect` at end | −1 or 0 |
| Round complete | All items fly off screen in "ship" animation | `playLevelComplete` + `playShip` | — |

**Question never advances until answered correctly**, whether by child or phantom.

## Win / loss conditions
- 10 questions per round × 3 rounds × 4 levels = 120 questions total per full game
- No fail state — the child always completes the game
- Final score = total correct out of 120 (max 120 points)
- Accuracy % shown on game-complete screen and PDF report

## Challenge rounds
The 3 rounds within each level act as the scaffolding-removal arc:

| Round | Name | What changes |
|-------|------|-------------|
| 1 | **Load** | Fully guided — child sees items pack; answer appears automatically; keypad hidden |
| 2 | **Pack** | Child types answer; that number drives the animation (containers fill to that count) |
| 3 | **Ship** | Child types answer and commits first; animation plays afterwards to confirm right/wrong |

This is the challenge arc — no separate named challenge round. The "Ship" round is the equivalent of Monster/Platinum in other games.

## Accessibility
- All containers and items have ARIA labels
- Keyboard navigable: Tab to select container, Enter to add item (L1), standard keypad navigation (L2–L4)
- Minimum tap target: 44×44px for all interactive elements
- Item count badge always visible (not colour-only feedback)
- Screen reader announces: "[N] [items] added to [container]. [M] remaining."

## Out of scope (v1)
- Multiplayer / leaderboards
- User accounts / cross-session progress
- Custom difficulty
- Speed / time rate problems
- Rate conversion (km/h → m/s)
- Best-buy comparison
- Non-integer group counts
