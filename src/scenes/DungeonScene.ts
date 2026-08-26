import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import {
  Tile,
  generate,
  isWalkable,
  maxDepth,
  type Floorplan,
} from '../dungeon/generate';
import {
  ATLAS_KEY,
  TILES_KEY,
  TILE_SIZE,
  WALL_LAYER_OFFSET,
  floorFrameAt,
  isGridTile,
  tileIndex,
  wallPlacements,
  type WallLayerName,
} from '../game/tiles';

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
  private shadow!: Phaser.GameObjects.Ellipse;
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
    const tileset = map.addTilesetImage(TILES_KEY, TILES_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!;
    const ground = map.createBlankLayer('ground', tileset)!.setDepth(0);
    const wallLayers: Record<WallLayerName, Phaser.Tilemaps.TilemapLayer> = {
      capsS: map.createBlankLayer('capsS', tileset)!.setDepth(1),
      capsN: map.createBlankLayer('capsN', tileset)!.setDepth(2),
      faces: map.createBlankLayer('faces', tileset)!.setDepth(3),
    };
    wallLayers.capsS.y += WALL_LAYER_OFFSET.capsS;
    const collide = map.createBlankLayer('collide', tileset)!.setVisible(false);

    const walkableAt = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < s && y < s && isWalkable(plan.tiles[y * s + x]);

    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const t = plan.tiles[y * s + x];
        if (isWalkable(t)) {
          ground.putTileAt(tileIndex(floorFrameAt(x, y, this.depth)), x, y);
        } else if (t === Tile.Wall) {
          collide.putTileAt(tileIndex('wall_mid'), x, y);
          for (const p of wallPlacements(walkableAt, x, y)) {
            if (isGridTile(p.name)) {
              wallLayers[p.layer].putTileAt(tileIndex(p.name), p.x, p.y);
            } else {
              // off-grid frames (wall_edge_* family) render as static images
              this.add
                .image(
                  p.x * TILE_SIZE + TILE_SIZE / 2,
                  p.y * TILE_SIZE + TILE_SIZE / 2 + WALL_LAYER_OFFSET[p.layer],
                  ATLAS_KEY,
                  p.name,
                )
                .setDepth(wallLayers[p.layer].depth);
            }
          }
        }
      }
    }
    collide.setCollisionByExclusion([-1]);

    let stairsZone: Phaser.GameObjects.Zone | null = null;
    if (plan.stairsDown) {
      this.add
        .image(px(plan.stairsDown.x), px(plan.stairsDown.y), ATLAS_KEY, 'floor_ladder')
        .setDepth(1);
      stairsZone = this.add.zone(px(plan.stairsDown.x), px(plan.stairsDown.y), 10, 10);
      this.physics.add.existing(stairsZone, true);
    }

    let prizeZone: Phaser.GameObjects.Zone | null = null;
    if (plan.prize) {
      this.prizeSprite = this.add
        .sprite(px(plan.prize.x), px(plan.prize.y), ATLAS_KEY, 'chest_full_open_anim_f0')
        .setDepth(4);
      prizeZone = this.add.zone(px(plan.prize.x), px(plan.prize.y), 12, 12);
      this.physics.add.existing(prizeZone, true);
    }

    this.shadow = this.add.ellipse(0, 0, 10, 4, 0x000000, 0.35).setDepth(4);
    this.player = this.physics.add.sprite(
      px(plan.spawn.x),
      px(plan.spawn.y),
      ATLAS_KEY,
      'knight_m_idle_anim_f0',
    );
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 8);
    body.setOffset(3, 19);
    this.player.setDepth(5);
    this.player.play('knight_m_idle');
    this.physics.world.setBounds(0, 0, worldPx, worldPx);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, collide);
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
      this.player.play('knight_m_idle', true);
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

    if (vx !== 0) this.player.setFlipX(vx < 0);
    this.player.play(vx !== 0 || vy !== 0 ? 'knight_m_run' : 'knight_m_idle', true);
    this.shadow.setPosition(this.player.x, this.player.y + 13);
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
    this.prizeSprite?.play('chest_open');
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
