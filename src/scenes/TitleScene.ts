import Phaser from 'phaser';
import { Button, DIM, H, W, fadeThen, soundToggle, txt } from '../ui/widgets';
import { Sound } from '../audio/Sound';
import { drawMansion } from '../ui/exterior';
import { CASE_TITLE, HOW_IT_WORKS, TITLE_TAGLINE } from '../data/case1';
import { GameState } from '../state/GameState';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#05060a');
    drawMansion(this, W, H);
    this.add.particles(0, 0, 'fog', {
      x: { min: -200, max: W + 200 },
      y: { min: 380, max: H },
      speedX: { min: -12, max: 12 },
      scale: { min: 1.5, max: 3 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 9000,
      frequency: 300,
    });

    // a soft dark panel so the title and level buttons read over the painting
    const panel = this.add.graphics();
    panel.fillStyle(0x070b16, 0.72);
    panel.fillRoundedRect(W / 2 - 590, 225, 1180, 330, 24);
    panel.lineStyle(2, 0x9cbfe0, 0.25);
    panel.strokeRoundedRect(W / 2 - 590, 225, 1180, 330, 24);

    const glow = this.add.image(W / 2, 150, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, 150, 'ghost').setScale(0.9);
    this.tweens.add({ targets: [ghost, glow], y: '-=14', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    txt(this, W / 2, 255, 'GHOST MYSTERY', 64, '#eef3ff', { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, W / 2, 310, `${CASE_TITLE}: a Bayesian whodunit`, 26, DIM, { fontStyle: 'italic' }).setOrigin(0.5);

    txt(this, W / 2, 362, TITLE_TAGLINE, 22, '#dfe6ff', { align: 'center', wordWrap: { width: 1080 } }).setOrigin(0.5);
    txt(this, W / 2, 432, `How it works: ${HOW_IT_WORKS}`, 18, '#cfe6ff', { align: 'center', wordWrap: { width: 1060 }, lineSpacing: 4 }).setOrigin(0.5);
    new Button(this, W / 2, 520, 'Begin', () => this.begin(), { width: 300, height: 66, size: 28 });

    if (GameState.hasSave()) {
      new Button(this, W / 2, 640, 'Continue saved case', () => {
        GameState.load();
        this.scene.start('World');
      }, { width: 360, height: 56, size: 22, fill: 0x0f1a14, stroke: 0x9ff0b0 });
    }

    soundToggle(this, W - 50, 50);
    Sound.setTicking(false);
    Sound.setMood('explore');
    txt(this, W / 2, H - 26, 'Best with sound on', 15, '#56627f', { fontStyle: 'italic' }).setOrigin(0.5);
    this.cameras.main.fadeIn(600);
  }

  private begin() {
    GameState.newGame();
    if (this.sys.game.device.input.touch && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        /* not allowed */
      }
    }
    fadeThen(this, 500, () => this.scene.start('World'));
  }
}
