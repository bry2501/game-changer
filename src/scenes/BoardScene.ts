import Phaser from 'phaser';
import { BarRow, Button, DIM, fitCamera, hex, overlayBackground, txt, W } from '../ui/widgets';
import { CLUES, SUSPECTS } from '../data/case1';
import { GameState } from '../state/GameState';

/** Draw belief-over-time lines. `series[k]` is the distribution after k steps. */
export function beliefChart(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  series: number[][],
  totalSteps: number,
  opts: { dashed?: boolean; alpha?: number } = {},
) {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x3a3a3a, 1);
  g.strokeRect(x, y, w, h);
  [0.25, 0.5, 0.75].forEach((v) => g.lineBetween(x, y + h * (1 - v), x + w, y + h * (1 - v)));
  const sx = (k: number) => x + (w * k) / Math.max(1, totalSteps);
  const sy = (p: number) => y + h * (1 - p);
  SUSPECTS.forEach((s, i) => {
    g.lineStyle(opts.dashed ? 2 : 4, s.color, opts.alpha ?? 1);
    for (let k = 1; k < series.length; k++) {
      const x0 = sx(k - 1), y0 = sy(series[k - 1][i]);
      const x1 = sx(k), y1 = sy(series[k][i]);
      if (opts.dashed) {
        const n = 8;
        for (let t = 0; t < n; t += 2) {
          g.lineBetween(x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n, x0 + ((x1 - x0) * (t + 1)) / n, y0 + ((y1 - y0) * (t + 1)) / n);
        }
      } else {
        g.lineBetween(x0, y0, x1, y1);
      }
    }
    if (!opts.dashed) series.forEach((d, k) => g.fillStyle(s.color, 1).fillCircle(sx(k), sy(d[i]), 4));
  });
  return g;
}

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('Board');
  }

  create() {
    fitCamera(this.cameras.main);
    overlayBackground(this);
    const data = GameState.data;
    txt(this, W / 2, 30, 'Suspicion Board', 36, '#f2f2f2', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    txt(this, W / 2, 80, `${data.found} of ${CLUES.length} clues weighed`, 20, DIM).setOrigin(0.5, 0);

    SUSPECTS.forEach((s, i) => {
      const y = 160 + i * 80;
      txt(this, 50, y - 30, `${s.name}, ${s.role}`, 22, hex(s.color), { fontStyle: 'bold' });
      // suspicion as bars only, without numbers
      new BarRow(this, 50, y + 10, 380, s.color, data.belief[i], () => '');
    });

    const series = [data.prior, ...data.history.map((h) => h.belief)];
    txt(this, 600, 120, 'Belief after each clue', 20, DIM);
    beliefChart(this, 600, 150, 620, 300, series, CLUES.length);
    txt(this, 600, 456, 'prior', 15, DIM);
    txt(this, 1220, 456, `clue ${CLUES.length}`, 15, DIM).setOrigin(1, 0);

    const found = CLUES.slice(0, Math.max(0, data.found)).map((c, i) => `${i + 1}. ${c.title}`);
    txt(this, 50, 500, 'Evidence:', 20, DIM);
    txt(this, 50, 530, found.join('     ') || '(none yet)', 18, '#e8e8e8', { wordWrap: { width: 900 }, lineSpacing: 6 });

    new Button(this, W - 165, 668, 'Back ▸', () => this.close(), { width: 240, height: 60 });
    this.input.keyboard?.on('keydown-B', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
