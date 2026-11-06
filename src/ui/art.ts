import Phaser from 'phaser';
import { PAL, paintRect } from './paint';

/**
 * Painted-background drawing helpers: a moonlit, hand-painted house in blue-teal
 * mid-tones with pale inked edges and accents of maroon, plum and brass.
 * Coordinates are local to a floor (FLOOR_Y is the floorboards).
 */
/** Deep painted blue, used for the darkest furniture and shadows (no longer pure black). */
export const SIL = 0x1a2640;
export const FLOOR_Y = 610;

export function drawBody(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  // a deep red rug with a pale border (the one splash of red in the study)
  g.fillStyle(0x8e1c24, 1);
  g.fillEllipse(x, y + 8, 310, 44);
  g.lineStyle(3, 0xc79a6a, 0.6);
  g.strokeEllipse(x, y + 8, 290, 36);
  g.lineStyle(2, PAL.ink, 0.8);
  g.strokeEllipse(x, y + 8, 310, 44);
  // the figure lying on its side, peacefully, as if asleep
  g.fillStyle(0x1d2638, 1);
  g.fillCircle(x - 100, y - 14, 18); // head
  g.fillRoundedRect(x - 82, y - 30, 120, 32, 12); // coat
  g.fillRoundedRect(x + 30, y - 22, 90, 18, 8); // legs
  g.fillRoundedRect(x + 112, y - 30, 16, 26, 4); // shoes
  g.fillRoundedRect(x - 70, y - 4, 70, 10, 5); // arm
  // moonlight along the top edge of the figure
  g.lineStyle(2, 0x6f8fb8, 0.7);
  g.beginPath();
  g.arc(x - 100, y - 14, 18, Math.PI * 1.1, Math.PI * 1.9);
  g.strokePath();
  g.lineBetween(x - 78, y - 30, x + 34, y - 30);
  g.lineBetween(x + 34, y - 22, x + 118, y - 22);
  // a soft outline (detective chalk, but friendly)
  g.lineStyle(2, 0xdfe8ff, 0.35);
  g.strokeRoundedRect(x - 128, y - 40, 268, 54, 24);
}

export function drawGrandfatherClock(scene: Phaser.Scene, x: number, layer?: Phaser.GameObjects.Container) {
  const g = scene.add.graphics().setDepth(5);
  // plum-brown case with a pointed bonnet
  paintRect(g, x - 34, FLOOR_Y - 300, 68, 300, PAL.plumWood);
  g.fillStyle(PAL.plumWood, 1);
  g.fillTriangle(x - 44, FLOOR_Y - 300, x + 44, FLOOR_Y - 300, x, FLOOR_Y - 345);
  g.lineStyle(2, PAL.edge, 0.4);
  g.lineBetween(x - 44, FLOOR_Y - 300, x, FLOOR_Y - 345);
  g.lineStyle(2, PAL.ink, 0.85);
  g.strokeTriangle(x - 44, FLOOR_Y - 300, x + 44, FLOOR_Y - 300, x, FLOOR_Y - 345);
  // brass ring and a pale face
  g.fillStyle(PAL.brass, 1);
  g.fillCircle(x, FLOOR_Y - 250, 26);
  g.fillStyle(0xdfe3d0, 1);
  g.fillCircle(x, FLOOR_Y - 250, 21);
  g.lineStyle(3, PAL.ink, 1);
  g.lineBetween(x, FLOOR_Y - 250, x, FLOOR_Y - 265);
  g.lineBetween(x, FLOOR_Y - 250, x + 11, FLOOR_Y - 246);
  // the glass door over the pendulum
  g.fillStyle(0x1b2236, 1);
  g.fillRect(x - 18, FLOOR_Y - 210, 36, 160);
  g.lineStyle(2, PAL.brass, 0.8);
  g.strokeRect(x - 18, FLOOR_Y - 210, 36, 160);
  layer?.add(g);
  const pend = scene.add.container(x, FLOOR_Y - 205).setDepth(6);
  const rod = scene.add.rectangle(0, 0, 3, 110, PAL.brassDark).setOrigin(0.5, 0);
  const bob = scene.add.circle(0, 110, 11, PAL.brass).setStrokeStyle(2, PAL.ink);
  pend.add([rod, bob]);
  pend.setAngle(-14);
  scene.tweens.add({ targets: pend, angle: 14, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  layer?.add(pend);
  return g;
}

/** A moonlit window: a pale frame, cool panes, the moon, and moss-hung trees outside. */
export function drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  // panes: night sky fading to the garden
  g.fillGradientStyle(0x2c4a70, 0x2c4a70, 0x1d3540, 0x1d3540, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xdfe8ff, 0.35);
  g.fillCircle(x + w * 0.7, y + h * 0.26, Math.min(w, h) * 0.13); // moon
  g.fillStyle(0xdfe8ff, 0.12);
  g.fillCircle(x + w * 0.7, y + h * 0.26, Math.min(w, h) * 0.22);
  // a tree outside, hung with moss
  g.fillStyle(0x132a30, 1);
  g.fillRect(x + w * 0.18, y + h * 0.35, 6, h * 0.65);
  g.fillEllipse(x + w * 0.22, y + h * 0.36, w * 0.5, h * 0.22);
  g.lineStyle(2, 0x2c5a50, 0.8);
  for (let i = 0; i < 6; i++) {
    const mx = x + w * 0.06 + i * w * 0.06;
    g.lineBetween(mx, y + h * 0.4, mx + 2, y + h * (0.5 + (i % 3) * 0.07));
  }
  // the frame, mullions and sill: pale painted wood with a dark ink line
  g.lineStyle(9, 0xb9cde6, 1);
  g.strokeRect(x, y, w, h);
  g.lineStyle(5, 0xb9cde6, 1);
  g.lineBetween(x + w / 2, y, x + w / 2, y + h);
  g.lineBetween(x, y + h / 2, x + w, y + h / 2);
  g.lineStyle(2, PAL.ink, 0.8);
  g.strokeRect(x - 5, y - 5, w + 10, h + 10);
  paintRect(g, x - 14, y + h + 4, w + 28, 12, 0xb9cde6, { edge: 0xffffff });
}

export function drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, w: number, h: number) {
  paintRect(g, x, FLOOR_Y - h, w, h, PAL.wood);
  const spines = [PAL.maroon, PAL.plum, 0x8a7a3a, 0x2f6266, 0x4b5f8a, 0x6b4a3a];
  const shelves = Math.floor(h / 60);
  for (let s = 0; s < shelves; s++) {
    const sy = FLOOR_Y - h + 10 + s * 60;
    g.fillStyle(0x16223a, 1);
    g.fillRect(x + 6, sy, w - 12, 50);
    let bx = x + 8;
    let k = s;
    while (bx < x + w - 16) {
      const bw = 8 + ((bx * 7 + s * 13) % 14);
      const bh = 34 + ((bx * 3 + s) % 16);
      g.fillStyle(spines[k++ % spines.length], 1);
      g.fillRect(bx, sy + (48 - bh), bw, bh);
      g.lineStyle(1, PAL.edge, 0.3);
      g.lineBetween(bx + 1, sy + (48 - bh), bx + 1, sy + 48);
      bx += bw + 3;
    }
    g.lineStyle(3, PAL.edge, 0.5);
    g.lineBetween(x + 4, sy + 52, x + w - 4, sy + 52); // shelf lip
  }
}

export function drawDesk(g: Phaser.GameObjects.Graphics, x: number, w: number) {
  paintRect(g, x, FLOOR_Y - 120, w, 18, PAL.plumWood);
  paintRect(g, x + 8, FLOOR_Y - 102, 16, 102, PAL.plumWood);
  paintRect(g, x + w - 24, FLOOR_Y - 102, 16, 102, PAL.plumWood);
  paintRect(g, x + w - 110, FLOOR_Y - 102, 86, 60, PAL.plumWood);
}

export function drawPlant(g: Phaser.GameObjects.Graphics, x: number, scale = 1) {
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    const len = (110 + (i % 3) * 30) * scale;
    const tx = x + Math.cos(a) * len;
    const ty = FLOOR_Y - 50 * scale + Math.sin(a) * len;
    g.fillStyle(i % 2 ? PAL.leaf : 0x245652, 1);
    g.fillTriangle(x - 6 * scale, FLOOR_Y - 50 * scale, x + 6 * scale, FLOOR_Y - 50 * scale, tx, ty);
    g.lineStyle(2, PAL.leafLight, 0.7);
    g.lineBetween(x, FLOOR_Y - 50 * scale, (x + tx) / 2, (FLOOR_Y - 50 * scale + ty) / 2);
  }
  paintRect(g, x - 24 * scale, FLOOR_Y - 52 * scale, 48 * scale, 52 * scale, PAL.plum, { radius: 6 });
}

/** A gilded, scalloped frame with a dim painted figure inside. */
export function drawPortrait(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(PAL.brass, 1);
  g.fillRoundedRect(x - 54, y - 70, 108, 140, 10);
  g.fillStyle(PAL.brassDark, 1);
  for (let i = -2; i <= 2; i++) {
    g.fillCircle(x + i * 20, y - 70, 6); // scallops
    g.fillCircle(x + i * 20, y + 70, 6);
  }
  g.lineStyle(2, PAL.ink, 0.8);
  g.strokeRoundedRect(x - 54, y - 70, 108, 140, 10);
  g.fillStyle(0x2a2a44, 1);
  g.fillRect(x - 40, y - 55, 80, 110);
  g.fillStyle(0x1a1a2c, 1);
  g.fillCircle(x, y - 15, 18);
  g.fillRoundedRect(x - 28, y + 6, 56, 50, 14);
  g.lineStyle(1, 0x5a5a80, 0.8);
  g.strokeCircle(x, y - 15, 18);
}

export function drawCabinet(g: Phaser.GameObjects.Graphics, x: number) {
  paintRect(g, x, FLOOR_Y - 190, 90, 190, PAL.wood);
  for (let i = 1; i < 4; i++) {
    g.lineStyle(2, PAL.ink, 0.8);
    g.lineBetween(x + 6, FLOOR_Y - 190 + i * 47, x + 84, FLOOR_Y - 190 + i * 47);
    g.fillStyle(PAL.brass, 1);
    g.fillRect(x + 36, FLOOR_Y - 190 + i * 47 - 26, 18, 5);
  }
}

/** A brass chandelier with pale candles, a cobweb trailing from one arm. */
export function drawChandelier(g: Phaser.GameObjects.Graphics, x: number) {
  g.lineStyle(3, PAL.brassDark, 1);
  g.lineBetween(x, 0, x, 90);
  g.fillStyle(PAL.brass, 1);
  g.fillEllipse(x, 100, 140, 24);
  g.lineStyle(2, PAL.ink, 0.8);
  g.strokeEllipse(x, 100, 140, 24);
  for (let i = -2; i <= 2; i++) {
    g.fillStyle(0xdfe3d0, 1);
    g.fillRect(x + i * 28 - 3, 72, 6, 24);
    g.fillStyle(PAL.brassDark, 1);
    g.fillRect(x + i * 28 - 6, 94, 12, 5);
  }
  g.lineStyle(1, 0xdfe8ff, 0.4);
  g.lineBetween(x + 56, 104, x + 80, 150);
  g.lineBetween(x + 40, 108, x + 80, 150);
  g.lineBetween(x + 66, 102, x + 80, 150);
}

/** An ornate moulded fireplace: pale mantel with scrolls, brick hearth, brass fender. */
export function drawFireplace(g: Phaser.GameObjects.Graphics, x: number, w = 300, h = 300) {
  const left = x - w / 2;
  const top = FLOOR_Y - h;
  paintRect(g, left, top, w, h, PAL.pale, { edge: 0xdfe8ff, edgeAlpha: 0.6 });
  paintRect(g, left - 18, top - 22, w + 36, 26, PAL.pale, { edge: 0xdfe8ff, edgeAlpha: 0.6 }); // mantel shelf
  // moulding: a swag and two scrolls
  g.lineStyle(3, PAL.paleDark, 1);
  g.beginPath();
  g.arc(x, top + 10, w * 0.3, Math.PI * 0.15, Math.PI * 0.85);
  g.strokePath();
  for (const sx of [left + 30, left + w - 30]) {
    g.strokeCircle(sx, top + 28, 10);
    g.lineBetween(sx, top + 40, sx, top + h - 20); // pilaster flutes
    g.lineBetween(sx - 8, top + 44, sx - 8, top + h - 20);
    g.lineBetween(sx + 8, top + 44, sx + 8, top + h - 20);
  }
  // the opening, with brick inside
  const ox = left + 56;
  const ow = w - 112;
  const oy = top + 70;
  const oh = h - 70;
  g.fillStyle(0x15131c, 1);
  g.fillRect(ox, oy, ow, oh);
  for (let r = 0; r < Math.floor(oh / 18); r++) {
    for (let c = 0; c < Math.ceil(ow / 36) + 1; c++) {
      const bx = ox + c * 36 - (r % 2) * 18;
      const by = oy + 40 + r * 18;
      if (by + 14 > oy + oh || bx + 32 < ox || bx > ox + ow) continue;
      g.fillStyle(PAL.brick, 0.75 - r * 0.03);
      g.fillRect(Math.max(ox, bx), by, Math.min(32, ox + ow - Math.max(ox, bx)), 14);
    }
  }
  g.lineStyle(2, PAL.ink, 0.9);
  g.strokeRect(ox, oy, ow, oh);
  // brass fender and andirons
  paintRect(g, left + 30, FLOOR_Y - 26, w - 60, 20, PAL.brass, { edge: 0xffe9a8, edgeAlpha: 0.6, radius: 6 });
  g.fillStyle(PAL.brass, 1);
  g.fillCircle(ox + 30, FLOOR_Y - 46, 12);
  g.fillCircle(ox + ow - 30, FLOOR_Y - 46, 12);
  // a gilded mirror above
  g.fillStyle(PAL.brass, 1);
  g.fillRoundedRect(x - w * 0.36, top - 170, w * 0.72, 130, 16);
  g.fillStyle(0x3b5578, 1);
  g.fillRoundedRect(x - w * 0.36 + 12, top - 158, w * 0.72 - 24, 106, 10);
  g.fillStyle(0xdfe8ff, 0.12);
  g.fillTriangle(x - w * 0.2, top - 150, x + w * 0.1, top - 150, x - w * 0.3, top - 60);
  g.lineStyle(2, PAL.ink, 0.8);
  g.strokeRoundedRect(x - w * 0.36, top - 170, w * 0.72, 130, 16);
}

/** A tall panelled door with a brass knob. */
export function drawDoor(g: Phaser.GameObjects.Graphics, x: number, w = 110, h = 260) {
  paintRect(g, x - w / 2 - 10, FLOOR_Y - h - 12, w + 20, h + 12, PAL.woodDark); // frame
  paintRect(g, x - w / 2, FLOOR_Y - h, w, h, 0x3c5578);
  g.lineStyle(2, PAL.edge, 0.4);
  g.strokeRect(x - w / 2 + 12, FLOOR_Y - h + 14, w - 24, h * 0.4);
  g.strokeRect(x - w / 2 + 12, FLOOR_Y - h * 0.52, w - 24, h * 0.44);
  g.fillStyle(PAL.brass, 1);
  g.fillCircle(x + w / 2 - 16, FLOOR_Y - h * 0.48, 5);
}

/** A dado rail and panelled wainscot along the lower wall, and a cornice at the top. */
export function drawWainscot(g: Phaser.GameObjects.Graphics, x0: number, x1: number) {
  const top = FLOOR_Y - 150;
  g.fillStyle(0x0d1524, 0.32);
  g.fillRect(x0, top, x1 - x0, 150);
  g.lineStyle(2, PAL.edge, 0.25);
  for (let x = x0 + 30; x < x1 - 90; x += 140) g.strokeRect(x, top + 22, 110, 100);
  paintRect(g, x0, top - 8, x1 - x0, 10, PAL.paleDark, { edgeAlpha: 0.5 }); // dado rail
  paintRect(g, x0, FLOOR_Y - 18, x1 - x0, 18, PAL.woodDark, { edgeAlpha: 0.3 }); // skirting
  // cornice
  g.fillStyle(PAL.cornice, 1);
  g.fillRect(x0, 0, x1 - x0, 40);
  g.lineStyle(3, PAL.edge, 0.35);
  g.lineBetween(x0, 40, x1, 40);
  g.lineStyle(2, PAL.edge, 0.2);
  g.lineBetween(x0, 48, x1, 48);
}
