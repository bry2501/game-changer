import Phaser from 'phaser';
import { txt, viewOf } from './widgets';

const MAX_W = 420;
const PAD_X = 22;
const PAD_Y = 14;
const NAV_H = 30;

/**
 * The ghost's inner voice: a thought bubble that floats beside the ghost.
 *
 * - A single passing thought fades by itself after a generous pause.
 * - A thought SEQUENCE (two or more lines) waits for the player: tap / Space / →
 *   for the next bubble, ← (or the ‹ on the bubble) to go back. Nothing auto-advances.
 *   Only the ‹ › arrows are shown; there is no page counter.
 */
export class ThoughtBubble {
  private box: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private prevBtn: Phaser.GameObjects.Text;
  private nextBtn: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private index = 0;
  private timer?: Phaser.Time.TimerEvent;
  private onDone?: () => void;
  private onLine?: (index: number) => void;
  private bw = 0;
  private bh = 0;
  /** True while lines are showing. */
  busy = false;
  /** True while a player-paced sequence is showing. */
  sequence = false;

  constructor(private scene: Phaser.Scene, private target: Phaser.GameObjects.Image) {
    this.bg = scene.add.graphics();
    this.label = txt(scene, 0, 0, '', 23, '#e6edff', {
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: MAX_W - PAD_X * 2 },
      lineSpacing: 2,
    }).setOrigin(0.5);
    // generous hit areas: these are tapped with thumbs
    this.prevBtn = txt(scene, 0, 0, '‹', 34, '#e6e6e6', { padding: { x: 18, y: 2 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.nextBtn = txt(scene, 0, 0, '›', 34, '#e6e6e6', { padding: { x: 18, y: 2 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.prevBtn.on('pointerup', () => this.back());
    this.nextBtn.on('pointerup', () => this.next());
    this.box = scene.add
      .container(0, 0, [this.bg, this.label, this.prevBtn, this.nextBtn])
      .setDepth(950)
      .setAlpha(0);
  }

  /**
   * Show lines. Two or more lines form a sequence the player steps through;
   * a single line is a passing thought. `onDone` fires after the last line.
   */
  say(lines: string[], onDone?: () => void, onLine?: (index: number) => void, paced = false) {
    this.timer?.remove();
    this.onLine = onLine;
    this.lines = lines.filter(Boolean);
    this.index = 0;
    this.onDone = onDone;
    // two or more lines, or a cutscene beat, wait for the player; a lone passing thought fades by itself
    this.sequence = this.lines.length > 1 || (paced && this.lines.length > 0);
    this.busy = this.lines.length > 0;
    if (!this.busy) {
      this.hide();
      onDone?.();
      return;
    }
    this.show(true);
  }

  next() {
    if (!this.busy) return;
    if (this.index + 1 < this.lines.length) {
      this.index++;
      this.show(false);
    } else {
      this.finish();
    }
  }

  back() {
    if (!this.busy || this.index === 0) return;
    this.index--;
    this.show(false);
  }

  /** Kept for callers that just want to move things along. */
  advance() {
    this.next();
  }

  clear() {
    this.timer?.remove();
    this.lines = [];
    this.busy = this.sequence = false;
    this.onDone = undefined;
    this.hide();
  }

  /** Hide immediately (e.g. before an overlay pauses the world mid-fade). */
  hideNow() {
    this.clear();
    this.scene.tweens.killTweensOf(this.box);
    this.box.setAlpha(0);
  }

  update() {
    if (this.box.alpha <= 0) return;
    const view = viewOf(this.scene.cameras.main);
    const half = this.bw / 2 + 12;
    const x = Phaser.Math.Clamp(this.target.x, view.x + half, view.right - half);
    const y = Math.max(this.target.y - 84 - this.bh / 2, view.y + this.bh / 2 + 10);
    this.box.setPosition(x, y);
    this.draw(this.target.x - x);
  }

  private finish() {
    this.timer?.remove();
    this.busy = this.sequence = false;
    this.hide();
    const done = this.onDone;
    this.onDone = undefined;
    done?.();
  }

  private hide() {
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.add({ targets: this.box, alpha: 0, duration: 300 });
  }

  private show(fresh: boolean) {
    this.timer?.remove();
    const line = this.lines[this.index];
    this.onLine?.(this.index);
    this.label.setText(line.replace(/\*/g, '')); // *emphasis* marks are for the screenplay
    const seq = this.sequence;
    this.bw = Math.max(seq ? 200 : 0, Math.min(MAX_W, this.label.width + PAD_X * 2));
    this.bh = this.label.height + PAD_Y * 2 + (seq ? NAV_H : 0);
    this.label.setY(seq ? -NAV_H / 2 : 0);
    const navY = this.bh / 2 - NAV_H / 2 - 4;
    this.prevBtn.setVisible(seq).setPosition(-this.bw / 2 + 26, navY).setAlpha(this.index > 0 ? 1 : 0.25);
    this.nextBtn.setVisible(seq).setPosition(this.bw / 2 - 26, navY);
    this.scene.tweens.killTweensOf(this.box);
    if (fresh) this.box.setAlpha(0);
    this.scene.tweens.add({ targets: this.box, alpha: 1, duration: fresh ? 300 : 150 });
    this.update();
    if (!seq) {
      // a passing thought lingers long enough to read comfortably, then fades
      const ms = 4000 + line.length * 70;
      this.timer = this.scene.time.delayedCall(ms, () => this.finish());
    } else {
      // invite the tap with a gentle pulse on the "next" chevron
      this.scene.tweens.killTweensOf(this.nextBtn);
      this.nextBtn.setAlpha(1);
      this.scene.tweens.add({ targets: this.nextBtn, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    }
  }

  private draw(dx: number) {
    const g = this.bg;
    const halfH = this.bh / 2;
    g.clear();
    g.fillStyle(0x101010, 0.88);
    g.lineStyle(2, 0xd0d0d0, 0.45);
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
