import Phaser from 'phaser';

/**
 * A curly brace spanning [x0, x1], pointing at a label: the tip points up (dir -1), with the
 * brace's ends resting on y, or down (dir 1). The span can glide to new ends, so the brace
 * grows and shrinks with the shapes it measures. A vertical brace spans [y0, y1] instead,
 * its ends resting on the x given as `base`, its tip pointing left (dir -1) or right (dir 1).
 */
export class Brace extends Phaser.GameObjects.Graphics {
  private span = { x0: 0, x1: 0 };
  private tween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x0: number,
    x1: number,
    private baseY: number,
    private dir: 1 | -1 = -1,
    private color = 0xdcdcdc,
    private tipDepth = 12,
    private vertical = false,
  ) {
    super(scene);
    this.span = { x0, x1 };
    this.redraw();
  }

  /** The x of the brace's tip, where its label belongs. */
  get tipX() {
    return (this.span.x0 + this.span.x1) / 2;
  }

  /** Slide the ends to a new span (or jump there). `onUpdate` follows the tip as it moves. */
  setSpan(x0: number, x1: number, animate = true, duration = 900, delay = 0, onUpdate?: (tipX: number) => void) {
    this.tween?.stop();
    if (!animate) {
      this.span = { x0, x1 };
      this.redraw();
      onUpdate?.(this.tipX);
      return this;
    }
    this.tween = this.scene.tweens.add({
      targets: this.span,
      x0,
      x1,
      duration,
      delay,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.redraw();
        onUpdate?.(this.tipX);
      },
    });
    return this;
  }

  /** Stop gliding when the brace goes away with its page. */
  preDestroy() {
    this.tween?.stop();
    this.tween = undefined;
    super.preDestroy();
  }

  private redraw() {
    if (!this.scene) return;
    this.clear();
    const { x0, x1 } = this.span;
    const w = x1 - x0;
    if (w < 6) return;
    const h = this.tipDepth * this.dir;
    const y = this.baseY;
    const m = (x0 + x1) / 2;
    const r = Math.min(Math.abs(this.tipDepth), w / 4);
    const mid = y + h / 2;
    // drawn along the span (u) and across it (v); a vertical brace swaps the two
    const pt = (u: number, v: number): [number, number] => (this.vertical ? [v, u] : [u, v]);
    const path = new Phaser.Curves.Path(...pt(x0, y));
    const q = (eu: number, ev: number, cu: number, cv: number) => path.quadraticBezierTo(...pt(eu, ev), ...pt(cu, cv));
    q(x0 + r, mid, x0, mid);
    path.lineTo(...pt(m - r, mid));
    q(m, y + h, m, mid);
    q(m + r, mid, m, mid);
    path.lineTo(...pt(x1 - r, mid));
    q(x1, y, x1, mid);
    this.lineStyle(2, this.color, 0.9);
    path.draw(this, 48);
  }
}
