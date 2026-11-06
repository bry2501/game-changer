import Phaser from 'phaser';
import { Button, H, W, hex, txt } from '../ui/widgets';
import { MEMORY_INTRO, MEMORY_OUTRO, SUSPECTS } from '../data/case1';
import { Sound } from '../audio/Sound';

/** Draws a suspect as a silhouette bust with a coloured rim and a small identifying detail. */
export function drawSuspect(scene: Phaser.Scene, x: number, y: number, i: number, scale = 1) {
  const s = SUSPECTS[i];
  const c = scene.add.container(x, y).setScale(scale);
  const rim = scene.add.image(0, -10, 'glow').setScale(3.2).setTint(s.color).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
  const g = scene.add.graphics();
  g.fillStyle(0x020306, 1);
  g.fillRoundedRect(-95, 40, 190, 150, 60); // shoulders
  g.fillRect(-22, 10, 44, 45); // neck
  g.fillCircle(0, -30, 58); // head
  switch (s.id) {
    case 'butler': // neat parting and a bow tie
      g.fillTriangle(-26, 62, 0, 74, -26, 86);
      g.fillTriangle(26, 62, 0, 74, 26, 86);
      g.fillStyle(0x020306, 1);
      g.fillEllipse(-8, -82, 110, 30);
      break;
    case 'niece': // long hair
      g.fillEllipse(-52, 10, 48, 150);
      g.fillEllipse(52, 10, 48, 150);
      g.fillEllipse(0, -80, 130, 50);
      break;
    case 'partner': // top hat
      g.fillRect(-48, -170, 96, 90);
      g.fillRoundedRect(-80, -92, 160, 18, 8);
      break;
    case 'gardener': // flat cap
      g.fillEllipse(0, -78, 130, 46);
      g.fillRoundedRect(10, -78, 90, 16, 8);
      break;
  }
  c.add([rim, g]);
  return c;
}

/**
 * Memories returning: an amber, softly blurred overlay, visually distinct from notes.
 * Page 0 = intro, pages 1..4 = suspects, final page = resolve.
 */
export class MemoryScene extends Phaser.Scene {
  private page = 0;
  private layer!: Phaser.GameObjects.Container;
  private busy = false;

  constructor() {
    super('Memory');
  }

  create() {
    this.page = 0;
    this.busy = false;
    Sound.setMood('memory');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a1d10, 0x2a1d10, 0x0b0805, 0x0b0805, 0.97);
    bg.fillRect(0, 0, W, H);
    this.add.image(W / 2, H / 2, 'vignette').setAlpha(0.9);
    this.add.particles(0, 0, 'fog', {
      x: { min: 0, max: W },
      y: { min: 0, max: H },
      speedX: { min: -10, max: 10 },
      speedY: { min: -6, max: 6 },
      scale: { min: 1.5, max: 3 },
      alpha: { start: 0.25, end: 0 },
      tint: 0xffd9a0,
      lifespan: 7000,
      frequency: 350,
    });
    txt(this, W / 2, 34, '— a memory returns —', 22, '#d9b98a', { fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.layer = this.add.container();
    new Button(this, W - 150, H - 56, 'Remember ▸', () => this.next(), {
      width: 230,
      height: 56,
      size: 22,
      fill: 0x2a1d10,
      stroke: 0xd9b98a,
    });
    let down = false;
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => (down = !over.length));
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (down && !over.length) this.next();
      down = false;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.show();
    this.cameras.main.fadeIn(900, 255, 230, 190);
  }

  private next() {
    if (this.busy) return;
    this.page++;
    Sound.blip();
    if (this.page > SUSPECTS.length + 1) {
      this.busy = true;
      this.cameras.main.fade(700, 0, 0, 0, true);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop();
        this.scene.resume('World', { from: 'memory' });
      });
      return;
    }
    this.busy = true;
    this.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.show();
        this.busy = false;
      },
    });
  }

  private show() {
    this.layer.removeAll(true);
    this.layer.setAlpha(0);
    const p = this.page;
    if (p === 0) {
      this.layer.add(
        txt(this, W / 2, H / 2 - 40, MEMORY_INTRO, 32, '#f3e2c4', {
          fontStyle: 'italic',
          align: 'center',
          wordWrap: { width: 900 },
        }).setOrigin(0.5),
      );
      SUSPECTS.forEach((_, i) => {
        const fig = drawSuspect(this, W / 2 + (i - (SUSPECTS.length - 1) / 2) * 190, H / 2 + 170, i, 0.55).setAlpha(0.35);
        this.layer.add(fig);
      });
    } else if (p <= SUSPECTS.length) {
      const i = p - 1;
      const s = SUSPECTS[i];
      this.layer.add(drawSuspect(this, 330, 400, i));
      this.layer.add(txt(this, 600, 190, s.name, 52, hex(s.color), { fontStyle: 'bold' }));
      this.layer.add(txt(this, 600, 256, s.role, 26, '#d9b98a', { fontStyle: 'italic' }));
      this.layer.add(
        txt(this, 600, 320, `“${s.memory}”`, 26, '#f3e2c4', { wordWrap: { width: 600 }, lineSpacing: 8 }),
      );
      this.layer.add(txt(this, 600, 560, `${p} of ${SUSPECTS.length}`, 18, '#8a7558'));
    } else {
      MEMORY_OUTRO.forEach((line, k) => {
        this.layer.add(
          txt(this, W / 2, 210 + k * 90, line, k === 0 ? 40 : 26, k === 0 ? '#ffe9b8' : '#f3e2c4', {
            fontStyle: k === 0 ? 'bold' : 'italic',
            align: 'center',
            wordWrap: { width: 1000 },
          }).setOrigin(0.5),
        );
      });
    }
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 600 });
  }
}
