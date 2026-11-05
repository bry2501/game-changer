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
import {
  AFTER_MEMORY_THOUGHTS,
  AWAKEN_LINES,
  BODY_X,
  CLUES,
  DRIFT_HINT,
  BODY_LINES,
  PRIOR_SHEET,
  ROOMS,
  ROOM_THOUGHTS,
  ROOM_WIDTH,
} from '../data/case1';
import { GameState } from '../state/GameState';
import { TouchControls } from '../ui/TouchControls';
import { ThoughtBubble } from '../ui/ThoughtBubble';

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
  private bubble!: ThoughtBubble;
  private spots = new Map<string, Spot>();
  private marker!: Phaser.GameObjects.Container;
  private markerLabel!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private room = -1;
  private seenRooms = new Set<number>();
  /** A story moment is playing: movement is locked and taps advance the lines. */
  private cutscene = false;
  private t = 0;
  private vx = 0;

  constructor() {
    super('World');
  }

  create() {
    this.room = -1;
    this.seenRooms = new Set([0]);
    this.cutscene = false;
    this.vx = 0;
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

    // HUD (kept minimal; hidden while the ghost does not yet know where it is)
    this.roomLabel = txt(this, 30, 24, '', 26, '#dfe6ff', { fontStyle: 'italic' }).setScrollFactor(0).setDepth(1000);
    this.counter = txt(this, 30, 60, '', 20, '#8f9ab8').setScrollFactor(0).setDepth(1000);

    this.bubble = new ThoughtBubble(this, this.ghost);
    this.controls = new TouchControls(
      this,
      (x, y) => this.isOnActiveSpot(x, y),
      () => this.inspect(),
      () => this.openBoard(),
    );
    // During story moments a tap moves the inner monologue along.
    this.input.on('pointerdown', () => {
      if (this.cutscene) this.bubble.advance();
    });

    this.events.on('resume', (_s: unknown, data?: { from?: string }) => this.onResume(data?.from));
    this.refreshTarget();

    if (GameState.awakening) this.awaken();
    else {
      this.cameras.main.fadeIn(700);
      this.time.delayedCall(800, () => this.bubble.say([this.currentThought()]));
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.t += dt;
    this.controls.update();

    // movement: keyboard direction, or drift toward the touched / tapped point
    let want = this.controls.keyDir;
    const tx = this.controls.targetX;
    if (want === 0 && tx !== null && !this.cutscene) {
      const dx = tx - this.ghost.x;
      if (Math.abs(dx) < 10) this.controls.targetX = null;
      else want = Math.sign(dx) * Math.min(1, Math.abs(dx) / 80);
    }
    if (this.cutscene) want = 0;
    this.vx = Phaser.Math.Linear(this.vx, want * SPEED, Math.min(1, dt * 8));
    if (Math.abs(this.vx) > 1) {
      this.ghost.x = Phaser.Math.Clamp(this.ghost.x + this.vx * dt, 60, WORLD_W - 60);
      this.ghost.setFlipX(this.vx < 0);
    }
    this.ghost.y = GHOST_BASE_Y + Math.sin(this.t * 2.2) * 12;
    this.ghost.setAngle((this.vx / SPEED) * 6 + Math.sin(this.t * 1.3) * 2);
    this.glow.setPosition(this.ghost.x, this.ghost.y + 8);
    this.glow.setAlpha((0.75 + Math.sin(this.t * 3) * 0.15) * this.ghost.alpha);
    this.bubble.update();

    const r = Math.floor(this.ghost.x / ROOM_WIDTH);
    if (r !== this.room) this.enterRoom(r);

    // proximity to the glowing spot
    const spot = this.currentSpot();
    const dist = Math.abs(spot.x - this.ghost.x);
    this.markerLabel.setVisible(this.marker.visible && dist < REACH);
    if (this.cutscene || !this.marker.visible) return;
    if (this.currentKey() === 'body' && dist < REACH) {
      this.discoverBody();
    } else if (this.controls.pendingInspect && dist < REACH * 0.7) {
      this.controls.reset();
      this.inspect();
    }
  }

  // ---------------------------------------------------------------- story

  /** Thrown into ghostly existence: no memory, only the ticking of clocks. */
  private awaken() {
    this.cutscene = true;
    this.controls.enabled = false;
    this.controls.showBoard(false);
    this.marker.setVisible(false);
    this.roomLabel.setAlpha(0);
    this.counter.setAlpha(0);
    this.ghost.setAlpha(0).setScale(0.3);
    this.cameras.main.fadeIn(2600);
    this.tweens.add({ targets: this.ghost, alpha: 1, scale: 0.85, duration: 2600, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.ghost, alpha: 0.55, duration: 140, yoyo: true, repeat: 3, delay: 2700 });
    this.time.delayedCall(2200, () =>
      this.bubble.say(AWAKEN_LINES, () => {
        this.cutscene = false;
        this.controls.enabled = true;
        this.marker.setVisible(true);
        this.bubble.say([DRIFT_HINT]);
      }),
    );
  }

  /** The ghost drifts over the figure on the rug... and recognises it. */
  private discoverBody() {
    this.cutscene = true;
    this.controls.enabled = false;
    this.controls.reset();
    this.marker.setVisible(false);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(BODY_X + 120, H / 2 - 20, 1400, 'Sine.easeInOut');
    cam.zoomTo(1.3, 1400, 'Sine.easeInOut');
    this.tweens.add({ targets: this.ghost, x: BODY_X + 140, duration: 1400, ease: 'Sine.easeInOut' });
    this.time.delayedCall(1200, () =>
      this.bubble.say(BODY_LINES, () => {
        cam.flash(900, 255, 225, 180);
        this.time.delayedCall(500, () => {
          cam.zoomTo(1, 10);
          cam.startFollow(this.ghost, true, 0.08, 0.08, 0, 60);
          this.scene.pause();
          this.scene.launch('Memory');
        });
      }),
    );
  }

  /** Called when an overlay closes. */
  private onResume(from?: string) {
    this.controls.reset();
    if (from === 'memory') {
      GameState.rememberSuspects();
      this.cameras.main.fadeIn(800);
      this.marker.setVisible(true);
      this.controls.showBoard(false);
      this.roomLabel.setText(ROOMS[Math.max(0, this.room)].name);
      this.tweens.add({ targets: [this.roomLabel, this.counter], alpha: 1, duration: 800 });
      this.refreshTarget();
      this.cutscene = true;
      this.bubble.say(AFTER_MEMORY_THOUGHTS, () => this.endCutscene());
      return;
    }
    this.refreshTarget();
    if (from === 'evidence') {
      const f = GameState.data.found;
      const src = f === 0 ? PRIOR_SHEET : CLUES[f - 1];
      this.bubble.say([...src.reaction, src.nextThought]);
    }
  }

  private endCutscene() {
    this.cutscene = false;
    this.controls.enabled = true;
  }

  private enterRoom(r: number) {
    this.room = r;
    GameState.data.ghostX = this.ghost.x;
    GameState.save();
    if (GameState.awakening) return;
    this.roomLabel.setText(ROOMS[r].name).setAlpha(0);
    this.tweens.add({ targets: this.roomLabel, alpha: 1, duration: 600 });
    if (!this.seenRooms.has(r)) {
      this.seenRooms.add(r);
      if (!this.bubble.busy && !this.cutscene) this.bubble.say([ROOM_THOUGHTS[r]]);
    }
  }

  // ---------------------------------------------------------------- targets

  private currentKey(): string {
    const t = GameState.nextTarget;
    if (typeof t === 'number') return CLUES[t].id;
    return t;
  }

  private currentSpot(): Spot {
    return this.spots.get(this.currentKey())!;
  }

  private isOnActiveSpot(x: number, y: number): boolean {
    const s = this.currentSpot();
    return this.marker.visible && Math.abs(x - s.x) < 90 && Math.abs(y - s.y) < 130;
  }

  private currentThought(): string {
    const f = GameState.data.found;
    if (f === -1) return AFTER_MEMORY_THOUGHTS[AFTER_MEMORY_THOUGHTS.length - 1];
    if (f < 0) return '';
    if (f === 0) return PRIOR_SHEET.nextThought;
    return CLUES[f - 1].nextThought;
  }

  private refreshTarget() {
    const s = this.currentSpot();
    this.marker.setPosition(s.x, s.y);
    this.markerLabel.setText(s.label);
    this.counter.setText(`Evidence: ${Math.max(0, GameState.data.found)} / ${CLUES.length}`);
    this.controls.showBoard(GameState.priorSet);
  }

  private inspect() {
    if (this.cutscene || !this.marker.visible) return;
    const s = this.currentSpot();
    if (Math.abs(s.x - this.ghost.x) >= REACH) {
      // too far: drift over and examine on arrival
      this.controls.targetX = s.x;
      this.controls.pendingInspect = true;
      return;
    }
    const key = this.currentKey();
    if (key === 'body') return this.discoverBody();
    this.controls.reset();
    this.bubble.clear();
    if (key === 'accuse') {
      this.cameras.main.fade(500, 0, 0, 0, true);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Accuse'));
      return;
    }
    this.scene.pause();
    this.scene.launch('Evidence', { kind: key === 'prior' ? 'prior' : 'clue' });
  }

  private openBoard() {
    if (!GameState.priorSet || this.cutscene) return;
    this.controls.reset();
    this.scene.pause();
    this.scene.launch('Board');
  }

  // ---------------------------------------------------------------- world building

  private buildSpots() {
    const deskY = FLOOR_Y - 140;
    const positions: Record<string, { y: number; label: string }> = {
      body: { y: FLOOR_Y - 40, label: 'A figure on the rug' },
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
    this.spots.set('body', { key: 'body', x: BODY_X, ...positions.body });
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
