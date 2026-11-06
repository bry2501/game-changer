import Phaser from 'phaser';
import { Button, DIM, fadeThen, fitCamera, H, RED, soundToggle, txt, W } from '../ui/widgets';
import { Sound } from '../audio/Sound';
import { drawMansion } from '../ui/exterior';
import { AccentCamera, Noir, filmGrain } from '../ui/noir';
import { CASE_TITLE, HOW_IT_WORKS, TITLE_TAGLINE } from '../data/case1';
import { GameState } from '../state/GameState';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor('#050505');
    new Noir(this, this.cameras.main, 0);
    const accent = new AccentCamera(this);
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
    panel.fillStyle(0x080808, 0.74);
    panel.fillRoundedRect(W / 2 - 590, 225, 1180, 330, 24);
    panel.lineStyle(2, 0xd0d0d0, 0.25);
    panel.strokeRoundedRect(W / 2 - 590, 225, 1180, 330, 24);

    const glow = this.add.image(W / 2, 150, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, 150, 'ghost').setScale(0.9);
    this.tweens.add({ targets: [ghost, glow], y: '-=14', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // the ghost keeps its colour, and one red line under the title
    accent.keep(glow, ghost, this.add.rectangle(W / 2, 290, 420, 3, RED));
    this.add.image(W / 2, H / 2, 'vignette').setAlpha(0.8);
    filmGrain(this);

    txt(this, W / 2, 255, 'GHOST MYSTERY', 64, '#f2f2f2', { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, W / 2, 310, `${CASE_TITLE}: a Bayesian whodunit`, 26, DIM, { fontStyle: 'italic' }).setOrigin(0.5);

    txt(this, W / 2, 362, TITLE_TAGLINE, 22, '#e8e8e8', { align: 'center', wordWrap: { width: 1080 } }).setOrigin(0.5);
    txt(this, W / 2, 432, `How it works: ${HOW_IT_WORKS}`, 18, '#dcdcdc', { align: 'center', wordWrap: { width: 1060 }, lineSpacing: 4 }).setOrigin(0.5);
    new Button(this, W / 2, 520, 'Begin', () => this.begin(), { width: 300, height: 66, size: 28 });

    if (GameState.hasSave()) {
      new Button(this, W / 2, 640, 'Continue saved case', () => {
        GameState.load();
        this.scene.start('World');
      }, { width: 360, height: 56, size: 22, fill: 0x0f1a14, stroke: 0xe0e0e0 });
    }

    soundToggle(this, W - 50, 50);
    Sound.setTicking(false);
    Sound.setMood('explore');
    txt(this, W / 2, H - 26, 'Best with sound on, in full screen (press F)', 15, '#666666', { fontStyle: 'italic' }).setOrigin(0.5);
    this.cameras.main.fadeIn(600);
  }

  private begin() {
    GameState.newGame();
    fadeThen(this, 500, () => this.scene.start('World'));
  }
}
