import Phaser from 'phaser';

/**
 * A hand-painted, moonlit look: blue-teal mid-tones, soft brush strokes, pale "inked"
 * edges, and accents of maroon, plum and brass. Textures are painted onto canvases at
 * boot, so the game still ships no image files.
 */
export const PAL = {
  ink: 0x0d1524, // dark outline
  edge: 0x9cbfe0, // pale highlight edge, like a lit brush line
  wood: 0x151d2c, // furniture: near-black silhouettes in the noir light
  woodDark: 0x0b101a,
  plumWood: 0x1f1219,
  maroon: 0x7a2f45,
  plum: 0x5a3a6e,
  brass: 0xb8953e,
  brassDark: 0x7a5e22,
  brick: 0x6b3b3f,
  mortar: 0x34252c,
  pale: 0x4a5566, // plaster and mantel: dim, so nothing large glows
  paleDark: 0x343c4a,
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
  g.lineStyle(2, opts.edge ?? PAL.edge, opts.edgeAlpha ?? 0.2);
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

  // moonlight through venetian blinds: a widening fan of bright slats with dark gaps
  canvas(scene, 'shaft', 200, 420, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(235,240,255,0.42)');
    g.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = g;
    const slats = 9;
    for (let i = 0; i < slats; i++) {
      // each slat is a thin wedge across the fan, so the bars spread as they fall
      const t0 = i / slats;
      const t1 = t0 + 0.55 / slats;
      ctx.beginPath();
      ctx.moveTo(w * (0.15 + 0.7 * t0), 0);
      ctx.lineTo(w * (0.15 + 0.7 * t1), 0);
      ctx.lineTo(w * t1, h);
      ctx.lineTo(w * t0, h);
      ctx.closePath();
      ctx.fill();
    }
  });

  // a wide soft pool of light, like a lamp behind fog: bright in the middle, gone at the edges
  canvas(scene, 'haze', 512, 288, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -w / 2, w, w);
    ctx.restore();
  });

  // drifting fog: big soft blobs, tileable left to right, thicker toward the bottom
  canvas(scene, 'fogband', 512, 256, (ctx, w, h) => {
    const rnd = mulberry(31);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w;
      const y = h * (0.25 + rnd() * 0.75);
      const r = 30 + rnd() * 80;
      const a = 0.05 + rnd() * 0.09;
      for (const ox of [-w, 0, w]) {
        const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        g.addColorStop(0, `rgba(235,235,235,${a})`);
        g.addColorStop(1, 'rgba(235,235,235,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
  });

  // film grain: fine random speckle, tileable
  canvas(scene, 'grain', 256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const rnd = mulberry(23);
    for (let i = 0; i < w * h; i++) {
      const v = rnd() * 255;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = rnd() < 0.5 ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
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
