import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import {
  Tile,
  generate,
  isWalkable,
  maxDepth,
  type Floorplan,
} from '../dungeon/generate';
import { SHEET_KEY, TILES, TILE_SIZE, variantAt } from '../game/tiles';

interface DungeonData {
  seed: string;
  depth: number;
}

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'R',
  Phaser.Input.Keyboard.Key
>;

const ZOOM = 3;
const PLAYER_SPEED = 95;

export class DungeonScene extends Phaser.Scene {
  private seed = 'nadir';
  private depth = 1;
  private plan!: Floorplan;
  private player!: Phaser.Physics.Arcade.Sprite;
  private prizeSprite?: Phaser.GameObjects.Sprite;
  private keys!: Keys;
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
    const s = plan.size;
    const worldPx = s * TILE_SIZE;
    const px = (t: number) => t * TILE_SIZE + TILE_SIZE / 2;

    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: s,
      height: s,
    });
    const tileset = map.addTilesetImage(SHEET_KEY, SHEET_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!;
    const ground = map.createBlankLayer('ground', tileset)!;
    const walls = map.createBlankLayer('walls', tileset)!;

    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const t = plan.tiles[y * s + x];
        if (isWalkable(t)) {
          ground.putTileAt(variantAt(TILES.floorVariants, x, y, this.depth), x, y);
        } else if (t === Tile.Wall) {
          walls.putTileAt(variantAt(TILES.wallVariants, x, y, this.depth), x, y);
        }
      }
    }
    walls.setCollisionByExclusion([-1]);

    let stairsZone: Phaser.GameObjects.Zone | null = null;
    if (plan.stairsDown) {
      this.add.sprite(px(plan.stairsDown.x), px(plan.stairsDown.y), SHEET_KEY, TILES.ladderDown);
      stairsZone = this.add.zone(px(plan.stairsDown.x), px(plan.stairsDown.y), 10, 10);
      this.physics.add.existing(stairsZone, true);
    }

    let prizeZone: Phaser.GameObjects.Zone | null = null;
    if (plan.prize) {
      this.prizeSprite = this.add.sprite(px(plan.prize.x), px(plan.prize.y), SHEET_KEY, TILES.prizeClosed);
      prizeZone = this.add.zone(px(plan.prize.x), px(plan.prize.y), 12, 12);
      this.physics.add.existing(prizeZone, true);
    }

    this.player = this.physics.add.sprite(px(plan.spawn.x), px(plan.spawn.y), SHEET_KEY, TILES.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 8);
    body.setOffset(3, 7);
    this.player.setDepth(5);
    this.physics.world.setBounds(0, 0, worldPx, worldPx);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    if (stairsZone) this.physics.add.overlap(this.player, stairsZone, () => this.descend());
    if (prizeZone) this.physics.add.overlap(this.player, prizeZone, () => this.claimPrize());

    // Camera: follow on large floors; once the whole floor fits the view, hold it centered.
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    const viewW = this.scale.width / ZOOM;
    const viewH = this.scale.height / ZOOM;
    if (worldPx <= viewW && worldPx <= viewH) {
      cam.centerOn(worldPx / 2, worldPx / 2);
    } else {
      cam.setBounds(0, 0, worldPx, worldPx);
      cam.startFollow(this.player, true, 0.12, 0.12);
    }
    cam.fadeIn(250, 0, 0, 0);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,R') as Keys;

    this.registry.set('hud', {
      depth: this.depth,
      maxDepth: maxDepth(),
      size: s,
      seed: this.seed,
      status: plan.isNadir ? 'The nadir. Claim what waits here.' : 'Find the way down.',
      won: false,
    });

    // Dev hook: drive the game from the console / browser tooling.
    (window as unknown as Record<string, unknown>).nadir = {
      scene: this,
      state: () => ({
        depth: this.depth,
        maxDepth: maxDepth(),
        size: s,
        seed: this.seed,
        won: this.won,
        player: {
          x: Math.floor(this.player.x / TILE_SIZE),
          y: Math.floor(this.player.y / TILE_SIZE),
        },
        stairs: plan.stairsDown,
        prize: plan.prize,
      }),
      warp: (tx: number, ty: number) => this.player.setPosition(px(tx), px(ty)),
      move: (vx: number, vy: number, ms: number) => {
        this.debugMove = { vx, vy, until: this.time.now + ms };
      },
      descend: () => this.descend(),
    };
  }

  update() {
    if (this.transitioning) {
      this.player.setVelocity(0, 0);
      return;
    }
    if (this.won) {
      this.player.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.restartRun();
      return;
    }

    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) vx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) vy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) vy += 1;

    if (this.debugMove) {
      if (this.time.now < this.debugMove.until) {
        vx = this.debugMove.vx;
        vy = this.debugMove.vy;
      } else {
        this.debugMove = null;
      }
    }

    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
  }

  private descend() {
    if (this.transitioning || this.won) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ seed: this.seed, depth: this.depth + 1 });
    });
  }

  private claimPrize() {
    if (this.won || this.transitioning) return;
    this.won = true;
    this.prizeSprite?.setFrame(TILES.prizeOpen);
    const hud = this.registry.get('hud') as Record<string, unknown>;
    this.registry.set('hud', {
      ...hud,
      status: 'Press R to rise again.',
      won: true,
    });
  }

  private restartRun() {
    if (this.transitioning) return;
    this.transitioning = true;
    const pinned = new URL(window.location.href).searchParams.get('seed');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ seed: pinned ?? randomSeedString(), depth: 1 });
    });
  }
}
