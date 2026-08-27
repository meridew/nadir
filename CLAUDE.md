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

Pure logic (unit-tested, no Phaser) → shared game bindings → entities → thin scenes. New systems follow the same split: pure math in a tested module, a typed binding if scenes+tools share it, Phaser wiring last.

- `src/core/rng.ts` — seeded RNG (xmur3 + mulberry32)
- `src/dungeon/generate.ts` — pure floorplan generation: non-overlapping rooms + L-corridors (nearest-neighbor chaining, connected by construction), 1–3 loop corridors, exit at the BFS-farthest walkable tile, geometric shrink (`sizeForDepth`: 64 → 9 over 9 depths). The nadir floor is a single room with the prize instead of stairs. No art-driven shape constraints: the blob autotiler renders every wall configuration.
- `src/game/dtii-blob.ts` — **the wall-rendering oracle**: blob autotiling (Godot "3×3 minimal" / cr31 blob). `blobReduce` (corners count only when both adjacent edges are set) + `BLOB_CELL` (47 canonical classes → atlas cells), machine-extracted from the official Godot template image and pinned by an exhaustive 256-neighborhood test. Walls are 16×32 pieces from `walls_high.png`, one per near-floor wall cell, bottom-anchored, y-sorted by base. NEVER hand-write wall grammar again — if a wall looks wrong, the bug is in mask building or anchoring, not tile choice.
- `src/game/dtii-wall-insets.ts` — GENERATED (`npm run assets:insets`): per-blob-cell opaque-art bounding insets, measured from walls_high.png. Colliders derive from these minus a 3px sprite margin on horizontal sides, so the SPRITE lands flush on side bars (zero gap, zero overlap) while stub flanks stay walkable. **Depth-model invariant (do not break)**: actors sort by feet-y, wall pieces by their own cell base; sprites may overlap wall art VERTICALLY only (head over faces, legs behind south caps) — never horizontally over side bars, because corner pieces belong to two structures at once and no per-piece scalar depth can order a horizontal overlap correctly (the column-sink experiment proved this by breaking rear corners). Pinned by the flush test in draws.test.ts.
- `src/game/tiles.ts` — DTII art bindings: texture keys, `tileCenter`, `tileIndex`/`isGridTile` (some named frames sit at y%16==8 and can't be tilemap tiles), `floorFrameAt` variants
- `src/game/draws.ts` — **single source of truth** turning a Floorplan into draw commands (ground tiles / blob wall pieces / colliders) plus the depth model (`ACTOR_DEPTH`, `actorDepth(feetY)`, `wallBaseDepth`). The dungeon is carved into solid rock: EVERY non-walkable cell gets its blob piece (the mask-255 interior tile is near-black by design, matching 0x72's sample), and wall cells touching floor are paved underneath — the tall-wall art has transparent margins that show the ground a wall stands on. Consumed by BOTH DungeonScene and the offline preview scripts so live and offline rendering can't drift.
- `src/game/anims.ts` (typed anim registry — add monster rows here), `hud.ts` (HUD contract: `setHud`/`patchHud`, read by UIScene), `input.ts` (`KeyInput` → move intent + restart keys), `debug.ts` (window.nadir hook), `dtii-frames.ts` (GENERATED — `npm run assets:atlas`)
- `src/entities/` — `Actor` (physics sprite base: feet box config, drop shadow, feet-y depth sort in preUpdate; monsters extend it), `Player` (feet box 10×4 @ (3,18): box height = gap to north walls, bottom 6px above sprite bottom = leg overhang behind south walls)
- `src/scenes/` — `BootScene` (load + registerAnims + seed), `DungeonScene` (composes the above: buildFloor / buildObjectives / setupCamera / fadeTo transitions), `UIScene` (renders HudState)
- `scripts/render-map.ts` (seed/depth preview) + `scripts/render-ascii.ts` (hand-written ascii floors — the wall-art audit harness) + shared `scripts/draw-json.ts`, composited by `scripts/compose-map.ps1`: `npx vite-node scripts/render-map.ts <seed> <depth> out.json` then `pwsh scripts/compose-map.ps1 -Json out.json -Out out.png -Scale 3`.
- `public/assets/dtii/` — **0x72 DungeonTileset II v1.7** (CC-0): `dungeon_sheet.png` (512×512), `tile_list_v1.7.txt` (name x y w h — the source of truth), generated `atlas.json`, license note. Every character has 4-frame idle+run (most have a hit frame). Monster bench for M2, by depth band: tiny_zombie/goblin/imp (16×16) up top → skelet/orc_warrior/masked_orc (16×23) mid → chort/wogol/necromancer deep → **big_demon/ogre/big_zombie (32×36) at the nadir**. Also: mimic chest, animated chests/coins/spikes/wall fountains, 27 weapon sprites, ui_heart_full/half/empty, doors. The zip also ships 3×3-minimal autotile atlases (not vendored; in the download) if we ever outgrow the named-tile grammar.

## Controls

- Move: WASD / arrows
- R: restart the current dungeon (same seed) · N: new dungeon (fresh seed)
- The active seed is always pinned into the URL (`?seed=…`) — copy the URL to share/reproduce a run.

## Debug hook

`window.nadir` in the browser console: `.state()`, `.warp(tx, ty)`, `.move(vx, vy, ms)`, `.descend()`. `window.game` (the Phaser.Game) is also exposed.

Headless verification when the Browser pane is hidden (rAF throttled to zero, so Phaser never steps on its own): drive frames manually with a persistent clock — `t += 16.7; game.step(t, 16.7)` in a loop — then read pixels via `game.canvas.toDataURL()` (the CANVAS renderer is used specifically so this stays readable) and decode the base64 to a PNG. Keep one monotonic `t` across calls.

**Check `document.hidden` first.** If the pane is VISIBLE, Phaser's real rAF loop is running — never call `game.step` with synthetic timestamps then (the two clocks interleave, `time.now` oscillates, and every timer/tween/debugMove misbehaves — symptoms: frozen movement probes, ghost double-sprites in captures). With a visible pane, test with real-time waits instead. Also: `cam.scrollX/Y` are relative to the UNZOOMED canvas — for world→screen math use `screen = (world - cam.midPoint) * zoom + canvasSize/2`.

## Roadmap

- [x] M0 skeleton: procgen floor renders, WASD/arrow movement, wall collision, camera follow
- [x] M1 descent: ladder → smaller floor, HUD depth counter, nadir prize + win banner, R restarts the run
- [x] M1.5 art migration: DTII everywhere — animated knight (idle/run), chest-open anim on the win, wall grammar + generator merge pass, offline preview tooling
- [x] M1.6 refinement: characters pass behind walls (faces/edges above actors + feet-y depth sort), stutter fix (variable-step physics + hard follow with deadzone), R/N restart keys, seed pinned to URL, descend zoom punch
- [ ] M2 danger: enemies with chase AI (depth-banded DTII monsters, big_demon at the nadir), health + heart HUD, melee (weapon sprite swing, Gungeon-style), death & restart
- [ ] M3 texture: items/potions, fog of war, doors/banners/fountains as room decor, sound (candidate: Ninja Adventure's CC-0 SFX/music), optional: blob floor atlas for floor-edge shadows

## Decisions log

- 2026-08-26 (tunneling): the "squeak through walls" bug was TIMESTEP, not geometry or the solver — `fixedStep: false` (the stutter fix) plus Phaser's default delta floor of 5fps meant one 200ms hitch moved the body 19px in a single physics step, clean through any wall (reproduced on demand with big-delta steps). Geometry had been machine-proven sealed all along (collision.test.ts leak detector). Fix: `fps: { min: 30 }` clamps deltas to 33ms, and the standing invariant `maxActorSpeed / PHYSICS_MIN_FPS < MIN_SOLID (8px)` is pinned by a test (see `game/physics.ts`). Anything faster than ~240px/s (M2 projectiles?) needs swept collision, not a bigger clamp. NOTE: the manual `game.step` debug harness bypasses this clamp — always step it with ≤33ms deltas.
- 2026-08-26 (blob oracle): replaced the entire hand-written wall grammar (~150 lines of neighbor special-casing in `wallPlacements`, the capsN/capsS layer machinery, and the generator's no-1-thick-walls merge pass) with standard blob autotiling driven by DTII v1.7's own `atlas_walls_high` — the pack was authored against the Godot 3×3-minimal template all along (README → godot-docs #3316). The mask→cell table was machine-extracted from the official template marker image and validated exhaustively (47 classes, no dups, no gaps). Every wall-top audit defect (2-thick band cap-mush, 1-wide chasm-slot walls, T-junctions, corner steps) fixed by construction. Lesson recorded: check whether an asset pack ships a formal autotile spec BEFORE deriving a grammar from screenshots.
- 2026-08-26 (structure pass): pre-M2 DRY/architecture hardening. The floor-draw pipeline was deduplicated into `game/draws.ts` after the scene and offline renderer drifted once; wall grammar + draw invariants now unit-tested (18 tests total). Entities own their bodies/shadows/depth (Actor base). Anim keys, HUD shape, and input are typed modules — no raw strings/registry shapes in scenes. Deliberately skipped: ESLint/Prettier (typecheck + tests + review carry quality; revisit if collaboration grows), ECS frameworks (Phaser scene + entity classes are enough at this scale).

- 2026-08-26: Real-time action (not turn-based). v1 is descend-only (no return climb). Kenney Tiny Dungeon CC0 tileset. Shrink curve 64→9 over 9 floors (SHRINK=0.78, MIN_SIZE=9). Camera: follow at zoom 3, switch to static centered view when the floor fits on screen (last two depths).
- 2026-08-26 (art pass): walls use the pack's real grammar (no rotation needed — the fix was tile *roles*, not orientation). Generator keeps scatter-rooms + nearest-neighbor L-corridors, now with 1–3 extra loop corridors per floor so layouts aren't pure trees. Alternatives (BSP, cellular-automata caves, TinyKeep-style graph gen) deliberately deferred; revisit for depth-band variety (e.g. cave-flavored middle floors) rather than replacing the core.
- 2026-08-26 (M1.6): rendering/feel conventions locked in. Occlusion: wall faces + edge strips render at `WALL_OVER_ACTORS_DEPTH` above all actors; actors depth-sort at `ACTOR_DEPTH + feet-y` (player updates per frame; chest static; monsters must do the same in M2). Motion: Arcade `fixedStep: false` (fixed 60Hz physics vs high-refresh rendering made the player update every other frame — "camera smooth, character stutters"), camera hard-follow (lerp 1) + 64×48 deadzone so camera and sprite quantize together under pixel rounding. Never reintroduce follow-lerp with roundPixels.
- 2026-08-26 (M1.5): switched all art from Kenney Tiny Dungeon to **0x72 DungeonTileset II v1.7** (CC-0) — Tiny Dungeon's platform-style wall vocabulary can't cover arbitrary procgen wall masks and has no animation frames; DTII is authored for this style and animates everything. Generator gained a merge pass (no one-tile-thick horizontal walls — the face+cap grammar needs the row) with a test pinning it. Characters face sideways only (flipX); attack anims don't exist — melee will swing separate weapon sprites. itch.io downloads are session-keyed (see the browser-assisted flow in session history); assets are vendored so this never needs repeating.
