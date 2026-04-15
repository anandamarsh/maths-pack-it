# Sound System — Pack It!

## Music patterns

| Context | Pattern | Notes |
|---------|---------|-------|
| L1–L3 (normal rounds) | Pattern 1 — upbeat, light arcade | Same track across Load/Pack/Ship within level |
| L4 (textbook round) | Pattern 2 — calm, focused | Lower tempo, fewer notes |

Both use Web Audio API only (no audio files). Platform's 4 built-in looping patterns.

## Standard SFX (inherited from platform)
- `playCorrect` — correct answer
- `playWrong` — wrong answer
- `playLevelComplete` — round complete
- `playTap` — UI tap
- `playButton` — button press
- `playKeyClick` — keypad digit press

## New SFX (game-specific)

### `playItemDrop`
- Trigger: item lands successfully in a container
- Synthesis: short soft thud — sine wave 200Hz, 80ms, fast attack, gentle decay
- Volume: 0.4

### `playItemBounce`
- Trigger: wrong answer — items bounce back to items zone
- Synthesis: two-note boing — square wave 300Hz → 200Hz, 200ms total
- Volume: 0.5

### `playShip`
- Trigger: round complete, containers fly off screen
- Synthesis: ascending whoosh (noise sweep 100ms) + ding (sine 880Hz, 300ms)
- Volume: 0.6

### `playChalkWrite`
- Trigger: each blackboard line appears
- Synthesis: white noise burst, 60ms, band-pass filtered at 2kHz — simulates chalk on board
- Volume: 0.25 (subtle, should not distract)

## SFX sequence per event

| Event | SFX sequence |
|-------|-------------|
| Item dragged | (none — silent drag) |
| Item lands in container | `playItemDrop` |
| Container full | `playTap` (slightly higher pitch) |
| Correct answer | `playCorrect` + `playItemDrop` (layered) |
| Wrong answer | `playWrong` + `playItemBounce` (150ms apart) |
| Blackboard line appears | `playChalkWrite` |
| Round ships | `playLevelComplete` + `playShip` (simultaneous) |
| Keypad digit | `playKeyClick` |
| Submit button | `playButton` |
