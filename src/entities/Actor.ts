/**
 * Base class for anything that walks the dungeon: owns the drop shadow and
 * feet-based depth sorting so every actor occludes correctly against walls
 * (see game/draws.ts for the shared depth model). Monsters extend this in M2.
 */
import Phaser from 'phaser';
import { actorDepth } from '../game/draws';

export interface ActorConfig {
  /** physics feet box, in sprite-local pixels */
  bodySize: [w: number, h: number];
  bodyOffset: [x: number, y: number];
  shadow?: { width: number; height: number };
}

export abstract class Actor extends Phaser.Physics.Arcade.Sprite {
  private shadowEllipse?: Phaser.GameObjects.Ellipse;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    frame: string,
    config: ActorConfig,
  ) {
    super(scene, x, y, texture, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(...config.bodySize);
    body.setOffset(...config.bodyOffset);
    if (config.shadow) {
      this.shadowEllipse = scene.add.ellipse(
        x,
        y,
        config.shadow.width,
        config.shadow.height,
        0x000000,
        0.35,
      );
    }
    this.syncDepth();
  }

  /** World y of the physics feet — the anchor for depth sorting. */
  get feetY(): number {
    return (this.body as Phaser.Physics.Arcade.Body).bottom;
  }

  private syncDepth() {
    const feet = this.feetY;
    this.setDepth(actorDepth(feet));
    if (this.shadowEllipse) {
      this.shadowEllipse.setPosition(this.x, feet + 1);
      this.shadowEllipse.setDepth(actorDepth(feet) - 1);
    }
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.syncDepth();
  }

  destroy(fromScene?: boolean) {
    this.shadowEllipse?.destroy();
    super.destroy(fromScene);
  }
}
