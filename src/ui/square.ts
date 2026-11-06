import Phaser from 'phaser';
import { hex, txt } from './widgets';

/**
 * Bayes as geometry, after the "square of all possibilities" picture:
 * one square holds every possible world. Each suspect owns a column as wide as their
 * share of suspicion (the prior). Inside each column, a shaded piece as tall as the
 * rating (how often the clue turns up in that story). Keep only the shaded pieces and
 * stretch them back into a full square: their widths are the new shares (the posterior).
 *
 *   phase 0  before: full columns, widths = prior
 *   phase 1  shrink: shaded pieces, heights = ratings; the rest of each column dims
 *   phase 2  together: only the shaded pieces remain, the worlds that fit the clue
 *   phase 3  stretch: the shaded pieces fill a new square, widths = posterior
 */
export class BayesSquare extends Phaser.GameObjects.Container {
  readonly size: number;
  private full: Phaser.GameObjects.Rectangle[] = [];
  private piece: Phaser.GameObjects.Rectangle[] = [];
  private names: Phaser.GameObjects.Text[] = [];
  private frame: Phaser.GameObjects.Graphics;
  private oldLines: Phaser.GameObjects.Graphics;
  private post: number[];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    private prior: number[],
    private lik: number[],
    colors: number[],
    labels: string[],
    phase = 0,
    opts: { labelSize?: number } = {},
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.size = size;
    const joint = prior.map((p, i) => p * lik[i]);
    const total = joint.reduce((a, b) => a + b, 0) || 1;
    this.post = joint.map((j) => j / total);

    this.add(scene.add.rectangle(0, 0, size, size, 0x05070d, 1).setOrigin(0));
    prior.forEach((_, i) => {
      // unit rectangles, sized with scale so they tween cleanly
      const f = scene.add.rectangle(0, 0, 1, 1, colors[i], 0.85).setOrigin(0);
      const p = scene.add.rectangle(0, 0, 1, 1, colors[i], 0.95).setOrigin(0);
      this.full.push(f);
      this.piece.push(p);
      this.add([f, p]);
    });
    this.frame = scene.add.graphics();
    this.oldLines = scene.add.graphics();
    this.add([this.frame, this.oldLines]);
    labels.forEach((l, i) => {
      const t = txt(scene, 0, size + 10, l, opts.labelSize ?? 18, hex(colors[i]), { fontStyle: 'bold' }).setOrigin(0.5, 0);
      this.names.push(t);
      this.add(t);
    });
    this.setPhase(phase, false);
  }

  /** The new shares this square stretches to. */
  get posterior() {
    return this.post.slice();
  }

  /** Move to a phase, sliding everything into place (or jumping, with animate = false). */
  setPhase(ph: number, animate = true) {
    const S = this.size;
    const cum = (w: number[]) => w.map((_, i) => w.slice(0, i).reduce((a, b) => a + b, 0) * S);
    const px = cum(this.prior);
    const qx = cum(this.post);
    const go = (o: Phaser.GameObjects.GameObject, props: Record<string, number>, delay = 0) => {
      if (animate) this.scene.tweens.add({ targets: o, ...props, duration: 900, delay, ease: 'Sine.easeInOut' });
      else Object.assign(o, props);
    };

    this.prior.forEach((p, i) => {
      const L = this.lik[i];
      go(this.full[i], { x: px[i], y: 0, scaleX: Math.max(p * S, 0.001), scaleY: S, alpha: [0.85, 0.16, 0.05, 0][ph] }, ph === 1 ? i * 300 : 0);
      if (ph === 0) go(this.piece[i], { x: px[i], y: S, scaleX: Math.max(p * S, 0.001), scaleY: 0.001 });
      else if (ph <= 2) go(this.piece[i], { x: px[i], y: S - L * S, scaleX: Math.max(p * S, 0.001), scaleY: Math.max(L * S, 0.001) }, ph === 1 ? i * 300 : 0);
      else go(this.piece[i], { x: qx[i], y: 0, scaleX: Math.max(this.post[i] * S, 0.001), scaleY: S });
    });

    // names under their columns, nudged apart when a column is narrow
    const widths = ph === 3 ? this.post : this.prior;
    const starts = ph === 3 ? qx : px;
    let right = -Infinity;
    this.names.forEach((t, i) => {
      let cx = starts[i] + (widths[i] * S) / 2;
      cx = Math.max(cx, right + t.width / 2 + 10);
      cx = Math.min(cx, S + 40 - t.width / 2);
      right = cx + t.width / 2;
      go(t, { x: cx });
    });

    // the square's outline, the column boundaries, and (when stretched) where the old boundaries were
    this.frame.clear();
    this.frame.lineStyle(2, 0xdfe6ff, ph === 2 ? 0.25 : 0.7);
    this.frame.strokeRect(0, 0, S, S);
    this.oldLines.clear();
    if (ph === 3) {
      this.oldLines.lineStyle(2, 0xffffff, 0.7);
      px.slice(1).forEach((x) => {
        for (let y = 0; y < S; y += 14) this.oldLines.lineBetween(x, y, x, Math.min(y + 7, S));
      });
      this.oldLines.setAlpha(0);
      go(this.oldLines, { alpha: 1 }, 900);
    }
    return this;
  }
}
