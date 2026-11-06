import Phaser from 'phaser';
import { Sound } from '../audio/Sound';

/** Layout units: every scene is laid out on a 1280×720 stage. */
export const W = 1280;
export const H = 720;
/** The canvas is drawn at full HD; each camera zooms the 1280×720 stage up to fill it. */
export const ZOOM = 1.5;
export const VIEW_W = W * ZOOM;
export const VIEW_H = H * ZOOM;
export const FONT = 'Georgia, "Times New Roman", serif';
export const INK = '#e8e8e8';
export const DIM = '#9a9a9a';
export const ACCENT = '#e6e6e6';
/** The one colour noir keeps for blood-red notes (stays PG: rugs, tea, seals, warnings). */
export const RED = 0xb3202a;

/** Fit a camera to the stage: the 1280×720 layout, drawn at full resolution. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera) {
  cam.setOrigin(0, 0).setZoom(ZOOM);
  return cam;
}

/**
 * What a fitted camera shows, in world units. (Phaser's own worldView assumes a centred
 * camera origin; ours pivots on the top-left so that the 1280×720 layout maps cleanly.)
 */
export function viewOf(cam: Phaser.Cameras.Scene2D.Camera) {
  return new Phaser.Geom.Rectangle(cam.scrollX, cam.scrollY, cam.width / cam.zoom, cam.height / cam.zoom);
}

const TEXT_RES = Math.min(3, ZOOM * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 24,
  color = INK,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, content, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    ...extra,
  });
  t.setResolution(TEXT_RES);
  return t;
}

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  size?: number;
  fill?: number;
  stroke?: number;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    const w = opts.width ?? 260;
    const h = opts.height ?? 64;
    this.bg = scene.add
      .rectangle(0, 0, w, h, opts.fill ?? 0x161616, 0.92)
      .setStrokeStyle(2, opts.stroke ?? 0xd0d0d0, 0.8);
    this.label = txt(scene, 0, 0, text, opts.size ?? 26).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(w, h);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.enabled && this.bg.setFillStyle(0x2c2c2c, 0.95));
    // Only fire when the press also started on this button, so a tap that opens
    // an overlay can never "fall through" onto a button underneath the finger.
    let pressed = false;
    this.bg.on('pointerdown', () => (pressed = true));
    this.bg.on('pointerout', () => {
      pressed = false;
      this.bg.setFillStyle(opts.fill ?? 0x161616, 0.92);
    });
    this.bg.on('pointerup', () => {
      if (!this.enabled || !pressed) return;
      pressed = false;
      scene.tweens.add({ targets: this, scale: { from: 0.94, to: 1 }, duration: 120 });
      onClick();
    });
    scene.add.existing(this);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.4);
    return this;
  }
}

/**
 * A horizontal bar, optionally draggable, with an optional "truth" marker.
 * Value is always in [0, 1]; the label is produced by `format`.
 */
export class BarRow extends Phaser.GameObjects.Container {
  value: number;
  private track: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private marker?: Phaser.GameObjects.Rectangle;
  private valueText: Phaser.GameObjects.Text;
  private handle?: Phaser.GameObjects.Arc;
  onChange?: (v: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly barWidth: number,
    color: number,
    value: number,
    private format: (v: number) => string,
    opts: { draggable?: boolean; step?: number; min?: number; height?: number } = {},
  ) {
    super(scene, x, y);
    const h = opts.height ?? 26;
    this.value = value;
    this.track = scene.add.rectangle(0, 0, barWidth, h, 0x111111, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x444444);
    this.fill = scene.add.rectangle(0, 0, barWidth * value, h, color, 0.85).setOrigin(0, 0.5);
    this.valueText = txt(scene, barWidth + 14, 0, format(value), 22).setOrigin(0, 0.5);
    this.add([this.track, this.fill, this.valueText]);

    if (opts.draggable) {
      const step = opts.step ?? 0.01;
      const min = opts.min ?? 0;
      this.handle = scene.add.circle(barWidth * value, 0, h * 0.75, 0xffffff, 0.95).setStrokeStyle(2, color);
      this.add(this.handle);
      const hit = scene.add
        .rectangle(-10, 0, barWidth + 20, h + 34, 0xffffff, 0.001)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true, draggable: false });
      this.add(hit);
      let dragging = false;
      const setFromPointer = (p: Phaser.Input.Pointer) => {
        const m = this.getWorldTransformMatrix();
        const localX = (p.x - m.tx) / m.scaleX;
        let v = Phaser.Math.Clamp(localX / barWidth, min, 1);
        v = Math.round(v / step) * step;
        this.setValue(v);
        this.onChange?.(this.value);
      };
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dragging = true;
        setFromPointer(p);
      });
      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => dragging && p.isDown && setFromPointer(p));
      scene.input.on('pointerup', () => (dragging = false));
    }
    scene.add.existing(this);
  }

  setValue(v: number, animate = false) {
    if (!this.scene) return; // destroyed (its page was left before a delayed animation ran)
    this.value = v;
    const w = Math.max(0, this.barWidth * v);
    if (animate) {
      this.scene.tweens.add({ targets: this.fill, width: w, duration: 700, ease: 'Cubic.easeInOut' });
    } else {
      this.fill.width = w;
    }
    this.handle?.setX(w);
    this.valueText.setText(this.format(v));
  }

  setLabel(s: string) {
    if (!this.scene) return;
    this.valueText.setText(s);
  }

  showMarker(v: number, color = 0xffffff) {
    if (!this.scene) return;
    if (!this.marker) {
      this.marker = this.scene.add
        .rectangle(0, 0, 5, (this.track.height as number) + 18, color, 1)
        .setOrigin(0.5);
      this.add(this.marker);
    }
    this.marker.setX(this.barWidth * v).setAlpha(0);
    this.scene.tweens.add({ targets: this.marker, alpha: 1, duration: 400 });
  }

  setDraggable(on: boolean) {
    this.handle?.setVisible(on);
    this.list.forEach((o) => {
      const r = o as Phaser.GameObjects.Rectangle;
      if (r.input && r !== this.track) r.input.enabled = on;
    });
  }
}

/** A stacked horizontal bar showing a distribution with suspect colours. */
export function stackedBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  dist: number[],
  colors: number[],
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  let cx = 0;
  dist.forEach((p, i) => {
    const w = width * p;
    if (w > 0.5) c.add(scene.add.rectangle(cx, 0, w, height, colors[i], 0.9).setOrigin(0, 0.5));
    cx += w;
  });
  c.add(scene.add.rectangle(0, 0, width, height).setOrigin(0, 0.5).setStrokeStyle(1, 0x666666));
  return c;
}

/** Full-screen dim panel used by overlay scenes. */
export function overlayBackground(scene: Phaser.Scene, alpha = 0.94) {
  scene.add.rectangle(0, 0, W, H, 0x060606, alpha).setOrigin(0).setInteractive();
  scene.add.rectangle(W / 2, H / 2, W - 24, H - 24).setStrokeStyle(2, 0x3a3a3a, 0.9);
}

/** A small full-screen toggle (F does the same), fixed to the screen. */
export function fullscreenToggle(scene: Phaser.Scene, x: number, y: number) {
  const cont = scene.add.container(x, y).setDepth(1001);
  const bg = scene.add.circle(0, 0, 26, 0x111111, 0.65).setStrokeStyle(2, 0xd0d0d0, 0.5).setInteractive({ useHandCursor: true });
  const g = scene.add.graphics();
  g.lineStyle(3, 0xdcdcdc, 1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.lineBetween(sx * 11, sy * 11, sx * 11, sy * 4);
    g.lineBetween(sx * 11, sy * 11, sx * 4, sy * 11);
  }
  cont.add([bg, g]);
  cont.setScrollFactor(0, 0, true);
  let pressed = false;
  bg.on('pointerdown', () => (pressed = true));
  bg.on('pointerout', () => (pressed = false));
  bg.on('pointerup', () => {
    if (!pressed) return;
    pressed = false;
    scene.scale.toggleFullscreen();
  });
  return cont;
}

/** A small round sound on/off toggle, fixed to the screen, with the full-screen toggle beside it. */
export function soundToggle(scene: Phaser.Scene, x: number, y: number) {
  fullscreenToggle(scene, x - 64, y);
  const cont = scene.add.container(x, y).setDepth(1001);
  const bg = scene.add.circle(0, 0, 26, 0x111111, 0.65).setStrokeStyle(2, 0xd0d0d0, 0.5).setInteractive({ useHandCursor: true });
  const icon = txt(scene, 0, 1, '♪', 26, '#dcdcdc').setOrigin(0.5);
  const slash = scene.add.rectangle(0, 0, 40, 3, 0xd84a52).setAngle(-45);
  cont.add([bg, icon, slash]);
  cont.setScrollFactor(0, 0, true);
  {
    const refresh = () => {
      slash.setVisible(Sound.muted);
      icon.setAlpha(Sound.muted ? 0.5 : 1);
    };
    refresh();
    let pressed = false;
    bg.on('pointerdown', () => (pressed = true));
    bg.on('pointerout', () => (pressed = false));
    bg.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      Sound.unlock();
      Sound.toggleMute();
      refresh();
    });
  }
  return cont;
}

/**
 * Fade the scene's camera to black, then run `next` exactly once. The camera's
 * "fade complete" event can occasionally be missed (for example if the fade is
 * restarted or the frame rate stalls), so a real-time fallback guarantees the
 * game never sits on a finished fade.
 */
export function fadeThen(scene: Phaser.Scene, ms: number, next: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    next();
  };
  const cam = scene.cameras.main;
  cam.once('camerafadeoutcomplete', run);
  cam.fade(ms, 0, 0, 0, true);
  window.setTimeout(run, ms + 600);
}
