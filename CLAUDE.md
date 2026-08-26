# nadir

2D top-down dungeon crawler. You enter at the surface; every floor down is **smaller** — depth 1 is 64×64 tiles, the nadir (depth 9) is a single 9×9 room. Same danger budget in less space: the dungeon closes in as you descend. Reach the bottom, claim the prize.

## Doctrine

- Claude is the sole developer; Daniel orchestrates. Optimize for velocity over ceremony.
- Stack: TypeScript + Vite + Phaser 3 (+ Vitest). Prefer familiar, established libraries.
- Game logic (generation, combat math, progression) lives in **pure TS modules with unit tests**. Phaser scenes stay thin and are verified by eye in the browser preview.
- All randomness flows through the seeded RNG (`src/core/rng.ts`); every run is reproducible via `?seed=<x>` in the URL.
- Commit at milestones with Daniel's OK, not silently.

## Commands

- `npm run dev` — dev server at http://localhost:5173 (strict port; `.claude/launch.json` config "nadir")
- `npm test` — Vitest unit tests (pure logic only, no Phaser)
- `npm run typecheck` / `npm run build`

## Architecture

- `src/core/rng.ts` — seeded RNG (xmur3 + mulberry32)
- `src/dungeon/generate.ts` — pure floorplan generation: non-overlapping rooms + L-corridors (nearest-neighbor chaining, connected by construction), exit placed at the BFS-farthest walkable tile, geometric shrink (`sizeForDepth`: 64 → 9 over 9 depths, factor 0.78). The nadir floor is a single room with the prize instead of stairs.
- `src/game/tiles.ts` — frame indices into the tilesheet + deterministic per-cell variant picking
- `src/scenes/` — `BootScene` (load sheet, resolve seed), `DungeonScene` (tilemap build, player, descend/claim/restart), `UIScene` (HUD; reads registry key `hud`)
- `public/assets/tilemap_packed.png` — Kenney **Tiny Dungeon** (CC0), 12×11 grid of 16px tiles; license copy alongside. Sprite bench for later: slime 108, ogre 109, bat 120, ghost 121, spider 122, rat 123, mimic 92, potions 113–116, swords 103–106.

## Debug hook

`window.nadir` in the browser console: `.state()`, `.warp(tx, ty)`, `.move(vx, vy, ms)`, `.descend()`. `window.game` (the Phaser.Game) is also exposed.

Headless verification when the Browser pane is hidden (rAF throttled to zero, so Phaser never steps on its own): drive frames manually with a persistent clock — `t += 16.7; game.step(t, 16.7)` in a loop — then read pixels via `game.canvas.toDataURL()` (the CANVAS renderer is used specifically so this stays readable) and decode the base64 to a PNG. Keep one monotonic `t` across calls; mixing `performance.now()` between tool calls makes scene time jump and expires timed debug moves early.

## Roadmap

- [x] M0 skeleton: procgen floor renders, WASD/arrow movement, wall collision, camera follow
- [x] M1 descent: ladder → smaller floor, HUD depth counter, nadir prize + win banner, R restarts the run
- [ ] M2 danger: enemies with chase AI, health, melee combat, death & restart
- [ ] M3 texture: items/potions, fog of war, wall autotiling (sheet rows 36–39 + 57/59), sound

## Decisions log

- 2026-08-26: Real-time action (not turn-based). v1 is descend-only (no return climb). Kenney Tiny Dungeon CC0 tileset. Shrink curve 64→9 over 9 floors (SHRINK=0.78, MIN_SIZE=9). Camera: follow at zoom 3, switch to static centered view when the floor fits on screen (last two depths).
