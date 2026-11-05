import Phaser from 'phaser';
import { Button, H, W, txt } from '../ui/widgets';
import { FLOOR_Y, drawBody, drawGrandfatherClock, drawWindow } from '../ui/art';
import { INTRO_LINES } from '../data/case1';

export class IntroScene extends Phaser.Scene {
  private idx = 0;
  private line!: Phaser.GameObjects.Text;

  constructor() {
    super('Intro');
  }

  create() {
    this.idx = 0;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1b2233, 0x1b2233, 0x0a0d14, 0x0a0d14, 1);
    bg.fillRect(0, 0, W, H);
    drawWindow(bg, 860, 120, 200, 260);
    bg.fillStyle(0x020306, 1);
    bg.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    drawGrandfatherClock(this, 200);
    const body = this.add.graphics();
    drawBody(body, W / 2, FLOOR_Y - 6);

    const glow = this.add.image(W / 2, FLOOR_Y - 40, 'glow').setScale(2.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, FLOOR_Y - 40, 'ghost').setAlpha(0);
    this.tweens.add({ targets: [ghost, glow], y: 330, alpha: 1, duration: 3000, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: [ghost, glow], scaleX: '*=1.02', duration: 1400, yoyo: true, repeat: -1, delay: 3000 });

    this.add.image(W / 2, H / 2, 'vignette');

    this.add.rectangle(W / 2, 90, W - 160, 120, 0x05070d, 0.75).setStrokeStyle(1, 0x2c3a5e);
    this.line = txt(this, W / 2, 90, '', 28, '#eef3ff', { align: 'center', wordWrap: { width: W - 220 } }).setOrigin(0.5);
    const hint = txt(this, W / 2, 168, 'tap to continue', 18, '#6f7ea8').setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });

    new Button(this, W - 110, H - 50, 'Skip ▸', () => this.finish(), { width: 160, height: 50, size: 20 });

    this.showLine();
    let down = false;
    this.input.on('pointerdown', () => (down = true));
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || !down) return;
      down = false;
      this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.cameras.main.fadeIn(800);
  }

  private advance() {
    this.idx++;
    if (this.idx >= INTRO_LINES.length) this.finish();
    else this.showLine();
  }

  private showLine() {
    this.line.setText(INTRO_LINES[this.idx]).setAlpha(0);
    this.tweens.add({ targets: this.line, alpha: 1, duration: 500 });
  }

  private finish() {
    if (this.idx > 1000) return;
    this.idx = 1001;
    this.cameras.main.fade(600, 0, 0, 0, true);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
