import Phaser from 'phaser';
import { Button, H, W, hex, txt } from '../ui/widgets';
import { ENDING_CORRECT, ENDING_WRONG, EndLine, SUSPECTS } from '../data/case1';
import { FLOOR_Y, drawBody, drawDesk, drawGrandfatherClock, drawWainscot, drawWindow } from '../ui/art';
import { PAL, cobweb, paintRect } from '../ui/paint';
import { drawSuspect } from './MemoryScene';
import { Sound } from '../audio/Sound';

const BODY_AT = 520;
const DOOR_X = 1150;

/**
 * The ending, acted out in the study. Correct: the ghost reconstructs the night, the great
 * clock strikes eleven, and Clara comes in to say goodnight. Wrong: the night rewinds.
 * Stage directions are acted, not shown; spoken and thought lines appear in a box below.
 */
export class EndingScene extends Phaser.Scene {
  private lines: EndLine[] = [];
  private k = -1;
  private correct = false;
  private accused = 0;
  private busy = false;
  private ghost!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private amber!: Phaser.GameObjects.Rectangle;
  private caption!: Phaser.GameObjects.Text;
  private box!: Phaser.GameObjects.Container;
  private voss?: Phaser.GameObjects.Container;

  constructor() {
    super('Ending');
  }

  init(data: { accused: number; correct: boolean }) {
    this.accused = data.accused;
    this.correct = data.correct;
    this.k = -1;
    this.busy = false;
    this.voss = undefined;
    const name = SUSPECTS[data.accused].name;
    this.lines = (data.correct ? ENDING_CORRECT : ENDING_WRONG).map((l) => ({ ...l, text: l.text.replace('{name}', name) }));
  }

  create() {
    this.cameras.main.setBackgroundColor('#05060a');
    this.drawStudy();
    this.glow = this.add.image(BODY_AT + 120, 360, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
    this.ghost = this.add.image(BODY_AT + 120, 360, 'ghost').setScale(0.8).setDepth(41);
    this.tweens.add({ targets: [this.ghost, this.glow], y: '-=12', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.amber = this.add.rectangle(0, 0, W, H, 0x2a1d10, 0).setOrigin(0).setDepth(50);
    this.caption = txt(this, W / 2, 40, '', 22, '#d9b98a', { fontStyle: 'italic' }).setOrigin(0.5, 0).setDepth(80);
    this.box = this.add.container(0, 0).setDepth(90);
    this.add.image(W / 2, H / 2, 'vignette').setDepth(60);

    const next = new Button(this, W - 120, H - 48, 'Next ▸', () => this.advance(), { width: 180, height: 52, size: 20 });
    next.setDepth(100);
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-RIGHT', () => this.advance());
    Sound.setTicking(false);
    Sound.setMood(this.correct ? 'reveal' : 'emerge');
    this.cameras.main.fadeIn(800);
    this.time.delayedCall(700, () => this.advance());
  }

  /** The study, painted once: walls, window, clock, desk, the body on its rug, and the door. */
  private drawStudy() {
    this.add.tileSprite(0, 0, W, FLOOR_Y, 'paintWall').setOrigin(0).setTint(0x5a7aa6);
    this.add.tileSprite(0, FLOOR_Y, W, H - FLOOR_Y, 'floorboards').setOrigin(0).setTint(0xa9b4c8);
    const g = this.add.graphics();
    drawWainscot(g, 0, W);
    drawWindow(g, 70, 120, 180, 240);
    drawDesk(g, 760, 300);
    // the doorway to the hall, where the kitchen light will come from
    paintRect(g, DOOR_X - 80, FLOOR_Y - 300, 160, 300, 0x0b1120);
    paintRect(g, DOOR_X - 96, FLOOR_Y - 316, 16, 316, PAL.woodDark);
    paintRect(g, DOOR_X + 80, FLOOR_Y - 316, 16, 316, PAL.woodDark);
    paintRect(g, DOOR_X - 96, FLOOR_Y - 320, 192, 18, PAL.woodDark);
    drawGrandfatherClock(this, 360);
    const body = this.add.graphics();
    drawBody(body, BODY_AT, FLOOR_Y - 4);
    cobweb(this, 0, 40, 1.1);
    cobweb(this, W, 40, 0.9, true);
  }

  private advance() {
    if (this.busy) return;
    this.k++;
    if (this.k >= this.lines.length) return this.finish();
    const l = this.lines[this.k];
    Sound.blip();
    if (l.who === 'direction') {
      // directions are acted out, then the story moves on by itself
      this.busy = true;
      this.showLine();
      const ms = this.beat(l.beat);
      this.time.delayedCall(ms, () => {
        this.busy = false;
        this.advance();
      });
      return;
    }
    this.showLine(l);
  }

  /** The speaking box: the ghost's thoughts in blue, imagined scenes in amber, Clara's words in her colour. */
  private showLine(l?: EndLine) {
    this.box.removeAll(true);
    if (!l) return;
    const x0 = 120;
    const w = W - 240 - 120;
    const who = l.who === 'clara' ? 'Clara' : l.who === 'imagining' ? 'John, imagining' : 'John';
    const color = l.who === 'clara' ? hex(SUSPECTS[0].color) : l.who === 'imagining' ? '#d9b98a' : '#9fd8ff';
    const t = txt(this, x0 + 26, 0, l.text.replace(/\*/g, ''), 22, l.who === 'imagining' ? '#f3e2c4' : '#eef3ff', {
      fontStyle: l.who === 'clara' ? 'normal' : 'italic',
      wordWrap: { width: w - 52 },
      lineSpacing: 5,
    });
    const h = t.height + 56;
    const y = H - 24 - h;
    t.setY(y + 40);
    const bg = this.add.graphics();
    bg.fillStyle(l.who === 'imagining' ? 0x2a1d10 : 0x0b1222, 0.93);
    bg.lineStyle(2, l.who === 'imagining' ? 0xd9b98a : l.who === 'clara' ? SUSPECTS[0].color : 0x9fd8ff, 0.6);
    bg.fillRoundedRect(x0, y, w, h, 16);
    bg.strokeRoundedRect(x0, y, w, h, 16);
    this.box.add([bg, txt(this, x0 + 26, y + 12, who, 17, color, { fontStyle: 'bold' }), t]);
    this.box.setAlpha(0);
    this.tweens.add({ targets: this.box, alpha: 1, duration: 300 });
  }

  /** Act out a stage direction. Returns how long it takes. */
  private beat(b: EndLine['beat']): number {
    const cam = this.cameras.main;
    switch (b) {
      case 'strike':
        Sound.toll();
        cam.shake(300, 0.002);
        return 1600;
      case 'reconstruct':
        this.tweens.add({ targets: this.amber, fillAlpha: 0.72, duration: 1400 });
        this.caption.setText('— not a memory: what the evidence leaves standing —').setAlpha(0);
        this.tweens.add({ targets: this.caption, alpha: 1, duration: 900 });
        this.voss = drawSuspect(this, W / 2, 300, 1, 0.9).setAlpha(0).setDepth(55);
        this.tweens.add({ targets: this.voss, alpha: 0.35, duration: 1800 });
        return 1800;
      case 'eleven': {
        this.tweens.add({ targets: [this.amber], fillAlpha: 0, duration: 1200 });
        this.tweens.add({ targets: [this.caption, this.voss].filter(Boolean), alpha: 0, duration: 1000 });
        for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 900, () => Sound.toll());
        this.caption.setText('Eleven.');
        this.time.delayedCall(1100, () => {
          this.caption.setAlpha(0).setColor('#ffe9b8');
          this.tweens.add({ targets: this.caption, alpha: 1, duration: 600 });
        });
        // light spills down the passage from the kitchen
        const light = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(20).setAlpha(0);
        light.fillStyle(0xffd9a0, 0.35);
        light.fillRect(DOOR_X - 80, FLOOR_Y - 300, 160, 300);
        light.fillStyle(0xffd9a0, 0.16);
        light.fillTriangle(DOOR_X - 80, FLOOR_Y, DOOR_X + 80, FLOOR_Y, DOOR_X - 340, H);
        light.fillTriangle(DOOR_X + 80, FLOOR_Y, DOOR_X - 340, H, DOOR_X + 60, H);
        this.tweens.add({ targets: light, alpha: 1, duration: 1800, delay: 1800 });
        this.time.delayedCall(2800, () => Sound.open());
        return 4200;
      }
      case 'clara-enters': {
        this.tweens.add({ targets: this.caption, alpha: 0, duration: 600 });
        const c = this.drawClara().setPosition(DOOR_X + 40, FLOOR_Y).setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, duration: 500 });
        this.tweens.add({ targets: c, x: BODY_AT + 250, duration: 2200, ease: 'Sine.easeInOut', delay: 300 });
        // she stops; the parcel falls and does not break; she kneels
        const parcel = this.add.rectangle(BODY_AT + 222, FLOOR_Y - 150, 34, 24, 0x9a7a4a).setStrokeStyle(2, 0x5a4024).setDepth(31).setAlpha(0);
        this.time.delayedCall(2600, () => {
          parcel.setAlpha(1);
          this.tweens.add({ targets: parcel, y: FLOOR_Y - 12, angle: 14, duration: 500, ease: 'Bounce.easeOut' });
          Sound.empty();
        });
        this.time.delayedCall(3300, () => this.tweens.add({ targets: c, scaleY: 0.72, x: BODY_AT + 200, duration: 900, ease: 'Sine.easeInOut' }));
        return 4400;
      }
      case 'silence':
        Sound.setMood('silent');
        this.tweens.add({ targets: [this.ghost, this.glow], y: '-=160', alpha: 0.5, duration: 2600, ease: 'Sine.easeIn' });
        return 2600;
      case 'rewind': {
        Sound.whoosh();
        this.time.delayedCall(500, () => Sound.whoosh());
        this.time.delayedCall(1000, () => Sound.whoosh());
        this.tweens.add({ targets: cam, rotation: -Math.PI * 2, duration: 2200, ease: 'Cubic.easeInOut' });
        cam.flash(2200, 200, 210, 255);
        this.caption.setText('Ten o’clock.').setAlpha(0);
        this.time.delayedCall(2000, () => {
          cam.setRotation(0);
          Sound.toll();
          this.tweens.add({ targets: this.caption, alpha: 1, duration: 600 });
        });
        return 3200;
      }
      default:
        return 900;
    }
  }

  /** Clara, full figure: grey cardigan, dark skirt, a small parcel in her hand. */
  private drawClara() {
    const c = this.add.container(0, 0).setDepth(30);
    const g = this.add.graphics();
    const s = 1;
    g.fillStyle(0x2b1d18, 1);
    g.fillEllipse(0, -232 * s, 60, 74); // hair
    g.fillStyle(0xb7a99c, 1);
    g.fillCircle(0, -236 * s, 24); // face
    g.fillStyle(0x2b1d18, 1);
    g.fillEllipse(0, -256 * s, 56, 26);
    g.fillRect(-26, -244 * s, 10, 60);
    g.fillRect(16, -244 * s, 10, 60);
    paintRect(g, -32, -206 * s, 64, 96, 0x7d8496, { radius: 12 }); // cardigan
    g.fillStyle(PAL.plumWood, 1);
    g.fillTriangle(-34, -112 * s, 34, -112 * s, 44, -24 * s); // skirt
    g.fillTriangle(-34, -112 * s, -44, -24 * s, 44, -24 * s);
    g.fillStyle(0x1a2640, 1);
    g.fillRect(-18, -24 * s, 10, 24);
    g.fillRect(8, -24 * s, 10, 24);
    g.lineStyle(2, PAL.edge, 0.4);
    g.strokeCircle(0, -236 * s, 24);
    c.add(g);
    c.add(this.add.image(0, -150, 'glow').setScale(1.4).setTint(SUSPECTS[0].color).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD));
    return c;
  }

  private finish() {
    this.busy = true;
    this.cameras.main.fadeOut(1200);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Accuse', { results: true, accused: this.accused }));
    // fallback in case the fade event is missed
    this.time.delayedCall(1600, () => {
      if (this.scene.isActive()) this.scene.start('Accuse', { results: true, accused: this.accused });
    });
  }
}
