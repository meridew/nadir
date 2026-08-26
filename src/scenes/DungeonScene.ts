import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import { generate, maxDepth, type Floorplan } from '../dungeon/generate';
import { Player } from '../entities/Player';
import { ANIM } from '../game/anims';
import { actorDepth, buildFloorDraws } from '../game/draws';
import { wallSheetFrame } from '../game/dtii-blob';
import { installDebugHook } from '../game/debug';
import { setHud, patchHud } from '../game/hud';
import { KeyInput } from '../game/input';
import {
  ATLAS_KEY,
  TILES_KEY,
  TILE_SIZE,
  WALLS_KEY,
  tileCenter,
  tileIndex,
} from '../game/tiles';

interface DungeonData {
  seed: string;
  depth: number;
}

const ZOOM = 3;
const TRANSITION_MS = 250;

export class DungeonScene extends Phaser.Scene {
  private seed = 'nadir';
  private depth = 1;
  private plan!: Floorplan;
  private player!: Player;
  private prizeSprite?: Phaser.GameObjects.Sprite;
  private keyInput!: KeyInput;
  private collideLayer!: Phaser.Tilemaps.TilemapLayer;
  private transitioning = false;
  private won = false;
  private debugMove: { vx: number; vy: number; until: number } | null = null;

  constructor() {
    super('dungeon');
  }

  init(data: Partial<DungeonData>) {
    this.seed = data.seed ?? this.seed;
    this.depth = data.depth ?? 1;
    this.transitioning = false;
    this.won = false;
    this.debugMove = null;
    this.prizeSprite = undefined;
  }

  create() {
    const plan = (this.plan = generate(this.seed, this.depth));
    const worldPx = plan.size * TILE_SIZE;

    this.buildFloor(plan);
    this.player = new Player(this, tileCenter(plan.spawn.x), tileCenter(plan.spawn.y));
    this.physics.world.setBounds(0, 0, worldPx, worldPx);
    this.player.setCollideWorldBounds(true);
    this.buildObjectives(plan);
    this.setupCamera(worldPx);

    this.keyInput = new KeyInput(this);
    if (this.depth === 1) {
      // Pin the run's seed into the URL so every run is shareable/reproducible.
      window.history.replaceState(null, '', `?seed=${encodeURIComponent(this.seed)}`);
    }

    setHud(this, {
      depth: this.depth,
      maxDepth: maxDepth(),
      size: plan.size,
      seed: this.seed,
      status: plan.isNadir ? 'The nadir. Claim what waits here.' : 'Find the way down.',
      won: false,
    });

    installDebugHook({
      scene: this,
      state: () => ({
        depth: this.depth,
        maxDepth: maxDepth(),
        size: plan.size,
        seed: this.seed,
        won: this.won,
        player: {
          x: Math.floor(this.player.x / TILE_SIZE),
          y: Math.floor(this.player.y / TILE_SIZE),
        },
        stairs: plan.stairsDown,
        prize: plan.prize,
      }),
      warp: (tx, ty) => this.player.setPosition(tileCenter(tx), tileCenter(ty)),
      move: (vx, vy, ms) => {
        this.debugMove = { vx, vy, until: this.time.now + ms };
      },
      descend: () => this.descend(),
    });
  }

  /** Materialize the shared draw commands: ground tiles, blob wall images, colliders. */
  private buildFloor(plan: Floorplan) {
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: plan.size,
      height: plan.size,
    });
    const tileset = map.addTilesetImage(TILES_KEY, TILES_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!;
    const ground = map.createBlankLayer('ground', tileset)!.setDepth(0);
    const collide = map.createBlankLayer('collide', tileset)!.setVisible(false);

    const draws = buildFloorDraws(plan);
    for (const t of draws.ground) ground.putTileAt(tileIndex(t.name), t.x, t.y);
    for (const w of draws.walls) {
      // 16x32 blob piece, bottom-anchored to its cell so the cap half rises
      // into the cell above; y-sorts against actors by its base depth.
      this.add
        .image(tileCenter(w.x), w.y * TILE_SIZE, WALLS_KEY, wallSheetFrame(w.cell))
        .setDepth(w.depth);
    }
    for (const c of draws.colliders) collide.putTileAt(0, c.x, c.y);
    collide.setCollisionByExclusion([-1]);
    this.collideLayer = collide;
  }

  private buildObjectives(plan: Floorplan) {
    this.physics.add.collider(this.player, this.collideLayer);
    if (plan.stairsDown) {
      const { x, y } = plan.stairsDown;
      this.add.image(tileCenter(x), tileCenter(y), ATLAS_KEY, 'floor_ladder').setDepth(1);
      const zone = this.add.zone(tileCenter(x), tileCenter(y), 10, 10);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.descend());
    }
    if (plan.prize) {
      const { x, y } = plan.prize;
      this.prizeSprite = this.add
        .sprite(tileCenter(x), tileCenter(y), ATLAS_KEY, 'chest_full_open_anim_f0')
        .setDepth(actorDepth((y + 1) * TILE_SIZE));
      const zone = this.add.zone(tileCenter(x), tileCenter(y), 12, 12);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.claimPrize());
    }
  }

  private setupCamera(worldPx: number) {
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    const viewW = this.scale.width / ZOOM;
    const viewH = this.scale.height / ZOOM;
    if (worldPx <= viewW && worldPx <= viewH) {
      // the whole floor fits on screen — hold it centered (the deep floors)
      cam.centerOn(worldPx / 2, worldPx / 2);
    } else {
      cam.setBounds(0, 0, worldPx, worldPx);
      // Hard follow + deadzone: no lerp, so camera and player quantize to the
      // pixel grid together (lerp + rounding makes the player judder against a
      // smooth camera). NOTE for tooling: scrollX/Y are relative to the UNZOOMED
      // canvas — use cam.midPoint for world→screen math.
      cam.startFollow(this.player, true, 1, 1);
      cam.setDeadzone(64, 48);
    }
    cam.fadeIn(TRANSITION_MS, 0, 0, 0);
  }

  update() {
    if (this.transitioning) {
      this.player.halt();
      return;
    }
    if (this.keyInput.justRestart()) return this.fadeTo({ seed: this.seed, depth: 1 });
    if (this.keyInput.justNewRun()) return this.fadeTo({ seed: randomSeedString(), depth: 1 });
    if (this.won) {
      this.player.halt();
      return;
    }

    let intent = this.keyInput.moveIntent();
    if (this.debugMove) {
      if (this.time.now < this.debugMove.until) {
        intent = { vx: this.debugMove.vx, vy: this.debugMove.vy };
      } else {
        this.debugMove = null;
      }
    }
    this.player.move(intent);
  }

  private descend() {
    if (this.won) return;
    this.fadeTo({ seed: this.seed, depth: this.depth + 1 }, { zoomPunch: true });
  }

  private claimPrize() {
    if (this.won || this.transitioning) return;
    this.won = true;
    this.prizeSprite?.play(ANIM.chestOpen);
    patchHud(this, { status: 'Press R to descend again, N for a new dungeon.', won: true });
  }

  private fadeTo(data: DungeonData, opts: { zoomPunch?: boolean } = {}) {
    if (this.transitioning) return;
    this.transitioning = true;
    const cam = this.cameras.main;
    if (opts.zoomPunch) cam.zoomTo(ZOOM * 1.25, TRANSITION_MS, 'Sine.easeIn', true);
    cam.fadeOut(TRANSITION_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart(data);
    });
  }
}
