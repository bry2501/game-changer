import Phaser from 'phaser';
import { Button, fadeThen, fitCamera, H, hex, txt, W } from '../ui/widgets';
import { MEMORY_INTRO, MEMORY_OUTRO, SUSPECTS } from '../data/case1';
import { Sound } from '../audio/Sound';

/** Draws a suspect as a silhouette bust with a coloured rim and a small identifying detail. */
export function drawSuspect(scene: Phaser.Scene, x: number, y: number, i: number, scale = 1) {
  const s = SUSPECTS[i];
  const c = scene.add.container(x, y).setScale(scale);
  const rim = scene.add.image(0, -10, 'glow').setScale(3.2).setTint(s.color).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
  const g = scene.add.graphics();
  g.fillStyle(0x020306, 1);
  g.fillRoundedRect(-95, 40, 190, 150, 60); // shoulders
  g.fillRect(-22, 10, 44, 45); // neck
  g.fillCircle(0, -30, 58); // head
  switch (s.id) {
    case 'butler': // neat parting and a bow tie
      g.fillTriangle(-26, 62, 0, 74, -26, 86);
      g.fillTriangle(26, 62, 0, 74, 26, 86);
      g.fillStyle(0x020306, 1);
      g.fillEllipse(-8, -82, 110, 30);
      break;
    case 'niece': // long hair
      g.fillEllipse(-52, 10, 48, 150);
      g.fillEllipse(52, 10, 48, 150);
      g.fillEllipse(0, -80, 130, 50);
      break;
    case 'partner': // top hat
      g.fillRect(-48, -170, 96, 90);
      g.fillRoundedRect(-80, -92, 160, 18, 8);
      break;
    case 'gardener': // flat cap
      g.fillEllipse(0, -78, 130, 46);
      g.fillRoundedRect(10, -78, 90, 16, 8);
      break;
  }
  c.add([rim, g]);
  return c;
}

type MemoryPage = { kind: 'intro' } | { kind: 'face'; i: number } | { kind: 'voices'; i: number } | { kind: 'outro' };

/**
 * Memories returning: an amber, softly blurred overlay, visually distinct from notes.
 * The ghost's opening thought, then each face (and, for some, the voices that come with it), then the resolve.
 */
export class MemoryScene extends Phaser.Scene {
  private page = 0;
  private pages: MemoryPage[] = [];
  private layer!: Phaser.GameObjects.Container;
  private busy = false;

  constructor() {
    super('Memory');
  }

  create() {
    fitCamera(this.cameras.main);
    this.page = 0;
    this.busy = false;
    this.pages = [{ kind: 'intro' }];
    SUSPECTS.forEach((s, i) => {
      this.pages.push({ kind: 'face', i });
      if (s.voices) this.pages.push({ kind: 'voices', i });
    });
    this.pages.push({ kind: 'outro' });
    Sound.setMood('memory');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a1d10, 0x2a1d10, 0x0b0805, 0x0b0805, 0.97);
    bg.fillRect(0, 0, W, H);
    this.add.image(W / 2, H / 2, 'vignette').setAlpha(0.9);
    this.add.particles(0, 0, 'fog', {
      x: { min: 0, max: W },
      y: { min: 0, max: H },
      speedX: { min: -10, max: 10 },
      speedY: { min: -6, max: 6 },
      scale: { min: 1.5, max: 3 },
      alpha: { start: 0.25, end: 0 },
      tint: 0xffd9a0,
      lifespan: 7000,
      frequency: 350,
    });
    txt(this, W / 2, 34, '— a memory returns —', 22, '#d9b98a', { fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.layer = this.add.container();
    new Button(this, W - 150, H - 56, 'Remember ▸', () => this.next(), {
      width: 230,
      height: 56,
      size: 22,
      fill: 0x2a1d10,
      stroke: 0xd9b98a,
    });
    let down = false;
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => (down = !over.length));
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (down && !over.length) this.next();
      down = false;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.show();
    this.cameras.main.fadeIn(900, 255, 230, 190);
  }

  private next() {
    if (this.busy) return;
    this.page++;
    Sound.blip();
    if (this.page >= this.pages.length) {
      this.busy = true;
      fadeThen(this, 700, () => {
        this.scene.stop();
        this.scene.resume('World', { from: 'memory' });
      });
      return;
    }
    this.busy = true;
    this.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.show();
        this.busy = false;
      },
    });
  }

  private show() {
    this.layer.removeAll(true);
    this.layer.setAlpha(0);
    const p = this.pages[this.page];
    if (p.kind === 'intro') {
      this.layer.add(
        txt(this, W / 2, H / 2 - 40, MEMORY_INTRO, 32, '#f3e2c4', {
          fontStyle: 'italic',
          align: 'center',
          wordWrap: { width: 900 },
        }).setOrigin(0.5),
      );
      SUSPECTS.forEach((_, i) => {
        const fig = drawSuspect(this, W / 2 + (i - (SUSPECTS.length - 1) / 2) * 190, H / 2 + 170, i, 0.55).setAlpha(0.35);
        this.layer.add(fig);
      });
    } else if (p.kind === 'face' || p.kind === 'voices') {
      const i = p.i;
      const s = SUSPECTS[i];
      this.layer.add(drawSuspect(this, 300, 400, i));
      this.layer.add(txt(this, 300, 612, `${s.name}, ${s.role}`, 19, '#8a7558', { fontStyle: 'italic' }).setOrigin(0.5, 0));
      let y = 92;
      const add = (t: Phaser.GameObjects.Text, gap: number) => {
        this.layer.add(t);
        y += t.height + gap;
      };
      const col = 560;
      const width = 660;
      if (p.kind === 'face') {
        // name, role, the remembered line and their story
        add(txt(this, col, y, s.name, 46, hex(s.color), { fontStyle: 'bold' }), 2);
        add(txt(this, col, y, s.role, 22, '#d9b98a', { fontStyle: 'italic' }), 18);
        add(txt(this, col, y, `\u201C${s.memory}\u201D`, 23, '#f3e2c4', { fontStyle: 'italic', wordWrap: { width }, lineSpacing: 5 }), 16);
        add(txt(this, col, y, s.backstory, 20, '#e2d2b4', { wordWrap: { width }, lineSpacing: 5 }), 16);
        if (!s.voices && s.tonight) this.tonight(col, y, width, s.tonight, add);
      } else {
        // the memory sharpens into voices, then what they did tonight
        y = 120;
        for (const [who, words] of s.voices!.lines) {
          const color = who === 'John' ? '#dcdcdc' : hex(s.color);
          add(txt(this, col, y, who, 18, color, { fontStyle: 'bold' }), 2);
          add(txt(this, col, y, `\u201C${words.replace(/\*/g, '')}\u201D`, 28, '#f3e2c4', { fontStyle: 'italic', wordWrap: { width } }), 20);
        }
        if (s.voices!.after) add(txt(this, col, y, s.voices!.after, 21, '#e2d2b4', { fontStyle: 'italic', wordWrap: { width } }), 26);
        else y += 6;
        if (s.tonight) this.tonight(col, y, width, s.tonight, add);
      }
    } else {
      // the memory ends: what it gave, and the resolve. "One of them did this" stands out.
      const lines = MEMORY_OUTRO.map((line) => {
        const key = line.startsWith('One of them did this');
        return txt(this, W / 2, 0, line, key ? 38 : 23, key ? '#f2f2f2' : '#f3e2c4', {
          fontStyle: key ? 'bold' : 'italic',
          align: 'center',
          wordWrap: { width: 1000 },
          lineSpacing: 4,
        }).setOrigin(0.5, 0);
      });
      const gap = 22;
      const total = lines.reduce((a, t) => a + t.height, 0) + gap * (lines.length - 1);
      let y = Math.max(80, (H - total) / 2 - 20);
      for (const t of lines) {
        t.setY(y);
        this.layer.add(t);
        y += t.height + gap;
      }
    }
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 600 });
  }

  private tonight(col: number, y: number, width: number, text: string, add: (t: Phaser.GameObjects.Text, gap: number) => void) {
    add(txt(this, col, y, 'Tonight', 16, '#c9a46a', { fontStyle: 'bold' }), 4);
    add(txt(this, col, y + 24, text, 20, '#ffd9a0', { wordWrap: { width }, lineSpacing: 5 }), 0);
  }
}
