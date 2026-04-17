# Brief: Pack It!

## Teaching objective
The child learns the **unitary method**: given a total quantity and a number of equal groups, find the value per group — then use that unit rate to scale to any new quantity. After playing, the child can reliably:
1. Identify the unit rate from two given quantities (find A ÷ B)
2. Apply the unit rate to find a new total (unit × new groups)
3. Apply the unit rate to find new groups (total ÷ unit)
This maps directly to IXL 7th Grade L.5 (Unit rates) and L.7 (Word problems using unit rates).

## Age group
10–13 (Year 6–7)

## Curriculum standard(s)
| Level | Code | Description |
|-------|------|-------------|
| L1–L2 | MA3-MR-01 | Stage 3 — selects and applies appropriate strategies to solve multiplication and division problems |
| L3–L4 | MA4-RAT-C-01 | Stage 4 — solves problems involving ratios and rates (unitary method explicitly named in teaching advice) |

## Primary interaction
- **L1 Load round**: drag individual items into containers (max 24 items on screen)
- **L1 Pack/Ship rounds**: tap container to add items one at a time; hold to stream
- **L2–L3 all rounds**: type answer on numeric keypad → animation plays
- **L4 all rounds**: type answer on numeric keypad → no animation (pure text)

## Mechanic
Items (apples, coins, fish, etc.) are grouped into containers (crates, piggy banks, bowls, etc.). The child physically creates, reads, and applies the grouping. A **blackboard panel** on the right of the canvas shows the unitary method working in chalk notation, built step by step as the child plays.

## Levels (question type per level)

| Level | Name | Concept | Question type |
|-------|------|---------|---------------|
| L1 | Discover the unit | Given total + groups → find unit rate | Physically pack items into containers |
| L2 | Use the unit | Given unit rate + groups OR unit rate + total → find the missing value | One-step calculation, visual still present |
| L3 | Apply the unit | Given total + groups → find unit rate → apply to new scenario | Two-step full unitary method; fractions introduced |
| L4 | Textbook | Any direction, any solve-for, plain text format | Identical to IXL/worksheet wording, no visual |

## Challenge rounds (within each level)
Each level has 3 rounds, named:

| Round | Name | Scaffold state |
|-------|------|----------------|
| Round 1 | **Load** | Fully assisted — drag/tap, answer appears automatically |
| Round 2 | **Pack** | Semi-assisted — child types answer, that drives the animation |
| Round 3 | **Ship** | Unassisted — child types answer first, commits, animation confirms right/wrong |

## Questions
- 10 questions per round
- **L1**: groups 2–4, unit rate 2–6, totals up to 24, whole numbers only
- **L2**: groups 2–8, unit rate 2–8, totals up to 48, whole numbers only
- **L3**: groups 2–10, unit rate 2–10, totals up to 60; fractions introduced (½, ¼, ⅓)
- **L4**: groups 2–12, unit rate 2–10, totals up to 100; fractions and decimals
- Numbers always generate clean answers (no remainders), except intentional fraction questions
- No two consecutive questions use the same grouping pair
- Randomised each session

## Grouping pairs (12 total, rotated across questions)
| Items | Container |
|-------|-----------|
| Apples | Crates |
| Coins | Piggy banks |
| Children | Buses |
| Monkeys | Cages |
| Fish | Bowls |
| Eggs | Egg cartons |
| Cookies | Cookie jars |
| Gems | Treasure chests |
| Cupcakes | Baking trays |
| Puppies | Baskets |
| Books | Shelves |
| Strawberries | Punnets |

## Feedback & game feel
- Correct: +1 progress unit, satisfying pack/fill animation, correct SFX
- First wrong: −1 progress unit, item bounces back, blackboard shows correct working
- Subsequent wrong: no further deduction, question stays active
- Phantom (autopilot): ghost clicks/drags solve visually; costs max 1 point if not already deducted
- **Question never advances until answered correctly** (by child or phantom)
- Round complete: all items "shipped" with delivery animation + level-complete SFX
- Game complete: full blackboard shown with all steps from session

## Theme & visuals
- Name: **Pack It!**
- Style: bright, clean, cartoonish — each grouping pair has its own colour palette
- Blackboard: right-side panel, dark green with chalk-white text, builds live as child plays
- Rendering: HTML/CSS for items and containers (div-based animation); blackboard is SVG text
- Item sprites: simple flat-design SVGs, small enough for 6–10 per group on screen
- Fraction visual: split item sprite (half apple, cracked egg, broken cookie)

## Level background theming
| Level | Background | Round 3 (Ship) variant |
|-------|-----------|------------------------|
| L1 | Warm yellow `#FFF3CD` | Deeper amber `#F5C842` |
| L2 | Soft green `#D4EDDA` | Deeper green `#4CAF7D` |
| L3 | Light blue `#D1ECF1` | Deeper teal `#2196A8` |
| L4 | Pale purple `#E8D5F5` | Deeper purple `#7B2FBE` |

## Secondary HUD elements
- **Blackboard panel**: right 25% of canvas; chalk-style font; shows unitary working built step by step
  - L1: `5 boxes → 20 apples` / `1 box → 4 apples`
  - L3+: `20 apples ÷ 5 boxes = 4 per box` / `8 boxes × 4 = 32 apples`
- **Item counter badge**: small number above each container showing current fill count
- **Unit rate badge**: appears after unit rate is established, shown as `[N] per box`

## Sound
- Normal rounds (L1–L3): upbeat, light arcade loop (pattern 1)
- L4 (textbook): calm, focused loop (pattern 2)
- SFX additions beyond standard set:
  - `playItemDrop`: soft thud when item lands in container
  - `playItemBounce`: bounce when wrong answer returns items
  - `playShip`: satisfying "whoosh + ding" when round ships successfully
  - `playChalkWrite`: soft chalk scratch when blackboard text appears

## Session report
- Per question card shows:
  - Question text (exact IXL-style wording, e.g. "36 coins were shared equally among 4 piggy banks. How many coins per piggy bank?")
  - Child's answer vs correct answer
  - Small canvas diagram: grouping pair with item count and container count labelled
  - Blackboard working for that question (the 2–3 step unitary method)
- Report reader: teacher and parent
- Curriculum statement for share copy: "Practising the unitary method — NSW Stage 4 MA4-RAT-C-01"

## Responsive / screen size
- Large screen (≥768px landscape): up to 10 items per group, full blackboard panel visible
- Mobile landscape (<768px): max 6 items per group, blackboard panel collapsed (tap to expand)
- Portrait mobile: show "Please rotate your device or use a tablet for the best experience"
- Minimum recommended: tablet in landscape (768×1024)

## Out of scope (v1)
- Multiplayer / leaderboards
- User accounts / progress saving across sessions
- Custom difficulty settings
- Speed / time-based rate problems (separate game)
- Rate conversion (km/h → m/s etc.)
- Best-buy comparison questions

## Notes & assumptions
- Deviates from template default: **4 levels** (template default is 2–3)
- Deviates from template default: **3 named rounds per level** (Load/Pack/Ship vs single round)
- Deviates from template default: **drag interaction in L1 Load** (template default is keypad only)
- Fundamental scoring rule: max 1 point lost per question regardless of retry count or phantom use; question never advances until correct (documented in BA.md and must be implemented in template)
- Fraction answers accepted as decimal (0.5) or fraction string (1/2) — both treated as correct
- Dev server port: **4005**
- Game slug: **pack-it**
