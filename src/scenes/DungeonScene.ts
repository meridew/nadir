import Phaser from 'phaser';
import { randomSeedString } from '../core/rng';
import { generate, isWalkable, maxDepth, type Floorplan } from '../dungeon/generate';
import { lineOfSight } from '../dungeon/los';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { ANIM } from '../game/anims';
import { actorDepth, buildFloorDraws } from '../game/draws';
import { wallSheetFrame } from '../game/dtii-blob';
import { installDebugHook } from '../game/debug';
import { CONTACT_DAMAGE, MAX_HP, circleIntersectsRect } from '../game/combat';
import { setHud, patchHud } from '../game/hud';
import { KeyInput } from '../game/input';
import { MONSTER_SPECIES, placeMonsters } from '../game/monsters';
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
  /** carried across floors within a run; omitted = fresh run at MAX_HP */
  hp?: number;
}

const ZOOM = 3;
const TRANSITION_MS = 250;

export class DungeonScene extends Phaser.Scene {
  private seed = 'nadir';
  private depth = 1;
  private plan!: Floorplan;
  private player!: Player;
  private monsters: Monster[] = [];
  private prizeSprite?: Phaser.GameObjects.Sprite;
  private keyInput!: KeyInput;
  private wallBodies: Phaser.GameObjects.Zone[] = [];
  private transitioning = false;
  private won = false;
  private dead = false;
  private hp = MAX_HP;
  private debugMove: { vx: number; vy: number; until: number } | null = null;
  /** flight recorder: recent feet-box positions for glitch reports (nadir.trail()) */
  private crumbs: { t: number; x: number; y: number; dt: number }[] = [];

  constructor() {
    super('dungeon');
  }

  init(data: Partial<DungeonData>) {
    this.seed = data.seed ?? this.seed;
    this.depth = data.depth ?? 1;
    this.hp = data.hp ?? MAX_HP;
    this.transitioning = false;
    this.won = false;
    this.dead = false;
    this.debugMove = null;
    this.prizeSprite = undefined;
    this.monsters = [];
  }

  create() {
    const plan = (this.plan = generate(this.seed, this.depth));
    const worldPx = plan.size * TILE_SIZE;

    this.buildFloor(plan);
    this.player = new Player(this, tileCenter(plan.spawn.x), tileCenter(plan.spawn.y));
    this.physics.world.setBounds(0, 0, worldPx, worldPx);
    this.player.setCollideWorldBounds(true);
    this.buildObjectives(plan);
    this.spawnMonsters(plan);
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
      hp: this.hp,
      maxHp: MAX_HP,
      dead: false,
    });

    installDebugHook({
      scene: this,
      state: () => ({
        depth: this.depth,
        maxDepth: maxDepth(),
        size: plan.size,
        seed: this.seed,
        won: this.won,
        hp: this.hp,
        dead: this.dead,
        player: {
          x: Math.floor(this.player.x / TILE_SIZE),
          y: Math.floor(this.player.y / TILE_SIZE),
        },
        stairs: plan.stairsDown,
        prize: plan.prize,
        monsters: this.monsters.map((m) => ({
          species: m.def.id,
          x: Math.floor(m.x / TILE_SIZE),
          y: Math.floor(m.y / TILE_SIZE),
          alerted: m.alerted,
        })),
      }),
      warp: (tx, ty) => this.player.setPosition(tileCenter(tx), tileCenter(ty)),
      move: (vx, vy, ms) => {
        this.debugMove = { vx, vy, until: this.time.now + ms };
      },
      descend: () => this.descend(),
      trail: () => this.crumbs.slice(),
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

    const draws = buildFloorDraws(plan);
    for (const t of draws.ground) ground.putTileAt(tileIndex(t.name), t.x, t.y);
    for (const w of draws.walls) {
      // 16x32 blob piece, bottom-anchored to its cell so the cap half rises
      // into the cell above; y-sorts against actors by its base depth.
      this.add
        .image(tileCenter(w.x), w.y * TILE_SIZE, WALLS_KEY, wallSheetFrame(w.cell))
        .setDepth(w.depth);
    }
    // art-shaped static colliders (see WALL_CELL_INSETS): walls collide where
    // they are visible; their painted ground margins stay walkable.
    this.wallBodies = [];
    for (const c of draws.colliders) {
      const zone = this.add.zone(c.px + c.w / 2, c.py + c.h / 2, c.w, c.h);
      this.physics.add.existing(zone, true);
      this.wallBodies.push(zone);
    }
  }

  private buildObjectives(plan: Floorplan) {
    this.physics.add.collider(this.player, this.wallBodies);
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

  /** The danger: bench monsters spawn and chase (damage arrives with the hearts chunk). */
  private spawnMonsters(plan: Floorplan) {
    this.monsters = placeMonsters(plan, this.seed).map(
      (m) => new Monster(this, tileCenter(m.x), tileCenter(m.y), MONSTER_SPECIES[m.species]),
    );
    if (this.monsters.length === 0) return;
    this.physics.add.collider(this.monsters, this.wallBodies);
    this.physics.add.collider(this.monsters, this.monsters);
    this.physics.add.collider(this.player, this.monsters, (_p, m) =>
      this.onMonsterContact(m as Monster),
    );
  }

  /** Apply the live swing's hit circle to unhit monsters (sprite bounds — hitting what you see). */
  private resolveSwing() {
    const swing = this.player.activeSwing;
    if (!swing) return;
    for (const m of [...this.monsters]) {
      if (swing.hit.has(m)) continue;
      const b = m.getBounds();
      if (!circleIntersectsRect(swing.x, swing.y, swing.r, b.x, b.y, b.width, b.height)) continue;
      swing.hit.add(m);
      if (m.takeHit(this.player.x, this.player.feetY)) {
        // splice in place — the physics colliders hold THIS array by reference
        this.monsters.splice(this.monsters.indexOf(m), 1);
        m.perish();
      }
    }
  }

  private onMonsterContact(m: Monster) {
    if (this.dead || this.won || this.transitioning) return;
    if (!this.player.hurt(m.x, m.feetY)) return;
    this.hp = Math.max(0, this.hp - CONTACT_DAMAGE);
    patchHud(this, { hp: this.hp });
    this.cameras.main.shake(90, 0.004);
    if (this.hp <= 0) this.onDeath();
  }

  private onDeath() {
    this.dead = true;
    this.player.die();
    patchHud(this, { dead: true, status: 'The dungeon keeps what it kills.' });
  }

  private canSee = (m: Monster): boolean => {
    const s = this.plan.size;
    const walk = (tx: number, ty: number) =>
      tx >= 0 && ty >= 0 && tx < s && ty < s && isWalkable(this.plan.tiles[ty * s + tx]);
    const eye = m.feetCenter;
    const target = this.player.feetCenter;
    return lineOfSight(
      walk,
      eye.x / TILE_SIZE,
      eye.y / TILE_SIZE,
      target.x / TILE_SIZE,
      target.y / TILE_SIZE,
    );
  };

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
      for (const m of this.monsters) m.halt();
      return;
    }
    if (this.keyInput.justRestart()) return this.fadeTo({ seed: this.seed, depth: 1 });
    if (this.keyInput.justNewRun()) return this.fadeTo({ seed: randomSeedString(), depth: 1 });
    if (this.won) {
      this.player.halt();
      for (const m of this.monsters) m.halt();
      return;
    }
    if (this.dead) {
      // the knight holds the death pose; the dungeon goes still
      for (const m of this.monsters) m.halt();
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
    if (this.keyInput.attackDown()) this.player.attack();
    this.resolveSwing();
    for (const m of this.monsters) m.updateAI(this.player, this.canSee, this.time.now);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.crumbs.push({
      t: Math.round(this.time.now),
      x: Math.round(body.x * 10) / 10,
      y: Math.round(body.y * 10) / 10,
      dt: Math.round(this.game.loop.delta * 10) / 10,
    });
    if (this.crumbs.length > 240) this.crumbs.shift();
  }

  private descend() {
    if (this.won || this.dead) return;
    this.fadeTo({ seed: this.seed, depth: this.depth + 1, hp: this.hp }, { zoomPunch: true });
  }

  private claimPrize() {
    if (this.won || this.dead || this.transitioning) return;
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
