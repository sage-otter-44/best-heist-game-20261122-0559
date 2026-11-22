# MIDNIGHT VAULT — 3 Rooms · 6 Guards · 12 Loot · 3 Tools

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/sage-otter-44/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/sage-otter-44/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A complete top-down heist game that runs in a desktop browser from static files, no
network request. One museum floor, three rooms — the Gallery, the Grand Hall and the
Vault — six patrolling guards with vision cones, four sweeping wall cameras, twelve
pieces of loot including the Grand Diamond, and an alarm meter that decides whether
you walk out rich or get grabbed. Everything is visible in one frame: the thief, the
cones, the cameras, the loot, the alarm, the tools and the exit.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and press Space or click to start.

- **Move** — WASD or arrow keys. **Sprint** — Shift (fast, but loud: nearby guards
  turn to investigate the noise).
- **Coin lure** — click the floor, or F to toss one ahead of you: the nearest guard
  walks over to investigate. **Smoke** — Q, a cloud that blocks all vision for 4 s.
  **EMP** — E, kills every camera within range for 6 s.
- **Pause** — P or Esc.
- **Win** — pocket the Grand Diamond, then reach the green EXIT before dawn. **Lose**
  — the alarm hits 100%, a guard grabs you, or dawn breaks.
- **Nights** — clear a night to open the next: Night 1 has 4 guards, 3 cameras and
  8 loot; Night 2 has 6 guards, 4 cameras and 12 loot; Night 3 has 8 guards,
  5 cameras and 16 loot, with less time on the clock each night.

## What is in the frame

- **Vision cones** — yellow while a guard patrols, red while it chases; a `!` over a
  guard that has you, a `?` over one that heard something.
- **Cameras** — red sweeping cones on the walls; EMP turns them grey and `OFF`.
- **Loot** — gold bars, gems, paintings, cash and the Grand Diamond, each with its
  value; the HUD counts loot, score and time to dawn.
- **Alarm meter** — fills while any cone is on you, drains while you are hidden.
- **Tools** — smoke, EMP and lure counts in the HUD, keys in the footer.

## Layout

- `game/index.html` — the page; `game/src/main.js` — boot and the fixed-step loop.
- `game/src/world.js` — the heist rules: patrols, vision, alarm, loot, tools, win/lose.
- `game/src/render.js` — all drawing, HUD, panels.
- `game/src/shots.js` — the screenshot scenes and the autopilot that plays them.
- `game/src/config.js` — tuning, palette and the floor plan.
- `game/src/input.js` — keyboard and pointer input. `game/src/random.js` — seeded RNG.
- `main.ts` — the hand-in: copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored make.fun library.
- `screenshots/` — 1-start (heist under way in the Gallery), 2-play (mid-heist in
  the Vault, thief under a camera cone below the Grand Diamond), 3-end (Night 2
  cleared).

## Verification

- Played through in a desktop browser with keyboard and mouse: movement, sprint,
  smoke, EMP and coin lure all work; a lure pulls a guard to `?` suspicious.
- Headless self-test (`?selftest=1&seed=1`) drives Night 1 with the same autopilot
  the screenshots use; the autopilot wins 4 of 9 night/seed combinations across
  the three nights, including Night 1 and Night 2 — the game is winnable and
  losable, and the alarm, the grab and the dawn timer all end runs.
- `main.ts` run twice into different output directories produces byte-identical
  `dossier.json`.

## License

MIT — see `LICENSE`.
