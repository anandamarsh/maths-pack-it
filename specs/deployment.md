# Deployment — Pack It!

## Game slug
`pack-it`

## Vercel project name
`maths-pack-it`

## Dev server port
**4003**
(distance-calculator = 4001, angle-explorer = 4002, pack-it = 4003)

## Live URL (placeholder)
`https://maths-pack-it.vercel.app`

## Env vars
```
VITE_GAME_SLUG=pack-it
VITE_GAME_NAME=Pack It!
VITE_DEV_PORT=4003
VITE_DISQUS_SHORTNAME=interactive-maths
```

## PWA manifest additions
```json
{
  "name": "Pack It! — Unit Rates",
  "short_name": "Pack It!",
  "description": "Learn the unitary method by packing items into groups",
  "subjects": ["Mathematics"],
  "skills": ["Unit rates", "Unitary method", "Ratios", "Proportional reasoning"],
  "age_range": "10-13",
  "curriculum": "NSW MA4-RAT-C-01",
  "screenshots": [
    { "src": "/screenshots/pack-it-l1.png", "label": "Level 1 — Discover the unit" },
    { "src": "/screenshots/pack-it-l2.png", "label": "Level 2 — Use the unit" },
    { "src": "/screenshots/pack-it-l3.png", "label": "Level 3 — Apply the unit" },
    { "src": "/screenshots/pack-it-l4.png", "label": "Level 4 — Textbook" }
  ]
}
```

## localStorage keys
```
pack-it-score
pack-it-level
pack-it-yt-cta-dismissed
pack-it-mute
```

## iframe embed
```html
<iframe
  src="https://maths-pack-it.vercel.app"
  width="100%"
  height="700"
  frameborder="0"
  allow="autoplay"
  title="Pack It! — Unit Rates Game">
</iframe>
```
