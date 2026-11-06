import Phaser from 'phaser';

/**
 * A hand-painted, moonlit look: blue-teal mid-tones, soft brush strokes, pale "inked"
 * edges, and accents of maroon, plum and brass. Textures are painted onto canvases at
 * boot, so the game still ships no image files.
 */
export const PAL = {
  ink: 0x0d1524, // dark outline
  edge: 0x9cbfe0, // pale highlight edge, like a lit brush line
  wood: 0x2f4466, // painted blue furniture
  woodDark: 0x22324e,
  plumWood: 0x4a2f45,
  maroon: 0x7a2f45,
  plum: 0x5a3a6e,
  brass: 0xb8953e,
  brassDark: 0x7a5e22,
  brick: 0x6b3b3f,
  mortar: 0x34252c,
  pale: 0x8fb0d6, // painted plaster / mantel
  paleDark: 0x5f7fa8,
  leaf: 0x1f4a4a,
  leafLight: 0x3f7a6a,
  velvet: 0x2c3f78,
  cornice: 0x101a2c,
};

/** A rectangle painted rather than flat: dark ink outline, a lighter edge on the lit side. */
export function paintRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  opts: { edge?: number; edgeAlpha?: number; radius?: number } = {},
) {
  const r = opts.radius ?? 0;
  g.fillStyle(fill, 1);
  if (r) g.fillRoundedRect(x, y, w, h, r);
  else g.fillRect(x, y, w, h);
  g.lineStyle(2, opts.edge ?? PAL.edge, opts.edgeAlpha ?? 0.45);
  g.lineBetween(x + 2, y + 2, x + w - 2, y + 2); // lit top edge
  g.lineBetween(x + 2, y + 2, x + 2, y + h - 2); // lit left edge
  g.lineStyle(2, PAL.ink, 0.85);
  if (r) g.strokeRoundedRect(x, y, w, h, r);
  else g.strokeRect(x, y, w, h);
}

/** A jagged plaster crack. */
export function crack(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, seed = 1) {
  g.lineStyle(2, PAL.ink, 0.5);
  let cx = x;
  let cy = y;
  for (let i = 0; i < 6; i++) {
    const nx = cx + ((seed * (i + 3) * 7) % 9) - 4;
    const ny = cy + len / 6;
    g.lineBetween(cx, cy, nx, ny);
    if (i === 2) g.lineBetween(nx, ny, nx + 10, ny + 8);
    cx = nx;
    cy = ny;
  }
}

/** A cobweb in a corner. `flip` mirrors it for a right-hand corner. */
export function cobweb(scene: Phaser.Scene, x: number, y: number, scale = 1, flip = false, alpha = 0.55) {
  return scene.add.image(x, y, 'cobweb').setOrigin(flip ? 1 : 0, 0).setScale(scale).setFlipX(flip).setAlpha(alpha);
}

/** Paint every texture the house needs. Called once from the boot scene. */
export function makePaintTextures(scene: Phaser.Scene) {
  // a pale, tileable wall of soft vertical brush strokes; rooms tint it to their colour
  canvas(scene, 'paintWall', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4cfdd';
    ctx.fillRect(0, 0, w, h);
    const rnd = mulberry(7);
    for (let i = 0; i < 140; i++) {
      const x = rnd() * w;
      const sw = 6 + rnd() * 18;
      const len = 60 + rnd() * 180;
      const y = rnd() * h;
      const l = 0.82 + rnd() * 0.3;
      ctx.fillStyle = `rgba(${Math.round(196 * l)},${Math.round(207 * l)},${Math.round(221 * l)},${0.25 + rnd() * 0.25})`;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) ctx.fillRect(x + ox, y + oy, sw, len);
    }
    for (let i = 0; i < 18; i++) {
      // soft blotches, like gouache pooling
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 14 + rnd() * 30;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(150,165,190,${0.12 + rnd() * 0.12})`);
      grd.addColorStop(1, 'rgba(150,165,190,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });

  // floorboards seen from the side: long planks, seams and grain
  canvas(scene, 'floorboards', 256, 112, (ctx, w, h) => {
    ctx.fillStyle = '#8796ae';
    ctx.fillRect(0, 0, w, h);
    const rnd = mulberry(11);
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      const shade = 0.85 + rnd() * 0.25;
      ctx.fillStyle = `rgba(${Math.round(135 * shade)},${Math.round(150 * shade)},${Math.round(174 * shade)},1)`;
      ctx.fillRect(0, y, w, h / rows);
      ctx.fillStyle = 'rgba(30,40,60,0.55)';
      ctx.fillRect(0, y, w, 1.5);
      const seam = rnd() * w;
      ctx.fillRect(seam, y, 1.5, h / rows);
      ctx.strokeStyle = 'rgba(60,72,96,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, y + h / rows / 2 + rnd() * 3);
      ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y + 10, w, y + h / rows / 2);
      ctx.stroke();
    }
  });

  // a corner cobweb: spokes and sagging threads
  canvas(scene, 'cobweb', 160, 160, (ctx) => {
    ctx.strokeStyle = 'rgba(220,232,255,0.75)';
    ctx.lineWidth = 1.2;
    const spokes = 7;
    const ends: [number, number][] = [];
    for (let i = 0; i < spokes; i++) {
      const a = (i / (spokes - 1)) * (Math.PI / 2);
      const ex = Math.cos(a) * 155;
      const ey = Math.sin(a) * 155;
      ends.push([ex, ey]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    for (let ring = 1; ring <= 5; ring++) {
      const f = ring / 5.4;
      ctx.beginPath();
      for (let i = 0; i < spokes - 1; i++) {
        const [x1, y1] = ends[i];
        const [x2, y2] = ends[i + 1];
        const ax = x1 * f;
        const ay = y1 * f;
        const bx = x2 * f;
        const by = y2 * f;
        if (i === 0) ctx.moveTo(ax, ay);
        // threads sag slightly toward the corner
        ctx.quadraticCurveTo((ax + bx) / 2 * 0.92, (ay + by) / 2 * 0.92, bx, by);
      }
      ctx.stroke();
    }
  });

  // moonlight falling in from a window
  canvas(scene, 'shaft', 200, 420, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(190,215,255,0.22)');
    g.addColorStop(1, 'rgba(190,215,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 0);
    ctx.lineTo(w * 0.85, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  });
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext(), w, h);
  tex.refresh();
}

/** Small seeded random, so the painting is the same every time. */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
