# Functional Specification — Interactive Maths Game Template

> **Status:** Draft — Pending Author Review
> **Purpose:** This document is the authoritative contract for all games built on this template. All LLM-assisted development must treat these specifications as binding requirements. Any deviation requires explicit sign-off.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Layout Architecture](#2-layout-architecture)
3. [Top Control Bar](#3-top-control-bar)
4. [Numeric Keypad](#4-numeric-keypad)
5. [Question Box](#5-question-box)
6. [Level Buttons](#6-level-buttons)
7. [Progress Dots](#7-progress-dots)
8. [Audio Button](#8-audio-button)
9. [Tutorial Hint](#9-tutorial-hint)
10. [Rotate Prompt](#10-rotate-prompt)
11. [Session Report Modal](#11-session-report-modal)
12. [Game Mechanics — Ripple Touch (Reference Implementation)](#12-game-mechanics--ripple-touch-reference-implementation)
13. [Game Phase State Machine](#13-game-phase-state-machine)
14. [Input Handling](#14-input-handling)
15. [Audio System](#15-audio-system)
16. [Session Logging](#16-session-logging)
17. [PDF Report & Sharing](#17-pdf-report--sharing)
18. [Social Integration](#18-social-integration)
19. [Responsive Behaviour](#19-responsive-behaviour)
20. [PWA & Service Worker](#20-pwa--service-worker)
21. [Build & Deployment](#21-build--deployment)
22. [Customisation Contract for Game Developers](#22-customisation-contract-for-game-developers)
23. [Known Constraints](#23-known-constraints)

---

## 1. Overview

The **Interactive Maths Game Template** is a production-ready Progressive Web App (PWA) starter for the Interactive Maths platform. It provides:

- A complete UI shell (layout, keypad, question box, controls)
- Audio synthesis via the Web Audio API
- Session tracking and PDF report generation
- Social sharing and embedded discussion comments
- PWA infrastructure (manifest, service worker, offline caching)

The template ships with a demo game called **Ripple Touch** that teaches counting through tap-and-count interactions. Game developers replace the demo game logic and screen while keeping the shell intact.

**Tech stack:** React 19, TypeScript 5, Vite 8, Tailwind CSS 4, vite-plugin-pwa 1.2, jsPDF 4.

---

## 2. Layout Architecture

### 2.1 GameLayout Component

`GameLayout` is the master container rendered as a fixed, fullscreen element.

**Background:** Dark arcade colour `#020617` with an arcade grid pattern overlay.

**Three vertical zones (top → bottom):**

| Zone | Description |
|------|-------------|
| Top Bar | Fixed-height row containing control buttons and progress indicators |
| Canvas Area | Fills remaining space; game content renders here as children |
| Bottom Overlay | Floating row containing the Question Box and Numeric Keypad; never displaces the canvas |

**Rendering rule:** The bottom overlay is absolutely positioned over the canvas. The canvas must not reflow when the keypad is shown or hidden.

### 2.2 Portrait Mode

On touch (coarse-pointer) devices in portrait orientation, the entire game is blocked by the Rotate Prompt overlay (see §10). No game interaction is possible in portrait mode.

---

## 3. Top Control Bar

The top bar is a horizontal flex row divided into three sections: **left controls**, **centre**, and **right controls**.

### 3.1 Left Controls (order: left to right)

| Button | Icon | Condition | Behaviour |
|--------|------|-----------|-----------|
| Audio | Speaker SVG | Always shown | Toggles mute; see §8 |
| Restart | Arrow-path (circular refresh) SVG | Only when `onRestart` prop provided | Calls `onRestart()` |
| Share | Share SVG | Always shown | Opens native share or social share UI |
| Comments | Chat/comment SVG | Always shown | Opens DiscussIt iframe |
| YouTube | YouTube logo | Shown when `manifest.json` contains valid `videoUrl` | Opens how-to-play modal; first-time speech bubble can be dismissed persistently |

All buttons use the `arcade-button` CSS class (orange gradient, yellow border).
Each button has a `title` attribute describing its action (e.g. `"Mute"`, `"Restart"`, `"Share"`, `"Comments"`).

### 3.2 Centre — Progress Dots

Rendered only when both `progress` and `progressTotal` props are provided. See §7.

### 3.3 Right Controls — Level Buttons

Rendered only when `levelCount`, `currentLevel`, and `unlockedLevel` props are provided. See §6.

---

## 4. Numeric Keypad

### 4.1 Display

- Uses the **DSEG7Classic** font (LCD/calculator aesthetic).
- Text colour: cyan `#67e8f9` with glow shadow `0 0 12px rgba(103,232,249,0.85)`.
- Letter spacing: `0.08em`.
- Shows `"0"` when the value is empty.
- The display is clickable and toggles the keypad collapsed/expanded state.

### 4.2 Button Layout

```
7   8   9   ⌫
4   5   6   ±
1   2   3   .
    0       ✓
```

- **Digit buttons (0–9):** Dark slate background with border.
- **Operation buttons (⌫ ± . ✓):** Slightly lighter slate background.
- **Pressed state:** Cyan highlight with glow shadow; `active:scale-95` press animation; 140 ms flash feedback.

### 4.3 Button Behaviours

| Button | Behaviour |
|--------|-----------|
| `0–9` | If current value is `"0"`, replace with digit. If current value is `"-0"`, replace with `"-" + digit`. Otherwise append digit. |
| `⌫` | Delete the last character. If the result is `"-"` or `""`, reset to `"0"`. |
| `±` | Toggle leading negative sign. Special case: `"-0"` is valid as an intermediate state while the user types a negative number. |
| `.` | Append decimal point only if no decimal point already exists in the value. |
| `✓` | **Enabled only when `canSubmit` prop is `true`.** Calls `onKeypadSubmit()`. When disabled: reduced opacity, cursor `not-allowed`. |

### 4.4 Collapse Behaviour

- Animated via `max-height` transition (0 → full height), `opacity` transition, duration 0.3–0.4 s ease-in-out.
- Collapsing/expanding the keypad must not move or resize the canvas.
- On mobile landscape the keypad is **minimised by default** on first render.

### 4.5 Controlled Component Contract

The keypad is **fully controlled**:
- `value` (string) comes from the parent.
- `onChange(value: string)` is called on every input event.
- `onKeypadSubmit()` is called on ✓ press or Enter key.

The component does not own internal value state.

### 4.6 Sizing

| Context | Width | Button height | Font size |
|---------|-------|---------------|-----------|
| Mobile landscape | 16.25 rem | 56 px | 1.6875 rem |
| Desktop | 12.5–13.75 rem | 40 px | 1.5 rem |

---

## 5. Question Box

### 5.1 Display

- Arcade-styled panel; white bold text; `text-lg`.
- Accepts `ReactNode` content (text, JSX, inline icons).
- Rendered in the bottom overlay, filling width adjacent to the keypad.

### 5.2 Shake Animation

Triggered by setting the `questionShake` prop to `true` on a wrong answer.

```
Duration: 400 ms, easing: ease-in-out
Keyframes:
  0%, 100%: translateX(0)
     20%:   translateX(-8px)
     40%:   translateX( 8px)
     60%:   translateX(-6px)
     80%:   translateX( 6px)
```

The parent must reset `questionShake` to `false` after 400 ms so the animation can re-trigger on the next wrong answer.

### 5.3 Optional onClick

When an `onClick` handler is provided, clicking the question box (e.g. to toggle the keypad) is supported.

---

## 6. Level Buttons

### 6.1 Visibility

Rendered only when `levelCount`, `currentLevel`, and `unlockedLevel` are all provided as props to `GameLayout`.

### 6.2 Per-Button Visual States

| State | Condition | Background | Text | Extra |
|-------|-----------|------------|------|-------|
| Locked | `level > unlockedLevel` | `#0f172a` | Muted grey | 🔒 emoji, opacity 0.5, `cursor: not-allowed` |
| Active | `level === currentLevel` | Cyan `#0ea5e9` | White | — |
| Completed | `level < currentLevel` | Brown `#78350f` | Gold `#fde047` | Gold glow shadow |
| Upcoming | `level > currentLevel && level <= unlockedLevel` | Slate `#1e293b` | Grey | — |

### 6.3 Interaction

- Clicking a **locked** button: no-op.
- Clicking any other button: calls `onLevelSelect(level)`.
- Buttons are 9×8 px minimum, rounded, 2 px border, `font-black text-xs`.

---

## 7. Progress Dots

### 7.1 Visibility

Rendered only when both `progress` and `progressTotal` props are provided.

### 7.2 Appearance

- Row of cyan glowing dots; maximum 10 dots regardless of `progressTotal` value.
- **Filled dot:** Scales 1.15× with cyan glow effect.
- **Empty dot:** Default size, no glow.
- Smooth CSS transitions on state change.

### 7.3 Mapping

`progress` filled dots out of `progressTotal` total dots. Values outside `[0, progressTotal]` are clamped.

---

## 8. Audio Button

### 8.1 Visual States

| State | Icon | Styling |
|-------|------|---------|
| Unmuted | Speaker with sound waves (white SVG) | Default arcade-button |
| Muted | Speaker with X through waves (white SVG) | Gradient background, custom border colour, box-shadow |

### 8.2 Behaviour

Clicking the button calls `onToggleMute()`. The button reflects the `muted` boolean prop — it is a controlled component.

---

## 9. Tutorial Hint

### 9.1 Purpose

An animated hand-pointer overlay shown on first interaction to guide the player.

### 9.2 Display

- Cyan hand SVG icon with drop-shadow glow.
- Label in a rounded pill with border.
- Centred within its parent container; position adjustable via `offsetX` / `offsetY` props.
- `pointer-events: none` — fully non-interactive.

### 9.3 Animation

Infinite opacity fade: `0.35 → 1.0 → 0.35`, period 2.4 s, easing ease-in-out.

### 9.4 Visibility Control

Controlled by parent via a boolean prop. Parent is responsible for hiding it after the first interaction.

---

## 10. Rotate Prompt

### 10.1 Trigger Condition

Active when **both** of the following are true:
- The device has a coarse pointer (touch device).
- The current orientation is portrait.

### 10.2 Display

- Fixed fullscreen overlay, background `#0d1b35`.
- Animated rotating device icon (wobble animation).
- Text: `"Rotate your device"` (heading) + `"This game plays best in landscape mode"` (body).

### 10.3 Behaviour

1. When the overlay becomes active, sends `postMessage` to parent shell:
   `{ type: "interactive-maths:overlay-active", active: true }`.
2. Attempts to lock screen orientation to landscape via the Screen Orientation API (fails silently if unsupported).
3. When the overlay becomes inactive (device rotated), sends:
   `{ type: "interactive-maths:overlay-active", active: false }`.

### 10.4 Desktop / Non-touch

The rotate prompt is **never shown** on non-touch (fine pointer) devices.

---

## 11. Session Report Modal

### 11.1 Trigger

Displayed when the parent provides a non-null `sessionSummary` object.

### 11.2 Layout

Full-screen overlay (z-index 80), radial gradient background, arcade-styled centred panel.

- Mobile landscape: full height.
- Desktop: max-width `48 rem` (3xl), centred.

### 11.3 Content

**Header:**
- `"Level X Complete!"` in gold/yellow.
- `"Monster Round Crushed!"` subtitle in purple.
- Three animated egg icons.

**Score Cards (desktop only):**
- Score: `correct / total` in emerald green.
- Accuracy: `N%` in yellow.
- Eggs: count in fuchsia.

**Action Buttons:**

| Button | Condition | Behaviour |
|--------|-----------|-----------|
| Share Report | Always shown | Calls `shareReport(summary)` |
| Email input + Send | Always shown | Downloads PDF and opens `mailto:` |
| Next Level | `level < maxLevel && onNextLevel` provided | Calls `onNextLevel()` |
| Play Again | Always shown (primary when at max level) | Calls `onPlayAgain()` |

### 11.4 Share Behaviour

- `shareReport()` uses the native Web Share API (file share) if available.
- Fallback: triggers browser download of the PDF.

### 11.5 Email Draft Behaviour

1. Generate PDF via `downloadReport(summary)`.
2. Open `mailto:` with a pre-filled subject and body referencing the game and level.

---

## 12. Game Mechanics — Ripple Touch (Reference Implementation)

This section documents the demo game. Game developers replace this logic while keeping the shell described in §§2–11.

### 12.1 Round Configuration

```typescript
interface RoundConfig {
  level: 1 | 2 | 3
  target: number        // number of taps required to complete the round
  rippleColor: string   // hex accent colour for this round's ripples
  tapPrompt: string     // shown during tapping phase
  entryPrompt: string   // shown during answering phase
}
```

`makeRound(level)` generates a random `RoundConfig`:

| Level | Target range | Accent colour |
|-------|-------------|---------------|
| 1 | 3–5 taps | Cyan |
| 2 | 6–9 taps | Gold |
| 3 | 10–15 taps | Violet |

### 12.2 Ripple Animation

Each tap on the canvas creates a ripple at the tap position:

- **3 concentric rings** expand outward over 900 ms.
- Ring delays: 0 ms, 80 ms, 160 ms.
- **Keyframe `ripple-expand`:**
  `scale(0), opacity(0.9)` → `scale(1), opacity(0)`, ease-out.
- A filled core dot is rendered at the tap centre with a glow effect.
- Ripple DOM elements are removed after 1000 ms.

### 12.3 Pitch Mapping

Each ripple plays a tone whose pitch is derived from the tap's normalised X position:

```
scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25] Hz  (C D E G A C)
index = round(normX × 5)
pitchVariance = 0.85 + normY × 0.3
pitch = scale[index] × pitchVariance
```

### 12.4 Egg Scoring

- Each correct answer awards 1 egg.
- 3 eggs per session complete the level (triggers report modal).
- Egg count resets when a new level session starts.

### 12.5 Level Progression

- Game starts with Level 1 unlocked.
- Completing Level 1 (3 eggs) unlocks Level 2.
- Completing Level 2 unlocks Level 3.
- `unlockedLevel` state persists for the current browser session only (not localStorage).

---

## 13. Game Phase State Machine

The demo game (and by convention all games built on this template) tracks a discrete phase:

```
GamePhase = "tapping" | "answering" | "feedback" | "levelComplete"
```

### 13.1 Transitions

```
startNewRound(level)
  └─► "tapping"
        │  [user taps canvas until tapCount >= targetTaps]
        └─► "answering"
              │  [user enters answer and presses ✓]
              └─► "feedback"  (held for 1200 ms)
                    ├─ [eggsCollected >= 3]  ──► "levelComplete"
                    │                               └─ show SessionReportModal
                    └─ [eggsCollected < 3]   ──► startNewRound(level)
```

### 13.2 Keypad State per Phase

| Phase | Keypad active | canSubmit |
|-------|---------------|-----------|
| tapping | No | false |
| answering | Yes | true when value ≠ "" |
| feedback | No | false |
| levelComplete | No | false |

---

## 14. Input Handling

### 14.1 Pointer / Touch (Canvas)

- Event: `onPointerDown` on the canvas div.
- Only processed during the `"tapping"` phase; ignored in all other phases.
- Normalised position calculated as:
  `normX = (e.clientX - rect.left) / rect.width`
  `normY = (e.clientY - rect.top) / rect.height`
- `touchmove` default is prevented (`{ passive: false }`) to stop scroll interference.

### 14.2 Physical Keyboard

Active **only** during the `"answering"` phase. Events are ignored if focus is on an `<input>` or `<textarea>`.

| Key | Action |
|-----|--------|
| `0`–`9` | Digit input |
| `Backspace` | Delete last character |
| `Enter` | Submit (calls `onKeypadSubmit`) |
| `.` | Decimal point |
| `-` | Negate toggle |

---

## 15. Audio System

All audio is synthesised via the **Web Audio API** — no audio files are loaded.

### 15.1 Initialisation Rule

The `AudioContext` starts suspended. `startMusic()` **must** be called on the first user gesture (tap or click). Calling audio functions before this point must not throw; they should fail silently.

### 15.2 Mute State

- Default: **muted in development** (`import.meta.env.DEV === true`); unmuted in production.
- `toggleMute()` returns the new boolean state.
- `isMuted()` returns current state.
- When muted, all sound functions are no-ops.
- Music channels and SFX channels both respect the mute flag.

### 15.3 Sound Effects

| Function | Description | Waveform(s) |
|----------|-------------|-------------|
| `playRipple(pitch?)` | Tap feedback; default 440 Hz | Sine + triangle + noise burst |
| `playCorrect()` | Ascending arpeggio (C–E–G–C–E) | Sine |
| `playWrong()` | Descending sawtooth cascade | Sawtooth |
| `playLevelComplete()` | 6-note ascending melody | Sine |
| `playKeyClick()` | Short keypad click | Noise burst + square wave |
| `playButton()` | UI button press | Two ascending square waves |

### 15.4 Pitch Mapping for Ripples

See §12.3 for the formula. The pitch argument to `playRipple()` accepts the computed Hz value directly.

### 15.5 Background Music

- 4 distinct patterns (randomised on `startMusic()`).
- Each pattern: 16-step sequence, melody + bass oscillators.
- Loops indefinitely until `stopMusic()`.
- `shuffleMusic()` switches to a different pattern without stopping.
- BPM range across patterns: 110–170.
- Music volume: 0.25× relative to SFX.

---

## 16. Session Logging

### 16.1 Module API

```typescript
startSession()                       // reset all state, start session timer
startQuestionTimer()                 // reset per-question timer
logAttempt(attempt: Omit<QuestionAttempt, "questionNumber" | "timestamp" | "timeTakenMs">)
buildSummary(opts) → SessionSummary
clearSession()
getAttemptCount() → number
```

### 16.2 QuestionAttempt Record

```typescript
interface QuestionAttempt {
  questionNumber: number        // auto-assigned (1-based)
  prompt: string                // question text shown to player
  level: 1 | 2 | 3
  correctAnswer: number
  childAnswer: number | null    // null if no answer submitted
  isCorrect: boolean
  timestamp: number             // Unix ms, auto-assigned
  timeTakenMs: number           // elapsed since startQuestionTimer(), auto-calculated
  gamePhase: "normal" | "monster"
  ripplePositions: RipplePosition[]  // [{x: 0–1, y: 0–1}] or [] for non-ripple games
}
```

### 16.3 SessionSummary Record

```typescript
interface SessionSummary {
  playerName: string
  level: 1 | 2 | 3
  date: string               // ISO 8601
  startTime: number          // Unix ms
  endTime: number            // Unix ms
  totalQuestions: number
  correctCount: number
  accuracy: number           // 0–100 (percentage)
  normalEggs: number
  monsterEggs: number
  levelCompleted: boolean
  monsterRoundCompleted: boolean
  attempts: QuestionAttempt[]
}
```

### 16.4 Usage Contract

1. Call `startSession()` when a new level session begins (level select or play again).
2. Call `startQuestionTimer()` at the start of each question's answering phase.
3. Call `logAttempt()` when the player submits an answer.
4. Call `buildSummary()` when a level is completed to produce the report data.

---

## 17. PDF Report & Sharing

### 17.1 Functions

```typescript
downloadReport(summary: SessionSummary): Promise<void>
shareReport(summary: SessionSummary): Promise<boolean>   // returns true if native share used
canNativeShare(): boolean
```

### 17.2 PDF Content

The PDF includes:
- Player name, level, date.
- Score (`correct / total`) and accuracy percentage.
- Total time.
- Per-question attempt cards.
- Ripple position diagrams (if `ripplePositions` are non-empty).
- Encouragement message.

### 17.3 Share Behaviour

1. `canNativeShare()` checks `navigator.canShare({ files: [file] })`.
2. If available: invokes `navigator.share({ files: [pdfFile] })`.
3. If unavailable: falls back to `downloadReport()`.

---

## 18. Social Integration

### 18.1 Share Buttons (SocialShare Component)

Renders share buttons for: Twitter, Facebook, WhatsApp, LinkedIn.
All links share the Interactive Maths platform landing page URL.

### 18.2 DiscussIt Comments (SocialComments Component)

- Embeds the DiscussIt widget in an `<iframe>`.
- **Production URL:** `https://discussit-widget.vercel.app`
- **Dev URL:** `http://localhost:5001`
- Overridable via environment variable `VITE_DISCUSSIT_URL`.

### 18.3 openCommentsComposer()

Sends a `postMessage` to the DiscussIt iframe to open the comment composition panel.

### 18.4 YouTube walkthrough CTA

- `GameLayout` fetches `/manifest.json` on mount and reads `videoUrl`.
- The URL is converted into a YouTube embed URL.
- When present, a YouTube launcher is shown next to the comments button.
- The launcher button uses the same visual treatment as `see-maths`: transparent fill, yellow circular border, YouTube logo.
- A first-time speech bubble is rendered either above or below the icon, depending on which position keeps it fully visible in the viewport.
- The bubble tail must point back toward the icon from the nearest edge.
- Bubble content follows the `see-maths` pattern:
  - YouTube icon in a circular yellow ring
  - copy from translation key `social.youtubePrompt`
  - dismiss text from translation key `social.youtubeDismiss`
- English source strings are:
  - `First time? Look at a video on how to play.`
  - `Don't show again`
- The bubble is fixed at `310px` wide on mobile and desktop.
- `see-maths` and `maths-game-template` may place the bubble on different sides of the icon if their launcher positions differ.
- Dismissing the bubble writes `"true"` to localStorage key:
  `maths-game-template:youtube-bubble-dismissed`
- The icon remains visible after dismissal.
- Pressing the icon opens a centered modal containing the embedded YouTube player.
- The modal close control uses Material UI's `Close` icon rather than a text character.

---

## 19. Responsive Behaviour

### 19.1 Breakpoints

| Label | Value | Notes |
|-------|-------|-------|
| `sm` | 640 px | Tailwind default |
| `md` | 768 px | Main desktop layout breakpoint |
| `lg` | 1024 px | |

### 19.2 Device Detection

| Hook | Media Query | Meaning |
|------|-------------|---------|
| `useIsCoarsePointer()` | `(hover: none) and (pointer: coarse)` | Touch device |
| `useIsMobileLandscape()` | coarse pointer + `(orientation: landscape)` | Mobile in landscape |

### 19.3 Layout Rules by Context

| Context | Keypad default | Keypad size | Bottom bar behaviour |
|---------|----------------|-------------|----------------------|
| Desktop (fine pointer) | Expanded | Compact (12.5–13.75 rem) | Always visible |
| Mobile landscape (coarse) | **Minimised** | Wide (16.25 rem) | Floating overlay |
| Portrait (coarse) | N/A | N/A | Blocked by RotatePrompt |

---

## 20. PWA & Service Worker

### 20.1 Manifest (`public/manifest.json`)

Key fields:

| Field | Value |
|-------|-------|
| `display` | `"standalone"` |
| `orientation` | `"landscape"` |
| `background_color` | `"#0d1b35"` |
| `theme_color` | `"#0d1b35"` |
| `start_url` | `"/"` |
| `scope` | `"/"` |
| `videoUrl` | YouTube walkthrough URL used by the in-game help modal |

Icons: 192×192, 512×512 (`any` purpose), 512×512 (`maskable`), apple-touch-icon 180×180.

### 20.2 Caching Strategy

- **Static assets** (JS, CSS, HTML, fonts, icons): Precached by Workbox at build time; served cache-first offline.
- **External HTTPS resources**: NetworkFirst, 10-second timeout, cache name `"external-cache"`.

### 20.3 Service Worker Registration

`registerType: 'autoUpdate'` — the service worker auto-updates on next page load when a new build is deployed.

### 20.4 Build Stamp

Before each production build, `scripts/stamp-manifest.mjs` replaces the token `__BUILD_STAMP__` in `manifest.json` `description` with:

```
Build: YYYY-MM-DD HH:MM:SS (+HHMM) · SHA xxxxxxx
```

The original manifest is restored after the build. The stamp uses Sydney local time and the git short SHA.

---

## 21. Build & Deployment

### 21.1 Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Starts Vite on port 4003 |
| Production build | `npm run build` | TypeScript check + Vite bundle + PWA |
| Preview | `npm run preview` | Local preview of `/dist/` |
| Lint | `npm run lint` | ESLint on `src/` |

### 21.2 Port Convention

| Port | Game |
|------|------|
| 4000 | interactive-maths shell |
| 4001 | maths-distance-calculator |
| 4002 | maths-angle-explorer |
| 4003 | this template |
| 4004+ | custom games |

### 21.3 Deployment (Vercel)

1. Push to GitHub.
2. Import repository in Vercel; framework auto-detected as Vite.
3. No additional configuration required.
4. Verify `/manifest.json` is accessible post-deploy and contains the build stamp.

### 21.4 Dependency Note

`vite-plugin-pwa@1.2.0` has a peer-dependency conflict with Vite 8. This is resolved via `legacy-peer-deps=true` in `.npmrc`. Do not remove this file.

---

## 22. Customisation Contract for Game Developers

This section defines what **must**, **may**, and **must not** change when building a new game on this template.

### 22.1 Files to Replace

| File | Action | Notes |
|------|--------|-------|
| `src/game/rippleGame.ts` | Replace entirely | Implement `makeRound(level)` and `RoundConfig` |
| `src/screens/RippleScreen.tsx` | Replace entirely | Implement custom game screen |
| `src/App.tsx` | Update import | Point to new screen component |
| `public/manifest.json` | Update fields | `id`, `name`, `short_name`, `description`, `tags`, `skills`, `subjects`, `githubUrl` |
| `index.html` | Update | `<title>` and `apple-mobile-web-app-title` |
| `public/favicon.svg` | Replace | Vector icon |
| `public/favicon.ico` | Replace | 32×32 raster fallback |
| `public/icon-192.png` | Replace | 192×192 PWA icon |
| `public/icon-512.png` | Replace | 512×512 PWA icon |
| `public/apple-touch-icon.png` | Replace | 180×180 iOS icon |

### 22.2 Files to Keep Unchanged

- All files in `src/components/` (GameLayout, NumericKeypad, QuestionBox, LevelButtons, AudioButton, TutorialHint, RotatePrompt, SessionReportModal, Social)
- `src/sound/index.ts`
- `src/hooks/useMediaQuery.ts`
- `src/report/sessionLog.ts`
- `src/report/shareReport.ts`
- `src/report/generatePdf.ts`
- `vite.config.ts` (except `server.port`)
- `.npmrc`
- All TypeScript config files

### 22.3 GameLayout Props Contract

All props are optional except those marked **required**.

```typescript
interface GameLayoutProps {
  // Audio — REQUIRED
  muted: boolean
  onToggleMute: () => void

  // Restart button — optional; omit to hide
  onRestart?: () => void

  // Keypad — omit onKeypadChange to make display read-only
  keypadValue: string         // REQUIRED
  onKeypadChange?: (v: string) => void
  onKeypadSubmit?: () => void
  canSubmit?: boolean         // default false

  // Question box — omit to hide
  question?: ReactNode
  questionShake?: boolean     // default false

  // Progress dots — omit both to hide
  progress?: number
  progressTotal?: number

  // Level buttons — omit all three to hide
  levelCount?: number
  currentLevel?: number
  unlockedLevel?: number
  onLevelSelect?: (level: number) => void

  // Canvas content — REQUIRED
  children: ReactNode
}
```

### 22.4 Session Logging Contract

Games must call these in order:

1. `startSession()` — on new level session start.
2. `startQuestionTimer()` — at the start of each question's answering phase.
3. `logAttempt({...})` — when the player submits an answer.
4. `buildSummary({...})` — when a level is complete; pass result to `SessionReportModal`.

### 22.5 Sound API Contract

Games must call `startMusic()` on the **first user gesture**. All other sound functions may be called freely after that.

---

## 23. Known Constraints

| # | Constraint | Implication |
|---|-----------|-------------|
| C1 | Browser requires a user gesture before audio playback | `startMusic()` must be deferred to first tap/click |
| C2 | Session state is in-memory only | Progress resets on page reload; no localStorage persistence |
| C3 | DiscussIt comments iframe requires network | Fails gracefully (iframe blank) when offline |
| C4 | Native file share unavailable on desktop browsers | Falls back to download |
| C5 | Screen orientation lock may fail on some browsers | Rotate prompt still shown; lock attempted, fails silently |
| C6 | Very long numeric answers may overflow the LCD display | Game developers should constrain expected answer length |
| C7 | `vite-plugin-pwa@1.2.0` peer-dep conflict with Vite 8 | Requires `.npmrc` `legacy-peer-deps=true`; do not upgrade plugin without testing |
| C8 | Portrait mode fully blocked on touch devices | No partial landscape fallback; rotate prompt is the only UX |

---

*End of Functional Specification*
