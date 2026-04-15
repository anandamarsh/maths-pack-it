# Pack It!

Pack It! is an interactive maths game that teaches the **unitary method** through a satisfying packing and grouping mechanic. Children drag items into containers, discover the unit rate by doing, and progressively work up to solving textbook-style word problems — without ever feeling like they're doing homework.

The game targets the exact misconception seen in IXL 7th Grade L.5 and L.7: children who can do arithmetic but don't know *which number to divide by which*. By physically placing apples into crates (never crates into apples), the correct direction becomes embodied before any calculation is required.

## Teaching objective
Master the unitary method:
1. Given a total and a number of equal groups, find the value of 1 unit (A ÷ B)
2. Use the unit rate to find a new total (unit × new groups)
3. Use the unit rate to find new groups (new total ÷ unit)

## Age group
10–13 (Year 6–7)

## Curriculum mapping
| Level | Standard | Description |
|-------|----------|-------------|
| L1–L2 | MA3-MR-01 | Stage 3 — selects and applies strategies for multiplication and division |
| L3–L4 | MA4-RAT-C-01 | Stage 4 — solves problems involving ratios and rates (unitary method) |

## Game structure
| Level | Name | Concept |
|-------|------|---------|
| L1 | Discover the unit | Physically pack items to find the unit rate |
| L2 | Use the unit | One-step calculation using a given rate |
| L3 | Apply the unit | Full two-step unitary method; fractions introduced |
| L4 | Textbook | IXL/worksheet format, any direction, no visual |

Each level has 3 rounds: **Load** (guided) → **Pack** (semi-guided) → **Ship** (unassisted).

## Key features
- 12 grouping pairs (apples/crates, coins/piggy banks, children/buses, and more) rotated randomly
- Blackboard panel shows unitary method working in chalk notation, built live as the child plays
- Fraction unit rates from L3 (½, ¼, ⅓) with split item sprites
- Responsive: full layout on tablet/desktop; compact on mobile landscape
- Max 1 point lost per question regardless of retries or autopilot; question never skipped until correct
- PDF session report with per-question diagrams and blackboard working — looks like homework to the teacher

## Tech stack
| Layer | Technology |
|-------|-----------|
| Framework | React + TypeScript |
| Build | Vite |
| Styling | CSS Modules |
| Animation | CSS transitions + keyframes |
| Audio | Web Audio API |
| PDF | jsPDF |
| PWA | Vite PWA plugin |
| Deployment | Vercel |

## Directory structure
```
maths-pack-it/
├── src/
│   ├── game-logic.ts       # Question generation, validation, autopilot steps
│   ├── GameLoop.tsx        # Main game component, state machine
│   ├── Canvas.tsx          # Items zone, containers zone, blackboard panel
│   ├── Blackboard.tsx      # Chalk-style working steps display
│   ├── grouping-pairs.ts   # 12 grouping pair definitions
│   ├── sound.ts            # Web Audio SFX functions
│   └── pdf-report.ts       # Session report generation
├── specs/
│   ├── brief.md
│   ├── spec.md
│   ├── game-logic.md
│   ├── game-loop.md
│   ├── canvas.md
│   ├── session-reporting.md
│   ├── sound-system.md
│   ├── deployment.md
│   ├── i18n.md
│   └── autopilot.md
├── public/
│   ├── screenshots/
│   └── icons/
└── tests/
    └── playwright/
```

## Feature index
| Feature | Spec | Key files |
|---------|------|-----------|
| Question generation | specs/game-logic.md | src/game-logic.ts |
| Drag & drop (L1) | specs/canvas.md | src/Canvas.tsx |
| Tap-to-fill (L1 Pack/Ship) | specs/canvas.md | src/Canvas.tsx |
| Blackboard panel | specs/canvas.md | src/Blackboard.tsx |
| Fraction questions | specs/game-logic.md | src/game-logic.ts |
| Scoring rule | specs/game-logic.md | src/GameLoop.tsx |
| Session PDF report | specs/session-reporting.md | src/pdf-report.ts |
| Sound | specs/sound-system.md | src/sound.ts |
| Autopilot | specs/autopilot.md | src/GameLoop.tsx |
| i18n | specs/i18n.md | src/i18n.ts |
| Deployment | specs/deployment.md | vercel.json |

## Dev setup
```bash
npm install
npm run dev   # runs on http://localhost:4003
```

## Deploy
```bash
npm run build
vercel --prod
```

## Live URL
https://maths-pack-it.vercel.app *(placeholder — update after first deploy)*
