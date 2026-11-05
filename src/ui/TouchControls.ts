import Phaser from 'phaser';
import { W, txt } from './widgets';

/**
 * Arrow-free controls.
 * - Touch / mouse: press and hold anywhere and the ghost drifts toward your finger;
 *   a quick tap sends the ghost to that spot. Tapping the glowing clue sends the
 *   ghost there and examines it on arrival.
 * - Keyboard: ← → / A D to drift, Space / E / Enter to examine, B or Tab for the board.
 */
export class TouchControls {
  /** World x the ghost is drifting toward, if any. */
  targetX: number | null = null;
  /** Set when the player tapped the glowing clue: examine it on arrival. */
  pendingInspect = false;
  enabled = true;
  private holding?: Phaser.Input.Pointer;
  private keys?: { [k: string]: Phaser.Input.Keyboard.Key };
  private boardBtn: Phaser.GameObjects.Container;

  constructor(
    private scene: Phaser.Scene,
    private isOnClue: (worldX: number, worldY: number) => boolean,
    private onInspect: () => void,
    onBoard: () => void,
  ) {
    scene.input.addPointer(2);
    this.boardBtn = this.boardButton(onBoard);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.enabled || over.length) return;
      this.holding = p;
      this.pendingInspect = this.isOnClue(p.worldX, p.worldY);
      this.targetX = p.worldX;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p === this.holding) this.holding = undefined;
    });

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('LEFT,RIGHT,A,D') as { [k: string]: Phaser.Input.Keyboard.Key };
      const inspect = () => this.enabled && this.onInspect();
      kb.on('keydown-SPACE', inspect);
      kb.on('keydown-E', inspect);
      kb.on('keydown-ENTER', inspect);
      kb.on('keydown-B', () => this.enabled && onBoard());
      kb.on('keydown-TAB', (e: KeyboardEvent) => {
        e.preventDefault();
        if (this.enabled) onBoard();
      });
    }
  }

  /** Keyboard direction, -1 / 0 / 1. Pressing a key cancels any tap target. */
  get keyDir(): number {
    const k = this.keys;
    if (!k || !this.enabled) return 0;
    const d = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    if (d !== 0) {
      this.targetX = null;
      this.pendingInspect = false;
    }
    return d;
  }

  /** While a finger is held down, keep following it (the camera moves, so recompute). */
  update() {
    const p = this.holding;
    if (!p || !p.isDown || !this.enabled) return;
    const pt = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    this.targetX = pt.x;
  }

  showBoard(on: boolean) {
    this.boardBtn.setVisible(on);
  }

  reset() {
    this.targetX = null;
    this.pendingInspect = false;
    this.holding = undefined;
  }

  private boardButton(fn: () => void) {
    const cont = this.scene.add.container(W - 100, 52).setDepth(1000);
    const bg = this.scene.add
      .rectangle(0, 0, 160, 54, 0x0d1424, 0.65)
      .setStrokeStyle(2, 0xffe2a0, 0.6)
      .setInteractive({ useHandCursor: true });
    const t = txt(this.scene, 0, 0, 'Suspects', 22, '#ffe9b8').setOrigin(0.5);
    cont.add([bg, t]);
    cont.setScrollFactor(0, 0, true);
    let pressed = false;
    bg.on('pointerdown', () => (pressed = true));
    bg.on('pointerout', () => (pressed = false));
    bg.on('pointerup', () => {
      if (pressed && this.enabled) fn();
      pressed = false;
    });
    return cont;
  }
}
