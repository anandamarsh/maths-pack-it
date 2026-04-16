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
| L1 Load round | Drag fixed item combos into containers |
| L1 Pack / Ship rounds | Tap container to add one item; hold to stream |
| L2–L3 all rounds | Type answer on keypad → animation plays |
| L4 all rounds | Type answer on keypad → no animation |

Keypad: standard platform numeric keypad (digits, backspace, decimal, Submit). It remains visible in every round as part of the consistent template layout; in guided rounds it can act as a passive display rather than an active input.

## Screens

### Playing screen
- **Top strip**: toolbar icons + level buttons + progress row
- **Main playfield**: large clean packing area with containers and a loading bay
- **No floating instructional text inside the playfield**
- **Overall theme**: dark UI chrome and dark play surface, not a light worksheet theme
- **Each container shows a digital counter** in odometer / digital-clock style at its top-right corner; the count increments and decrements live as items move in and out
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

### L1 — Discover the unit
Question language should follow worksheet / IXL-style natural word-problem phrasing, with a large bank of sentence patterns rather than one repeated stem. Runtime values should be slotted into varied templates such as:

> "There are [total] [items] that have to be packed equally into [groups] [containers]. How many shall each [container] have?"
> "[total] [items] are shared equally among [groups] [containers]. How many [items] should go in each [container]?"
> "[total] [items] need to be divided evenly into [groups] [containers]. How many [items] will each [container] hold?"

The wording bank should be broad enough that a short round feels varied rather than repetitive; no two consecutive generated questions should use the same wording template.

Child packs physically. Steps panel should reveal full worked lines such as:

`Total gems = 6.`
`Total chests = 3.`
`∴ Gems per chest = 6 ÷ 3 = 2.`

These should appear using the same character-by-character typewriter/click sequence as the question, one line at a time with about a 1 second gap before the next line starts after a correct submit, or after the robot finishes its correct demonstration. Numbers and division-keyword words should be highlighted yellow; `∴`, `=`, and `÷` should be green. After the full final line is typed, wait about 3 seconds and then show an inline filled button on that same final line. The inline button should be compact enough not to jitter the line height noticeably. For a normal correct solve it should say `Next question` and advance only when pressed. For a robot-demonstrated solve it should say `Now you try it` and reset that same question when pressed.

Example: "There are 20 cupcakes that have to be packed equally into 5 boxes. How many shall each box have?" → unit = 4 cupcakes per box.

Numbers: groups 2–4, unit 2–6, total ≤24. Whole numbers only.

Load-round drag rule: the child does not pick up just one loose item. Picking one loose item should also select enough following loose items to match the number of boxes in that question, skipping over any empty source gaps left by earlier moves. Those linked items should first glow in place, then join the main item when the drag actually lifts. Only the top/right first box is an active drop target; lower boxes are read-only display boxes. When the combo is dropped, all selected items should first land in the top box together, then the extra items should animate downward into the lower boxes so the final equal distribution is shown. Right-side box-to-box redistribution is not allowed. Dragging a placed combo back should only be possible from the top box, and it should bring that remembered combo back to the source side as a group, preserving the source gaps/slots they came from.

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
| 1 | **Load** | Fully guided — child sees items pack; answer appears automatically; keypad stays visible as passive scaffold |
| 2 | **Pack** | Child types answer; that number drives the animation (containers fill to that count) |
| 3 | **Ship** | Child types answer and commits first; animation plays afterwards to confirm right/wrong |

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
