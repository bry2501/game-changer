import Phaser from 'phaser';
import { H, W, txt } from '../ui/widgets';
import {
  FLOOR_Y,
  SIL,
  drawBody,
  drawBookshelf,
  drawCabinet,
  drawChandelier,
  drawDesk,
  drawGrandfatherClock,
  drawPlant,
  drawPortrait,
  drawWindow,
} from '../ui/art';
import { BODY_X, CLUES, PRIOR_SHEET, ROOMS, ROOM_WIDTH } from '../data/case1';
import { GameState } from '../state/GameState';
import { TouchControls } from '../ui/TouchControls';

const WORLD_W = ROOM_WIDTH * ROOMS.length;
const GHOST_BASE_Y = 400;
const SPEED = 330;
const REACH = 120;

interface Spot {
  key: string;
  x: number;
  y: number;
  label: string;
}

export class WorldScene extends Phaser.Scene {
  private ghost!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private controls!: TouchControls;
  private spots = new Map<string, Spot>();
  private marker!: Phaser.GameObjects.Container;
  private markerLabel!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private thought!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private room = -1;
  private t = 0;

  constructor() {
    super('World');
  }

  create() {
    this.room = -1;
    this.cameras.main.setBackgroundColor('#05060a');
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.buildRooms();
    this.buildSpots();

    this.glow = this.add.image(0, 0, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
    this.ghost = this.add.image(GameState.data.ghostX, GHOST_BASE_Y, 'ghost').setDepth(51).setScale(0.85);
    this.add.particles(0, 0, 'spark', {
      follow: this.ghost,
      followOffset: { x: 0, y: 40 },
      speedY: { min: 10, max: 40 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 900,
      frequency: 90,
      blendMode: 'ADD',
    }).setDepth(49);

    // fog drifting across the screen (screen-space keeps the particle count low for phones)
    this.add.particles(0, 0, 'fog', {
      x: { min: -100, max: W + 100 },
      y: { min: FLOOR_Y - 100, max: H },
      speedX: { min: -20, max: 20 },
      scale: { min: 1.5, max: 2.5 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 8000,
      frequency: 400,
    }).setDepth(60).setScrollFactor(0);

    this.buildForeground();

    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDepth(900);

    this.cameras.main.startFollow(this.ghost, true, 0.08, 0.08, 0, 60);

    // HUD
    this.roomLabel = txt(this, 30, 24, '', 26, '#dfe6ff', { fontStyle: 'italic' }).setScrollFactor(0).setDepth(1000);
    this.counter = txt(this, 30, 60, '', 20, '#8f9ab8').setScrollFactor(0).setDepth(1000);
    this.thought = txt(this, W / 2, 130, '', 24, '#cfe6ff', {
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: 900 },
      backgroundColor: '#05070dcc',
      padding: { x: 18, y: 10 },
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0);
    this.arrow = txt(this, 0, GHOST_BASE_Y, '', 44, '#ffe2a0').setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({ targets: this.arrow, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    this.controls = new TouchControls(this, () => this.inspect(), () => this.openBoard());

    this.refreshTarget();
    this.events.on('resume', () => this.onResume());
    this.cameras.main.fadeIn(700);

    const firstThought =
      GameState.data.found < 0
        ? 'Graves keeps a household log... it should be on the side table.'
        : this.currentThought();
    this.time.delayedCall(800, () => this.think(firstThought));
  }

  update(_time: number, delta: number) {
    this.t += delta / 1000;
    const dir = this.controls.dir;
    if (dir !== 0) {
      this.ghost.x = Phaser.Math.Clamp(this.ghost.x + dir * SPEED * (delta / 1000), 60, WORLD_W - 60);
      this.ghost.setFlipX(dir < 0);
    }
    this.ghost.y = GHOST_BASE_Y + Math.sin(this.t * 2.2) * 12;
    this.ghost.setAngle(dir * 6 + Math.sin(this.t * 1.3) * 2);
    this.glow.setPosition(this.ghost.x, this.ghost.y + 8);
    this.glow.setAlpha(0.75 + Math.sin(this.t * 3) * 0.15);

    const r = Math.floor(this.ghost.x / ROOM_WIDTH);
    if (r !== this.room) {
      this.room = r;
      this.roomLabel.setText(ROOMS[r].name).setAlpha(0);
      this.tweens.add({ targets: this.roomLabel, alpha: 1, duration: 600 });
      GameState.data.ghostX = this.ghost.x;
      GameState.save();
    }

    // target proximity + direction arrow
    const spot = this.currentSpot();
    const near = Math.abs(spot.x - this.ghost.x) < REACH;
    this.controls.setInspectActive(near);
    this.markerLabel.setVisible(near);
    const cam = this.cameras.main;
    const sx = spot.x - cam.scrollX;
    if (sx < 0) this.arrow.setText('◀').setX(40).setVisible(true);
    else if (sx > W) this.arrow.setText('▶').setX(W - 40).setVisible(true);
    else this.arrow.setVisible(false);
  }

  // ---------------------------------------------------------------- targets

  private currentKey(): string {
    const t = GameState.nextTarget;
    if (t === 'prior') return 'prior';
    if (t === 'accuse') return 'accuse';
    return CLUES[t].id;
  }

  private currentSpot(): Spot {
    return this.spots.get(this.currentKey())!;
  }

  private currentThought(): string {
    const f = GameState.data.found;
    if (f < 0) return '';
    if (f === 0) return PRIOR_SHEET.nextThought;
    return CLUES[f - 1].nextThought;
  }

  private refreshTarget() {
    const s = this.currentSpot();
    this.marker.setPosition(s.x, s.y);
    this.markerLabel.setText(s.label);
    this.counter.setText(
      GameState.priorSet ? `Evidence: ${GameState.data.found} / ${CLUES.length}` : 'Evidence: 0 / ' + CLUES.length,
    );
  }

  private inspect() {
    const s = this.currentSpot();
    if (Math.abs(s.x - this.ghost.x) >= REACH) {
      this.think('Nothing here... the glow is somewhere else.');
      return;
    }
    this.controls.reset();
    const key = this.currentKey();
    if (key === 'accuse') {
      this.cameras.main.fade(500, 0, 0, 0, true);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Accuse'));
      return;
    }
    this.scene.pause();
    this.scene.launch('Evidence', { kind: key === 'prior' ? 'prior' : 'clue' });
  }

  private openBoard() {
    if (!GameState.priorSet) {
      this.think('I have nothing to weigh yet. First I should find the household log.');
      return;
    }
    this.controls.reset();
    this.scene.pause();
    this.scene.launch('Board');
  }

  private onResume() {
    this.controls.reset();
    this.refreshTarget();
    this.think(this.currentThought());
  }

  private think(s: string) {
    if (!s) return;
    this.tweens.killTweensOf(this.thought);
    this.thought.setText(s).setAlpha(0);
    this.tweens.add({ targets: this.thought, alpha: 1, duration: 500, hold: 3800, yoyo: true });
  }

  // ---------------------------------------------------------------- world building

  private buildSpots() {
    const deskY = FLOOR_Y - 140;
    const positions: Record<string, { y: number; label: string }> = {
      prior: { y: FLOOR_Y - 110, label: 'Household log' },
      teacup: { y: deskY, label: 'Teacup' },
      letter: { y: FLOOR_Y - 20, label: 'Crumpled letter' },
      boot: { y: FLOOR_Y - 10, label: 'Boot print' },
      greenhouse: { y: FLOOR_Y - 100, label: 'Greenhouse log' },
      ledger: { y: deskY, label: 'Ledger' },
      phone: { y: deskY, label: 'Telephone log' },
      cufflink: { y: FLOOR_Y - 14, label: 'Something shiny' },
      accuse: { y: FLOOR_Y - 60, label: 'Name the culprit' },
    };
    this.spots.set('prior', { key: 'prior', x: PRIOR_SHEET.x, ...positions.prior });
    CLUES.forEach((c) => this.spots.set(c.id, { key: c.id, x: c.x, ...positions[c.id] }));
    this.spots.set('accuse', { key: 'accuse', x: BODY_X, ...positions.accuse });

    // props for each spot
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(0xd9d2bc, 0.75);
    g.fillRect(PRIOR_SHEET.x - 22, FLOOR_Y - 116, 44, 10); // log book on side table
    g.fillStyle(0xd9d2bc, 0.9);
    g.fillEllipse(930, deskY + 12, 26, 12); // teacup
    g.lineStyle(3, 0xd9d2bc, 0.9);
    g.strokeCircle(945, deskY + 10, 5);
    g.fillStyle(0xe8e0c8, 0.85);
    g.fillTriangle(1885, FLOOR_Y - 8, 1915, FLOOR_Y - 12, 1900, FLOOR_Y - 26); // crumpled letter
    g.fillStyle(0x3a2a1a, 1);
    [0, 1].forEach((k) => g.fillEllipse(2980 + k * 46, FLOOR_Y - 6 - k * 3, 30, 12)); // boot prints
    g.fillStyle(0xd9d2bc, 0.75);
    g.fillRect(3480, FLOOR_Y - 104, 40, 8); // greenhouse log on bench
    g.fillRect(4280, deskY + 6, 44, 12); // ledger
    g.fillRect(4790, deskY + 6, 28, 10); // phone log
    g.fillStyle(0x0d0d0d, 1);
    g.fillRect(4825, deskY - 4, 22, 20); // telephone
    g.fillStyle(0xc8d0e0, 1);
    g.fillCircle(1110, FLOOR_Y - 8, 4); // cufflink

    // the active-target marker
    this.marker = this.add.container(0, 0).setDepth(40);
    const mg = this.add.image(0, 0, 'glow').setScale(1.1).setBlendMode(Phaser.BlendModes.ADD);
    const sp = this.add.image(0, 0, 'spark').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
    this.markerLabel = txt(this, 0, -70, '', 22, '#ffe9b8', {
      backgroundColor: '#05070dcc',
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5);
    this.marker.add([mg, sp, this.markerLabel]);
    this.tweens.add({ targets: [mg, sp], scale: '*=1.35', alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
  }

  private buildRooms() {
    // far layer (slow parallax): back walls
    const back = this.add.graphics().setScrollFactor(0.85).setDepth(0);
    ROOMS.forEach((r, i) => {
      const x0 = i * ROOM_WIDTH * 0.85 - 200;
      back.fillGradientStyle(r.wallTop, r.wallTop, r.wallBottom, r.wallBottom, 1);
      back.fillRect(x0, 0, ROOM_WIDTH * 0.85 + 400, H);
    });

    // main layer
    const g = this.add.graphics().setDepth(10);
    // floor
    g.fillStyle(SIL, 1);
    g.fillRect(0, FLOOR_Y, WORLD_W, H - FLOOR_Y);
    g.lineStyle(2, 0x1c2235, 1);
    g.lineBetween(0, FLOOR_Y, WORLD_W, FLOOR_Y);

    // door frames between rooms
    for (let i = 1; i < ROOMS.length; i++) {
      const x = i * ROOM_WIDTH;
      g.fillStyle(SIL, 1);
      g.fillRect(x - 60, 0, 30, FLOOR_Y);
      g.fillRect(x + 30, 0, 30, FLOOR_Y);
      g.fillRect(x - 60, 0, 120, 120);
    }

    // Study (room 0)
    drawWindow(g, 480, 120, 180, 240);
    drawBookshelf(g, 40, 160, 380);
    drawDesk(g, 820, 360);
    g.fillStyle(SIL, 1);
    g.fillRect(PRIOR_SHEET.x - 40, FLOOR_Y - 106, 80, 12); // side table
    g.fillRect(PRIOR_SHEET.x - 6, FLOOR_Y - 94, 12, 94);
    drawChandelier(g, 640);
    const body = this.add.graphics().setDepth(15);
    drawBody(body, BODY_X, FLOOR_Y - 4);

    // Hallway (room 1)
    const hx = ROOM_WIDTH;
    [hx + 250, hx + 560, hx + 870].forEach((x) => drawPortrait(g, x, 250));
    drawChandelier(g, hx + 640);
    g.fillStyle(SIL, 1);
    g.fillRect(hx + 1050, FLOOR_Y - 90, 140, 14); // console table
    g.fillRect(hx + 1060, FLOOR_Y - 76, 10, 76);
    g.fillRect(hx + 1170, FLOOR_Y - 76, 10, 76);
    // staircase
    for (let s = 0; s < 8; s++) g.fillRect(hx + 60 + s * 22, FLOOR_Y - (s + 1) * 26, 200 - s * 22, 26);

    // Conservatory (room 2)
    const cx = ROOM_WIDTH * 2;
    for (let i = 0; i < 4; i++) drawWindow(g, cx + 140 + i * 270, 70, 220, 320);
    drawPlant(g, cx + 220, 1.2);
    drawPlant(g, cx + 640, 0.9);
    drawPlant(g, cx + 1150, 1.3);
    g.fillStyle(SIL, 1);
    g.fillRect(cx + 860, FLOOR_Y - 90, 260, 14); // potting bench
    g.fillRect(cx + 870, FLOOR_Y - 76, 12, 76);
    g.fillRect(cx + 1100, FLOOR_Y - 76, 12, 76);

    // Office (room 3)
    const ox = ROOM_WIDTH * 3;
    drawCabinet(g, ox + 120);
    drawCabinet(g, ox + 220);
    drawDesk(g, ox + 380, 300);
    drawDesk(g, ox + 880, 300);
    drawWindow(g, ox + 660, 140, 160, 200);
    drawBookshelf(g, ox + 1150, 110, 300);

    // clocks everywhere: the house of a clockmaker
    drawGrandfatherClock(this, 760);
    drawGrandfatherClock(this, hx + 420);
    drawGrandfatherClock(this, ox + 1000);
  }

  private buildForeground() {
    // near layer (fast parallax): dark curtains and posts passing in front
    const fg = this.add.graphics().setScrollFactor(1.25).setDepth(80);
    fg.fillStyle(0x000000, 0.8);
    for (let x = 0; x < WORLD_W * 1.25 + W; x += 900) {
      fg.fillRect(x, 0, 70, H);
      fg.fillTriangle(x + 70, 0, x + 70, 260, x + 170, 0);
      fg.fillEllipse(x + 400, H + 10, 420, 120);
    }
  }
}
