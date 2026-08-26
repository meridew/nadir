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
- `src/game/tiles.ts` — art bindings for the DTII sheet: texture keys, `tileIndex` (grid-aligned frames → tilemap indices), `isGridTile` (the `wall_edge_*` family sits at y%16==8 in the sheet and must render as images, not tiles), `floorFrameAt`, and `wallPlacements`: the neighbor-aware wall grammar verified against 0x72's own sample screenshot — floor-south walls get face + cap in the cell above (capsN layer); floor-north walls get face + cap tucked under (capsS layer, shifted +6px); side walls get edge strips on the floor side (piece names say where the strip sits on the tile); diagonal-only contacts get corner joins; deeper mass stays black.
- `src/game/dtii-frames.ts` — GENERATED rect table (regenerate with `npx vite-node scripts/generate-dtii-atlas.ts`, which also writes `public/assets/dtii/atlas.json` for Phaser's atlas loader)
- `scripts/render-map.ts` + `scripts/compose-map.ps1` — offline map preview with zero browser: `npx vite-node scripts/render-map.ts <seed> <depth> out.json` then `pwsh scripts/compose-map.ps1 -Json out.json -Out out.png -Scale 3`. Emits the same draw commands DungeonScene issues; use it to judge art/procgen changes instantly.
- `src/scenes/` — `BootScene` (load sheet, resolve seed), `DungeonScene` (tilemap build, player, descend/claim/restart), `UIScene` (HUD; reads registry key `hud`)
- `public/assets/dtii/` — **0x72 DungeonTileset II v1.7** (CC-0): `dungeon_sheet.png` (512×512), `tile_list_v1.7.txt` (name x y w h — the source of truth), generated `atlas.json`, license note. Every character has 4-frame idle+run (most have a hit frame). Monster bench for M2, by depth band: tiny_zombie/goblin/imp (16×16) up top → skelet/orc_warrior/masked_orc (16×23) mid → chort/wogol/necromancer deep → **big_demon/ogre/big_zombie (32×36) at the nadir**. Also: mimic chest, animated chests/coins/spikes/wall fountains, 27 weapon sprites, ui_heart_full/half/empty, doors. The zip also ships 3×3-minimal autotile atlases (not vendored; in the download) if we ever outgrow the named-tile grammar.

## Debug hook

`window.nadir` in the browser console: `.state()`, `.warp(tx, ty)`, `.move(vx, vy, ms)`, `.descend()`. `window.game` (the Phaser.Game) is also exposed.

Headless verification when the Browser pane is hidden (rAF throttled to zero, so Phaser never steps on its own): drive frames manually with a persistent clock — `t += 16.7; game.step(t, 16.7)` in a loop — then read pixels via `game.canvas.toDataURL()` (the CANVAS renderer is used specifically so this stays readable) and decode the base64 to a PNG. Keep one monotonic `t` across calls; mixing `performance.now()` between tool calls makes scene time jump and expires timed debug moves early.

## Roadmap

- [x] M0 skeleton: procgen floor renders, WASD/arrow movement, wall collision, camera follow
- [x] M1 descent: ladder → smaller floor, HUD depth counter, nadir prize + win banner, R restarts the run
- [x] M1.5 art migration: DTII everywhere — animated knight (idle/run), chest-open anim on the win, wall grammar + generator merge pass, offline preview tooling
- [ ] M2 danger: enemies with chase AI (depth-banded DTII monsters, big_demon at the nadir), health + heart HUD, melee (weapon sprite swing, Gungeon-style), death & restart
- [ ] M3 texture: items/potions, fog of war, doors/banners/fountains as room decor, sound (candidate: Ninja Adventure's CC-0 SFX/music), polish: south-corner cap alignment (6px step where corner joins meet capsS)

## Decisions log

- 2026-08-26: Real-time action (not turn-based). v1 is descend-only (no return climb). Kenney Tiny Dungeon CC0 tileset. Shrink curve 64→9 over 9 floors (SHRINK=0.78, MIN_SIZE=9). Camera: follow at zoom 3, switch to static centered view when the floor fits on screen (last two depths).
- 2026-08-26 (art pass): walls use the pack's real grammar (no rotation needed — the fix was tile *roles*, not orientation). Generator keeps scatter-rooms + nearest-neighbor L-corridors, now with 1–3 extra loop corridors per floor so layouts aren't pure trees. Alternatives (BSP, cellular-automata caves, TinyKeep-style graph gen) deliberately deferred; revisit for depth-band variety (e.g. cave-flavored middle floors) rather than replacing the core.
- 2026-08-26 (M1.5): switched all art from Kenney Tiny Dungeon to **0x72 DungeonTileset II v1.7** (CC-0) — Tiny Dungeon's platform-style wall vocabulary can't cover arbitrary procgen wall masks and has no animation frames; DTII is authored for this style and animates everything. Generator gained a merge pass (no one-tile-thick horizontal walls — the face+cap grammar needs the row) with a test pinning it. Characters face sideways only (flipX); attack anims don't exist — melee will swing separate weapon sprites. itch.io downloads are session-keyed (see the browser-assisted flow in session history); assets are vendored so this never needs repeating.
