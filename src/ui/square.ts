import Phaser from 'phaser';
import { hex, share, txt } from './widgets';
import { Brace } from './brace';

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
  /** A curly brace under each column, from its edges to its name; it stretches with the column. */
  private braces: (Brace | undefined)[] = [];
  private frame: Phaser.GameObjects.Graphics;
  private oldLines: Phaser.GameObjects.Graphics;
  private post: number[];
  /** The numbers written inside the columns, redrawn for each phase. */
  private numbers: Phaser.GameObjects.Text[] = [];
  /** Side braces (shrink and together steps) around each kept piece, labelled "evidence". */
  private sides: Phaser.GameObjects.GameObject[] = [];
  private showSides: boolean;
  /** A dashed outline around what is left, which stretches with it into the new square. */
  private selection!: Phaser.GameObjects.Graphics;
  private selectionTween?: Phaser.Tweens.Tween;
  private numberSize: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    private prior: number[],
    private lik: number[],
    private colors: number[],
    labels: string[],
    phase = 0,
    opts: { labelSize?: number; sides?: boolean } = {},
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.size = size;
    this.showSides = opts.sides ?? true;
    this.numberSize = Phaser.Math.Clamp(Math.round(size / 15), 13, 22);
    const joint = prior.map((p, i) => p * lik[i]);
    const total = joint.reduce((a, b) => a + b, 0) || 1;
    this.post = joint.map((j) => j / total);

    this.add(scene.add.rectangle(0, 0, size, size, 0x060606, 1).setOrigin(0));
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
    this.selection = scene.add.graphics();
    this.add([this.frame, this.oldLines, this.selection]);
    const depth = Phaser.Math.Clamp(Math.round(size / 30), 6, 11);
    labels.forEach((l, i) => {
      const brace = l ? new Brace(scene, 0, 0, size + 5, 1, colors[i], depth) : undefined;
      if (brace) this.add(brace);
      this.braces.push(brace);
      const t = txt(scene, 0, size + 10 + (l ? depth + 4 : 0), l, opts.labelSize ?? 18, hex(colors[i]), { fontStyle: 'bold' }).setOrigin(0.5, 0);
      this.names.push(t);
      this.add(t);
    });
    this.setPhase(phase, false);
  }

  /** Stop the outline's stretch when the square goes away with its page. */
  preDestroy() {
    this.selectionTween?.stop();
    this.selectionTween = undefined;
    super.preDestroy();
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
      // at the shrink step the brackets show first; then each full bar shrinks down from the top into them
      const shrinkDelay = ph === 1 ? 600 + i * 300 : 0;
      go(this.full[i], { x: px[i], y: 0, scaleX: Math.max(p * S, 0.001), scaleY: S, alpha: [0.85, 0.16, 0.05, 0][ph] }, shrinkDelay);
      if (ph === 0) go(this.piece[i], { x: px[i], y: 0, scaleX: Math.max(p * S, 0.001), scaleY: S });
      else if (ph <= 2) go(this.piece[i], { x: px[i], y: S - L * S, scaleX: Math.max(p * S, 0.001), scaleY: Math.max(L * S, 0.001) }, shrinkDelay);
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
      // the brace spans the column, its edges just inside the column's borders
      const inset = Math.min(3, (widths[i] * S) / 6);
      this.braces[i]?.setSpan(starts[i] + inset, starts[i] + widths[i] * S - inset, animate);
    });

    this.writeNumbers(ph, px, qx, animate);
    this.writeSides(ph, animate);
    this.drawSelection(ph, px, qx, animate);

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

  /**
   * Braces down the outer sides of the first and last columns while the pieces are cut:
   * one around the shaded piece (kept, as tall as the rating) and one around the faded part
   * above it (taken away by the clue).
   */
  private writeSides(ph: number, animate: boolean) {
    this.sides.forEach((o) => o.destroy());
    this.sides = [];
    if ((ph !== 1 && ph !== 2) || !this.showSides) return;
    const S = this.size;
    const n = this.prior.length;
    const depth = Phaser.Math.Clamp(Math.round(S / 30), 6, 11);
    const fs = Math.round(this.numberSize * 0.85);
    const edges = n >= 2 ? [0, n - 1] : [0];
    edges.forEach((i, k) => {
      const L = this.lik[i];
      const dir = k === 0 ? -1 : 1;
      const base = dir < 0 ? -6 : S + 6;
      const labelX = base + dir * (depth + 6);
      const y0 = S - L * S + 2;
      const y1 = S - 2;
      if (y1 - y0 < 14) return;
      // the bracket marks the evidence: the part of this story in which the clue turns up.
      // At the shrink step it first labels the whole bar, then shrinks down with it.
      const shrinking = animate && ph === 1;
      const top = shrinking ? 2 : y0;
      const b = new Brace(this.scene, top, y1, base, dir as 1 | -1, this.colors[i], depth, true);
      const label = txt(this.scene, labelX, (top + y1) / 2, 'evidence', fs, hex(this.colors[i]), { fontStyle: 'italic' }).setOrigin(dir < 0 ? 1 : 0, 0.5);
      this.add([b, label]);
      this.sides.push(b, label);
      if (shrinking) {
        [b, label].forEach((o) => {
          o.setAlpha(0);
          this.scene.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 150 + i * 150 });
        });
        // same timing as the bar's own shrink in setPhase()
        b.setSpan(y0, y1, true, 900, 600 + i * 300, (tip) => label.setY(tip));
      }
    });
  }

  /**
   * What is left after the cut, outlined with a dashed line: drawn round the shaded pieces
   * at the together step, then stretched with them until it is the whole new square.
   */
  private drawSelection(ph: number, px: number[], qx: number[], animate: boolean) {
    this.selectionTween?.stop();
    this.selection.clear().setAlpha(1);
    if (ph < 2) return;
    const S = this.size;
    const from = this.prior.map((p, i) => ({ x: px[i], w: p * S, top: S - this.lik[i] * S }));
    const to = this.post.map((p, i) => ({ x: qx[i], w: p * S, top: 0 }));
    const draw = (t: number) => {
      const r = from.map((a, i) => ({
        x: a.x + (to[i].x - a.x) * t,
        w: a.w + (to[i].w - a.w) * t,
        top: a.top + (to[i].top - a.top) * t,
      }));
      // the staircase outline of the pieces standing side by side on the floor of the square
      const pts: [number, number][] = [[r[0].x, S]];
      r.forEach((q) => pts.push([q.x, q.top], [q.x + q.w, q.top]));
      pts.push([r[r.length - 1].x + r[r.length - 1].w, S], [r[0].x, S]);
      this.selection.clear();
      this.selection.lineStyle(2.5, 0xffffff, 0.95);
      for (let k = 1; k < pts.length; k++) dashed(this.selection, pts[k - 1], pts[k]);
    };
    if (ph === 2) {
      draw(0);
      if (animate) {
        this.selection.setAlpha(0);
        this.scene.tweens.add({ targets: this.selection, alpha: 1, duration: 500, delay: 700 });
      }
      return;
    }
    // ph 3: the outline grows with the pieces into the full square, then fades into its frame
    if (!animate) return;
    const k = { t: 0 };
    draw(0);
    this.selectionTween = this.scene.tweens.add({
      targets: k,
      t: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: () => draw(k.t),
      onComplete: () => this.scene.tweens.add({ targets: this.selection, alpha: 0, duration: 500 }),
    });
  }

  /**
   * The exact quantities, inside the shapes they measure:
   *   before   each column's width (the share)
   *   shrink   each shaded piece's height (the rating)
   *   together each shaded piece's area (share × rating)
   *   stretch  each new column's width (the new share)
   */
  private writeNumbers(ph: number, px: number[], qx: number[], animate: boolean) {
    this.numbers.forEach((t) => t.destroy());
    this.numbers = [];
    const S = this.size;
    const fs = this.numberSize;
    this.prior.forEach((p, i) => {
      const L = this.lik[i];
      let label: string;
      let x: number;
      let w: number;
      let top: number;
      let h: number;
      if (ph === 0) [label, x, w, top, h] = [share(p), px[i], p * S, 0, S];
      else if (ph === 1) [label, x, w, top, h] = [share(L), px[i], p * S, S - L * S, L * S];
      else if (ph === 2) [label, x, w, top, h] = [share(p * L), px[i], p * S, S - L * S, L * S];
      else [label, x, w, top, h] = [share(this.post[i]), qx[i], this.post[i] * S, 0, S];
      const n = txt(this.scene, x + w / 2, top + h / 2, label, fs, '#111111', { fontStyle: 'bold' }).setOrigin(0.5);
      // too narrow or too short to hold the number: leave it out rather than spill over
      if (n.width + 8 > w || n.height + 4 > h) {
        n.destroy();
        return;
      }
      this.add(n);
      this.numbers.push(n);
      if (animate) {
        n.setAlpha(0);
        this.scene.tweens.add({ targets: n, alpha: 1, duration: 400, delay: ph === 1 ? 1500 + i * 300 : 900 });
      }
    });
  }
}

/** A dashed straight line. */
function dashed(g: Phaser.GameObjects.Graphics, [x0, y0]: [number, number], [x1, y1]: [number, number], dash = 8, gap = 6) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.5) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(d + dash, len);
    g.lineBetween(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e);
  }
}
