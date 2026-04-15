# Canvas & Scene — Pack It!

## Rendering technology
**HTML/CSS with React** (div-based animation). Not SVG.

Rationale: the core visual is item sprites moving into container sprites — a layout problem, not a coordinate-geometry problem. CSS transitions (`transform: translate`, `opacity`) handle all movement. SVG would add unnecessary complexity. The blackboard text is rendered as HTML with a chalk-style font.

## Viewport / viewBox
- Canvas fills the available area below the toolbar and above the keypad
- Minimum canvas height: 320px (mobile landscape)
- Recommended: 500px+ (tablet landscape)
- Layout is flex-based, not fixed-pixel, so items and containers scale with canvas size

## Coordinate system
No explicit coordinate system. Items and containers are positioned using CSS flexbox/grid:
- **Items zone**: top-left area, items arranged in a wrap grid
- **Containers zone**: bottom/centre area, containers arranged in a row
- **Blackboard panel**: right 25% of canvas, fixed width min 180px

## Scene layers (z-index stack)

| Layer | z-index | Contents |
|-------|---------|----------|
| Background | 0 | Level colour gradient |
| Containers | 1 | Container sprites (static) |
| Items (resting) | 2 | Item sprites in items zone |
| Items (dragging) | 10 | Item sprite being dragged (lifted above everything) |
| Blackboard | 3 | Blackboard panel, always visible |
| Fill counter badges | 4 | "3/5" pill badges on containers |
| Unit rate badge | 5 | "[N] per [container]" badge, fades in/out |
| Feedback overlay | 20 | Wrong-answer bounce effect |

## Key visual objects

### Item sprite
- Size: 36×36px (large screen), 28×28px (mobile landscape)
- Style: flat emoji or simple SVG icon
- States: `resting` | `dragging` | `inContainer` | `bouncing` | `flying` (ship animation)
- Fraction item: split sprite (left half + right half, different CSS class)
- CSS class: `.pack-item`, `.pack-item--dragging`, `.pack-item--fraction`

### Container sprite
- Size: scales to fit unit rate items (min 80px wide)
- Style: flat emoji / simple outlined SVG with open top
- States: `empty` | `partial` | `full`
- Fill visualisation: items stack inside container (absolute positioned within container div)
- CSS class: `.pack-container`, `.pack-container--full`

### Blackboard panel
- Width: 25% of canvas, min 180px
- Background: `#2D5A1B` with slight texture (CSS radial gradient)
- Border: 8px solid `#1A3A0A`, slight rounded corners
- Font: `Caveat` (Google Fonts) or fallback `cursive`, size 16–20px
- Colour: `#F5F5DC` (cream-white)
- Lines appear one at a time, 400ms apart, with chalk-write animation:
  - Line slides in from left with opacity 0→1
  - `playChalkWrite` SFX on each line
- Wrong step shown in `#FF6B6B` (red chalk), then overwritten after 1s
- Cleared between questions

### Delivery animation (round complete)
- All filled containers slide off to the right of screen ("shipped")
- Duration: 800ms, CSS `transform: translateX(110%)`
- `playShip` SFX triggers at start of animation

## Responsive layout

### Large screen (≥768px landscape)
```
┌─────────────────────────────────────────────────────┐
│  Toolbar                                             │
├─────────────────────────────┬───────────────────────┤
│                             │                       │
│   Items zone                │   Blackboard          │
│   (6–10 items, wrap grid)   │   panel               │
│                             │                       │
│   Containers zone           │   (chalk steps)       │
│   (2–10 containers, row)    │                       │
│                             │                       │
├─────────────────────────────┴───────────────────────┤
│  Question box                                        │
├──────────────────────────────────────────────────────┤
│  Progress row (10 item emoji icons)                  │
├──────────────────────────────────────────────────────┤
│  Numeric keypad (collapsible)                        │
└──────────────────────────────────────────────────────┘
```

### Mobile landscape (<768px)
```
┌──────────────────────────────────────┐
│  Toolbar (compact)                   │
├────────────────────────┬─────────────┤
│  Items zone            │ Blackboard  │
│  (max 6 items)         │ (collapsed  │
│                        │  tap to     │
│  Containers zone       │  expand)    │
│  (max 5 containers)    │             │
├────────────────────────┴─────────────┤
│  Question box (compact)              │
├──────────────────────────────────────┤
│  Progress row                        │
├──────────────────────────────────────┤
│  Keypad                              │
└──────────────────────────────────────┘
```

### Portrait / small screen
Show rotate prompt overlay: "Please rotate your device for the best experience 🔄"
Minimum supported: 768px landscape.

## Pointer interaction

### L1 Load round — drag
- `pointerdown` on item: lift item (z-index 10, scale 1.1, slight shadow)
- `pointermove`: item follows pointer
- `pointerup` on container: if valid target → item snaps into container, fill counter increments
- `pointerup` elsewhere: item bounces back to items zone
- Multi-touch: first pointer only (single item drag)
- Desktop: same events (pointer events API)

### L1 Pack / Ship rounds — tap-to-fill
- `pointerdown` on container: add 1 item from items zone into container (animated hop)
- `pointerdown` and hold (>300ms): stream items at 150ms intervals until correct count reached or pointer released
- No dragging in these rounds

### L2–L3 — keypad driven
- No item interaction
- Keypad input → answer typed → Submit pressed → animation plays
- Animation: items fly from items zone into containers (CSS keyframe, no pointer events)

### L4 — keypad only
- No canvas interaction
- Canvas shows static question diagram (grouped items illustration)
- Keypad is primary interaction

## Secondary HUD elements

### Fill counter badge
- Position: top-centre of each container
- Style: small pill `background: rgba(0,0,0,0.6)`, white text, 12px font
- Content: `"[filled]/[target]"` e.g. `"3/5"`
- Shown: L1 and L2 only (hidden L3+)

### Unit rate badge
- Position: centre-top of canvas, below toolbar
- Style: rounded rectangle, level accent colour, 14px bold
- Content: `"4 apples per crate"` (localised)
- Appears: after unit rate established (L1 packing complete; L3 after step 1)
- Behaviour: fades in (300ms), persists for question, fades out on reset

### Blackboard panel (primary secondary HUD)
See Key visual objects above.

## Scene capture notes
- The **square snip tool** (dev-only overlay) should be centred on the items zone + containers zone combined
- Exclude blackboard panel from snip (the PDF report card shows the grouping diagram, not the working)
- Recommended snip area: left 75% of canvas, vertically centred
- The snip captures the filled containers with item count — this is the per-question PDF diagram

## Square snip usage
- Triggered by dev shortcut (see platform docs)
- Captures: filled containers with item sprites visible inside
- Used for: PDF report card diagrams (70×42mm per question card)
- The diagram should show: containers filled to correct count, item count label, container count label
- For fraction questions: split item sprites visible inside container
