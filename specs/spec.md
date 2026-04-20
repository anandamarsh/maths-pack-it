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

A **bottom steps panel** displays the unitary-method working as it is revealed through play. The playfield itself should stay visually clean, with no instructional copy floating inside it.

## Primary interaction

| Context | Interaction |
|---------|-------------|
| L1 all rounds | Add (+) or remove (−) test tubes that each start pre-filled with the unit count; keypad commits answer from Round 2 |
| L2 Load round | Drag fixed item combos from the left source into containers on the right |
| L2 Pack / Ship rounds | Tap container to add one item; hold to stream |
| L3 all rounds | Type answer on keypad → animation plays |
| L4 all rounds | Type answer on keypad → no animation |

Keypad: standard platform numeric keypad (digits, backspace, decimal, Submit). It remains visible in every round as part of the consistent template layout; in guided rounds it can act as a passive display rather than an active input.

## Screens

### Playing screen
- **Top strip**: toolbar icons + level buttons + progress row
- **Main playfield**: large clean packing area with containers and a loading bay
- **No floating instructional text inside the playfield**
- **Overall theme**: dark UI chrome and dark play surface, not a light worksheet theme
- **Each container shows a digital counter** in odometer / digital-clock style at its top-right corner; the count increments and decrements live as items move in and out
- **L1 only — progress bar under the tubes**: horizontal fractional bar. Filled segment = current tube count ÷ target tube count. Filled colour is blue while under 100%. At exactly 100% it turns green and flashes to signal "done". If the child overshoots, it turns red and flashes / beeps to signal "too far". Unfilled portion is neutral grey.
- **Bottom dock**:
  - question panel
  - steps / revealed working panel
  - keypad panel
  - text panel and keypad panel should be the same visual height
- Loading bay and box areas should not have filled card backgrounds; rely on border and layout instead

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

### L1 — Scale the unit (multiplication, replicate a full box)
L1 introduces the unitary method through **multiplication only**. The question always gives a fully filled "1 box" as a starting picture and asks the child to scale it up.

Question phrasing follows natural worksheet / IXL-style sentences such as:

> "If 1 box has [unit] [items], how many [items] would be in [groups] boxes?"
> "Each [container] holds [unit] [items]. How many [items] are in [groups] [containers]?"
> "One [container] is filled with [unit] [items]. [Groups] identical [containers] hold how many [items] in total?"

Wording bank should be broad enough that a short round feels varied; no two consecutive generated questions should use the same wording template.

Steps panel should reveal working such as:

`1 box = 5 apples.`
`5 boxes = 5 × 5 = 25 apples.`

These appear with the same typewriter/click sequence used elsewhere, one line at a time, ~1 s gap before the next line starts after a correct submit. Numbers and multiplication-keyword words (`×`, `times`, `each`, `per`, `in total`) are highlighted yellow; `∴`, `=`, and `×` are green. After the final line is typed, wait ~3 s and show an inline `Next question` / `Now you try it` button on that same line (same rules as other levels).

Example: "If 1 box has 5 apples, how many apples are in 7 boxes?" → 35.

Numbers: unit 3–8, groups 3–8, target total ≤ 64. Whole numbers only.

**L1 playfield mechanic — test-tube replicator**

- No left / source side at all. The playfield is the right-hand "packed" side only.
- Round starts with **one static test tube** already pre-filled with `unit` items; that tube represents "1 box" stated in the question. It has no badges and cannot be deleted.
- Every tube the child adds beyond the first shows two badges:
  - **+** badge (top-right): tapping duplicates that tube (creates one more identical full tube).
  - **−** badge (top-left): tapping deletes that tube immediately — no confirmation.
- The **count readout** at the bottom multiplies / subtracts in steps of `unit` as tubes are added/removed (starts at `unit`; with `k` tubes it reads `k × unit`).
- A **progress bar** sits under the tubes and shows fill = (current tube count) / (target tube count):
  - Starts at 1 / target filled.
  - Fills as tubes are added.
  - At **exactly 100%** it turns green and **flashes** to cue the child that they've reached the answer. This is the "done" signal.
  - If the child goes **beyond 100%** the bar turns **red** and flashes / beeps to cue "too far". Removing tubes returns it to blue/green as appropriate.
  - Default filled colour below 100% is **blue**.

### L2 — Discover the unit (division, drag from source)
L2 keeps the packing mechanic that was previously shown at L1: items arrive loose on a **left source area** and must be dragged in groups into the **right containers**.

Question phrasing stays the IXL-style divide-equally wording, e.g.:

> "There are [total] [items] that have to be packed equally into [groups] [containers]. How many shall each [container] have?"
> "[total] [items] are shared equally among [groups] [containers]. How many [items] should go in each [container]?"

Steps panel reveals:

`Total gems = 6.`
`Total chests = 3.`
`∴ Gems per chest = 6 ÷ 3 = 2.`

Numbers and division-keyword words highlighted yellow; `∴`, `=`, and `÷` green. Inline `Next question` / `Now you try it` button rules same as other levels.

Example: "There are 20 cupcakes that have to be packed equally into 5 boxes. How many shall each box have?" → unit = 4 cupcakes per box.

Numbers: groups 2–4, unit 2–6, total ≤24. Whole numbers only.

Load-round drag rule (unchanged from the former L1): the child does not pick up just one loose item. Picking one loose item selects enough following loose items to match the number of boxes, skipping empty source gaps. Linked items glow first, then follow when the drag lifts. Only the top/right first box is an active drop target; lower boxes are read-only display boxes. When the combo is dropped, all selected items first land in the top box and then the extras animate down into the lower boxes. Right-side box-to-box redistribution is not allowed. Dragging a placed combo back is only possible from the top box and returns the combo to the source side as a group preserving its source gaps.

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
| Correct | A green tick icon falls from the top-left, then the blackboard step appears | `playCorrect` + `playItemDrop` | +1 |
| First wrong on a question | A red cross icon falls from the top-left; boxes simply keep their current state | `playWrong` + `playItemBounce` | −1 |
| Subsequent wrong attempts on the same question | Same red cross, no extra penalty | `playWrong` | 0 |
| Phantom used | Ghost clicks/drags solve it; if first wrong not yet deducted → −1 | `playCorrect` at end | −1 or 0 |
| Round complete | All items fly off screen in "ship" animation | `playLevelComplete` + `playShip` | — |

**Question never advances until answered correctly**, whether by child or phantom.

## Win / loss conditions
- 10 questions per round × 3 rounds × 4 levels = 120 questions total per full game
- No fail state — the child always completes the game
- Final score = total correct out of 120 (max 120 points)
- Each question can lose at most 1 point, even if the child submits multiple wrong answers before eventually getting it right
- Accuracy % shown on game-complete screen and PDF report

## Robot / demo help
- Pressing the robot / question-demo help for a question deducts that question's one allowed point if it has not already been lost.
- The robot should drag more slowly than the child interaction, show the correct packing, and then reveal a `Now you try it` button at the top middle of the playfield.
- Pressing `Now you try it` should animate all items back to the left/source side and return control to the child.
- After robot help has been used, later right/wrong attempts on that question must not change the score again.
- The only effect of a correct answer after robot help is that the game may advance to the next question.

## Challenge rounds
The 3 rounds within each level act as the scaffolding-removal arc:

| Round | Name | What changes |
|-------|------|-------------|
| 1 | **Load** | Fully guided — child experiments with the physical mechanic; the live count and progress bar update as they play; the answer appears automatically when the target is reached; keypad stays visible as passive scaffold |
| 2 | **Pack** | Child still plays with the physical mechanic, but they must type the final answer into the keypad to commit. Count/progress bar still update live during play |
| 3 | **Ship** | Child must type the answer first; the physical mechanic (e.g. tubes in L1) then animates to confirm. The live count and auto-reveal are disabled until after commit |

This is the challenge arc — no separate named challenge round. The "Ship" round is the equivalent of Monster/Platinum in other games.

## Accessibility
- All containers and items have ARIA labels
- Keyboard navigable: Tab to select container, Enter to add item (L1), standard keypad navigation (L2–L4)
- Minimum tap target: 44×44px for all interactive elements
- Item count badge always visible (not colour-only feedback)
- Digital counters on containers must remain readable at a glance
- Screen reader announces: "[N] [items] added to [container]. [M] remaining."

## UI notes from implementation feedback
- Do not write visible instructional text anywhere outside the bottom dock.
- Question text is white by default, with numbers and keywords such as `pack`, `equally`, and `evenly` highlighted in yellow.
- Division-signalling words such as `equal`, `same`, `even`, `divide`, and `distribute` should also be highlighted.
- The question should reveal one character at a time with a light typewriter-style tick sound.
- The steps panel should only show revealed working, not generic instructions.

## Out of scope (v1)
- Multiplayer / leaderboards
- User accounts / cross-session progress
- Custom difficulty
- Speed / time rate problems
- Rate conversion (km/h → m/s)
- Best-buy comparison
- Non-integer group counts
