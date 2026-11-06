import Phaser from 'phaser';
import { Button, DIM, H, W, fadeThen, soundToggle, txt } from '../ui/widgets';
import { Sound } from '../audio/Sound';
import { CASE_TITLE } from '../data/case1';
import { Difficulty, GameState, LEVELS, unlockedLevel } from '../state/GameState';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#05060a');
    this.add.image(W / 2, H / 2, 'moon').setScale(5).setAlpha(0.8);
    this.add.particles(0, 0, 'fog', {
      x: { min: -200, max: W + 200 },
      y: { min: 380, max: H },
      speedX: { min: -12, max: 12 },
      scale: { min: 1.5, max: 3 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 9000,
      frequency: 300,
    });

    const glow = this.add.image(W / 2, 150, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, 150, 'ghost').setScale(0.9);
    this.tweens.add({ targets: [ghost, glow], y: '-=14', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    txt(this, W / 2, 255, 'GHOST MYSTERY', 64, '#eef3ff', { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, W / 2, 310, `${CASE_TITLE}: a Bayesian whodunit`, 26, DIM, { fontStyle: 'italic' }).setOrigin(0.5);

    // three levels: the same night, a wider net each time. Each unlocks when the one before is solved.
    const open = unlockedLevel();
    txt(this, W / 2, 365, 'The same night, three times. Solve a level to unlock the next.', 22, DIM).setOrigin(0.5);
    LEVELS.forEach((l, i) => {
      const x = W / 2 + (i - 1) * 380;
      const locked = l.n > open;
      const b = new Button(this, x, 430, locked ? `Level ${l.n} \u00B7 locked` : `Level ${l.n} \u00B7 ${l.name}`, () => !locked && this.begin(l.id), {
        width: 300,
        height: 74,
        size: 26,
      });
      if (locked) b.setEnabled(false);
      const desc = locked ? `Solve Level ${l.n - 1} to unlock.  ${l.desc}` : l.desc;
      txt(this, x, 480, desc, 19, locked ? '#56627f' : DIM, { align: 'center', wordWrap: { width: 330 } }).setOrigin(0.5, 0);
    });

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

  private begin(d: Difficulty) {
    GameState.newGame(d);
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
