import Phaser from 'phaser';

interface Hud {
  depth: number;
  maxDepth: number;
  size: number;
  seed: string;
  status: string;
  won: boolean;
}

export class UIScene extends Phaser.Scene {
  private line1!: Phaser.GameObjects.Text;
  private line2!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super('ui');
  }

  create() {
    const mono = 'Consolas, "Courier New", monospace';
    this.line1 = this.add
      .text(12, 10, '', { fontFamily: mono, fontSize: '18px', color: '#e8e0c8' })
      .setShadow(1, 1, '#000000', 2);
    this.line2 = this.add
      .text(12, 32, '', { fontFamily: mono, fontSize: '13px', color: '#9a917c' })
      .setShadow(1, 1, '#000000', 2);
    this.add
      .text(12, this.scale.height - 10, 'move: WASD / arrows', {
        fontFamily: mono,
        fontSize: '12px',
        color: '#6b6455',
      })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000000', 2);

    this.banner = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        'You have reached the nadir.\n\nPress R to rise again.',
        {
          fontFamily: mono,
          fontSize: '30px',
          color: '#f2d98c',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setShadow(2, 2, '#000000', 4)
      .setVisible(false);

    const render = (hud: Hud | undefined) => {
      if (!hud) return;
      this.line1.setText(`Depth ${hud.depth} / ${hud.maxDepth}  —  ${hud.size}×${hud.size}`);
      this.line2.setText(`seed ${hud.seed}  —  ${hud.status}`);
      this.banner.setVisible(hud.won);
    };

    render(this.registry.get('hud') as Hud | undefined);
    const onChange = (_parent: unknown, value: Hud) => render(value);
    this.registry.events.on('changedata-hud', onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-hud', onChange);
    });
  }
}
