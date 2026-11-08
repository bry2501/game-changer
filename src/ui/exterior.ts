import Phaser from 'phaser';
import { PAL, paintRect } from './paint';
import { drawFoliage } from './art';
import { ZOOM } from './widgets';

/**
 * The house from outside, painted for the title screen: a two-storey columned mansion
 * with a balcony, a maroon roof with dormers, crooked shutters and leafy oaks.
 */
export function drawMansion(scene: Phaser.Scene, W: number, H: number): Phaser.GameObjects.Image {
  // The painting is thousands of shapes, far too many to redraw every frame, so it is
  // painted once into a full-resolution texture and shown as a single image.
  const key = 'title-mansion';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    paintMansion(g, W, H);
    const rt = scene.make.renderTexture({ width: Math.ceil(W * ZOOM), height: Math.ceil(H * ZOOM) }, false);
    g.setScale(ZOOM);
    rt.draw(g);
    rt.saveTexture(key);
    g.destroy();
  }
  return scene.add.image(0, 0, key).setOrigin(0).setScale(1 / ZOOM);
}

function paintMansion(g: Phaser.GameObjects.Graphics, W: number, H: number) {
  // night sky, deep blue into teal at the horizon
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x0b1530),
      Phaser.Display.Color.ValueToColor(0x2c5a72),
      100,
      t * 100,
    );
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (i * 560) / bands, W, 560 / bands + 1);
  }
  // stars
  for (let i = 0; i < 60; i++) {
    g.fillStyle(0xdfe8ff, 0.3 + ((i * 37) % 10) / 20);
    g.fillCircle((i * 197) % W, (i * 83) % 300, i % 7 === 0 ? 1.8 : 1);
  }
  // the moon with a soft halo
  for (let r = 120; r > 50; r -= 10) {
    g.fillStyle(0xcfe0ff, 0.035);
    g.fillCircle(1060, 120, r);
  }
  g.fillStyle(0xe8efff, 1);
  g.fillCircle(1060, 120, 48);
  g.fillStyle(0xc9d6ee, 0.6);
  g.fillCircle(1045, 108, 9);
  g.fillCircle(1075, 135, 6);

  // the house
  const cx = W / 2;
  const hw = 470; // half width
  const top = 300; // top of the second storey wall
  const mid = 450; // between storeys
  const ground = 600;
  // roof: a maroon hip with dormers and chimneys
  paintRect(g, cx - 330, 150, 26, 80, PAL.brick);
  paintRect(g, cx + 300, 140, 26, 90, PAL.brick);
  g.fillStyle(PAL.maroon, 1);
  g.fillTriangle(cx - hw - 30, top, cx + hw + 30, top, cx, 170);
  g.fillRect(cx - hw + 120, 210, (hw - 120) * 2, top - 210);
  g.fillTriangle(cx - hw - 30, top, cx - hw + 120, 210, cx - hw + 120, top);
  g.fillTriangle(cx + hw + 30, top, cx + hw - 120, 210, cx + hw - 120, top);
  g.lineStyle(2, 0x4a1a2a, 0.6);
  for (let y = 222; y < top; y += 14) g.lineBetween(cx - hw + (top - y) * 1.0, y, cx + hw - (top - y) * 1.0, y); // shingle rows
  g.lineStyle(3, 0xc77a8f, 0.5);
  g.lineBetween(cx - hw + 120, 210, cx + hw - 120, 210);
  [-240, 0, 240].forEach((dx) => {
    const x = cx + dx;
    paintRect(g, x - 34, 214, 68, 70, PAL.pale);
    g.fillStyle(PAL.maroon, 1);
    g.fillTriangle(x - 46, 218, x + 46, 218, x, 182);
    g.fillStyle(dx === 240 ? 0xf3d58a : 0x1b2c4a, 1); // one lit window up top
    g.fillRect(x - 20, 230, 40, 46);
    g.lineStyle(2, PAL.paleDark, 1);
    g.lineBetween(x, 230, x, 276);
  });

  // walls
  paintRect(g, cx - hw, top, hw * 2, ground - top, 0x6f8fb8);
  g.fillStyle(0x51709a, 0.5);
  g.fillRect(cx - hw, mid, hw * 2, ground - mid); // the porch is in shadow
  // balcony and porch roof
  paintRect(g, cx - hw - 20, mid - 12, hw * 2 + 40, 18, PAL.pale);
  g.lineStyle(2, PAL.pale, 1);
  for (let x = cx - hw - 10; x <= cx + hw + 10; x += 16) g.lineBetween(x, mid - 12, x, mid - 46);
  g.lineStyle(5, PAL.pale, 1);
  g.lineBetween(cx - hw - 20, mid - 46, cx + hw + 20, mid - 46);

  // windows with shutters, some hanging crooked
  const win = (x: number, y: number, w: number, h: number, crooked: number, lit = false) => {
    g.fillStyle(lit ? 0xf3d58a : 0x1b2c4a, 1);
    g.fillRect(x - w / 2, y, w, h);
    g.lineStyle(3, PAL.pale, 1);
    g.strokeRect(x - w / 2, y, w, h);
    g.lineBetween(x, y, x, y + h);
    g.lineBetween(x - w / 2, y + h / 2, x + w / 2, y + h / 2);
    const sw = w * 0.45;
    g.fillStyle(PAL.wood, 1);
    g.fillRect(x - w / 2 - sw - 4, y, sw, h);
    g.lineStyle(2, PAL.ink, 0.8);
    g.strokeRect(x - w / 2 - sw - 4, y, sw, h);
    // the right shutter: maybe hanging by one hinge
    const rx = x + w / 2 + 4;
    g.fillStyle(PAL.wood, 1);
    g.beginPath();
    g.moveTo(rx, y);
    g.lineTo(rx + sw, y + crooked);
    g.lineTo(rx + sw + crooked * 0.3, y + h + crooked);
    g.lineTo(rx, y + h);
    g.closePath();
    g.fillPath();
    g.strokePath();
  };
  [-360, -200, 200, 360].forEach((dx, i) => win(cx + dx, 326, 54, 86, i === 1 ? 14 : i === 3 ? 6 : 0, false));
  [-360, -200, 200, 360].forEach((dx, i) => win(cx + dx, 476, 58, 96, i === 2 ? 18 : 0, i === 0));

  // front door with a fanlight
  paintRect(g, cx - 50, 470, 100, ground - 470, PAL.maroon);
  g.fillStyle(0xf3d58a, 0.75);
  g.slice(cx, 470, 50, Math.PI, 0, false);
  g.fillPath();
  g.lineStyle(3, PAL.pale, 1);
  g.strokeRect(cx - 50, 470, 100, ground - 470);
  g.fillStyle(PAL.brass, 1);
  g.fillCircle(cx + 30, 540, 5);

  // columns rising to the roof
  for (let i = 0; i < 8; i++) {
    const x = cx - hw + 20 + (i * (hw * 2 - 40)) / 7;
    if (Math.abs(x - cx) < 70) continue;
    paintRect(g, x - 11, top - 8, 22, ground - top + 8, 0xb9cde6, { edge: 0xffffff, edgeAlpha: 0.6 });
    paintRect(g, x - 16, top - 14, 32, 10, 0xdbe6f4);
    paintRect(g, x - 16, ground - 10, 32, 10, 0xdbe6f4);
  }
  // steps
  paintRect(g, cx - 110, ground, 220, 14, 0x9fb2cc);
  paintRect(g, cx - 140, ground + 14, 280, 14, 0x8aa0bd);

  // lawn and a path to the door
  g.fillStyle(0x1b3a3e, 1);
  g.fillRect(0, ground, W, H - ground);
  g.fillStyle(0x24494a, 1);
  g.fillEllipse(W * 0.25, ground + 30, 700, 50);
  g.fillEllipse(W * 0.8, ground + 40, 600, 60);
  g.fillStyle(0x6a7d98, 1);
  g.fillTriangle(cx - 140, ground + 28, cx + 140, ground + 28, cx + 300, H);
  g.fillTriangle(cx - 140, ground + 28, cx - 300, H, cx + 300, H);

  // leafy oaks at either side
  const tree = (x: number, flip: number) => {
    g.fillStyle(0x0d1a22, 1);
    g.fillRect(x - 22, 220, 44, H - 220);
    g.lineStyle(16, 0x0d1a22, 1);
    g.lineBetween(x, 300, x + 180 * flip, 200);
    g.lineBetween(x, 360, x + 260 * flip, 330);
    g.lineBetween(x, 260, x - 60 * flip, 120);
    [
      [0, 150, 150],
      [120, 190, 120],
      [-60, 110, 110],
      [210, 280, 110],
    ].forEach(([dx, y, r], k) => drawFoliage(g, x + dx * flip, y, r, r * 0.6, 0x132a2c, x + k * 31, 1.4));
  };
  tree(70, 1);
  tree(W - 70, -1);
}
