import Phaser from 'phaser';
import { txt } from './widgets';

/**
 * Pencil sketches of the physical clues, drawn instead of described. Each drawing fills a
 * SKETCH_W × SKETCH_H box and returns the points its pencilled notes point at, in the order
 * the clue's `notes` are written (see the Evidence type in src/data/case1.ts).
 */
export type Drawing = 'boot' | 'foxglove' | 'knife';
export const SKETCH_W = 440;
export const SKETCH_H = 260;

type Pt = { x: number; y: number };
const PENCIL = 0x3a3a38;
const FAINT = 0xc4c4bc;
const PAPER = 0xeeeeea;

/** A deterministic wobble so the lines look hand-drawn but never change between visits. */
function wobble(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280 - 0.5;
  };
}

/** A pencil line, gone over twice with a slight wobble. */
function pencil(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, rnd: () => number, width = 2, color = PENCIL) {
  g.lineStyle(width, color, 0.9);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineStyle(1, color, 0.5);
  g.lineBetween(a.x + rnd() * 2, a.y + rnd() * 2, b.x + rnd() * 2, b.y + rnd() * 2);
}

/** A leaf: a pointed oval from `base`, at `angle` (radians), `len` long. */
function leaf(g: Phaser.GameObjects.Graphics, base: Pt, angle: number, len: number, wid: number) {
  const pts: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const along = t * len;
    const side = Math.sin(Math.PI * t) * wid * (k < 8 ? 1 : 1);
    pts.push({ x: along, y: -side });
  }
  for (let k = 16; k >= 0; k--) {
    const t = k / 16;
    pts.push({ x: t * len, y: Math.sin(Math.PI * t) * wid });
  }
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const world = pts.map((p) => ({ x: base.x + p.x * c - p.y * s, y: base.y + p.x * s + p.y * c }));
  g.fillStyle(0x8a8a84, 0.55);
  g.fillPoints(world, true);
  g.lineStyle(1.5, PENCIL, 0.85);
  g.strokePoints(world, true);
  g.lineStyle(1, PENCIL, 0.5);
  g.lineBetween(base.x, base.y, base.x + len * 0.85 * c, base.y + len * 0.85 * s);
}

/** A boot print on the conservatory tiles, toe pointing into the house, under the window. */
function boot(g: Phaser.GameObjects.Graphics, ox: number, oy: number): Pt[] {
  const rnd = wobble(7);
  const cx = ox + SKETCH_W / 2;
  // floor tiles
  g.lineStyle(1, FAINT, 1);
  for (let y = oy + 86; y < oy + SKETCH_H; y += 44) g.lineBetween(ox + 20, y, ox + SKETCH_W - 20, y);
  for (let x = ox + 20; x <= ox + SKETCH_W - 20; x += 50) g.lineBetween(x, oy + 76, x, oy + SKETCH_H);
  // the window above, seen from the room: frame, panes and the latch swung open
  const wx = cx - 160;
  pencil(g, { x: wx, y: oy + 10 }, { x: wx + 320, y: oy + 10 }, rnd);
  pencil(g, { x: wx, y: oy + 54 }, { x: wx + 320, y: oy + 54 }, rnd);
  pencil(g, { x: wx, y: oy + 10 }, { x: wx, y: oy + 54 }, rnd);
  pencil(g, { x: wx + 320, y: oy + 10 }, { x: wx + 320, y: oy + 54 }, rnd);
  for (let k = 1; k < 4; k++) pencil(g, { x: wx + k * 80, y: oy + 10 }, { x: wx + k * 80, y: oy + 54 }, rnd, 1);
  pencil(g, { x: wx, y: oy + 62 }, { x: wx + 320, y: oy + 62 }, rnd, 1);
  g.fillStyle(PENCIL, 1);
  g.fillCircle(cx, oy + 54, 4);
  pencil(g, { x: cx, y: oy + 54 }, { x: cx + 24, y: oy + 72 }, rnd, 3);
  g.lineStyle(1, PENCIL, 0.6);
  g.strokeCircle(cx - 22, oy + 54, 3); // the keeper the latch should sit in
  // the print: heel at the window end, toe pointing into the house
  const mud = 0x4a4a46;
  const heel = { x: cx, y: oy + 112 };
  const ball = { x: cx + 4, y: oy + 196 };
  g.fillStyle(mud, 0.8);
  g.fillEllipse(heel.x, heel.y, 54, 58);
  g.fillEllipse(ball.x, ball.y, 76, 104);
  g.fillPoints(
    [
      { x: heel.x - 22, y: heel.y + 14 },
      { x: heel.x + 24, y: heel.y + 14 },
      { x: ball.x + 30, y: ball.y - 30 },
      { x: ball.x - 32, y: ball.y - 30 },
    ],
    true,
  );
  // the heel worn away on one side
  g.fillStyle(PAPER, 0.85);
  g.fillEllipse(heel.x + 20, heel.y - 12, 26, 30);
  // tread bars across the sole
  g.lineStyle(3, PAPER, 0.75);
  for (let y = ball.y - 34; y <= ball.y + 38; y += 12) g.lineBetween(ball.x - 30, y, ball.x + 30, y);
  g.lineStyle(2, PAPER, 0.6);
  for (let y = heel.y - 18; y <= heel.y + 14; y += 10) g.lineBetween(heel.x - 18, y, heel.x + 8, y);
  // soft mud squeezed out at the edges
  g.fillStyle(mud, 0.45);
  for (const [dx, dy, r] of [
    [-48, 170, 7],
    [-44, 188, 4],
    [44, 214, 5],
    [-30, 248, 4],
    [36, 140, 3],
  ])
    g.fillCircle(cx + dx, oy + dy, r);
  return [
    { x: cx + 26, y: oy + 74 }, // the latch
    { x: heel.x + 26, y: heel.y - 10 }, // the worn heel
    { x: cx - 50, y: oy + 172 }, // the mud
    { x: ball.x + 6, y: ball.y + 54 }, // the toe
  ];
}

/** Four foxgloves in pots on the bench; the last has lost its lower leaves to a knife. */
function foxglove(g: Phaser.GameObjects.Graphics, ox: number, oy: number): Pt[] {
  const rnd = wobble(11);
  const benchY = oy + 236;
  pencil(g, { x: ox + 6, y: benchY }, { x: ox + SKETCH_W - 6, y: benchY }, rnd);
  pencil(g, { x: ox + 6, y: benchY + 8 }, { x: ox + SKETCH_W - 6, y: benchY + 8 }, rnd, 1);
  pencil(g, { x: ox + 30, y: benchY + 8 }, { x: ox + 30, y: oy + SKETCH_H }, rnd);
  pencil(g, { x: ox + SKETCH_W - 30, y: benchY + 8 }, { x: ox + SKETCH_W - 30, y: oy + SKETCH_H }, rnd);
  const xs = [70, 170, 270, 370].map((x) => ox + x);
  const top = benchY - 46;
  xs.forEach((x, i) => {
    // the pot
    const pot = [
      { x: x - 28, y: top },
      { x: x + 28, y: top },
      { x: x + 20, y: benchY },
      { x: x - 20, y: benchY },
    ];
    g.fillStyle(0xa8a8a0, 0.6);
    g.fillPoints(pot, true);
    g.lineStyle(2, PENCIL, 0.9);
    g.strokePoints(pot, true);
    pencil(g, { x: x - 30, y: top + 8 }, { x: x + 30, y: top + 8 }, rnd, 1);
    // the stem
    pencil(g, { x, y: top }, { x: x + 2, y: oy + 30 }, rnd, 2);
    const stripped = i === 3;
    // lower leaves, or the clean stubs where they were cut
    [top - 14, top - 36, top - 58].forEach((y, k) => {
      if (stripped) {
        g.lineStyle(2, PENCIL, 0.9);
        g.lineBetween(x, y, x - 7, y - 3);
        g.lineBetween(x - 7, y - 6, x - 7, y);
        g.lineBetween(x, y - 6, x + 7, y - 9);
        g.lineBetween(x + 7, y - 12, x + 7, y - 6);
      } else {
        leaf(g, { x, y }, Math.PI + 0.35 - k * 0.12, 40 - k * 5, 9);
        leaf(g, { x, y: y - 6 }, -0.35 + k * 0.12, 40 - k * 5, 9);
      }
    });
    // a few small upper leaves and the bells hanging from the top of the stem
    leaf(g, { x: x + 1, y: oy + 112 }, Math.PI + 0.6, 22, 6);
    leaf(g, { x: x + 1, y: oy + 104 }, -0.6, 22, 6);
    for (let k = 0; k < 5; k++) {
      const by = oy + 40 + k * 13;
      const side = k % 2 ? 1 : -1;
      const bx = x + 2 + side * 9;
      g.fillStyle(0x6a6a66, 0.7);
      g.fillPoints(
        [
          { x: bx - 4, y: by - 4 },
          { x: bx + 4, y: by - 4 },
          { x: bx + 7, y: by + 9 },
          { x: bx - 7, y: by + 9 },
        ],
        true,
      );
      g.lineStyle(1, PENCIL, 0.8);
      g.lineBetween(x + 2, by - 6, bx, by - 4);
    }
  });
  return [
    { x: xs[3] + 2, y: top - 70 }, // the stripped stem
    { x: xs[3] + 9, y: top - 10 }, // the cut stubs
    { x: xs[2] + 30, y: top - 24 }, // the untouched pots
  ];
}

/** A folding pruning knife, closed, lying in the fringe of the rug. */
function knife(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, into: Phaser.GameObjects.Container, ox: number, oy: number): Pt[] {
  const rnd = wobble(5);
  // the rug's edge and its fringe
  g.fillStyle(0xb4b4ac, 0.5);
  g.fillRect(ox + 10, oy + 132, SKETCH_W - 20, 18);
  pencil(g, { x: ox + 10, y: oy + 132 }, { x: ox + SKETCH_W - 10, y: oy + 132 }, rnd, 1);
  pencil(g, { x: ox + 10, y: oy + 150 }, { x: ox + SKETCH_W - 10, y: oy + 150 }, rnd, 1);
  g.lineStyle(1, PENCIL, 0.6);
  for (let x = ox + 14; x < ox + SKETCH_W - 10; x += 7) g.lineBetween(x, oy + 150, x + rnd() * 6, oy + 188 + rnd() * 8);
  // the handle, bone, with metal ends; the closed blade's back shows along the top
  const hx = ox + 60;
  const hw = 300;
  const hy = oy + 64;
  const hh = 50;
  g.fillStyle(0x8a8a84, 0.9);
  g.fillRoundedRect(hx + 30, hy - 9, hw - 60, 14, 4); // the blade's back
  g.lineStyle(1.5, PENCIL, 0.9);
  g.strokeRoundedRect(hx + 30, hy - 9, hw - 60, 14, 4);
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(hx + 150, hy - 2, 18, 6); // the nail nick for opening it
  g.fillStyle(0xe2dfd4, 1);
  g.fillRoundedRect(hx, hy, hw, hh, 22);
  g.lineStyle(2, PENCIL, 0.95);
  g.strokeRoundedRect(hx, hy, hw, hh, 22);
  g.lineStyle(1, 0x9a9a92, 0.8);
  for (let k = 0; k < 6; k++) {
    const y = hy + 12 + k * 5 + rnd() * 3;
    g.lineBetween(hx + 70 + rnd() * 20, y, hx + 120 + rnd() * 30, y + rnd() * 2);
    g.lineBetween(hx + 200 + rnd() * 20, y, hx + 240 + rnd() * 20, y + rnd() * 2);
  }
  for (const x of [hx, hx + hw - 34]) {
    g.fillStyle(0x9c9c98, 1);
    g.fillRoundedRect(x, hy, 34, hh, { tl: x === hx ? 22 : 0, bl: x === hx ? 22 : 0, tr: x === hx ? 0 : 22, br: x === hx ? 0 : 22 });
    g.lineStyle(1.5, PENCIL, 0.9);
    g.strokeRoundedRect(x, hy, 34, hh, { tl: x === hx ? 22 : 0, bl: x === hx ? 22 : 0, tr: x === hx ? 0 : 22, br: x === hx ? 0 : 22 });
    g.fillStyle(PENCIL, 1);
    g.fillCircle(x + 17, hy + hh / 2, 3.5);
  }
  // the initials, scratched in
  into.add(txt(scene, hx + hw / 2, hy + hh / 2, 'E.T.', 22, '#3a3a38', { fontStyle: 'italic' }).setOrigin(0.5).setAngle(-4));
  g.lineStyle(1, PENCIL, 0.5);
  g.lineBetween(hx + hw / 2 - 26, hy + hh / 2 + 12, hx + hw / 2 + 24, hy + hh / 2 + 9);
  return [
    { x: hx + hw - 70, y: hy + hh + 2 }, // the bone handle
    { x: hx + hw / 2 + 20, y: hy + hh / 2 - 4 }, // the initials
    { x: hx + 90, y: hy - 10 }, // the closed blade
  ];
}

/** Draw `drawing` with its top-left at (ox, oy); returns the note anchor points and the height used. */
export function drawSketch(
  scene: Phaser.Scene,
  into: Phaser.GameObjects.Container,
  drawing: Drawing,
  ox: number,
  oy: number,
): { anchors: Pt[]; h: number } {
  const g = scene.add.graphics();
  into.add(g);
  if (drawing === 'boot') return { anchors: boot(g, ox, oy), h: SKETCH_H };
  if (drawing === 'foxglove') return { anchors: foxglove(g, ox, oy), h: SKETCH_H };
  return { anchors: knife(scene, g, into, ox, oy), h: SKETCH_H - 60 };
}
