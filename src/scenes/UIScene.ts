import Phaser from 'phaser';
import { heartsFor } from '../game/combat';
import { HUD_KEY, getHud, type HudState } from '../game/hud';
import { ATLAS_KEY } from '../game/tiles';

const HEART_SCALE = 2;
const HEART_SPACING = 32;

export class UIScene extends Phaser.Scene {
  private line1!: Phaser.GameObjects.Text;
  private line2!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('ui');
  }

  create() {
    this.hearts = [];
    const mono = 'Consolas, "Courier New", monospace';
    this.line1 = this.add
      .text(12, 10, '', { fontFamily: mono, fontSize: '18px', color: '#e8e0c8' })
      .setShadow(1, 1, '#000000', 2);
    this.line2 = this.add
      .text(12, 32, '', { fontFamily: mono, fontSize: '13px', color: '#9a917c' })
      .setShadow(1, 1, '#000000', 2);
    this.add
      .text(12, this.scale.height - 10, 'move: WASD / arrows  ·  R: restart dungeon  ·  N: new dungeon', {
        fontFamily: mono,
        fontSize: '12px',
        color: '#6b6455',
      })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000000', 2);

    this.banner = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: mono,
        fontSize: '30px',
        color: '#f2d98c',
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(2, 2, '#000000', 4)
      .setVisible(false);

    const render = (hud: HudState | undefined) => {
      if (!hud) return;
      this.line1.setText(`Depth ${hud.depth} / ${hud.maxDepth}  —  ${hud.size}×${hud.size}`);
      this.line2.setText(`seed ${hud.seed}  —  ${hud.status}`);

      const icons = heartsFor(hud.hp, hud.maxHp);
      while (this.hearts.length < icons.length) {
        this.hearts.push(
          this.add
            .image(26 + this.hearts.length * HEART_SPACING, 66, ATLAS_KEY, 'ui_heart_full')
            .setScale(HEART_SCALE),
        );
      }
      icons.forEach((icon, i) => this.hearts[i].setFrame(`ui_heart_${icon}`));

      if (hud.dead) {
        this.banner
          .setText(`You died at depth ${hud.depth}.\n\nR: retry this dungeon  ·  N: a new dungeon`)
          .setColor('#e2574c')
          .setVisible(true);
      } else if (hud.won) {
        this.banner
          .setText('You have reached the nadir.\n\nR: descend this dungeon again  ·  N: a new dungeon')
          .setColor('#f2d98c')
          .setVisible(true);
      } else {
        this.banner.setVisible(false);
      }
    };

    render(getHud(this));
    const onChange = (_parent: unknown, value: HudState) => render(value);
    this.registry.events.on(`changedata-${HUD_KEY}`, onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${HUD_KEY}`, onChange);
    });
  }
}
