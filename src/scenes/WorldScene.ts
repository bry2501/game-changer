import Phaser from 'phaser';
import { fadeThen, fitCamera, H, soundToggle, txt, viewOf, W, ZOOM, GHOST_RES } from '../ui/widgets';
import {
  drawBody,
  drawBookshelf,
  drawChandelier,
  drawDesk,
  drawGrandfatherClock,
  drawPlant,
  drawPortrait,
  drawDoor,
  drawFireplace,
  drawFoliage,
  drawWainscot,
  drawWindow,
} from '../ui/art';
import { PAL, cobweb, crack, paintRect } from '../ui/paint';
import {
  AFTER_MEMORY_THOUGHTS,
  AWAKEN_LINES,
  BODY_AFTER,
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
import { Controls } from '../ui/Controls';
import { AccentCamera, Noir, filmGrain } from '../ui/noir';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { Sound } from '../audio/Sound';

const WORLD_W = Math.max(...ROOMS.map((r) => r.x1));

/** Wall tints per room: moonlit blues and teals with a little plum, after the painted references. */
const ROOM_TINT: Record<string, number> = {
  study: 0x2c3240,
  hallway: 0x2a2d38,
  dining: 0x30293a,
  conservatory: 0x26332f,
  office: 0x2e2f36,
  clara: 0x342b3a,
  landing: 0x2a2e3c,
  library: 0x263230,
  boxroom: 0x2f2f36,
};
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
  private controls!: Controls;
  private cursor = 'default';
  /** The camera follows the ghost horizontally (floors change by a deliberate move). */
  private following = true;
  private lantern: Phaser.GameObjects.Image[] = [];
  /** Faint chevrons at the screen edges, pointing toward the next thing to find. */
  private guides: Phaser.GameObjects.Text[] = [];
  /** Window frames (drawn over the shared sky) and the panes the sky shows through. */
  private frames!: Phaser.GameObjects.Graphics;
  private windowRects: Phaser.Geom.Rectangle[] = [];
  private layers = new Map<number, Phaser.GameObjects.Container>();
  /** Black and white, except for what the accent camera keeps in colour. */
  private noir!: Noir;
  private accent!: AccentCamera;
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
  private roomGfx: { g: Phaser.GameObjects.Components.Visible; floor: number; x0: number; x1: number }[] = [];
  /** Parallax pieces (sky trees, foreground curtains), shown only while they are on screen. */
  private parallaxCull: { o: Phaser.GameObjects.Components.Visible; x: number; w: number; factor: number }[] = [];
  private t = 0;
  private vx = 0;

  constructor() {
    super('World');
  }

  // ================================================================== setup

  create() {
    fitCamera(this.cameras.main);
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
    cam.setBackgroundColor('#050505');

    this.noir = new Noir(this, cam, 0);
    this.accent = new AccentCamera(this);
    this.layers.clear();
    this.windowRects = [];
    this.frames = this.add.graphics().setDepth(10.8);
    this.buildFloor(0);
    this.buildFloor(1);
    this.buildSky();
    this.buildProps();

    this.glow = this.add.image(0, 0, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
    this.ghost = this.add.image(GameState.data.ghostX, this.baseY, 'ghost').setDepth(51).setScale(0.85 / GHOST_RES);
    this.accent.keep(this.glow, this.ghost);
    const trail = this.add
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
    this.accent.keep(trail);
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
    // the ghost is the light: darkness everywhere except a soft pool around him.
    // One copy darkens the grey world; a second, on the colour camera, darkens the body and
    // rug too (but not the clue glints or the ghost, which sit above it).
    this.lantern = [
      this.add.image(0, 0, 'lantern').setDisplaySize(2800, 2800).setDepth(890),
      this.add.image(0, 0, 'lantern').setDisplaySize(2800, 2800).setDepth(25),
    ];
    this.accent.keep(this.lantern[1]);
    // a dark oval vignette and fine grain
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDepth(900);
    filmGrain(this);

    // follow horizontally only; changing floors is a deliberate camera move
    this.following = true;
    cam.setScroll(this.followX(), floorTop(this.floor));

    // HUD
    this.roomLabel = txt(this, 30, 24, '', 26, '#f2f2f2', { fontStyle: 'italic' }).setScrollFactor(0).setDepth(1000);
    this.counter = txt(this, 30, 60, '', 20, '#c4c4c4').setScrollFactor(0).setDepth(1000);
    // the HUD is drawn without the noir filter, so it stays crisp and bright
    this.accent.keep(this.roomLabel, this.counter);
    this.guides = ['‹', '›'].map((c, i) =>
      txt(this, i === 0 ? 34 : W - 34, H / 2, c, 64, '#d8d8d8').setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0),
    );
    this.accent.keep(...this.guides);
    this.label = txt(this, 0, 0, '', 21, '#f2f2f2', { backgroundColor: '#060606cc', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setDepth(940)
      .setVisible(false);
    soundToggle(this, W - 50, 52);

    this.bubble = new ThoughtBubble(this, this.ghost);
    this.controls = new Controls(
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

  /** Where the camera's left edge should be to keep the ghost centred, within the house. */
  private followX() {
    return Phaser.Math.Clamp(this.ghost.x - W / 2, 0, WORLD_W - W);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.t += dt;
    // the light travels with the ghost, breathing a little like a flame
    const breathe = 2800 * (1 + Math.sin(this.t * 1.7) * 0.025);
    for (const l of this.lantern) l.setPosition(this.ghost.x, this.ghost.y + 30).setDisplaySize(breathe, breathe);
    this.updateGuides();
    if (this.following) {
      const cam = this.cameras.main;
      cam.scrollX += (this.followX() - cam.scrollX) * Math.min(1, 0.08 * dt * 60);
    }
    this.controls.update();

    let want = this.controls.keyDir;
    const tx = this.controls.targetX;
    if (want === 0 && tx !== null && !this.cutscene) {
      const dx = tx - this.ghost.x;
      if (Math.abs(dx) < 10) this.controls.targetX = null;
      else want = Math.sign(dx) * Math.min(1, Math.abs(dx) / 80);
    }
    if (this.cutscene) want = 0;
    // ease into a drift, but come to rest quickly once the key, finger or button is released
    this.vx = Phaser.Math.Linear(this.vx, want * SPEED, Math.min(1, dt * (want === 0 ? 24 : 8)));
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

    // the mouse: hovering over something searchable names it and shows a hand
    const ptr = this.input.activePointer;
    const at = this.cutscene ? undefined : this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const hoverId = at && this.findAt(at.x, at.y);
    const hover = hoverId === 'body' ? this.nearest() : hoverId ? this.props.get(hoverId) : undefined;
    const cursor = hoverId ? 'pointer' : 'default';
    if (cursor !== this.cursor) this.input.setDefaultCursor((this.cursor = cursor));
    const near = this.cutscene ? undefined : (hover ?? this.nearest());
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
    this.bodyMarker.setVisible(false);
    this.roomLabel.setAlpha(0);
    this.counter.setAlpha(0);
    this.ghost.setAlpha(0).setScale(0.3 / GHOST_RES);
    Sound.setMood('emerge');
    this.cameras.main.fadeIn(4500);
    this.tweens.add({ targets: this.ghost, alpha: 0.9, scale: 0.85 / GHOST_RES, duration: 4500, ease: 'Sine.easeOut' });
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
            this.bubble.say(DRIFT_HINT);
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
    // colour seeps back in as he recognises himself
    this.noir.fade(1, 5200, 600);
    this.bodyMarker.setVisible(false);
    this.bubble.hideNow();
    Sound.setMood('silent');
    const cam = this.cameras.main;
    this.following = false;
    // close in on the body: zoom, keeping (BODY_X + 140, 340) at the centre of the view
    const z = 1.35 * ZOOM;
    this.tweens.add({
      targets: cam,
      zoom: z,
      scrollX: BODY_X + 140 - cam.width / z / 2,
      scrollY: floorTop(0) + 340 - cam.height / z / 2,
      duration: 3200,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({ targets: this.ghost, x: BODY_X + 150, duration: 3200, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, baseY: this.baseY + 40, duration: 3200, ease: 'Sine.easeInOut' });
    const meIndex = BODY_LINES.findIndex((l) => l.includes('it’s me'));
    this.time.delayedCall(3300, () =>
      this.think(
        BODY_LINES,
        () => {
          this.lock();
          // a toll and a shudder; the light is saved for the memory itself
          Sound.toll();
          cam.shake(600, 0.003);
          // the memory starts to surface before it takes over
          this.time.delayedCall(1600, () =>
            this.think(
              BODY_AFTER,
              () => {
                this.lock();
                // one warm bloom that carries straight on into the memory (which fades in from the same glow)
                cam.fadeOut(900, 255, 228, 186);
                this.time.delayedCall(950, () => {
                  cam.setZoom(ZOOM);
                  this.baseY = floorTop(0) + LOCAL_GHOST_Y;
                  this.following = true;
                  cam.setScroll(this.followX(), floorTop(0));
                  this.scene.pause();
                  this.scene.launch('Memory');
                });
              },
              true,
            ),
          );
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
      this.noir.fade(0, 2600, 400); // and drains away again: back to the night
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
    // a cutscene beat always waits for the player, even when it is a single line
    const seq = lines.filter(Boolean).length > 1 || keepLocked;
    if (seq) this.lock();
    this.bubble.say(
      lines,
      () => {
        if (seq && !keepLocked) this.unlock();
        onDone?.();
      },
      onLine,
      seq,
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

  /** Where the next thing to find is: its world x on its floor (or the stairs, if it is on the other floor). */
  private guideX(): number | undefined {
    const key = this.currentKey();
    if (key === 'body') return undefined; // the opening is scripted
    let x: number;
    let floor: number;
    if (key === 'accuse') {
      x = BODY_X;
      floor = 0;
    } else {
      const p = [...this.props.values()].find((q) => q.def.holds === key);
      if (!p) return undefined;
      x = p.def.x;
      floor = p.def.floor;
    }
    return floor === this.floor ? x : STAIRS_X;
  }

  /** Show the left or right chevron, softly pulsing, when the next thing to find is off screen. */
  private updateGuides() {
    const gx = this.cutscene ? undefined : this.guideX();
    const v = viewOf(this.cameras.main);
    const side = gx === undefined ? -1 : gx < v.x + 40 ? 0 : gx > v.right - 40 ? 1 : -1;
    const pulse = 0.35 + 0.25 * Math.sin(this.t * 3);
    this.guides.forEach((g, i) => {
      const want = i === side ? pulse : 0;
      g.setAlpha(g.alpha + (want - g.alpha) * 0.15);
      g.setX((i === 0 ? 34 : W - 34) + (i === side ? Math.sin(this.t * 3) * (i === 0 ? -5 : 5) : 0));
    });
  }

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
    const best = this.findAt(x, y);
    this.tapTarget = best;
    if (best) this.controls.targetX = best === 'body' ? BODY_X : this.props.get(best)!.def.x;
    return !!best;
  }

  /** What searchable thing (or the body) is at this world point, if any. */
  private findAt(x: number, y: number): string | undefined {
    if (y < floorTop(this.floor) || y > floorTop(this.floor) + FLOOR_H) return undefined;
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
    return best;
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
      fadeThen(this, 600, () => this.scene.start('Accuse'));
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
    this.layers.set(floor, layer);
    const rooms = ROOMS.filter((r) => r.floor === floor);
    const b = floorBounds(floor);
    const R: Record<string, Phaser.GameObjects.Graphics> = {};
    rooms.forEach((r, i) => {
      const w = r.x1 - r.x0;
      // painted plaster, tinted to the room, and floorboards below
      const wall = this.add.tileSprite(r.x0, 0, w, F, 'paintWall').setOrigin(0).setTint(ROOM_TINT[r.id] ?? 0x4a6890);
      const boards = this.add.tileSprite(r.x0, F, w, FLOOR_H - F, 'floorboards').setOrigin(0).setTint(0x34363c);
      const g = this.add.graphics();
      layer.add([wall, boards, g]);
      R[r.id] = g;
      for (const o of [wall, boards, g]) this.roomGfx.push({ g: o, floor, x0: r.x0, x1: r.x1 });
      drawWainscot(g, r.x0, r.x1);
      // a few plaster cracks
      crack(g, r.x0 + 180 + (i * 137) % 400, 70, 120, i + 2);
      crack(g, r.x1 - 260 - (i * 89) % 300, 90, 90, i + 5);
      if (i > 0) {
        // a painted archway between rooms
        paintRect(g, r.x0 - 60, 0, 30, F, PAL.woodDark);
        paintRect(g, r.x0 + 30, 0, 30, F, PAL.woodDark);
        paintRect(g, r.x0 - 60, 40, 120, 70, PAL.woodDark);
      }
      if (i === 0) paintRect(g, b.min - 100, 0, 40, FLOOR_H, PAL.woodDark); // outer walls
      if (i === rooms.length - 1) paintRect(g, b.max + 60, 0, 40, FLOOR_H, PAL.woodDark);
      // cobwebs in the top corners of most rooms
      if (i % 2 === 0) layer.add(cobweb(this, r.x0 + (i > 0 ? 62 : 0) + (i === 0 ? b.min - 60 - r.x0 : 0), 40, 0.9));
      if (i % 3 !== 1) layer.add(cobweb(this, r.x1 - (i < rooms.length - 1 ? 62 : 0) - (i === rooms.length - 1 ? r.x1 - b.max - 60 : 0), 40, 0.8, true));
    });
    if (floor === 0) this.decorGround(R, layer);
    else this.decorUpstairs(R, layer);
  }

  /** Only draw the rooms near the camera. */
  private cullRooms() {
    const v = viewOf(this.cameras.main);
    // a whole floor out of view is skipped, so its blur costs nothing
    for (const [floor, layer] of this.layers) {
      const top = floorTop(floor);
      layer.setVisible(top < v.bottom && top + FLOOR_H > v.y);
    }
    // a piece at scroll factor f sits on screen at x - scrollX · f
    const cam = this.cameras.main;
    const vw = v.right - v.x;
    for (const p of this.parallaxCull) {
      const sx = p.x - cam.scrollX * p.factor;
      p.o.setVisible(sx + p.w > -60 && sx < vw + 60);
    }
    for (const r of this.roomGfx) {
      const top = floorTop(r.floor);
      r.g.setVisible(r.x1 > v.x - 300 && r.x0 < v.right + 300 && top < v.bottom && top + FLOOR_H > v.y);
    }
  }

  /** A window onto the shared night outside: its panes show the one sky, moon and trees. */
  private skyWindow(floor: number, x: number, y: number, w: number, h: number) {
    const top = floorTop(floor);
    this.windowRects.push(new Phaser.Geom.Rectangle(x, top + y, w, h));
    drawWindow(this.frames, x, top + y, w, h, false);
  }

  /**
   * One night outside every window: a dark sky, a single moon that barely moves, and trees at
   * two depths that slide past it as the ghost drifts (parallax). Everything is masked to the
   * window panes, so the walls hide it and each window is a view onto the same garden.
   */
  private buildSky() {
    const mask = this.make.graphics({}, false);
    mask.fillStyle(0xffffff, 1);
    for (const r of this.windowRects) mask.fillRect(r.x, r.y, r.width, r.height);
    const geo = mask.createGeometryMask();
    const sky = this.add.graphics().setScrollFactor(0).setDepth(10.5);
    sky.fillGradientStyle(0x0d1420, 0x0d1420, 0x1c2a36, 0x1c2a36, 1);
    sky.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      sky.fillStyle(0xdfe8ff, 0.25 + ((i * 37) % 10) / 25);
      sky.fillCircle((i * 197) % W, (i * 83) % 420, i % 9 === 0 ? 1.6 : 0.9);
    }
    // the moon: fixed high in the sky, drifting only a little
    const moon = this.add.graphics().setScrollFactor(0.03, 0).setDepth(10.52);
    // it hangs in the upper pane of the study window, where the ghost first looks out
    // (the camera rests at the start of the house then, so screen x is world x)
    const mx = WINDOW_X + 46;
    const my = 178;
    for (let r = 110; r > 40; r -= 12) {
      moon.fillStyle(0xdfe8ff, 0.05);
      moon.fillCircle(mx, my, r);
    }
    moon.fillStyle(0xeef2ff, 1);
    moon.fillCircle(mx, my, 40);
    moon.fillStyle(0xc9d2e4, 0.7);
    moon.fillCircle(mx - 13, my - 10, 7);
    moon.fillCircle(mx + 14, my + 14, 5);
    // far trees, then nearer ones, leafy silhouettes sliding past at different speeds
    const tree = (g: Phaser.GameObjects.Graphics, x: number, s: number, color: number) => {
      g.fillStyle(color, 1);
      g.fillRect(x - 10 * s, 120 * s, 20 * s, H);
      g.lineStyle(9 * s, color, 1);
      g.lineBetween(x, 200 * s, x + 140 * s, 110 * s);
      g.lineBetween(x, 260 * s, x - 120 * s, 170 * s);
      g.lineBetween(x, 150 * s, x + 40 * s, 30 * s);
      // a few thin twigs poking out of the crown
      g.lineStyle(3 * s, color, 1);
      g.lineBetween(x + 120 * s, 100 * s, x + 200 * s, 60 * s);
      g.lineBetween(x - 100 * s, 150 * s, x - 175 * s, 120 * s);
      g.lineBetween(x + 50 * s, 30 * s, x + 70 * s, -15 * s);
      [[0, 90, 120], [120, 100, 90], [-100, 150, 90], [50, 30, 70]].forEach(([dx, y, r], k) =>
        drawFoliage(g, x + dx * s, y * s, r * s, r * 0.55 * s, color, Math.round(x) + k, s),
      );
    };
    // The tree rows are thousands of small shapes, far too many to redraw every frame, so each
    // row is painted once into a texture that repeats along the house, and shown as images.
    const far = this.treeRow('sky-far', 4, 620, (g, k, x) => tree(g, x + ((k * 4340) % 180), 1, 0x0a0f14), 0.25, 10.54, 200);
    const near = this.treeRow('sky-near', 2, 1150, (g, _k, x) => tree(g, x, 1.6, 0x030506), 0.55, 10.56, 1150);
    for (const o of [sky, moon, ...far, ...near]) o.setMask(geo);
  }

  /**
   * One row of trees for the sky, baked into a repeating texture: `count` trees `gap` apart
   * make one tile (drawn wrapped at both ends so the tiles join without a seam), and tiles are
   * laid end to end across the house at the row's parallax.
   */
  private treeRow(
    key: string,
    count: number,
    gap: number,
    draw: (g: Phaser.GameObjects.Graphics, k: number, x: number) => void,
    factor: number,
    depth: number,
    start: number,
  ): Phaser.GameObjects.Image[] {
    const tileW = count * gap;
    const res = Math.min(ZOOM, 1.5); // sharp enough behind the glass, and modest on memory
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      for (let k = 0; k < count; k++) for (const shift of [-tileW, 0, tileW]) draw(g, k, k * gap + shift + gap / 2);
      g.setScale(res);
      const tex = this.textures.addDynamicTexture(key, Math.ceil(tileW * res), Math.ceil(H * res))!;
      tex.draw(g, 0, 0);
      g.destroy();
    }
    const imgs: Phaser.GameObjects.Image[] = [];
    for (let x = start - gap / 2; x < WORLD_W * factor + W + gap; x += tileW) {
      const img = this.add.image(x, 0, key).setOrigin(0).setScale(1 / res).setScrollFactor(factor, 0).setDepth(depth);
      imgs.push(img);
      this.parallaxCull.push({ o: img, x, w: tileW, factor });
    }
    return imgs;
  }

  /** Soft moonlight falling from a window onto the floor. */
  private shaft(layer: Phaser.GameObjects.Container, x: number, y: number, w: number, lean = 0.12) {
    const img = this.add.image(x, y, 'shaft').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    img.setDisplaySize(w * 1.4, F - y).setRotation(-lean).setAlpha(0.7);
    layer.add(img);
  }

  private decorGround(R: Record<string, Phaser.GameObjects.Graphics>, layer: Phaser.GameObjects.Container) {
    // Study: the window, a desk, the fireplace and my clock
    let g = R.study;
    this.skyWindow(0, WINDOW_X - 90, 120, 180, 240);
    this.shaft(layer, WINDOW_X, 372, 180);
    drawFireplace(g, 1490, 230, 280);
    drawDesk(g, 820, 360);
    paintRect(g, 580, F - 106, 80, 12, PAL.plumWood); // side table
    paintRect(g, 614, F - 94, 12, 94, PAL.plumWood);
    drawChandelier(g, 640);
    drawChandelier(g, 1150);
    drawGrandfatherClock(this, CLOCK_X, layer);
    // the body on its red rug, and the spilled tea: kept in colour
    const body = this.add.graphics().setDepth(16);
    drawBody(body, BODY_X, floorTop(0) + F - 4);
    const tea = this.add.graphics().setDepth(16);
    tea.fillStyle(0x3a1612, 0.75);
    tea.fillEllipse(960, floorTop(0) + F - 121, 46, 7);
    tea.fillCircle(985, floorTop(0) + F - 119, 3);
    // the body lies half in shadow: a soft darkness over the head end of the rug
    const shade = this.add.image(BODY_X - 70, floorTop(0) + F - 10, 'glow').setTint(0x000000).setScale(3.2, 1.3).setAlpha(0.75).setDepth(17);
    body.setAlpha(0.85);
    this.accent.keep(body, tea, shade);
    g.fillStyle(0xeeeeea, 0.9);
    g.fillRect(598, F - 116, 44, 10); // the household log
    drawTeacup(g, 930, F - 121);

    // Hallway: portraits, a panelled door, and the staircase rising through the ceiling
    g = R.hallway;
    drawDoor(g, 1830);
    [1990, 2250, 3200].forEach((x) => drawPortrait(g, x, 250));
    drawChandelier(g, 2250);
    drawGrandfatherClock(this, 2620, layer);
    for (let s = 0; s < 12; s++) {
      const sx = STAIRS_X - 140 + s * 30;
      const sy = F - (s + 1) * 51;
      paintRect(g, sx, sy, 400 - s * 30, 51, PAL.wood);
      g.lineStyle(3, PAL.edge, 0.6);
      g.lineBetween(sx, sy + 1, sx + 400 - s * 30, sy + 1); // pale nosing on each tread
    }
    g.lineStyle(7, PAL.maroon, 1);
    g.lineBetween(STAIRS_X - 140, F - 120, STAIRS_X + 220, F - 120 - 12 * 51); // banister
    g.lineStyle(2, 0xc77a8f, 0.6);
    g.lineBetween(STAIRS_X - 140, F - 124, STAIRS_X + 220, F - 124 - 12 * 51);
    g.lineStyle(4, PAL.maroon, 1);
    for (let s = 0; s < 12; s += 2) g.lineBetween(STAIRS_X - 130 + s * 30, F - (s + 1) * 51, STAIRS_X - 130 + s * 30, F - (s + 1) * 51 - 70);
    paintRect(g, STAIRS_X - 156, F - 150, 18, 150, PAL.maroon); // newel post
    layer.add(cobweb(this, STAIRS_X + 60, 40, 1.4, false, 0.5));

    // Dining room: a long table before a second fireplace
    g = R.dining;
    this.skyWindow(0, 3600, 130, 160, 230);
    this.shaft(layer, 3680, 372, 160);
    drawPortrait(g, 4300, 230);
    drawChandelier(g, 4300);
    [4060, 4160, 4440, 4540].forEach((x) => {
      paintRect(g, x - 5, F - 150, 10, 150, PAL.plumWood); // chair backs
      paintRect(g, x - 20, F - 64, 40, 10, PAL.plumWood);
    });

    // Conservatory: tall windows, plants, a potting bench
    g = R.conservatory;
    for (let i = 0; i < 4; i++) {
      this.skyWindow(0, 5180 + i * 400, 70, 260, 330);
      this.shaft(layer, 5310 + i * 400, 412, 260, 0.08);
    }
    drawPlant(g, 5530, 1.0);
    drawPlant(g, 6080, 0.9);
    drawPlant(g, 6650, 1.3);
    paintRect(g, 5950, F - 90, 230, 14, PAL.woodDark); // potting bench
    paintRect(g, 5960, F - 76, 12, 76, PAL.woodDark);
    paintRect(g, 6160, F - 76, 12, 76, PAL.woodDark);

    // Office
    g = R.office;
    this.skyWindow(0, 7700, 140, 170, 210);
    this.shaft(layer, 7785, 362, 170);
    drawBookshelf(g, 7880, 140, 330);
    drawGrandfatherClock(this, 7250, layer);
    drawChandelier(g, 7500);
  }

  private decorUpstairs(R: Record<string, Phaser.GameObjects.Graphics>, layer: Phaser.GameObjects.Container) {
    // Clara's room
    let g = R.clara;
    this.skyWindow(1, 1420, 130, 140, 190);
    this.shaft(layer, 1490, 332, 140);
    paintRect(g, 1790, F - 72, 170, 52, PAL.maroon, { radius: 8 }); // bed
    paintRect(g, 1790, F - 130, 14, 130, PAL.plumWood);
    paintRect(g, 1946, F - 100, 14, 100, PAL.plumWood);
    paintRect(g, 1806, F - 88, 60, 20, 0xc9b9c9, { radius: 8 }); // pillow
    // the landing: the stairwell going down, behind a maroon banister
    g = R.landing;
    g.fillStyle(0x0b1120, 1);
    g.fillRect(STAIRS_X - 160, F - 6, 330, FLOOR_H - F + 6);
    for (let s = 0; s < 4; s++) paintRect(g, STAIRS_X - 160 + s * 40, F + s * 26, 330 - s * 40, 26, PAL.wood);
    g.lineStyle(7, PAL.maroon, 1);
    g.lineBetween(STAIRS_X - 170, F - 80, STAIRS_X + 180, F - 80);
    g.lineStyle(4, PAL.maroon, 1);
    for (let x = STAIRS_X - 170; x <= STAIRS_X + 180; x += 35) g.lineBetween(x, F - 80, x, F);
    drawPortrait(g, 2560, 240);
    drawGrandfatherClock(this, 2370, layer);
    drawChandelier(g, 2900);
    // Library
    g = R.library;
    drawBookshelf(g, 3600, 150, 380);
    drawBookshelf(g, 3990, 260, 380);
    drawBookshelf(g, 4800, 220, 380);
    paintRect(g, 4280, F - 120, 110, 120, PAL.velvet, { radius: 30 }); // armchair
    drawChandelier(g, 4300);
    // Box room
    g = R.boxroom;
    this.skyWindow(1, 5700, 160, 120, 160);
    this.shaft(layer, 5760, 332, 120);
    paintRect(g, 5180, F - 90, 110, 90, PAL.plumWood); // crates
    paintRect(g, 5200, F - 160, 80, 70, PAL.plumWood);
    paintRect(g, 6230, F - 120, 120, 120, PAL.plumWood);
    g.fillStyle(0x7d90ab, 1);
    g.fillTriangle(5800, F, 5870, F - 140, 5940, F); // something under a dust sheet
    g.lineStyle(2, PAL.ink, 0.6);
    g.strokeTriangle(5800, F, 5870, F - 140, 5940, F);
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
          paintRect(g, def.x - w / 2 - 12, base - 86, 12, 86, PAL.woodDark);
          paintRect(g, def.x + w / 2, base - 86, 12, 86, PAL.woodDark);
          paintRect(g, def.x - w / 2, base - 86, w, 52, PAL.wood);
          paintRect(g, def.x - w / 2 - 20, base - 100, w + 40, 14, PAL.wood);
        }
        g.fillStyle(0x0b1120, 1);
        g.fillRect(def.x - w / 2 + 8, base - 82, w - 16, h);
        const front = this.add.rectangle(def.x, base - 82 + h / 2, w - 16, h, 0x3c5578).setStrokeStyle(2, PAL.edge, 0.55).setDepth(19);
        const knob = this.add.circle(def.x, base - 82 + h / 2, 4, PAL.brass).setDepth(19);
        p.hotY = base - 100;
        p.open = (instant) => {
          if (p.opened) return;
          p.opened = true;
          if (instant) [front, knob].forEach((o) => (o.y += h + 6));
          else this.tweens.add({ targets: [front, knob], y: `+=${h + 6}`, duration: 450, ease: 'Back.easeOut' });
        };
      } else if (def.kind === 'cabinet') {
        const g = this.add.graphics().setDepth(18);
        paintRect(g, def.x - w / 2 - 6, base - h - 8, w + 12, h + 8, PAL.woodDark);
        g.fillStyle(0x0b1120, 1);
        g.fillRect(def.x - w / 2, base - h, w, h - 4);
        const door = this.add
          .rectangle(def.x - w / 2, base - h / 2 - 2, w, h - 4, 0x34496c)
          .setOrigin(0, 0.5)
          .setStrokeStyle(2, PAL.edge, 0.55)
          .setDepth(19);
        const knob = this.add.circle(def.x + w / 2 - 14, base - h / 2, 4, PAL.brass).setDepth(19);
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
        p.spark = this.add.image(def.x, p.hotY, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setAlpha(0.25).setTint(0xffcf6a);
        this.accent.keep(p.spark);
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
    this.accent.keep(this.bodyMarker);
  }

  /** Silhouettes for things the ghost can push aside, with whatever hides beneath drawn first. */
  private drawMovable(def: Searchable, obj: Phaser.GameObjects.Container, w: number, h: number) {
    const base = floorTop(def.floor) + F;
    const under = this.add.graphics().setDepth(17);
    const g = this.add.graphics();
    obj.add(g);
    g.fillStyle(PAL.wood, 1);
    switch (def.id) {
      case 'chair':
        g.fillStyle(PAL.plumWood, 1);
        under.fillStyle(0xdfe8ff, 1);
        under.fillCircle(def.x + 6, base - 6, 4); // the cufflink
        g.fillRect(-w / 2, -h, 10, h);
        g.fillRect(-w / 2, -52, w, 10);
        g.fillRect(w / 2 - 8, -52, 8, 52);
        break;
      case 'fern':
        under.fillStyle(0x3a2a1a, 1);
        under.fillEllipse(def.x - 10, base - 6, 30, 12); // the boot print
        under.fillEllipse(def.x + 32, base - 9, 30, 12);
        g.fillStyle(PAL.leaf, 1);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.33;
          g.fillTriangle(-6, -h, 6, -h, Math.cos(a) * 130, -h + Math.sin(a) * 130);
        }
        g.lineStyle(2, PAL.leafLight, 0.7);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.33;
          g.lineBetween(0, -h, Math.cos(a) * 70, -h + Math.sin(a) * 70);
        }
        paintRect(g, -w / 2, -h, w, h, PAL.plum, { radius: 6 });
        break;
      case 'cans':
        g.fillStyle(0x5a6a7a, 1);
        g.fillRoundedRect(-w / 2, -h, 36, h, 6);
        g.fillRoundedRect(-w / 2 + 42, -h + 14, 34, h - 14, 6);
        g.fillTriangle(-w / 2 + 36, -h + 20, -w / 2 + 36, -h + 30, -w / 2 + 60, -h - 6);
        break;
      case 'coats':
        g.fillStyle(PAL.woodDark, 1);
        g.fillRect(-4, -h, 8, h);
        g.fillEllipse(0, -4, 50, 10);
        g.fillStyle(PAL.plum, 1);
        g.fillEllipse(-14, -h + 50, 46, 110);
        g.fillStyle(0x3d4f6e, 1);
        g.fillEllipse(16, -h + 60, 40, 120);
        g.lineStyle(2, PAL.edge, 0.4);
        g.strokeEllipse(-14, -h + 50, 46, 110);
        g.strokeEllipse(16, -h + 60, 40, 120);
        g.fillStyle(PAL.maroon, 1);
        g.fillEllipse(0, -h + 2, 40, 12); // a hat on the peg
        g.fillRect(-12, -h - 14, 24, 14);
        break;
      case 'tablecloth': {
        g.fillStyle(PAL.plumWood, 1);
        g.fillRect(-w / 2, -h - 8, w, 12);
        g.fillRect(-w / 2 + 10, -h, 10, h);
        g.fillRect(w / 2 - 20, -h, 10, h);
        const cloth = this.add.rectangle(0, -h + 2, w + 10, h - 20, 0x6a2a3d).setOrigin(0.5, 0).setStrokeStyle(2, PAL.edge, 0.35);
        cloth.setName('cloth');
        obj.add(cloth);
        break;
      }
      case 'hollow-book':
        paintRect(under, def.x - 70, base - 240, 140, 240, PAL.wood);
        under.fillStyle(0x0b1120, 1);
        under.fillRect(def.x - 62, base - 232, 124, 54);
        under.fillRect(def.x - 62, base - 160, 124, 54);
        const spines = [PAL.plum, 0x3f6f6a, PAL.brassDark, 0x4a5f8a, PAL.maroon, 0x5a6a7a];
        for (let i = 0; i < 6; i++) {
          under.fillStyle(spines[i], 1);
          under.fillRect(def.x - 60 + i * 20, base - 226, 15, 48);
          under.fillStyle(spines[(i + 3) % 6], 1);
          under.fillRect(def.x - 60 + i * 20, base - 152, 15, 46);
        }
        obj.setY(base - 120);
        g.fillStyle(PAL.maroon, 1);
        g.fillRect(-12, -h, 24, h);
        g.lineStyle(1, PAL.edge, 0.5);
        g.strokeRect(-12, -h, 24, h);
        break;
      case 'hatboxes':
        g.fillStyle(PAL.plum, 1);
        g.fillEllipse(0, -20, w, 40);
        g.fillEllipse(0, -55, w - 14, 36);
        g.fillEllipse(0, -88, w - 28, 32);
        break;
      default:
        g.fillRect(-w / 2, -h, w, h);
    }
  }

  private buildForeground() {
    // near layer (fast horizontal parallax): heavy velvet curtains and blurred furniture passing in front.
    // Each curtain is its own small drawing so the ones off screen can be skipped.
    for (let x = 0; x < WORLD_W * 1.25 + W; x += 1100) {
      const fg = this.add.graphics().setScrollFactor(1.25, 1).setDepth(80).setPosition(x, 0);
      this.parallaxCull.push({ o: fg, x: x - 40, w: 760, factor: 1.25 });
      for (const top of [0, FLOOR_H]) {
        // a curtain gathered at the top, folds picked out with lighter strokes
        fg.fillStyle(0x020202, 0.96);
        fg.beginPath();
        fg.moveTo(-40, top);
        fg.lineTo(150, top);
        fg.lineTo(70, top + 260);
        fg.lineTo(60, top + FLOOR_H);
        fg.lineTo(-40, top + FLOOR_H);
        fg.closePath();
        fg.fillPath();
        fg.lineStyle(3, 0x3a4a78, 0.55);
        for (const dx of [-10, 15, 40]) fg.lineBetween(dx + 40, top + 10, dx, top + FLOOR_H);
        fg.fillStyle(PAL.maroon, 0.85); // a tie-back
        fg.fillRoundedRect(40, top + 250, 46, 16, 6);
        fg.fillStyle(0x0d1428, 0.7);
        fg.fillEllipse(500, top + FLOOR_H + 10, 420, 110);
      }
    }
  }

}

/** The teacup (blue willow) on its saucer, side on, standing on a surface at y. */
function drawTeacup(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  const china = 0xdfe8ff;
  // the saucer
  g.fillStyle(0x9fb0cc, 0.9);
  g.fillEllipse(x, y - 1, 40, 6);
  g.fillStyle(china, 0.95);
  g.fillEllipse(x, y - 2.5, 36, 4);
  // the handle, a loop on the right
  g.lineStyle(2.5, china, 0.95);
  g.beginPath();
  g.arc(x + 11, y - 13, 5, -Math.PI / 2, Math.PI / 2, false);
  g.strokePath();
  // the bowl: wide at the rim, rounded into a small foot
  const top = y - 19;
  g.fillStyle(china, 0.95);
  g.beginPath();
  g.moveTo(x - 12, top);
  g.lineTo(x + 12, top);
  g.lineTo(x + 10, top + 8);
  g.lineTo(x + 6, top + 14);
  g.lineTo(x + 4, y - 4);
  g.lineTo(x - 4, y - 4);
  g.lineTo(x - 6, top + 14);
  g.lineTo(x - 10, top + 8);
  g.closePath();
  g.fillPath();
  // the blue willow band under the rim
  g.fillStyle(0x3b5a9a, 1);
  g.fillRect(x - 11, top + 3, 22, 2.5);
  // the rim, and the tea inside it
  g.fillStyle(0xf4f7ff, 1);
  g.fillEllipse(x, top, 24, 4);
  g.fillStyle(0x5a3a28, 1);
  g.fillEllipse(x, top + 0.5, 19, 2.5);
}
