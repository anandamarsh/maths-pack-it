# Interactive Maths — Game Template

A ready-to-run starting point for building games on the Interactive Maths platform.

## Quick start

```bash
npm install
npm run dev       # opens at http://localhost:4003
```

## What you get out of the box

- Full game chrome: numeric keypad, level buttons, audio button, shuffle music
- Responsive layout: landscape mobile, desktop, portrait blocked
- Social: share buttons + comments drawer
- PWA: installable, offline-capable, build-stamped manifest
- Sound system: Web Audio API (SFX + background music)
- Tutorial hint system
- TypeScript + Vite + React 19 + Tailwind CSS

## What to replace

### Your game logic → `src/game/myGame.ts`

Rename `rippleGame.ts` or add your own file. Export:
- A `RoundConfig` type describing one round of your game
- A `makeRound(level)` function that generates a new round
- Any helpers your screen needs

### Your game canvas → `src/screens/GameScreen.tsx`

Rename `RippleScreen.tsx`. The only requirement is that you render `<GameLayout>` with the right props and put your game canvas as its `children`.

The game canvas is the `<div>` with `ref={canvasRef}` and the ripple rendering. Replace that with your own SVG, canvas, or React elements.

### `public/manifest.json`

Update these fields:
- `id` — unique ID for this game (e.g. `"maths-angles-explorer"`)
- `name` / `short_name`
- `tags`, `skills`, `description`
- `githubUrl`
- `screenshots` — add after deployment

### `index.html`

Update `<title>` and `apple-mobile-web-app-title`.

### Icons

Replace the placeholder icons with your own:
- `public/favicon.svg` — vector icon
- `public/favicon.ico` — 32×32 fallback
- `public/icon-192.png` — PWA icon
- `public/icon-512.png` — PWA icon (any + maskable)
- `public/apple-touch-icon.png` — iOS home screen icon

## Shared components (do not modify)

These are shared infrastructure. They will be updated in the template and should be
re-copied when there are updates:

| Component | What it does |
|---|---|
| `RotatePrompt` | Blocks portrait on touch devices, notifies parent shell |
| `Social` | Share buttons + comments iframe |
| `GameLayout` | Responsive shell: top bar, canvas area, keypad, social |
| `NumericKeypad` | DSEG7 display + 12-button grid |
| `LevelButtons` | Level selector (locked/active/done states) |
| `AudioButton` | Mute/unmute toggle |
| `QuestionBox` | Styled question display |
| `TutorialHint` | Animated hand pointer with label |
| `sound/index.ts` | Web Audio SFX + background music |
| `hooks/useMediaQuery.ts` | `useIsMobileLandscape`, `useIsCoarsePointer` |

## Submitting to Interactive Maths

1. Deploy to Vercel (import GitHub repo → one click)
2. Your deployed URL will be e.g. `https://maths-my-game.vercel.app/`
3. Make sure `public/manifest.json` is accessible at `{your-url}/manifest.json`
4. Add screenshots to `public/screenshots/` and list them in `manifest.json`
5. Submit your URL to the Interactive Maths library

## Port convention

Each game runs on its own local port:
- `4000` — interactive-maths shell
- `4001` — maths-distance-calculator
- `4002` — maths-angle-explorer
- `4003` — this template
- `4004+` — your game (pick the next available)

Update `vite.config.ts` `server.port` accordingly.
