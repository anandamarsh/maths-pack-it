# Pack It!

> An Interactive Maths game for practising the unitary method through equal-group packing problems.

**Planned live URL:** https://maths-pack-it.vercel.app/

---

## What it is

Pack It! is built on the Interactive Maths game framework and is ready for deployment as a PWA on Vercel.

- Numeric keypad with DSEG7 LCD display
- Session reports emailed as PDF (via Resend)
- 5 built-in languages — English, Chinese, Spanish, Russian, Hindi — plus on-demand translation via OpenAI
- Autopilot mode for demos and end-to-end testing
- Web Audio synthesis (no sound files)
- Social sharing + embedded comments
- PWA — installable and offline-capable

Current game entry points are `src/game/packItGame.ts` and `src/screens/PackItScreen.tsx`.

---

## Quick start

```bash
git clone https://github.com/anandamarsh/maths-pack-it.git
cd maths-pack-it
npm install
npm run dev   # http://localhost:4005
```

---

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Vercel

---

## Docs

Full implementation details are in the **[`specs/`](./specs/)** folder — architecture, game loop, all component APIs, sound system, autopilot, i18n, deployment, and more.
