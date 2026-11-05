import Phaser from 'phaser';
import { txt } from './widgets';

const MAX_W = 400;
const PAD_X = 18;
const PAD_Y = 12;

/**
 * The ghost's inner voice: a soft thought bubble that floats beside the ghost
 * (not across the top of the screen). Lines play one after another.
 */
export class ThoughtBubble {
  private box: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private timer?: Phaser.Time.TimerEvent;
  private onDone?: () => void;
  private bw = 0;
  private bh = 0;
  /** True while lines are queued or showing. */
  busy = false;

  constructor(private scene: Phaser.Scene, private target: Phaser.GameObjects.Image) {
    this.bg = scene.add.graphics();
    this.label = txt(scene, 0, 0, '', 22, '#e6edff', {
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: MAX_W - PAD_X * 2 },
      lineSpacing: 2,
    }).setOrigin(0.5);
    this.box = scene.add.container(0, 0, [this.bg, this.label]).setDepth(950).setAlpha(0);
  }

  /** Play lines in order, replacing anything currently showing. */
  say(lines: string[], onDone?: () => void) {
    this.timer?.remove();
    this.queue = lines.filter(Boolean);
    this.onDone = onDone;
    this.busy = this.queue.length > 0;
    if (this.busy) this.next();
    else onDone?.();
  }

  /** Skip to the next line now (used by taps during story moments). */
  advance() {
    if (!this.busy) return;
    this.timer?.remove();
    this.next();
  }

  clear() {
    this.timer?.remove();
    this.queue = [];
    this.busy = false;
    this.onDone = undefined;
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.add({ targets: this.box, alpha: 0, duration: 250 });
  }

  update() {
    if (this.box.alpha <= 0) return;
    const view = this.scene.cameras.main.worldView;
    const half = this.bw / 2 + 12;
    const x = Phaser.Math.Clamp(this.target.x, view.x + half, view.right - half);
    const y = Math.max(this.target.y - 82 - this.bh / 2, view.y + this.bh / 2 + 10);
    this.box.setPosition(x, y);
    this.drawTail(this.target.x - x, this.bh / 2);
  }

  private next() {
    const line = this.queue.shift();
    if (line === undefined) {
      this.busy = false;
      this.scene.tweens.killTweensOf(this.box);
      this.scene.tweens.add({ targets: this.box, alpha: 0, duration: 400 });
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
      return;
    }
    this.label.setText(line);
    this.bw = Math.min(MAX_W, this.label.width + PAD_X * 2);
    this.bh = this.label.height + PAD_Y * 2;
    this.scene.tweens.killTweensOf(this.box);
    this.box.setAlpha(0);
    this.scene.tweens.add({ targets: this.box, alpha: 1, duration: 300 });
    this.update();
    const ms = line === '...' ? 1600 : 1900 + line.length * 42;
    this.timer = this.scene.time.delayedCall(ms, () => this.next());
  }

  private drawTail(dx: number, halfH: number) {
    const g = this.bg;
    g.clear();
    g.fillStyle(0x0b1222, 0.85);
    g.lineStyle(2, 0x9fd8ff, 0.45);
    g.fillRoundedRect(-this.bw / 2, -halfH, this.bw, this.bh, 18);
    g.strokeRoundedRect(-this.bw / 2, -halfH, this.bw, this.bh, 18);
    // thought-bubble puffs leading down toward the ghost
    const tx = Phaser.Math.Clamp(dx, -this.bw / 2 + 20, this.bw / 2 - 20);
    [
      [0.35, 9],
      [0.75, 6],
    ].forEach(([f, r]) => {
      const px = tx * (0.6 + f * 0.4);
      const py = halfH + 10 + f * 26;
      g.fillCircle(px, py, r);
      g.strokeCircle(px, py, r);
    });
  }
}
