import Phaser from 'phaser';

/** Silhouette-noir drawing helpers. Everything is near-black shapes on moody gradients. */
export const SIL = 0x020306;
export const FLOOR_Y = 610;

export function drawBody(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // rug
  g.fillStyle(0x1a1420, 1);
  g.fillEllipse(x, y + 8, 300, 40);
  g.lineStyle(2, 0x3a2a44, 1);
  g.strokeEllipse(x, y + 8, 300, 40);
  // the figure lying on its side, peacefully, as if asleep
  g.fillStyle(SIL, 1);
  g.fillCircle(x - 100, y - 14, 18); // head
  g.fillRoundedRect(x - 82, y - 30, 120, 32, 12); // torso / coat
  g.fillRoundedRect(x + 30, y - 22, 90, 18, 8); // legs
  g.fillRoundedRect(x + 112, y - 30, 16, 26, 4); // shoes
  g.fillRoundedRect(x - 70, y - 4, 70, 10, 5); // arm
  // dashed outline (detective chalk, but friendly)
  g.lineStyle(2, 0xcfd8ff, 0.35);
  g.strokeRoundedRect(x - 128, y - 40, 268, 54, 24);
}

export function drawGrandfatherClock(scene: Phaser.Scene, x: number, layer?: Phaser.GameObjects.Container) {
  const g = scene.add.graphics().setDepth(5);
  g.fillStyle(SIL, 1);
  g.fillRect(x - 34, FLOOR_Y - 300, 68, 300);
  g.fillTriangle(x - 44, FLOOR_Y - 300, x + 44, FLOOR_Y - 300, x, FLOOR_Y - 345);
  g.fillStyle(0x2a3350, 1);
  g.fillCircle(x, FLOOR_Y - 250, 24);
  g.lineStyle(3, SIL, 1);
  g.lineBetween(x, FLOOR_Y - 250, x, FLOOR_Y - 266);
  g.lineBetween(x, FLOOR_Y - 250, x + 12, FLOOR_Y - 246);
  g.fillStyle(0x0d1220, 1);
  g.fillRect(x - 18, FLOOR_Y - 210, 36, 160);
  layer?.add(g);
  // pendulum
  const pend = scene.add.container(x, FLOOR_Y - 205).setDepth(6);
  const rod = scene.add.rectangle(0, 0, 3, 110, 0x6f7ea8).setOrigin(0.5, 0);
  const bob = scene.add.circle(0, 110, 11, 0x9aa8cc);
  pend.add([rod, bob]);
  pend.setAngle(-14);
  scene.tweens.add({ targets: pend, angle: 14, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  layer?.add(pend);
  return g;
}

export function drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x31406a, 0.55);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xc7d4ff, 0.12);
  g.fillCircle(x + w * 0.7, y + h * 0.3, Math.min(w, h) * 0.18); // moon
  g.lineStyle(6, SIL, 1);
  g.strokeRect(x, y, w, h);
  g.lineBetween(x + w / 2, y, x + w / 2, y + h);
  g.lineBetween(x, y + h / 2, x + w, y + h / 2);
}

export function drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, w: number, h: number) {
  g.fillStyle(SIL, 1);
  g.fillRect(x, FLOOR_Y - h, w, h);
  g.fillStyle(0x10131f, 1);
  const shelves = Math.floor(h / 60);
  for (let s = 0; s < shelves; s++) {
    const sy = FLOOR_Y - h + 10 + s * 60;
    let bx = x + 8;
    while (bx < x + w - 16) {
      const bw = 8 + ((bx * 7 + s * 13) % 14);
      const bh = 34 + ((bx * 3 + s) % 16);
      g.fillRect(bx, sy + (48 - bh), bw, bh);
      bx += bw + 3;
    }
  }
}

export function drawDesk(g: Phaser.GameObjects.Graphics, x: number, w: number) {
  g.fillStyle(SIL, 1);
  g.fillRect(x, FLOOR_Y - 120, w, 18);
  g.fillRect(x + 8, FLOOR_Y - 102, 16, 102);
  g.fillRect(x + w - 24, FLOOR_Y - 102, 16, 102);
  g.fillRect(x + w - 110, FLOOR_Y - 102, 86, 60);
}

export function drawPlant(g: Phaser.GameObjects.Graphics, x: number, scale = 1) {
  g.fillStyle(SIL, 1);
  g.fillRect(x - 22 * scale, FLOOR_Y - 50 * scale, 44 * scale, 50 * scale);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    const len = (110 + (i % 3) * 30) * scale;
    const tx = x + Math.cos(a) * len;
    const ty = FLOOR_Y - 50 * scale + Math.sin(a) * len;
    g.fillTriangle(x - 5 * scale, FLOOR_Y - 50 * scale, x + 5 * scale, FLOOR_Y - 50 * scale, tx, ty);
  }
}

export function drawPortrait(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(SIL, 1);
  g.fillRect(x - 50, y - 65, 100, 130);
  g.fillStyle(0x251e30, 1);
  g.fillRect(x - 40, y - 55, 80, 110);
  g.fillStyle(SIL, 1);
  g.fillCircle(x, y - 15, 18);
  g.fillRoundedRect(x - 28, y + 6, 56, 50, 14);
}

export function drawCabinet(g: Phaser.GameObjects.Graphics, x: number) {
  g.fillStyle(SIL, 1);
  g.fillRect(x, FLOOR_Y - 190, 90, 190);
  g.lineStyle(2, 0x1c1610, 1);
  for (let i = 1; i < 4; i++) g.lineBetween(x + 6, FLOOR_Y - 190 + i * 47, x + 84, FLOOR_Y - 190 + i * 47);
}

export function drawChandelier(g: Phaser.GameObjects.Graphics, x: number) {
  g.lineStyle(3, SIL, 1);
  g.lineBetween(x, 0, x, 90);
  g.fillStyle(SIL, 1);
  g.fillEllipse(x, 100, 140, 26);
  for (let i = -2; i <= 2; i++) {
    g.fillRect(x + i * 28 - 3, 70, 6, 30);
  }
}
