import Phaser from 'phaser';
import { H, W, soundToggle, txt } from '../ui/widgets';
import {
  SIL,
  drawBody,
  drawBookshelf,
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
  BODY_LINES,
  CLOCK_AFTER,
  CLOCK_LINES,
  CLUES,
  DRIFT_HINT,
  PRIOR_SHEET,
  WINDOW_LINES,
} from '../data/case1';
import {
  BODY_X,
  CLOCK_X,
  FLOOR_H,
  LOCAL_FLOOR_Y,
  LOCAL_GHOST_Y,
  ROOMS,
  SEARCHABLES,
  STAIRS_X,
  Searchable,
  WINDOW_X,
  floorBounds,
  floorTop,
  roomAt,
} from '../data/house';
import { GameState } from '../state/GameState';
import { TouchControls } from '../ui/TouchControls';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { Sound } from '../audio/Sound';

const WORLD_W = Math.max(...ROOMS.map((r) => r.x1));
const WORLD_H = FLOOR_H * 2;
const SPEED = 340;
const REACH = 110;
const F = LOCAL_FLOOR_Y; // local y of the floorboards (same as the art helpers' FLOOR_Y)

/** Runtime handle for a searchable piece of furniture. */
interface Prop {
  def: Searchable;
  /** World y of the point to shimmer / label. */
  hotY: number;
  spark?: Phaser.GameObjects.Image;
  open: (instant?: boolean) => void;
  opened: boolean;
}

export class WorldScene extends Phaser.Scene {
  private ghost!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private controls!: TouchControls;
  private bubble!: ThoughtBubble;
  private props = new Map<string, Prop>();
  private bodyMarker!: Phaser.GameObjects.Container;
  private label!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private roomId = '';
  private seenRooms = new Set<string>();
  private floor = 0;
  private baseY = 0;
  /** A story moment or thought sequence: movement locked, taps advance the thoughts. */
  private cutscene = false;
  /** During the awakening, the body only draws the ghost in after the opening beats. */
  private bodyVisible = false;
  private tapTarget?: string;
  private roomGfx: { g: Phaser.GameObjects.Graphics; floor: number; x0: number; x1: number }[] = [];
  private t = 0;
  private vx = 0;

  constructor() {
    super('World');
  }

  // ================================================================== setup

  create() {
    this.props = new Map();
    this.roomGfx = [];
    this.seenRooms = new Set(['study']);
    this.cutscene = false;
    this.vx = 0;
    this.roomId = '';
    this.tapTarget = undefined;
    this.floor = GameState.data.floor ?? 0;
    this.baseY = floorTop(this.floor) + LOCAL_GHOST_Y;
    this.bodyVisible = !GameState.awakening;

    const cam = this.cameras.main;
    cam.setBackgroundColor('#05060a');
    cam.setBounds(0, 0, WORLD_W, WORLD_H);

    this.buildFloor(0);
    this.buildFloor(1);
    this.buildProps();

    this.glow = this.add.image(0, 0, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
    this.ghost = this.add.image(GameState.data.ghostX, this.baseY, 'ghost').setDepth(51).setScale(0.85);
    this.add
      .particles(0, 0, 'spark', {
        follow: this.ghost,
        followOffset: { x: 0, y: 40 },
        speedY: { min: 10, max: 40 },
        speedX: { min: -15, max: 15 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 900,
        frequency: 90,
        blendMode: 'ADD',
      })
      .setDepth(49);
    this.add
      .particles(0, 0, 'fog', {
        x: { min: -100, max: W + 100 },
        y: { min: F - 100, max: H },
        speedX: { min: -20, max: 20 },
        scale: { min: 1.5, max: 2.5 },
        alpha: { start: 0.4, end: 0 },
        lifespan: 8000,
        frequency: 400,
      })
      .setDepth(60)
      .setScrollFactor(0);
    this.buildForeground();
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDepth(900);

    // follow horizontally only; changing floors is a deliberate camera move
    cam.startFollow(this.ghost, true, 0.08, 0);
    cam.setScroll(Phaser.Math.Clamp(this.ghost.x - W / 2, 0, WORLD_W - W), floorTop(this.floor));

    // HUD
    this.roomLabel = txt(this, 30, 24, '', 26, '#dfe6ff', { fontStyle: 'italic' }).setScrollFactor(0).setDepth(1000);
    this.counter = txt(this, 30, 60, '', 20, '#8f9ab8').setScrollFactor(0).setDepth(1000);
    this.label = txt(this, 0, 0, '', 21, '#ffe9b8', { backgroundColor: '#05070dcc', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setDepth(940)
      .setVisible(false);
    soundToggle(this, W - 222, 52);

    this.bubble = new ThoughtBubble(this, this.ghost);
    this.controls = new TouchControls(
      this,
      (x, y) => this.pickAt(x, y),
      () => this.interactNearest(),
      () => this.openBoard(),
    );
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.cutscene && !over.length) this.bubble.next();
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.bubble.sequence && !e.repeat) {
        if (['ArrowRight', 'KeyD', 'Space', 'Enter', 'KeyE'].includes(e.code)) this.bubble.next();
        else if (['ArrowLeft', 'KeyA'].includes(e.code)) this.bubble.back();
        return;
      }
      if (this.cutscene || e.repeat) return;
      const near = this.nearest();
      if (near?.def.kind === 'stairs') {
        if ((e.code === 'ArrowUp' || e.code === 'KeyW') && this.floor === 0) this.climb();
        if ((e.code === 'ArrowDown' || e.code === 'KeyS') && this.floor === 1) this.climb();
      }
    });

    this.events.on('resume', (_s: unknown, data?: { from?: string }) => this.onResume(data?.from));
    this.refreshHud();
    Sound.setTicking(true);

    if (GameState.awakening) this.awaken();
    else {
      Sound.setMood('explore');
      cam.fadeIn(700);
      this.time.delayedCall(800, () => this.bubble.say([this.currentThought()]));
    }
  }

  // ================================================================== frame

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.t += dt;
    this.controls.update();

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
      const b = floorBounds(this.floor);
      this.ghost.x = Phaser.Math.Clamp(this.ghost.x + this.vx * dt, b.min, b.max);
      this.ghost.setFlipX(this.vx < 0);
    }
    this.ghost.y = this.baseY + Math.sin(this.t * 2.2) * 12;
    this.ghost.setAngle((this.vx / SPEED) * 6 + Math.sin(this.t * 1.3) * 2);
    this.glow.setPosition(this.ghost.x, this.ghost.y + 8);
    this.glow.setAlpha((0.75 + Math.sin(this.t * 3) * 0.15) * this.ghost.alpha);
    this.bubble.update();
    this.cullRooms();

    const room = roomAt(this.floor, this.ghost.x);
    if (room.id !== this.roomId) this.enterRoom(room.id);

    const near = this.cutscene ? undefined : this.nearest();
    if (near) this.label.setText(this.labelFor(near)).setPosition(near.def.x, near.hotY - 46).setVisible(true);
    else this.label.setVisible(false);

    if (this.cutscene) return;
    if (GameState.awakening && this.bodyVisible && this.floor === 0 && Math.abs(this.ghost.x - BODY_X) < REACH) {
      this.discoverBody();
      return;
    }
    // arrived at something that was tapped
    if (this.controls.pendingInspect && this.tapTarget) {
      const x = this.tapTarget === 'body' ? BODY_X : this.props.get(this.tapTarget)?.def.x;
      if (x !== undefined && Math.abs(x - this.ghost.x) < REACH * 0.6) {
        const id = this.tapTarget;
        this.controls.reset();
        this.tapTarget = undefined;
        this.interact(id);
      }
    }
  }

  // ================================================================== story beats

  /** Thrown into ghostly existence: no memory, only the ticking of clocks. */
  private awaken() {
    this.lock();
    this.controls.showBoard(false);
    this.bodyMarker.setVisible(false);
    this.roomLabel.setAlpha(0);
    this.counter.setAlpha(0);
    this.ghost.setAlpha(0).setScale(0.3);
    Sound.setMood('emerge');
    this.cameras.main.fadeIn(4500);
    this.tweens.add({ targets: this.ghost, alpha: 0.9, scale: 0.85, duration: 4500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.ghost, alpha: 0.4, duration: 160, yoyo: true, repeat: 4, delay: 4600 });
    this.time.delayedCall(4000, () => this.think(AWAKEN_LINES, () => this.beatClock(), true));
  }

  /** The ghost drifts to the grandfather clock and reaches for it. */
  private beatClock() {
    this.lock();
    this.ghost.setFlipX(true);
    this.tweens.add({
      targets: this.ghost,
      x: CLOCK_X + 100,
      duration: 3200,
      ease: 'Sine.easeInOut',
      onComplete: () =>
        this.think(
          CLOCK_LINES,
          () => {
            this.lock();
            Sound.empty();
            this.tweens.add({ targets: this.ghost, x: CLOCK_X - 30, alpha: 0.35, duration: 700, ease: 'Sine.easeIn' });
            this.time.delayedCall(800, () => {
              this.cameras.main.shake(260, 0.003);
              this.tweens.add({ targets: this.ghost, alpha: 0.9, duration: 900 });
              this.time.delayedCall(1100, () => this.think(CLOCK_AFTER, () => this.beatWindow(), true));
            });
          },
          true,
        ),
    });
  }

  /** No reflection in the window. */
  private beatWindow() {
    this.lock();
    this.tweens.add({
      targets: this.ghost,
      x: WINDOW_X + 10,
      duration: 2600,
      ease: 'Sine.easeInOut',
      onComplete: () =>
        this.think(
          WINDOW_LINES,
          () => {
            this.unlock();
            this.bodyVisible = true;
            this.bodyMarker.setVisible(true);
            this.bubble.say([DRIFT_HINT]);
          },
          true,
          (i) => i === 2 && this.flickerWindow(),
        ),
    });
  }

  private flickerWindow() {
    const pane = this.add.rectangle(WINDOW_X, floorTop(0) + 240, 172, 232, 0xc7d4ff, 0).setDepth(12);
    this.tweens.add({ targets: pane, fillAlpha: 0.12, duration: 500, yoyo: true, repeat: 1, onComplete: () => pane.destroy() });
  }

  /** The ghost drifts over the figure on the rug... and recognises it. Slowly. */
  private discoverBody() {
    this.lock();
    this.bodyMarker.setVisible(false);
    this.bubble.hideNow();
    Sound.setMood('silent');
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(BODY_X + 140, floorTop(0) + 340, 3200, 'Sine.easeInOut');
    cam.zoomTo(1.35, 3200, 'Sine.easeInOut');
    this.tweens.add({ targets: this.ghost, x: BODY_X + 150, duration: 3200, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, baseY: this.baseY + 40, duration: 3200, ease: 'Sine.easeInOut' });
    const meIndex = BODY_LINES.findIndex((l) => l.includes('it’s me'));
    this.time.delayedCall(3300, () =>
      this.think(
        BODY_LINES,
        () => {
          this.lock();
          cam.flash(1400, 255, 225, 180);
          Sound.toll();
          this.time.delayedCall(1600, () => {
            cam.zoomTo(1, 10);
            this.baseY = floorTop(0) + LOCAL_GHOST_Y;
            cam.startFollow(this.ghost, true, 0.08, 0);
            cam.setScroll(cam.scrollX, floorTop(0));
            this.scene.pause();
            this.scene.launch('Memory');
          });
        },
        true,
        (i) => {
          if (i === meIndex) {
            Sound.toll();
            cam.shake(400, 0.002);
          }
        },
      ),
    );
  }

  /** Called when an overlay closes. */
  private onResume(from?: string) {
    this.controls.reset();
    if (from === 'memory') {
      GameState.rememberSuspects();
      this.unlock();
      Sound.setMood('explore');
      this.cameras.main.fadeIn(1000);
      this.tweens.add({ targets: [this.roomLabel, this.counter], alpha: 1, duration: 800 });
      this.roomLabel.setText(roomAt(this.floor, this.ghost.x).name);
      this.refreshHud();
      this.think(AFTER_MEMORY_THOUGHTS);
      return;
    }
    this.refreshHud();
    if (from === 'evidence') {
      const f = GameState.data.found;
      const src = f === 0 ? PRIOR_SHEET : CLUES[f - 1];
      this.think([...src.reaction, src.nextThought]);
    }
  }

  // ================================================================== thoughts and locking

  private lock() {
    this.cutscene = true;
    this.controls.enabled = false;
    this.controls.reset();
  }

  private unlock() {
    this.cutscene = false;
    this.controls.enabled = true;
  }

  /**
   * Thoughts beside the ghost. A sequence (2+ lines) waits for the player and pauses drifting.
   * `keepLocked` leaves movement locked afterwards (for chained story beats).
   */
  private think(lines: string[], onDone?: () => void, keepLocked = false, onLine?: (i: number) => void) {
    const seq = lines.filter(Boolean).length > 1;
    if (seq) this.lock();
    this.bubble.say(
      lines,
      () => {
        if (seq && !keepLocked) this.unlock();
        onDone?.();
      },
      onLine,
    );
  }

  private enterRoom(id: string) {
    this.roomId = id;
    GameState.data.ghostX = this.ghost.x;
    GameState.data.floor = this.floor;
    GameState.save();
    if (GameState.awakening) return;
    const room = ROOMS.find((r) => r.id === id)!;
    this.roomLabel.setText(room.name).setAlpha(0);
    this.tweens.add({ targets: this.roomLabel, alpha: 1, duration: 600 });
    if (!this.seenRooms.has(id)) {
      this.seenRooms.add(id);
      if (!this.bubble.busy && !this.cutscene && room.thought) this.bubble.say([room.thought]);
    }
  }

  // ================================================================== searching

  private currentKey(): string {
    const t = GameState.nextTarget;
    if (typeof t === 'number') return CLUES[t].id;
    return t;
  }

  private currentThought(): string {
    const f = GameState.data.found;
    if (f === -1) return AFTER_MEMORY_THOUGHTS[AFTER_MEMORY_THOUGHTS.length - 1];
    if (f < 0) return '';
    if (f === 0) return PRIOR_SHEET.nextThought;
    return CLUES[f - 1].nextThought;
  }

  /** Index of a clue in the active case (-1 for the prior, -2 if this case doesn't use it). */
  private clueIndex(id: string) {
    if (id === 'prior') return -1;
    const i = CLUES.findIndex((c) => c.id === id);
    return i < 0 ? -2 : i;
  }

  /** Can the ghost notice and search this right now? Future clues stay part of the furniture. */
  private canSearch(p: Prop): boolean {
    if (GameState.awakening) return false;
    if (p.def.kind === 'stairs') return true;
    const holds = p.def.holds;
    if (!holds || holds === 'prior') return true;
    const idx = this.clueIndex(holds);
    if (idx === -2) return true; // a clue this case doesn't use: ordinary furniture
    return idx <= GameState.data.found; // the current clue, or one already found
  }

  private nearest(): Prop | undefined {
    let best: Prop | undefined;
    let bd = REACH;
    for (const p of this.props.values()) {
      if (p.def.floor !== this.floor || !this.canSearch(p)) continue;
      const d = Math.abs(p.def.x - this.ghost.x);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (GameState.allFound && this.floor === 0 && Math.abs(this.ghost.x - BODY_X) < bd) {
      best = { def: { id: 'body', floor: 0, x: BODY_X, kind: 'plain', label: 'Name the culprit' }, hotY: floorTop(0) + F - 60, open: () => {}, opened: false };
    }
    return best;
  }

  private labelFor(p: Prop): string {
    if (p.def.id === 'body' || p.def.kind === 'stairs' || p.def.kind === 'plain') return p.def.label;
    return GameState.data.searched.includes(p.def.id) ? `${p.def.label} (searched)` : p.def.label;
  }

  /** A tap on (or near) something searchable: drift over and search it on arrival. */
  private pickAt(x: number, y: number): boolean {
    if (y < floorTop(this.floor) || y > floorTop(this.floor) + FLOOR_H) return false;
    let best: string | undefined;
    let bd = 95;
    for (const p of this.props.values()) {
      if (p.def.floor !== this.floor || !this.canSearch(p)) continue;
      const d = Math.abs(p.def.x - x);
      if (d < bd && Math.abs(y - p.hotY) < 190) {
        bd = d;
        best = p.def.id;
      }
    }
    if (!best && GameState.allFound && this.floor === 0 && Math.abs(x - BODY_X) < 120) best = 'body';
    this.tapTarget = best;
    if (best) this.controls.targetX = best === 'body' ? BODY_X : this.props.get(best)!.def.x;
    return !!best;
  }

  private interactNearest() {
    const p = this.nearest();
    if (p) this.interact(p.def.id);
  }

  private interact(id: string) {
    if (this.cutscene) return;
    if (id === 'body') {
      if (!GameState.allFound) return;
      this.lock();
      this.bubble.hideNow();
      this.cameras.main.fade(600, 0, 0, 0, true);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Accuse'));
      return;
    }
    const p = this.props.get(id);
    if (!p || !this.canSearch(p)) return;
    if (p.def.kind === 'stairs') return this.climb();

    const key = this.currentKey();
    const holds = p.def.holds;

    if (holds && holds === key) {
      // found it
      this.lock();
      this.markSearched(p);
      if (p.def.kind !== 'plain') Sound.open();
      p.open();
      this.time.delayedCall(p.def.kind === 'plain' ? 200 : 750, () => {
        Sound.discover();
        this.bubble.hideNow();
        this.cameras.main.flash(300, 255, 240, 200);
        this.time.delayedCall(550, () => {
          this.cutscene = false;
          this.scene.pause();
          this.scene.launch('Evidence', { kind: key === 'prior' ? 'prior' : 'clue' });
        });
      });
      return;
    }
    if (GameState.data.searched.includes(id)) {
      const foundHere = holds && this.clueIndex(holds) !== -2;
      this.bubble.say([foundHere ? 'I have already found what was here.' : 'I have already searched here.']);
      return;
    }
    // nothing that matters: an empty drawer, or something the ghost recognises as irrelevant
    this.lock();
    this.markSearched(p);
    if (p.def.kind !== 'plain') Sound.open();
    p.open();
    this.time.delayedCall(p.def.kind === 'plain' ? 100 : 650, () => {
      Sound.empty();
      const lines = p.def.noise ?? ['Nothing here.'];
      this.unlock();
      this.think(lines);
    });
  }

  private markSearched(p: Prop) {
    if (!GameState.data.searched.includes(p.def.id)) GameState.data.searched.push(p.def.id);
    GameState.save();
    p.spark?.setVisible(false);
  }

  /** Float up or down the hallway stairs. */
  private climb() {
    this.lock();
    this.bubble.hideNow();
    Sound.whoosh();
    const to = this.floor === 0 ? 1 : 0;
    const cam = this.cameras.main;
    this.tweens.add({
      targets: this.ghost,
      x: STAIRS_X,
      duration: 350,
      onComplete: () => {
        this.tweens.add({ targets: this.ghost, alpha: 0.4, duration: 300, yoyo: true });
        this.tweens.add({ targets: this, baseY: floorTop(to) + LOCAL_GHOST_Y, duration: 1400, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: this.ghost, x: STAIRS_X + (to === 1 ? 140 : -140), duration: 1400, ease: 'Sine.easeInOut' });
        this.tweens.add({
          targets: cam,
          scrollY: floorTop(to),
          duration: 1400,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.floor = to;
            GameState.data.floor = to;
            GameState.save();
            this.refreshHud();
            this.unlock();
          },
        });
      },
    });
  }

  private openBoard() {
    if (!GameState.priorSet || this.cutscene) return;
    this.controls.reset();
    this.bubble.hideNow();
    this.scene.pause();
    this.scene.launch('Board');
  }

  private refreshHud() {
    this.counter.setText(`Evidence: ${Math.max(0, GameState.data.found)} / ${CLUES.length}`);
    this.controls.showBoard(GameState.priorSet);
    this.bodyMarker.setVisible((GameState.awakening && this.bodyVisible) || GameState.allFound);
    for (const p of this.props.values()) {
      p.spark?.setVisible(this.canSearch(p) && !GameState.data.searched.includes(p.def.id));
    }
  }

  // ================================================================== building the house

  /**
   * One floor, drawn in local coordinates inside a container placed at the floor's top.
   * Each room gets its own Graphics so rooms far from the camera can be skipped entirely:
   * vector shapes are redrawn every frame, and a whole house of them is too slow on phones.
   */
  private buildFloor(floor: number) {
    const layer = this.add.container(0, floorTop(floor)).setDepth(10);
    const rooms = ROOMS.filter((r) => r.floor === floor);
    const b = floorBounds(floor);
    const R: Record<string, Phaser.GameObjects.Graphics> = {};
    rooms.forEach((r, i) => {
      const g = this.add.graphics();
      layer.add(g);
      R[r.id] = g;
      this.roomGfx.push({ g, floor, x0: r.x0, x1: r.x1 });
      g.fillGradientStyle(r.wallTop, r.wallTop, r.wallBottom, r.wallBottom, 1);
      g.fillRect(r.x0, 0, r.x1 - r.x0, FLOOR_H);
      g.fillStyle(SIL, 1);
      g.fillRect(r.x0, F, r.x1 - r.x0, FLOOR_H - F); // floorboards
      g.fillRect(r.x0, 0, r.x1 - r.x0, 34); // ceiling
      g.lineStyle(2, 0x1c2235, 1);
      g.lineBetween(r.x0, F, r.x1, F);
      if (i > 0) {
        g.fillStyle(SIL, 1);
        g.fillRect(r.x0 - 60, 0, 30, F);
        g.fillRect(r.x0 + 30, 0, 30, F);
        g.fillRect(r.x0 - 60, 0, 120, 120);
      }
      g.fillStyle(SIL, 1);
      if (i === 0) g.fillRect(b.min - 100, 0, 40, FLOOR_H); // outer walls
      if (i === rooms.length - 1) g.fillRect(b.max + 60, 0, 40, FLOOR_H);
    });
    if (floor === 0) this.decorGround(R, layer);
    else this.decorUpstairs(R, layer);
  }

  /** Only draw the rooms near the camera. */
  private cullRooms() {
    const v = this.cameras.main.worldView;
    for (const r of this.roomGfx) {
      const top = floorTop(r.floor);
      r.g.setVisible(r.x1 > v.x - 300 && r.x0 < v.right + 300 && top < v.bottom && top + FLOOR_H > v.y);
    }
  }

  private decorGround(R: Record<string, Phaser.GameObjects.Graphics>, layer: Phaser.GameObjects.Container) {
    // Study
    let g = R.study;
    drawWindow(g, WINDOW_X - 90, 120, 180, 240);
    drawWindow(g, 1460, 140, 150, 200);
    drawDesk(g, 820, 360);
    g.fillStyle(SIL, 1);
    g.fillRect(580, F - 106, 80, 12); // side table
    g.fillRect(614, F - 94, 12, 94);
    drawChandelier(g, 640);
    drawChandelier(g, 1300);
    drawGrandfatherClock(this, CLOCK_X, layer);
    const body = this.add.graphics();
    drawBody(body, BODY_X, F - 4);
    layer.add(body);
    g.fillStyle(0xd9d2bc, 0.75);
    g.fillRect(598, F - 116, 44, 10); // the household log
    g.fillStyle(0xd9d2bc, 0.9);
    g.fillEllipse(930, F - 128, 26, 12); // the teacup
    g.lineStyle(3, 0xd9d2bc, 0.9);
    g.strokeCircle(945, F - 130, 5);

    // Hallway, with the staircase rising up through the ceiling
    g = R.hallway;
    [1950, 2250, 3200].forEach((x) => drawPortrait(g, x, 250));
    drawChandelier(g, 2250);
    drawGrandfatherClock(this, 2620, layer);
    g.fillStyle(SIL, 1);
    for (let s = 0; s < 12; s++) g.fillRect(STAIRS_X - 140 + s * 30, F - (s + 1) * 51, 400 - s * 30, 51);
    g.lineStyle(4, 0x2a2f44, 1);
    g.lineBetween(STAIRS_X - 140, F - 120, STAIRS_X + 220, F - 120 - 12 * 51);
    for (let s = 0; s < 12; s += 2) g.lineBetween(STAIRS_X - 130 + s * 30, F - (s + 1) * 51, STAIRS_X - 130 + s * 30, F - (s + 1) * 51 - 70);

    // Dining room
    g = R.dining;
    drawWindow(g, 3600, 130, 160, 230);
    drawChandelier(g, 4300);
    g.fillStyle(SIL, 1);
    [4060, 4160, 4440, 4540].forEach((x) => {
      g.fillRect(x - 4, F - 150, 8, 150); // chair backs
      g.fillRect(x - 18, F - 62, 36, 8);
    });
    drawPortrait(g, 4300, 230);

    // Conservatory
    g = R.conservatory;
    for (let i = 0; i < 4; i++) drawWindow(g, 5180 + i * 400, 70, 260, 330);
    drawPlant(g, 5530, 1.0);
    drawPlant(g, 6080, 0.9);
    drawPlant(g, 6650, 1.3);
    g.fillStyle(SIL, 1);
    g.fillRect(5950, F - 90, 230, 14); // potting bench
    g.fillRect(5960, F - 76, 12, 76);
    g.fillRect(6160, F - 76, 12, 76);

    // Office
    g = R.office;
    drawWindow(g, 7700, 140, 170, 210);
    drawBookshelf(g, 7880, 140, 330);
    drawGrandfatherClock(this, 7250, layer);
    drawChandelier(g, 7500);
  }

  private decorUpstairs(R: Record<string, Phaser.GameObjects.Graphics>, layer: Phaser.GameObjects.Container) {
    // Clara's room
    let g = R.clara;
    drawWindow(g, 1420, 130, 140, 190);
    g.fillStyle(SIL, 1);
    g.fillRoundedRect(1790, F - 70, 170, 50, 8); // bed
    g.fillRect(1790, F - 130, 14, 130);
    g.fillRect(1946, F - 100, 14, 100);
    g.fillStyle(0x3a2a3e, 1);
    g.fillRoundedRect(1806, F - 86, 60, 20, 8);
    // the landing: the stairwell going down, behind a banister
    g = R.landing;
    g.fillStyle(0x010102, 1);
    g.fillRect(STAIRS_X - 160, F - 6, 330, FLOOR_H - F + 6);
    g.fillStyle(SIL, 1);
    for (let s = 0; s < 4; s++) g.fillRect(STAIRS_X - 160 + s * 40, F + s * 26, 330 - s * 40, 26);
    g.lineStyle(5, 0x2a2f44, 1);
    g.lineBetween(STAIRS_X - 170, F - 80, STAIRS_X + 180, F - 80);
    for (let x = STAIRS_X - 170; x <= STAIRS_X + 180; x += 35) g.lineBetween(x, F - 80, x, F);
    drawPortrait(g, 2500, 240);
    drawGrandfatherClock(this, 2370, layer);
    drawChandelier(g, 2900);
    // Library
    g = R.library;
    drawBookshelf(g, 3600, 150, 380);
    drawBookshelf(g, 3990, 260, 380);
    drawBookshelf(g, 4800, 220, 380);
    g.fillStyle(SIL, 1);
    g.fillRoundedRect(4280, F - 120, 110, 120, 30); // armchair
    drawChandelier(g, 4300);
    // Box room
    g = R.boxroom;
    drawWindow(g, 5700, 160, 120, 160);
    g.fillStyle(SIL, 1);
    g.fillRect(5180, F - 90, 110, 90); // crates
    g.fillRect(5200, F - 160, 80, 70);
    g.fillRect(6230, F - 120, 120, 120);
    g.fillTriangle(5800, F, 5870, F - 140, 5940, F); // something under a dust sheet
  }

  /** Searchable furniture, each with its own little opening animation. */
  private buildProps() {
    for (const def of SEARCHABLES) {
      const base = floorTop(def.floor) + F;
      const p: Prop = { def, hotY: base - 80, open: () => {}, opened: false };
      const w = def.w ?? 100;
      const h = def.h ?? 100;

      if (def.kind === 'drawer') {
        const g = this.add.graphics().setDepth(18);
        if (def.id !== 'study-desk') {
          g.fillStyle(SIL, 1);
          g.fillRect(def.x - w / 2 - 20, base - 100, w + 40, 14);
          g.fillRect(def.x - w / 2 - 12, base - 86, 12, 86);
          g.fillRect(def.x + w / 2, base - 86, 12, 86);
          g.fillRect(def.x - w / 2, base - 86, w, 52);
        }
        g.fillStyle(0x020203, 1);
        g.fillRect(def.x - w / 2 + 8, base - 82, w - 16, h);
        const front = this.add.rectangle(def.x, base - 82 + h / 2, w - 16, h, 0x1a2032).setStrokeStyle(2, 0x2c3550).setDepth(19);
        const knob = this.add.circle(def.x, base - 82 + h / 2, 4, 0x8a96b8).setDepth(19);
        p.hotY = base - 100;
        p.open = (instant) => {
          if (p.opened) return;
          p.opened = true;
          if (instant) [front, knob].forEach((o) => (o.y += h + 6));
          else this.tweens.add({ targets: [front, knob], y: `+=${h + 6}`, duration: 450, ease: 'Back.easeOut' });
        };
      } else if (def.kind === 'cabinet') {
        const g = this.add.graphics().setDepth(18);
        g.fillStyle(SIL, 1);
        g.fillRect(def.x - w / 2 - 6, base - h - 8, w + 12, h + 8);
        g.fillStyle(0x020203, 1);
        g.fillRect(def.x - w / 2, base - h, w, h - 4);
        const door = this.add
          .rectangle(def.x - w / 2, base - h / 2 - 2, w, h - 4, 0x161c2c)
          .setOrigin(0, 0.5)
          .setStrokeStyle(2, 0x2c3550)
          .setDepth(19);
        const knob = this.add.circle(def.x + w / 2 - 14, base - h / 2, 4, 0x8a96b8).setDepth(19);
        p.hotY = base - Math.min(h, 260) / 2 - 20;
        p.open = (instant) => {
          if (p.opened) return;
          p.opened = true;
          knob.setVisible(false);
          if (instant) door.setScale(0.14, 1);
          else this.tweens.add({ targets: door, scaleX: 0.14, duration: 500, ease: 'Sine.easeOut' });
        };
      } else if (def.kind === 'move') {
        const obj = this.add.container(def.x, base).setDepth(19);
        this.drawMovable(def, obj, w, h);
        p.hotY = def.id === 'hollow-book' ? base - 160 : base - h / 2 - 10;
        const dx = def.id === 'hollow-book' ? 22 : def.id === 'tablecloth' ? 0 : 90;
        p.open = (instant) => {
          if (p.opened) return;
          p.opened = true;
          const cloth = obj.getByName('cloth') as Phaser.GameObjects.Rectangle | null;
          if (cloth) {
            if (instant) cloth.setScale(1, 0.25);
            else this.tweens.add({ targets: cloth, scaleY: 0.25, duration: 500, ease: 'Sine.easeOut' });
            return;
          }
          const to = { x: obj.x + dx, angle: def.id === 'hollow-book' ? 12 : 4 };
          if (instant) obj.setPosition(to.x, obj.y).setAngle(to.angle);
          else this.tweens.add({ targets: obj, ...to, duration: 600, ease: 'Sine.easeOut' });
        };
      } else if (def.kind === 'plain') {
        p.hotY = base - (def.id === 'log' ? 110 : 130);
      } else {
        p.hotY = base - 140;
      }

      // a faint shimmer marks things worth a look; clues and dead ends look exactly the same
      if (def.kind !== 'stairs') {
        p.spark = this.add.image(def.x, p.hotY, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setAlpha(0.25);
        this.tweens.add({
          targets: p.spark,
          alpha: 0.6,
          scale: 1.25,
          duration: 1200 + Math.random() * 800,
          yoyo: true,
          repeat: -1,
          delay: Math.random() * 1000,
        });
      }
      this.props.set(def.id, p);
      if (GameState.data.searched.includes(def.id)) p.open(true);
    }

    // the body: marked while the ghost doesn't yet know it, and again at the end
    this.bodyMarker = this.add.container(BODY_X, floorTop(0) + F - 40).setDepth(40);
    const mg = this.add.image(0, 0, 'glow').setScale(1.3).setBlendMode(Phaser.BlendModes.ADD);
    this.bodyMarker.add(mg);
    this.tweens.add({ targets: mg, scale: 1.7, alpha: 0.5, duration: 1100, yoyo: true, repeat: -1 });
  }

  /** Silhouettes for things the ghost can push aside, with whatever hides beneath drawn first. */
  private drawMovable(def: Searchable, obj: Phaser.GameObjects.Container, w: number, h: number) {
    const base = floorTop(def.floor) + F;
    const under = this.add.graphics().setDepth(17);
    const g = this.add.graphics();
    obj.add(g);
    g.fillStyle(SIL, 1);
    switch (def.id) {
      case 'chair':
        under.fillStyle(0xc8d0e0, 1);
        under.fillCircle(def.x + 6, base - 6, 4); // the cufflink
        g.fillRect(-w / 2, -h, 10, h);
        g.fillRect(-w / 2, -52, w, 10);
        g.fillRect(w / 2 - 8, -52, 8, 52);
        break;
      case 'fern':
        under.fillStyle(0x3a2a1a, 1);
        under.fillEllipse(def.x - 10, base - 6, 30, 12); // the boot print
        under.fillEllipse(def.x + 32, base - 9, 30, 12);
        g.fillRect(-w / 2, -h, w, h);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.33;
          g.fillTriangle(-6, -h, 6, -h, Math.cos(a) * 130, -h + Math.sin(a) * 130);
        }
        break;
      case 'cans':
        g.fillRoundedRect(-w / 2, -h, 36, h, 6);
        g.fillRoundedRect(-w / 2 + 42, -h + 14, 34, h - 14, 6);
        g.fillTriangle(-w / 2 + 36, -h + 20, -w / 2 + 36, -h + 30, -w / 2 + 60, -h - 6);
        break;
      case 'coats':
        g.fillRect(-4, -h, 8, h);
        g.fillEllipse(-14, -h + 50, 46, 110);
        g.fillEllipse(16, -h + 60, 40, 120);
        g.fillCircle(0, -h, 12);
        break;
      case 'tablecloth': {
        g.fillRect(-w / 2, -h - 8, w, 12);
        g.fillRect(-w / 2 + 10, -h, 10, h);
        g.fillRect(w / 2 - 20, -h, 10, h);
        const cloth = this.add.rectangle(0, -h + 2, w + 10, h - 20, 0x2b1e22).setOrigin(0.5, 0);
        cloth.setName('cloth');
        obj.add(cloth);
        break;
      }
      case 'hollow-book':
        under.fillStyle(SIL, 1);
        under.fillRect(def.x - 70, base - 240, 140, 240);
        under.fillStyle(0x10131f, 1);
        for (let i = 0; i < 6; i++) under.fillRect(def.x - 62 + i * 22, base - 230, 16, 50);
        obj.setY(base - 120);
        g.fillStyle(0x3b2c22, 1);
        g.fillRect(-12, -h, 24, h);
        break;
      case 'hatboxes':
        g.fillEllipse(0, -20, w, 40);
        g.fillEllipse(0, -55, w - 14, 36);
        g.fillEllipse(0, -88, w - 28, 32);
        break;
      default:
        g.fillRect(-w / 2, -h, w, h);
    }
  }

  private buildForeground() {
    // near layer (fast horizontal parallax): dark curtains and posts passing in front
    const fg = this.add.graphics().setScrollFactor(1.25, 1).setDepth(80);
    fg.fillStyle(0x000000, 0.75);
    for (let x = 0; x < WORLD_W * 1.25 + W; x += 1100) {
      for (const top of [0, FLOOR_H]) {
        fg.fillRect(x, top, 60, FLOOR_H);
        fg.fillTriangle(x + 60, top, x + 60, top + 240, x + 160, top);
        fg.fillEllipse(x + 500, top + FLOOR_H + 10, 420, 110);
      }
    }
  }
}
