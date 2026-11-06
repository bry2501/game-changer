import Phaser from 'phaser';
import { Button, fadeThen, fitCamera, H, soundToggle, txt, W } from '../ui/widgets';
import { Sound } from '../audio/Sound';
import { drawMansion } from '../ui/exterior';
import { AccentCamera, Noir, filmGrain } from '../ui/noir';
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
    // the house sinks into the dark; only the ghost gives any light
    this.add.rectangle(0, 0, W, H, 0x000000, 0.45).setOrigin(0);
    this.add.image(W / 2, 170, 'lantern').setDisplaySize(2300, 2300);
    this.add.particles(0, 0, 'fog', {
      x: { min: -200, max: W + 200 },
      y: { min: 430, max: H },
      speedX: { min: -12, max: 12 },
      scale: { min: 2, max: 3.5 },
      alpha: { start: 0.35, end: 0 },
      lifespan: 10000,
      frequency: 260,
    });

    const glow = this.add.image(W / 2, 170, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, 170, 'ghost').setScale(0.9);
    this.tweens.add({ targets: [ghost, glow], y: '-=14', duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    accent.keep(glow, ghost);
    this.add.image(W / 2, H / 2, 'vignette');
    filmGrain(this);

    // the title, guttering now and then like a candle
    const title = txt(this, W / 2, 335, 'GHOST MYSTERY', 78, '#f4f4f4', { fontStyle: 'bold' }).setOrigin(0.5);
    title.setShadow(0, 0, '#000000', 18, false, true);
    const flicker = () => {
      this.tweens.add({ targets: title, alpha: 0.55 + Math.random() * 0.25, duration: 60, yoyo: true, repeat: Math.floor(Math.random() * 3) });
      this.time.delayedCall(2500 + Math.random() * 4500, flicker);
    };
    this.time.delayedCall(2000, flicker);

    new Button(this, W / 2, 470, 'Begin', () => this.begin(), { width: 240, height: 58, size: 26, fill: 0x050505, stroke: 0x8a8a8a });
    if (GameState.hasSave()) {
      new Button(this, W / 2, 545, 'Continue', () => {
        GameState.load();
        this.scene.start('World');
      }, { width: 240, height: 50, size: 21, fill: 0x050505, stroke: 0x5a5a5a });
    }

    soundToggle(this, W - 50, 50);
    Sound.setTicking(false);
    Sound.setMood('explore');
    this.cameras.main.fadeIn(600);
  }

  private begin() {
    GameState.newGame();
    fadeThen(this, 500, () => this.scene.start('World'));
  }
}
