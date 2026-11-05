import Phaser from 'phaser';
import { H, W, txt } from './widgets';

/** On-screen controls (always visible, so they work on phones) plus keyboard bindings. */
export class TouchControls {
  left = false;
  right = false;
  private keys?: { [k: string]: Phaser.Input.Keyboard.Key };
  inspectBtn: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, onInspect: () => void, onBoard: () => void) {
    scene.input.addPointer(2);
    this.hold(110, H - 90, '◀', (v) => (this.left = v));
    this.hold(260, H - 90, '▶', (v) => (this.right = v));

    this.inspectBtn = this.tapButton(W - 120, H - 90, 62, 'Inspect', onInspect);
    this.tapButton(W - 90, 60, 44, 'Board', onBoard, 18);

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('LEFT,RIGHT,A,D') as { [k: string]: Phaser.Input.Keyboard.Key };
      kb.on('keydown-SPACE', onInspect);
      kb.on('keydown-E', onInspect);
      kb.on('keydown-ENTER', onInspect);
      kb.on('keydown-B', onBoard);
      kb.on('keydown-TAB', (e: KeyboardEvent) => {
        e.preventDefault();
        onBoard();
      });
    }
  }

  get dir(): number {
    const k = this.keys;
    const l = this.left || !!(k && (k.LEFT.isDown || k.A.isDown));
    const r = this.right || !!(k && (k.RIGHT.isDown || k.D.isDown));
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  setInspectActive(on: boolean) {
    this.inspectBtn.setAlpha(on ? 1 : 0.35);
  }

  reset() {
    this.left = this.right = false;
  }

  private hold(x: number, y: number, label: string, set: (v: boolean) => void) {
    const c = this.scene.add.circle(x, y, 60, 0x0d1424, 0.55).setStrokeStyle(2, 0x9fd8ff, 0.5);
    c.setScrollFactor(0).setDepth(1000).setInteractive();
    txt(this.scene, x, y, label, 34, '#cfe6ff').setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    c.on('pointerdown', () => {
      set(true);
      c.setFillStyle(0x24345c, 0.8);
    });
    const up = () => {
      set(false);
      c.setFillStyle(0x0d1424, 0.55);
    };
    c.on('pointerup', up);
    c.on('pointerout', up);
  }

  private tapButton(x: number, y: number, r: number, label: string, fn: () => void, size = 20) {
    const cont = this.scene.add.container(x, y).setDepth(1000);
    const c = this.scene.add.circle(0, 0, r, 0x0d1424, 0.6).setStrokeStyle(2, 0xffe2a0, 0.7).setInteractive();
    const t = txt(this.scene, 0, 0, label, size, '#ffe9b8').setOrigin(0.5);
    cont.add([c, t]);
    cont.setScrollFactor(0, 0, true);
    let pressed = false;
    c.on('pointerdown', () => (pressed = true));
    c.on('pointerout', () => (pressed = false));
    c.on('pointerup', () => {
      if (pressed) fn();
      pressed = false;
    });
    return cont;
  }
}
