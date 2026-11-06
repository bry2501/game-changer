import Phaser from 'phaser';
import { fitCamera, H, W, GHOST_RES } from '../ui/widgets';
import { makePaintTextures } from '../ui/paint';

/** Generates every texture procedurally: no binary assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    fitCamera(this.cameras.main);
    this.radial('glow', 128, [
      [0, 'rgba(190,225,255,0.9)'],
      [0.35, 'rgba(140,190,255,0.35)'],
      [1, 'rgba(120,170,255,0)'],
    ]);
    this.radial('fog', 256, [
      [0, 'rgba(170,180,210,0.35)'],
      [0.6, 'rgba(140,150,190,0.12)'],
      [1, 'rgba(120,130,170,0)'],
    ]);
    this.radial('spark', 32, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,240,200,0.6)'],
      [1, 'rgba(255,230,180,0)'],
    ]);
    this.radial('moon', 256, [
      [0, 'rgba(200,215,255,0.22)'],
      [1, 'rgba(200,215,255,0)'],
    ]);
    this.makeGhost();
    this.makeVignette();
    this.makeLantern();
    makePaintTextures(this);
    this.scene.start('Title');
  }

  private radial(key: string, size: number, stops: [number, string][]) {
    const tex = this.textures.createCanvas(key, size, size)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  private makeGhost() {
    const w = 96;
    const h = 120;
    const tex = this.textures.createCanvas('ghost', w * GHOST_RES, h * GHOST_RES)!;
    const ctx = tex.getContext();
    ctx.scale(GHOST_RES, GHOST_RES);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(240,248,255,0.98)');
    grad.addColorStop(0.7, 'rgba(200,225,255,0.85)');
    grad.addColorStop(1, 'rgba(170,200,255,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.bezierCurveTo(10, 8, 86, 8, 86, 50);
    ctx.lineTo(86, 96);
    // wavy tail
    const waves = 4;
    for (let i = 0; i < waves; i++) {
      const x0 = 86 - (i * 76) / waves;
      const x1 = 86 - ((i + 1) * 76) / waves;
      const mid = (x0 + x1) / 2;
      ctx.quadraticCurveTo(mid, i % 2 === 0 ? 120 : 92, x1, 104);
    }
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.ellipse(36, 46, 6, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(62, 46, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // little worried mouth
    ctx.strokeStyle = '#0b1020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(49, 70, 6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    tex.refresh();
  }

  /** Darkness with a soft hole in the middle: the ghost's own light, carried through the house. */
  private makeLantern() {
    const n = 512;
    const tex = this.textures.createCanvas('lantern', n, n)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.1, 'rgba(0,0,0,0.05)');
    g.addColorStop(0.24, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.42, 'rgba(0,0,0,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    tex.refresh();
  }

  private makeVignette() {
    const tex = this.textures.createCanvas('vignette', W, H)!;
    const ctx = tex.getContext();
    // an oval of light, the edges sinking into black
    ctx.save();
    ctx.translate(W / 2, H * 0.45);
    ctx.scale(1, 0.62);
    const g = ctx.createRadialGradient(0, 0, W * 0.2, 0, 0, W * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.85, 'rgba(0,0,0,0.92)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(-W, -W, W * 2, W * 2);
    ctx.restore();
    tex.refresh();
  }
}
