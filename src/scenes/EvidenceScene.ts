import Phaser from 'phaser';
import { Button, DIM, fadeThen, fitCamera, hex, INK, overlayBackground, share, txt, W, GHOST_RES, ZOOM, mathText } from '../ui/widgets';
import { CLUES, Evidence, LOG_ROWS, PRIOR_SHEET, SUSPECTS } from '../data/case1';
import { GameState, StepRecord, truePrior } from '../state/GameState';
import { update } from '../bayes/engine';
import { drawSuspect } from './MemoryScene';
import { CONCEPTS, numberWord } from '../data/lessons';
import { BayesSquare } from '../ui/square';
import { Brace } from '../ui/brace';
import { KEEP_WORDS as KEEP, RATING_VALUES, RATING_WORDS, UNCHANGED, UPDATE_STEPS } from '../data/ui';
import { Sound } from '../audio/Sound';

type Kind = 'prior' | 'clue';

interface Step {
  /** Short name shown in the breadcrumb at the top. */
  crumb: string;
  build: () => void;
}

const GOLD = '#f2f2f2';
const CONTENT_Y = 128;
const NAV_Y = 668;

/**
 * The player's 1–5 rating of how well a clue fits a story. Behind the scenes each rating
 * is a likelihood; Level 1 never shows those numbers, Level 2 shows them as percentages,
 * Level 3 as probabilities.
 */
const RATINGS = RATING_WORDS.map((word, k) => ({ n: k + 1, word, v: RATING_VALUES[k] }));
const ratingOf = (v: number) => RATINGS.find((r) => Math.abs(r.v - v) < 1e-9)!;

/** Words for how much of a share a rating keeps. */
const KEEP_WORDS: Record<number, string> = Object.fromEntries(KEEP.map((w, k) => [k + 1, w]));

/**
 * A note or clue, examined one idea at a time:
 *   the clue (as found, with the ghost's reading) → a concept lesson (one new idea per clue)
 *   → a 1–5 rating per suspect (the ghost thinks out loud)
 *   → the update as a square of possible worlds, stepped through (before, shrink, together, stretch) → recap.
 * Words only, no numbers or formulas: those wait in "See the math" at the end.
 * The game follows only the player's choices.
 */
export class EvidenceScene extends Phaser.Scene {
  private kind: Kind = 'clue';
  private steps: Step[] = [];
  private index = 0;
  private page!: Phaser.GameObjects.Container;
  private crumbs: Phaser.GameObjects.Text[] = [];
  private nextBtn!: Button;
  private backBtn!: Button;
  private nextOverride?: () => void;
  private backOverride?: () => void;
  /** Which of the ghost's thoughts is showing on a page that has several. */
  private noteIdx = 0;
  /** True for one redraw after Next adds a thought, so only that bubble animates in. */
  private noteArrived = false;
  /** How far the stack of thoughts is scrolled (undefined: pinned to the newest). */
  private noteScroll?: number;
  /** Scrolls the stack of thoughts on this page, when it is taller than its space. */
  private noteScroller?: (dy: number) => void;
  /** A remembered moment chimes once per visit to its page. */
  private chimed = false;
  private closing = false;
  /** Once the update is applied to the board, earlier pages can no longer be revisited. */
  private committed = false;

  // working state for this examination
  private prior: number[] = [];
  /** The player's likelihood for each suspect (undefined until rated). */
  private picks: (number | undefined)[] = [];
  /** How many hours (between 6 and 10 pm) the player has lit for each suspect, on the log pages. */
  private hourPicks: number[] = [];
  private rec?: StepRecord;
  /** Which step of the update animation is showing (0–3). */
  private phase = 0;
  /** Where this clue's starting shares came from, in full and in a few words. */
  private fromLong = '';
  private fromShort = '';
  /** How many suspects' rating blocks are showing under the lesson (0 = the lesson alone). */
  private weighStage = 0;
  /** True for one redraw after a rating block is revealed, so it slides in and is scrolled to. */
  private weighArrived = false;
  /** After rating the last block, show the page's end (its "You rated it…" line). */
  private weighToEnd = false;
  /** On the lesson & ratings page: rate the suspect waiting for a rating (keys 1–5). */
  private ratingKey?: (n: number) => void;
  /** While set, put() adds to this container instead of the page (for scrolling content). */
  private putInto?: Phaser.GameObjects.Container;
  /** Which stage of the math page is showing: symbols, names, numbers, multiply, add, divide (0–5). */
  private mathStage = 0;
  /** The math stage just left, so the next one can transform out of it. */
  private mathFrom?: number;

  constructor() {
    super('Evidence');
  }

  init(data: { kind: Kind }) {
    this.kind = data.kind;
    this.index = 0;
    this.closing = false;
    this.committed = false;
    this.crumbs = [];
    this.picks = [];
    this.hourPicks = [];
    this.rec = undefined;
    this.nextOverride = undefined;
    this.backOverride = undefined;
    this.noteIdx = 0;
    this.noteArrived = false;
    this.noteScroll = undefined;
    this.noteScroller = undefined;
    this.chimed = false;
    this.phase = 0;
    this.mathStage = 0;
    this.weighStage = 0;
    this.weighArrived = false;
  }

  create() {
    fitCamera(this.cameras.main);
    overlayBackground(this);
    this.page = this.add.container();
    this.backBtn = new Button(this, 130, NAV_Y, '‹ Back', () => this.onBack(), { width: 180, height: 56, size: 22 });
    this.nextBtn = new Button(this, W - 150, NAV_Y, 'Next ›', () => this.onNext(), { width: 240, height: 60, size: 24 });
    this.input.keyboard?.on('keydown-RIGHT', () => this.nextBtn.alpha === 1 && this.onNext());
    this.input.keyboard?.on('keydown-LEFT', () => this.backBtn.visible && this.onBack());
    // scrolling a tall stack of thoughts: wheel, arrow keys, or dragging
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.noteScroller?.(dy * 0.6));
    this.input.keyboard?.on('keydown-UP', () => this.noteScroller?.(-60));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const d = Number(e.key);
      if (d >= 1 && d <= 5 && !e.repeat) this.ratingKey?.(d);
    });
    this.input.keyboard?.on('keydown-DOWN', () => this.noteScroller?.(60));
    let dragY: number | undefined;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (dragY = p.y));
    this.input.on('pointerup', () => (dragY = undefined));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === undefined || !p.isDown || !this.noteScroller) return;
      this.noteScroller((dragY - p.y) / ZOOM);
      dragY = p.y;
    });

    this.steps = this.kind === 'prior' ? this.priorSteps() : this.clueSteps();
    this.buildCrumbs();
    this.show();
    this.cameras.main.fadeIn(250);
  }

  // ================================================================== navigation

  private go(delta: number) {
    Sound.blip();
    if (delta > 0 && this.index === this.steps.length - 1) return this.close();
    const next = Phaser.Math.Clamp(this.index + delta, 0, this.steps.length - 1);
    if (next !== this.index && !this.committed) this.phase = 0;
    if (next !== this.index) {
      // arriving from behind shows a page's last thought; arriving fresh shows its first
      this.noteIdx = delta < 0 ? Number.MAX_SAFE_INTEGER : 0;
      this.noteScroll = undefined;
      this.mathStage = delta < 0 ? 5 : 0;
      this.weighStage = delta < 0 ? SUSPECTS.length : 0;
      this.chimed = false;
    }
    this.index = next;
    this.show();
  }

  /** Back steps through a page's thoughts first, then to the previous page. */
  private onBack() {
    if (this.backOverride) {
      const f = this.backOverride;
      this.backOverride = undefined;
      Sound.blip();
      f();
    } else this.go(-1);
  }

  /** The main button: a page-specific action if one is set, otherwise the next page. */
  private onNext() {
    if (this.nextOverride) {
      const f = this.nextOverride;
      this.nextOverride = undefined;
      f();
    } else this.go(1);
  }

  /** Redraws the current page. A soft redraw (a thought added or taken away) skips the fade. */
  private show(soft = false) {
    // cancel the previous page's pending animations before its objects are destroyed
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.page.list);
    this.page.list.forEach((o) => o instanceof Phaser.GameObjects.Container && this.tweens.killTweensOf(o.list));
    this.page.removeAll(true);
    this.noteScroller = undefined;
    this.ratingKey = undefined;
    this.page.setAlpha(soft ? 1 : 0);
    this.setNext('Next ›', true);
    this.backOverride = undefined;
    this.steps[this.index].build();
    this.backBtn.setVisible((this.index > 0 || !!this.backOverride) && !this.committed);
    if (this.index === this.steps.length - 1 && this.nextBtn.label.text.startsWith('Next')) {
      this.setNext('Continue ›', this.nextBtn.alpha === 1);
    }
    this.crumbs.forEach((c, i) => c.setColor(i === this.index ? GOLD : i < this.index ? '#aaaaaa' : '#555555'));
    if (!soft) this.tweens.add({ targets: this.page, alpha: 1, duration: 250 });
  }

  private setNext(label: string, enabled: boolean, onClick?: () => void) {
    this.nextBtn.label.setText(label);
    this.nextBtn.setEnabled(enabled);
    this.nextOverride = onClick;
  }

  private buildCrumbs() {
    const labels = this.steps.map((s) => s.crumb);
    const sep = '  ›  ';
    const probe = txt(this, 0, 0, labels.join(sep), 16);
    let x = W / 2 - probe.width / 2;
    probe.destroy();
    labels.forEach((l, i) => {
      const t = txt(this, x, 82, l, 16, '#555555');
      this.crumbs.push(t);
      x += t.width;
      if (i < labels.length - 1) x += txt(this, x, 82, sep, 16, '#3a3a3a').width;
    });
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    fadeThen(this, 200, () => {
      this.scene.stop();
      this.scene.resume('World', { from: 'evidence' });
    });
  }

  // ================================================================== page helpers

  private put<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (this.putInto ?? this.page).add(o);
    return o;
  }

  private title(s: string) {
    this.put(txt(this, W / 2, 26, s, 32, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
  }

  private para(x: number, y: number, s: string, size = 24, color = INK, width = 1000, origin = 0) {
    return this.put(
      txt(this, x, y, s, size, color, { wordWrap: { width }, lineSpacing: 6, align: origin ? 'center' : 'left' }).setOrigin(origin, 0),
    );
  }

  private evidenceCard(y: number, heading: string, doc: Evidence, found?: string): number {
    const w = 1010;
    const pad = 30;
    const x0 = W / 2 - w / 2;
    if (found) {
      const cap = this.put(txt(this, x0 + 4, y, found, 18, '#9a9a9a', { fontStyle: 'italic', wordWrap: { width: w } }));
      y += cap.height + 12;
    }
    const card = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    card.add(bg);
    card.add(txt(this, x0 + pad, y + 16, `EVIDENCE  \u00B7  ${heading.toUpperCase()}`, 15, '#6a6a6a', { fontStyle: 'bold' }));
    let cy = y + 46;
    const ink = '#111111';
    const add = (t: Phaser.GameObjects.Text, gap = 6) => {
      card.add(t);
      cy += t.height + gap;
      return t;
    };
    if (doc.kind === 'letter') {
      add(txt(this, x0 + w - pad, cy, doc.date, 19, '#333333', { fontStyle: 'italic' }).setOrigin(1, 0), 2);
      doc.lines.forEach((l, k) =>
        add(txt(this, x0 + pad + (k ? 30 : 0), cy, l, k ? 27 : 23, ink, { fontStyle: 'italic', wordWrap: { width: w - pad * 2 - 30 } }), 8),
      );
      add(txt(this, x0 + w - pad - 40, cy, doc.sign, 25, ink, { fontStyle: 'italic' }).setOrigin(1, 0), 4);
    } else if (doc.kind === 'facts') {
      // the key column fits its longest label
      const keys = doc.rows.map(([k]) => txt(this, x0 + pad, cy, k, 20, '#3a3a3a', { fontStyle: 'bold' }));
      const kw = Math.max(190, ...keys.map((t) => t.width + 24));
      doc.rows.forEach(([, v], r) => {
        card.add(keys[r].setY(cy));
        add(txt(this, x0 + pad + kw, cy, v, 21, ink, { wordWrap: { width: w - pad * 2 - kw } }), 6);
      });
    } else {
      // column positions from relative widths (equal unless the document says otherwise)
      const weights = doc.widths ?? doc.columns.map(() => 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const colX: number[] = [];
      weights.reduce((acc, wt, k) => ((colX[k] = x0 + pad + ((w - pad * 2) * acc) / total), acc + wt), 0);
      doc.columns.forEach((c, k) => card.add(txt(this, colX[k], cy, c, 17, '#3a3a3a', { fontStyle: 'bold' })));
      cy += 26;
      bg.lineStyle(1, 0xb8b8b0, 1);
      bg.lineBetween(x0 + pad, cy - 4, x0 + w - pad, cy - 4);
      for (const r of doc.rows) {
        let h = 0;
        r.forEach((cell, k) => {
          const t = txt(this, colX[k], cy, cell, 20, ink);
          card.add(t);
          h = Math.max(h, t.height);
        });
        cy += h + 4;
      }
      if (doc.foot) add(txt(this, x0 + pad, cy + 4, doc.foot, 18, '#333333', { fontStyle: 'italic', wordWrap: { width: w - pad * 2 } }), 6);
    }
    const h = cy - y + pad - 12;
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(x0 + 6, y + 8, w, h, 6);
    bg.fillStyle(0xeeeeea, 0.97);
    bg.fillRoundedRect(x0, y, w, h, 6);
    bg.fillStyle(0xd6d6d0, 1);
    bg.fillTriangle(x0 + w - 34, y, x0 + w, y, x0 + w, y + 34);
    bg.lineStyle(1, 0xb8b8b0, 1);
    bg.strokeRoundedRect(x0, y, w, h, 6);
    card.sendToBack(bg);
    return y + h;
  }

  /**
   * The ghost's thoughts about a document, arriving one by one like messages: Next adds the
   * following thought under the ones before, Back takes the newest away. When the stack grows
   * taller than the space above the buttons it scrolls (mouse wheel, drag or the arrow keys),
   * always landing on the newest thought. A remembered moment is drawn in amber.
   */
  private ghostNotes(y: number, notes: { text: string; memory?: boolean }[]) {
    if (!notes.length) return;
    const k = Math.min(this.noteIdx, notes.length - 1);
    this.noteIdx = k;
    const arrived = this.noteArrived;
    this.noteArrived = false;

    const viewTop = y;
    const viewBottom = NAV_Y - 50;
    const viewH = viewBottom - viewTop;
    const stack = this.put(this.add.container(0, 0));
    let bottom = viewTop;
    let newest!: Phaser.GameObjects.Container;
    let prevBottom = viewTop;
    for (let i = 0; i <= k; i++) {
      prevBottom = bottom;
      const bubble = this.add.container(0, 0);
      stack.add(bubble);
      bottom = this.ghostNote(bubble, i === 0 ? bottom : bottom + 14, notes[i].text, notes[i].memory, i === k);
      newest = bubble;
    }
    const n = notes[k];
    if (n.memory && !this.chimed) {
      this.chimed = true;
      Sound.toll();
    }

    // scrolling: the stack is clipped to the space between the card and the buttons
    const contentH = bottom - viewTop;
    const minOff = Math.min(0, viewH - contentH);
    if (minOff < 0) {
      const maskShape = this.make.graphics({}, false);
      maskShape.fillStyle(0xffffff).fillRect(0, viewTop - 6, W, viewH + 12);
      stack.setMask(maskShape.createGeometryMask());
      // soft edges where thoughts slide out of view, and a small arrow beside the stack
      const band = 26;
      const fadeTop = this.put(this.add.graphics());
      fadeTop.fillGradientStyle(0x060606, 0x060606, 0x060606, 0x060606, 1, 1, 0, 0);
      fadeTop.fillRect(24, viewTop - 6, W - 48, band);
      const fadeBottom = this.put(this.add.graphics());
      fadeBottom.fillGradientStyle(0x060606, 0x060606, 0x060606, 0x060606, 0, 0, 1, 1);
      fadeBottom.fillRect(24, viewBottom + 6 - band, W - 48, band);
      const arrowX = W / 2 + 530;
      const upArrow = this.put(txt(this, arrowX, viewTop + 4, '\u02c4', 26, '#8a8a8a').setOrigin(0.5, 0));
      const downArrow = this.put(txt(this, arrowX, viewBottom - 4, '\u02c5', 26, '#8a8a8a').setOrigin(0.5, 1));
      const scrollTo = (off: number) => {
        this.noteScroll = Phaser.Math.Clamp(off, minOff, 0);
        stack.y = this.noteScroll;
        fadeTop.setVisible(this.noteScroll < 0);
        upArrow.setVisible(this.noteScroll < 0);
        fadeBottom.setVisible(this.noteScroll > minOff + 0.5);
        downArrow.setVisible(this.noteScroll > minOff + 0.5);
      };
      scrollTo(arrived || this.noteScroll === undefined ? minOff : this.noteScroll);
      if (arrived) {
        // glide up to make room for the new thought
        stack.y = Math.min(0, minOff + (bottom - prevBottom));
        this.tweens.add({ targets: stack, y: minOff, duration: 260, ease: 'Sine.easeOut', onComplete: () => scrollTo(minOff) });
      }
      this.noteScroller = (dy: number) => scrollTo(this.noteScroll! - dy);
    } else {
      this.noteScroll = undefined;
      this.noteScroller = undefined;
    }

    if (arrived) {
      newest.setAlpha(0);
      newest.y = 14;
      this.tweens.add({ targets: newest, alpha: 1, y: 0, duration: 260, ease: 'Sine.easeOut' });
    }

    if (k < notes.length - 1)
      this.setNext('Next ›', true, () => {
        this.noteIdx = k + 1;
        this.noteArrived = true;
        this.noteScroll = undefined;
        this.show(true);
      });
    if (k > 0)
      this.backOverride = () => {
        this.noteIdx = k - 1;
        this.noteScroll = undefined;
        this.show(true);
      };
  }

  /** One thought bubble. Only the newest carries the ghost beside it, as in a message thread. */
  private ghostNote(into: Phaser.GameObjects.Container, y: number, text: string, memory = false, avatar = true): number {
    const w = 900;
    const x0 = W / 2 - w / 2 + 50;
    const bg = this.add.graphics();
    into.add(bg);
    const top = memory ? 30 : 16;
    if (memory) into.add(txt(this, x0 + 24, y + 10, '\u2014 a memory returns \u2014', 15, '#d9b98a', { fontStyle: 'italic' }));
    const t = txt(this, x0 + 24, y + top, text.replace(/\*/g, ''), 22, memory ? '#f3e2c4' : '#dcdcdc', {
      fontStyle: 'italic',
      wordWrap: { width: w - 48 },
      lineSpacing: 5,
    });
    into.add(t);
    const h = t.height + top + 16;
    bg.fillStyle(memory ? 0x2a1d10 : 0x101010, 0.92);
    bg.lineStyle(2, memory ? 0xd9b98a : 0xd0d0d0, memory ? 0.7 : 0.45);
    bg.fillRoundedRect(x0, y, w, h, 18);
    bg.strokeRoundedRect(x0, y, w, h, 18);
    if (avatar) {
      const glow = this.add.image(x0 - 52, y + h / 2, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      const ghost = this.add.image(x0 - 52, y + h / 2, 'ghost').setScale(0.42 / GHOST_RES);
      into.add([glow, ghost]);
      bg.fillCircle(x0 - 14, y + h / 2 + 4, 6);
      bg.strokeCircle(x0 - 14, y + h / 2 + 4, 6);
    }
    return y + h;
  }

  /** A compact ghost thought for the right-hand column. */
  private ghostHint(x: number, y: number, text: string): number {
    const w = 760;
    const note = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    note.add(bg);
    const t = txt(this, x + 56, y + 12, text, 19, '#dcdcdc', { fontStyle: 'italic', wordWrap: { width: w - 76 }, lineSpacing: 4 });
    note.add(t);
    const h = Math.max(t.height + 24, 56);
    bg.fillStyle(0x101010, 0.9);
    bg.lineStyle(2, 0xd0d0d0, 0.4);
    bg.fillRoundedRect(x, y, w, h, 14);
    bg.strokeRoundedRect(x, y, w, h, 14);
    note.add(this.add.image(x + 28, y + h / 2, 'ghost').setScale(0.3 / GHOST_RES));
    return y + h;
  }


  /** Silhouette and name on the left of a one-suspect page. */
  private suspectPortrait(i: number) {
    const s = SUSPECTS[i];
    this.put(drawSuspect(this, 225, 360, i, 0.72));
    this.put(txt(this, 225, 520, s.name, 30, hex(s.color), { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.put(txt(this, 225, 558, s.role, 19, DIM, { fontStyle: 'italic' }).setOrigin(0.5, 0));
  }

  // ================================================================== the household log (prior)

  private priorSteps(): Step[] {
    const truth = truePrior();
    const steps: Step[] = [
      {
        crumb: 'The log',
        build: () => {
          this.title(PRIOR_SHEET.title);
          const bottom = this.evidenceCard(
            CONTENT_Y + 6,
            'the household log, tonight (6 – 10 pm)',
            { kind: 'table', columns: ['Name', 'Signed in', 'Signed out'], rows: LOG_ROWS, widths: [1.4, 1, 1] },
            'I found the household log on the side table in the study, where it always lies.',
          );
          this.ghostNotes(bottom + 22, [{ text: PRIOR_SHEET.text }, { text: PRIOR_SHEET.context }]);
        },
      },
    ];
    SUSPECTS.forEach((s, i) =>
      steps.push({
        crumb: s.name,
        build: () => this.hoursPage(i),
      }),
    );
    steps.push({
      crumb: 'Start',
      build: () => {
        this.title('Where my suspicion starts');
        // set a little lower so the page sits in the middle of the screen
        this.para(W / 2, CONTENT_Y + 75, PRIOR_SHEET.lesson, 23, '#dcdcdc', 1000, 0.5);
        this.blocksToBar(CONTENT_Y + 175, 'Before any clue:');
        this.commitPrior(truth);
      },
    });
    return steps;
  }

  /**
   * The hour blocks from the log pages come together into the starting bar: each suspect's
   * row of blocks, then one row of every hour anyone spent inside, then the gaps close and
   * the row becomes the shared bar of suspicion.
   */
  private blocksToBar(y: number, label: string) {
    const BW = 160;
    const GAP = 12;
    const BH = 64;
    const total = PRIOR_SHEET.total;
    const barW = 820;
    const barH = 28;
    const barX = W / 2 - barW / 2;
    const barY = y + 104;
    const rowX = W / 2 - (total * (BW + GAP) - GAP) / 2;
    const unit = barW / total;

    const caption = this.put(txt(this, W / 2, y, label, 18, DIM).setOrigin(0.5, 0).setAlpha(0));
    const blocks: { r: Phaser.GameObjects.Rectangle; t: Phaser.GameObjects.Text; slot: number }[] = [];
    const names: Phaser.GameObjects.Text[] = [];
    let slot = 0;
    SUSPECTS.forEach((s, i) => {
      const rowY = barY + 20 + i * 92;
      names.push(this.put(txt(this, rowX - 18, rowY, s.name, 20, hex(s.color)).setOrigin(1, 0.5)));
      for (let h = 1; h <= s.hoursInside; h++) {
        const x = rowX + (h - 1) * (BW + GAP);
        const r = this.put(this.add.rectangle(x, rowY, BW, BH, s.color, 0.95).setOrigin(0, 0.5));
        r.setStrokeStyle(2, s.color, 1);
        const t = this.put(txt(this, x + BW / 2, rowY, h === 1 ? '1 hour' : `${h} hours`, 20, '#111111').setOrigin(0.5));
        blocks.push({ r, t, slot: slot++ });
      }
    });

    // 1. the rows join into one row of every hour spent inside
    blocks.forEach(({ r, t, slot: k }) => {
      const x = rowX + k * (BW + GAP);
      this.tweens.add({ targets: r, x, y: barY, duration: 700, delay: 900, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: t, x: x + BW / 2, y: barY, duration: 700, delay: 900, ease: 'Sine.easeInOut' });
      // 2. the labels go, the gaps close, and the row settles into the bar
      this.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 1900 });
      this.tweens.add({
        targets: r,
        x: barX + k * unit,
        width: unit,
        height: barH,
        duration: 700,
        delay: 2100,
        ease: 'Sine.easeInOut',
        onUpdate: () => r.setSize(r.width, r.height).setStrokeStyle(),
      });
    });
    this.tweens.add({ targets: names, alpha: 0, duration: 400, delay: 800 });

    // 3. the bar's outline, the caption, and each share beneath it
    const outline = this.put(this.add.rectangle(barX, barY, barW, barH).setOrigin(0, 0.5).setStrokeStyle(1, 0x666666).setAlpha(0));
    const after: Phaser.GameObjects.GameObject[] = [outline, caption];
    // faint seams where the hour blocks met
    const seams = this.put(this.add.graphics().setAlpha(0));
    seams.lineStyle(1, 0x060606, 0.45);
    // short ticks at the top and bottom edges, so a seam never runs through a number
    for (let k = 1; k < total; k++) {
      seams.lineBetween(barX + k * unit, barY - barH / 2, barX + k * unit, barY - barH / 2 + 7);
      seams.lineBetween(barX + k * unit, barY + barH / 2 - 7, barX + k * unit, barY + barH / 2);
    }
    after.push(seams);
    let x = barX;
    SUSPECTS.forEach((s) => {
      const w = unit * s.hoursInside;
      const cx = x + w / 2;
      // the name over a brace that grows out from the middle of the share to its edges
      const brace = this.put(new Brace(this, cx, cx, barY - 18, -1, s.color, 10));
      const name = this.put(txt(this, cx, barY - 32, s.name, 20, hex(s.color)).setOrigin(0.5, 1).setAlpha(0));
      after.push(name);
      brace.setSpan(x + 3, x + w - 3, true, 700, 2900);
      after.push(
        this.put(
          mathText(this, cx, barY + 50, [{ n: `${s.hoursInside} hours`, d: `${total} hours` }, ` = ${share(s.hoursInside / total)}`], 18, '#a8a8a8', {
            originX: 0.5,
          }).setAlpha(0),
        ),
      );
      after.push(
        this.put(txt(this, cx, barY, share(s.hoursInside / total), 18, '#111111', { fontStyle: 'bold' })
          .setOrigin(0.5)
          .setAlpha(0)),
      );
      x += w;
    });
    // the rule that turns hours into shares
    after.push(
      this.put(
        mathText(this, W / 2, barY + 118, ['Starting share = ', { n: 'hours inside', d: 'all hours inside' }], 19, '#c9c9c9', {
          italic: true,
          originX: 0.5,
        }).setAlpha(0),
      ),
    );
    this.tweens.add({ targets: after, alpha: 1, duration: 500, delay: 2900 });
  }

  private commitPrior(p: number[]) {
    if (!this.committed) {
      GameState.setPrior(p);
      this.committed = true;
    }
  }

  /**
   * The player reads the log and lights each hour, 6 to 10 pm, that this person was in the
   * house. Once the right hours are lit, the page shows their share of all the time inside.
   */
  private hoursPage(i: number) {
    const s = SUSPECTS[i];
    const clock = (t: string) => {
      const m = t.match(/(\d+):(\d+)\s*pm/)!;
      return (+m[1] % 12) + 12 + +m[2] / 60;
    };
    // only the hours between 6 and 10 pm count
    const truth = Math.round(Math.max(0, Math.min(clock(s.logOut), 22) - Math.max(clock(s.logIn), 18)));
    const count = this.hourPicks[i] ?? 0;
    const solved = count === truth;
    const they = s.pronoun === 'she' ? 'she' : 'he';

    this.title(PRIOR_SHEET.title);
    // the question and the blocks sit level with the silhouette, in the middle of the page
    const TOP = CONTENT_Y + 110;
    this.suspectPortrait(i);
    this.para(470, TOP, solved ? `${s.name} was inside for ${s.hoursInside} hours.` : `How long was ${s.name} inside?`, 30, hex(s.color), 760);
    this.para(
      470,
      TOP + 54,
      `The log says ${s.name} signed in at ${s.logIn} and out at ${s.logOut}. How many hours between 6 and 10 pm was ${they} in the house?`,
      20,
      DIM,
      760,
    );
    // one block per hour: choosing a block lights it and every block to its left
    [1, 2, 3, 4].forEach((hours, k) => {
      const x = 470 + k * 172;
      const y = TOP + 170;
      const on = hours <= count;
      const r = this.put(this.add.rectangle(x, y, 160, 64, on ? s.color : 0x161616, on ? 0.95 : 1).setOrigin(0, 0.5));
      r.setStrokeStyle(2, on ? s.color : 0x5a5a5a, 1);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerup', () => {
        if (this.committed) return;
        // choosing the last lit block again turns it off
        this.hourPicks[i] = count === hours ? hours - 1 : hours;
        Sound.blip();
        this.show();
      });
      this.put(txt(this, x + 80, y, hours === 1 ? '1 hour' : `${hours} hours`, 20, on ? '#111111' : '#bdbdbd').setOrigin(0.5));
    });
    // once right, the page just confirms it; the share itself is shown on the next page
    if (solved) {
      return;
    }
    if (count > 0)
      this.para(470, TOP + 242, `Not quite. Check the times again: in at ${s.logIn}, out at ${s.logOut}, and only the hours between 6 and 10 pm count.`, 20, '#d8b0b0', 760);
    this.setNext('Next ›', false);
  }

  // ================================================================== a clue

  /**
   * Where the shares going into clue k came from, so every page that shows them can say:
   * the household log for the first clue, and after that the new shares the clue before produced.
   */
  private describeSource(k: number) {
    const now = SUSPECTS.map((s, i) => `${s.name} ${share(this.prior[i])}`).join(', ');
    if (k <= 0) {
      const hours = SUSPECTS.map((s) => `${s.name} ${s.hoursInside} of ${PRIOR_SHEET.total}`).join(', ');
      this.fromShort = 'from the household log';
      this.fromLong = `These shares come from the household log, the hours each person was inside (${hours}): ${now}.`;
      return;
    }
    const prev = CLUES[k - 1];
    this.fromShort = `the new shares from Clue ${k}, ${prev.title}`;
    this.fromLong = `These shares are the new shares worked out at the last clue, ${prev.title}: ${now}. What came out of that clue goes into this one.`;
  }

  private clueSteps(): Step[] {
    const clue = CLUES[GameState.data.found];
    this.prior = GameState.data.belief.slice();
    this.describeSource(GameState.data.found);
    const head = `Clue ${GameState.data.found + 1} of ${CLUES.length}: ${clue.title}`;

    const steps: Step[] = [
      {
        crumb: 'The clue',
        build: () => {
          this.title(head);
          const bottom = this.evidenceCard(CONTENT_Y + 4, clue.title, clue.evidence, clue.found);
          this.ghostNotes(bottom + 22, [
            ...(clue.memory ? [{ text: clue.memory, memory: true }] : []),
            ...clue.context.map((text) => ({ text })),
          ]);
        },
      },
      { crumb: 'Lesson & ratings', build: () => this.weighPage(clue, head) },
    ];
    steps.push({ crumb: 'Update', build: () => this.updatePage(head) });
    steps.push({ crumb: 'The math', build: () => this.mathPage(head, clue) });
    steps.push({ crumb: 'Recap', build: () => this.recapPage(head, clue) });
    return steps;
  }

  /**
   * The lesson and the ratings on one page that builds up as the player goes: the lesson
   * first; Next (or →) brings in the first suspect's question underneath; rating them brings
   * in the next suspect's. Everything stays on the page and scrolls when it grows taller
   * than the space above the buttons.
   */
  private weighPage(clue: (typeof CLUES)[number], head: string) {
    this.title(head);
    const n = SUSPECTS.length;
    const stage = Math.min(this.weighStage, n);
    const arrived = this.weighArrived;
    this.weighArrived = false;
    const reveal = () => {
      this.weighStage = stage + 1;
      this.weighArrived = true;
      this.noteScroll = undefined;
      Sound.blip();
      this.show(true);
    };

    const viewTop = CONTENT_Y - 8;
    const viewBottom = NAV_Y - 50;
    const box = this.put(this.add.container(0, 0));
    this.putInto = box;
    const X = 260;
    const WIDTH = 760;

    // the lesson
    const k = Math.min(GameState.data.found, CONCEPTS.length - 1);
    const c = CONCEPTS[k];
    const lt = this.put(txt(this, W / 2, CONTENT_Y + 2, `Lesson ${k + 1}: ${c.title}`, 28, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const body = this.para(W / 2, lt.y + lt.height + 14, c.body, 23, INK, 1000, 0.5);
    let y = body.y + body.height;

    // one block per suspect revealed so far
    const buttons: Button[] = [];
    let newestFrom = box.list.length;
    for (let i = 0; i < stage; i++) {
      const s = SUSPECTS[i];
      if (i === stage - 1) newestFrom = box.list.length;
      y += 34;
      this.put(this.add.rectangle(W / 2, y, 900, 1, 0x4a4a4a));
      y += 26;
      const h1 = this.para(X, y, `Suppose ${s.name} is the murderer.`, 30, hex(s.color), WIDTH);
      y += h1.height + 6;
      const q = this.para(X, y, `How likely would I be to find ${clue.short}?`, 23, INK, WIDTH);
      y += q.height + 12;
      y = this.ghostHint(X, y, clue.hints[i]) + 64;
      const chosen = this.picks[i];
      RATINGS.forEach((r, j) => {
        const b = this.put(
          new Button(this, X + 74 + j * 154, y, `${r.n}\n${r.word}\n${share(r.v)}`, () => {
            if (this.committed) return;
            const first = this.picks[i] === undefined;
            this.picks[i] = r.v;
            // rating the newest suspect brings in the next one
            if (first && i === stage - 1 && stage < n) return reveal();
            if (i === stage - 1) this.weighToEnd = true;
            Sound.blip();
            this.show(true);
          }, { width: 146, height: 96, size: 17, stroke: chosen === r.v ? 0xd8d8d8 : 0x5a5a5a }),
        );
        b.label.setAlign('center').setLineSpacing(4);
        if (chosen !== undefined && chosen !== r.v) b.setAlpha(0.5);
        buttons.push(b);
      });
      y += 60;
      if (chosen !== undefined) {
        const r = ratingOf(chosen);
        const done = this.para(X, y, `You rated it ${r.n}: ${r.word.toLowerCase()}, a ${share(r.v)} chance.`, 20, '#f0f0f0', WIDTH);
        y += done.height;
      }
    }
    this.putInto = undefined;
    const bottom = y + 24;

    // scrolling: the page is clipped to the space between the crumbs and the buttons
    const viewH = viewBottom - viewTop;
    const minOff = Math.min(0, viewH - (bottom - viewTop));
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(0, viewTop, W, viewH);
    box.setMask(maskShape.createGeometryMask());
    const band = 26;
    const fadeTop = this.put(this.add.graphics());
    fadeTop.fillGradientStyle(0x060606, 0x060606, 0x060606, 0x060606, 1, 1, 0, 0);
    fadeTop.fillRect(24, viewTop, W - 48, band);
    const fadeBottom = this.put(this.add.graphics());
    fadeBottom.fillGradientStyle(0x060606, 0x060606, 0x060606, 0x060606, 0, 0, 1, 1);
    fadeBottom.fillRect(24, viewBottom - band, W - 48, band);
    const arrowX = W / 2 + 560;
    const upArrow = this.put(txt(this, arrowX, viewTop + 4, '\u02c4', 26, '#8a8a8a').setOrigin(0.5, 0));
    const downArrow = this.put(txt(this, arrowX, viewBottom - 4, '\u02c5', 26, '#8a8a8a').setOrigin(0.5, 1));
    const scrollTo = (off: number) => {
      this.noteScroll = Phaser.Math.Clamp(off, minOff, 0);
      box.y = this.noteScroll;
      fadeTop.setVisible(this.noteScroll < 0);
      upArrow.setVisible(this.noteScroll < 0);
      fadeBottom.setVisible(this.noteScroll > minOff + 0.5);
      downArrow.setVisible(this.noteScroll > minOff + 0.5);
      // a button scrolled out of sight can't be clicked through the title or the fade
      buttons.forEach((b) => {
        const by = b.y + box.y;
        b.setClickable(by - 40 > viewTop && by + 40 < viewBottom);
      });
    };
    const toEnd = this.weighToEnd;
    this.weighToEnd = false;
    scrollTo(arrived || toEnd ? minOff : (this.noteScroll ?? 0));
    this.noteScroller = minOff < 0 ? (dy: number) => scrollTo(this.noteScroll! - dy) : undefined;

    // the block just revealed slides in, and the page glides down to it
    if (arrived) {
      const fresh = box.list.slice(newestFrom) as unknown as (Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Transform)[];
      fresh.forEach((o) => {
        o.setAlpha(0);
        o.y += 16;
        this.tweens.add({ targets: o, alpha: 1, y: o.y - 16, duration: 380, ease: 'Sine.easeOut' });
      });
      if (minOff < 0) {
        box.y = Math.min(0, minOff + 220);
        this.tweens.add({ targets: box, y: minOff, duration: 450, ease: 'Sine.easeInOut', onComplete: () => scrollTo(minOff) });
      }
    }

    // Next brings in the first suspect, then waits until everyone is rated
    if (stage === 0) this.setNext('Next ›', true, reveal);
    else if (stage < n || SUSPECTS.some((_, i) => this.picks[i] === undefined)) this.setNext('Next ›', false);
    // the number keys 1–5 rate the newest suspect still waiting for a rating
    const waiting = Array.from({ length: stage }, (_, i) => i).find((i) => this.picks[i] === undefined);
    this.ratingKey =
      waiting === undefined
        ? undefined
        : (num: number) => {
            const r = RATINGS.find((x) => x.n === num);
            if (!r || this.committed) return;
            this.picks[waiting] = r.v;
            if (waiting === stage - 1 && stage < n) return reveal();
            if (waiting === stage - 1) this.weighToEnd = true;
            Sound.blip();
            this.show(true);
          };
  }

  private get lik(): number[] {
    return this.picks.map((p) => p ?? 0.5);
  }

  /** Apply the player's ratings to their board (once). */
  private commitClue() {
    if (this.committed) return;
    this.rec = GameState.applyClue({ playerLik: this.lik });
    this.committed = true;
  }

  /**
   * The update as a square of possible worlds, one step at a time, at the player's pace:
   *   0. before: each person's column is as wide as their share
   *   1. shrink: inside each column, a shaded piece as tall as the rating
   *   2. together: only the shaded pieces, the worlds that fit this clue, remain
   *   3. stretch: the shaded pieces fill a new square; their widths are the new shares
   */
  private updatePage(head: string) {
    const ph = this.phase;
    this.title(head);
    const lik = this.lik;
    const after = update(this.prior, lik);
    const same = lik.every((l) => Math.abs(l - lik[0]) < 1e-9);
    if (ph >= 3) this.commitClue();
    const n = SUSPECTS.length;

    const [stepName, caption, key] = UPDATE_STEPS[ph].map((t) => t.replace('{n}', numberWord(n)));
    this.put(txt(this, W / 2, CONTENT_Y + 2, stepName, 22, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.para(W / 2, CONTENT_Y + 34, caption, 19, '#dcdcdc', 1080, 0.5);

    // the square, built at the previous step and slid into this one
    const S = 330;
    const sq = this.put(
      new BayesSquare(this, 150, CONTENT_Y + 128, S, this.prior, lik, SUSPECTS.map((s) => s.color), SUSPECTS.map((s) => s.name), Math.max(ph - 1, 0)),
    );
    if (ph > 0) this.time.delayedCall(250, () => sq.setPhase(ph));

    // what each part means, beside the square (clear of the P(E | H) label on its right side)
    const x = 630;
    let y = CONTENT_Y + 132;
    const k = this.para(x, y, key, 18, DIM, 610);
    y += k.height + 22;
    if (ph === 0) {
      // where these shares come from: the log, or the board the last clue left behind
      const src = this.para(x, y - 8, this.fromLong, 19, INK, 610);
      y += src.height + 18;
    }
    // each row: the words, then the exact numbers for this step
    const joint = this.prior.map((p, i) => p * lik[i]);
    const left = joint.reduce((a, b) => a + b, 0);
    SUSPECTS.forEach((s, i) => {
      const r = ratingOf(lik[i]);
      this.put(txt(this, x, y, s.name, 22, hex(s.color), { fontStyle: 'bold' }));
      let what = `before this clue: ${share(this.prior[i])}`;
      if (ph === 1) what = `rated ${r.n}: ${KEEP_WORDS[r.n]} (${share(lik[i])})`;
      if (ph === 2) what = `${share(this.prior[i])} × ${share(lik[i])} = ${share(joint[i])}`;
      let trend = '';
      if (ph === 3) {
        const d = after[i] - this.prior[i];
        trend = same || Math.abs(d) < 0.005 ? '= unchanged' : d > 0 ? (d > 0.15 ? '▲ grew a lot' : '▲ grew') : d < -0.15 ? '▼ shrank a lot' : '▼ shrank';
      }
      const t =
        ph === 3
          ? this.put(mathText(this, x + 160, y + 14, [{ n: share(joint[i]), d: share(left) }, ` = ${share(after[i])}`], 20, INK))
          : this.put(txt(this, x + 160, y + 2, what, 20, INK));
      if (ph === 3) {
        const tr = this.put(
          txt(this, x + 160 + t.width + 18, y + 2, trend, 20, trend.startsWith('▲') ? '#f0f0f0' : trend.startsWith('▼') ? '#d84a52' : INK),
        );
        [t, tr].forEach((o) => o.setAlpha(0));
        this.time.delayedCall(1200, () => this.tweens.add({ targets: [t, tr], alpha: 1, duration: 400 }));
      }
      y += ph === 3 ? 58 : 42;
    });
    // the sum, and the rule behind the step
    const rule =
      ph === 0
        ? `Together: ${SUSPECTS.map((_, i) => share(this.prior[i])).join(' + ')} = 100%`
        : ph === 1
          ? 'Each piece is as tall as the rating: the chance of this clue in that story.'
          : ph === 2
            ? `Left of the square: ${joint.map(share).join(' + ')} = ${share(left)}`
            : '';
    if (ph === 3) {
      const r3 = this.put(mathText(this, x, y + 18, ['New share = ', { n: 'share × rating', d: 'what was left' }], 18, '#c9c9c9', { italic: true }));
      y += r3.height + 14;
    } else {
      const ruleText = this.put(txt(this, x, y + 4, rule, 18, '#c9c9c9', { fontStyle: 'italic' }));
      y += ruleText.height + 14;
    }
    if (ph === 3) {
      const words = same
        ? UNCHANGED
        : SUSPECTS.map((s, i) => {
            const d = after[i] - this.prior[i];
            const how = Math.abs(d) < 0.005 ? 'stayed the same' : d > 0 ? (d > 0.15 ? 'grew a lot' : 'grew') : d < -0.15 ? 'shrank a lot' : 'shrank';
            return `${s.name}’s share ${how}.`;
          }).join('  ');
      this.para(x, y + 6, words, 20, INK, 610);
    }

    // the player steps through at their own pace
    if (ph < 3) {
      this.setNext(`Show step ${ph + 1} ›`, true, () => {
        this.phase = ph + 1;
        Sound.blip();
        this.show();
      });
    }
  }

  /**
   * The same update as Bayes' rule, in one formula that rewrites itself stage by stage:
   *   0. symbols: one hypothesis per suspect (H₁, H₂) and the evidence E
   *   1. names: each symbol becomes the person or the clue it stands for
   *   2. numbers: each term becomes the player's own number
   *   3. multiply, 4. add, 5. divide: the arithmetic done inside the formula itself
   * Stepping forward transforms the formula in place: every term slides to its new place
   * while the old wording dissolves into the new, and the fraction bar stretches to fit.
   */
  private mathPage(head: string, clue: (typeof CLUES)[number]) {
    this.title(head);
    this.commitClue();
    const stage = Math.min(this.mathStage, 5);
    const from = this.mathFrom;
    this.mathFrom = undefined;
    const EC = '#9fc4ff'; // the evidence
    const WC = '#f2f2f2';
    const SUB = ['₁', '₂', '₃', '₄'];
    const lik = this.lik;
    const joint = this.prior.map((p, i) => p * lik[i]);
    const pE = joint.reduce((a, b) => a + b, 0);
    const after = joint.map((j) => j / pE);
    const col = (i: number) => hex(SUSPECTS[i].color);
    const short = (i: number) => SUSPECTS[i].name.replace(/^Mr\. /, '');
    const noun = clue.noun.replace(/^the /, '');

    type Part = [string, string];
    const P = (...inner: Part[]): Part[] => [['P(', WC], ...inner, [')', WC]];
    const measure = (parts: Part[], size: number) =>
      parts.reduce((a, [t]) => {
        const m = txt(this, 0, 0, t, size, WC, { fontStyle: 'italic' });
        const w = m.width;
        m.destroy();
        return a + w;
      }, 0);

    // ---- what each term says at each stage
    const H = (i: number): Part => [`H${SUB[i]}`, col(i)];
    const E: Part = ['E', EC];
    const given = (st: number): Part => (st === 0 ? [' | ', WC] : [' given ', WC]);
    const content = (st: number) => {
      const who = (i: number): Part => (st === 0 ? H(i) : [short(i), col(i)]);
      const ev: Part = st === 0 ? E : [noun, EC];
      const prior = (i: number): Part[] => (st < 2 ? P(who(i)) : [[share(this.prior[i]), col(i)]]);
      const rate = (i: number): Part[] => (st < 2 ? P(ev, given(st), who(i)) : [[share(lik[i]), col(i)]]);
      const dot: Part = st < 2 ? [' · ', WC] : [' × ', WC];
      return { lhs: [...P(who(0), given(st), ev), [' = ', WC]] as Part[], prior, rate, dot };
    };

    // ---- each stage as keyed slots: the left side, then a numerator over a denominator
    // (or, once divided, a single answer). A slot can name the earlier slots it is made from,
    // so "60% × 70%" can collapse into "42%" and "42% + 20%" into "62%".
    type Item = [string, Part[], string[]?];
    type Shape = { lhs: Part[]; num?: Item[]; den?: Item[]; solo?: Item };
    const plus = (i: number): Item => [`dplus${i}`, [[' + ', WC]]];
    const shape = (st: number): Shape => {
      const c = content(Math.min(st, 2));
      const lhs = c.lhs;
      const term = (i: number, pre: string): Item[] => [
        [`${pre}p${i}`, c.prior(i)],
        [`${pre}dot${i}`, [c.dot]],
        [`${pre}r${i}`, c.rate(i)],
      ];
      const product = (i: number, pre: string): Item => [`${pre}j${i}`, [[share(joint[i]), col(i)]], [`${pre}p${i}`, `${pre}dot${i}`, `${pre}r${i}`]];
      if (st <= 2) return { lhs, num: term(0, 'n'), den: SUSPECTS.flatMap((_, i) => [...(i ? [plus(i)] : []), ...term(i, 'd')]) };
      // multiply: each product becomes its result
      if (st === 3) return { lhs, num: [product(0, 'n')], den: SUSPECTS.flatMap((_, i) => [...(i ? [plus(i)] : []), product(i, 'd')]) };
      // add: the bottom becomes one number
      const sum: Item = ['dsum', [[share(pE), WC]], SUSPECTS.flatMap((_, i) => [...(i ? [`dplus${i}`] : []), `dj${i}`])];
      if (st === 4) return { lhs, num: [['nj0', [[share(joint[0]), col(0)]]]], den: [sum] };
      // divide: the fraction becomes the answer
      return { lhs, solo: ['res', [[share(after[0]), col(0)]], ['nj0', 'dsum']] };
    };

    type Slot = { parts: Part[]; x: number; y: number; w: number; src?: string[] };
    // the formula sits in the middle of the space between the crumbs and the buttons
    const FY = Math.round((CONTENT_Y + NAV_Y - 50) / 2);
    const layout = (st: number) => {
      const sh = shape(st);
      const build = (sz: number) => {
        const slots = new Map<string, Slot>();
        const gap = sz * 0.7; // numerator above the bar, denominator below
        const width = (items: Item[]) => items.reduce((a, [, p]) => a + measure(p, sz), 0);
        const lw = measure(sh.lhs, sz);
        const fw = sh.solo ? 0 : Math.max(width(sh.num!), width(sh.den!)) + 16;
        const sw = sh.solo ? measure(sh.solo[1], sz) : 0;
        const total = lw + fw + sw;
        const x = W / 2 - total / 2;
        slots.set('lhs', { parts: sh.lhs, x, y: FY, w: lw });
        const place = (items: Item[], y: number, x0: number) => {
          let cx = x0;
          for (const [k, p, src] of items) {
            const w = measure(p, sz);
            slots.set(k, { parts: p, x: cx, y, w, src });
            cx += w;
          }
        };
        if (sh.solo) {
          const [k, p, src] = sh.solo;
          slots.set(k, { parts: p, x: x + lw, y: FY, w: sw, src });
        } else {
          place(sh.num!, FY - gap, x + lw + (fw - width(sh.num!)) / 2);
          place(sh.den!, FY + gap, x + lw + (fw - width(sh.den!)) / 2);
        }
        // a divided answer has no bar: it collapses to nothing where the fraction was
        const bar = sh.solo ? { x: x + lw + sw / 2, w: 0 } : { x: x + lw, w: fw };
        return { slots, bar, total, size: sz };
      };
      let size = 28;
      let L = build(size);
      if (L.total > 1120) L = build((size = Math.floor((size * 1120) / L.total)));
      return L;
    };

    const draw = (sl: Slot, size: number) => {
      const c = this.put(this.add.container(sl.x, sl.y));
      let cx = 0;
      sl.parts.forEach(([t, color]) => {
        const o = txt(this, cx, 0, t, size, color, { fontStyle: 'italic' }).setOrigin(0, 0.5);
        c.add(o);
        cx += o.width;
      });
      return c;
    };
    const barAt = (b: { x: number; w: number }) =>
      this.put(this.add.rectangle(b.x, FY, 1, 2, 0xdcdcdc).setOrigin(0, 0.5).setScale(Math.max(b.w, 0.001), 1).setVisible(b.w > 0));

    const L = layout(stage);
    const animate = from !== undefined && from === stage - 1;
    const old = animate ? layout(from) : undefined;
    const MS = 750;
    const used = new Set<string>();
    for (const [k, sl] of L.slots) {
      const n = draw(sl, L.size);
      const sources = (sl.src ?? [k]).map((key) => [key, old?.slots.get(key)] as const).filter(([, o]) => o) as [string, Slot][];
      if (!sources.length) {
        if (animate) {
          n.setAlpha(0);
          this.tweens.add({ targets: n, alpha: 1, duration: 400, delay: MS - 100 });
        }
        continue;
      }
      // the old pieces slide onto the new place and dissolve; the new wording takes over there
      const cxNew = sl.x + sl.w / 2;
      const cxOld = sources.reduce((a, [, o]) => a + o.x + o.w / 2, 0) / sources.length;
      const yOld = sources.reduce((a, [, o]) => a + o.y, 0) / sources.length;
      for (const [key, o] of sources) {
        used.add(key);
        const was = draw(o, old!.size);
        this.tweens.add({ targets: was, x: cxNew - o.w / 2, y: sl.y, alpha: 0, duration: MS, ease: 'Sine.easeInOut' });
      }
      n.setPosition(cxOld - sl.w / 2, yOld).setAlpha(0);
      this.tweens.add({ targets: n, x: sl.x, y: sl.y, duration: MS, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: n, alpha: 1, duration: MS * 0.6, delay: MS * 0.35 });
    }
    // anything from the last stage that nothing grew out of simply fades where it was
    if (old)
      for (const [k, o] of old.slots) {
        if (used.has(k)) continue;
        const was = draw(o, old.size);
        this.tweens.add({ targets: was, alpha: 0, duration: MS * 0.6 });
      }
    // the fraction bar stretches to its new width, or shrinks away once the division is done
    const bar = barAt(old ? old.bar : L.bar);
    if (old)
      this.tweens.add({
        targets: bar,
        x: L.bar.x,
        scaleX: Math.max(L.bar.w, 0.001),
        alpha: L.bar.w > 0 ? 1 : 0,
        duration: MS,
        ease: 'Sine.easeInOut',
      });

    // ---- the stage's name above, and its key below the first two stages
    const names = ['The rule', 'With the names', 'With your numbers', 'Multiply', 'Add', 'Divide'];
    this.put(txt(this, W / 2, FY - 110, names[stage], 18, DIM, { fontStyle: 'italic' }).setOrigin(0.5));
    const below: Phaser.GameObjects.GameObject[] = [];
    const keyY = FY + 92;
    if (stage === 0) {
      const legend: Part[] = [];
      SUSPECTS.forEach((sp, i) => legend.push(H(i), [`  ${sp.name} is the murderer      `, '#bdbdbd']));
      legend.push(E, [`  finding ${clue.short}`, '#bdbdbd']);
      below.push(draw({ parts: legend, x: W / 2 - measure(legend, 18) / 2, y: keyY, w: 0 }, 18));
    } else if (stage === 1) {
      const note = `P(${short(0)}): your board before this clue (${this.fromShort})      P(${noun} given ${short(0)}): your rating for ${short(0)}`;
      below.push(this.put(txt(this, W / 2, keyY, note, 16, '#9a9a9a', { fontStyle: 'italic' }).setOrigin(0.5)));
    }
    if (animate)
      below.forEach((o) => {
        (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 450, delay: MS });
      });

    const LAST = names.length - 1;
    if (stage < LAST) {
      this.setNext(`${names[stage + 1]} ›`, true, () => {
        this.mathFrom = stage;
        this.mathStage = stage + 1;
        Sound.blip();
        this.show(true);
      });
    }
    if (stage > 0)
      this.backOverride = () => {
        this.mathStage = stage - 1;
        this.show(true);
      };
  }

  private recapPage(head: string, clue: (typeof CLUES)[number]) {
    this.title(head);
    this.commitClue();
    const after = this.rec?.belief ?? GameState.data.belief;
    this.put(txt(this, W / 2, CONTENT_Y + 6, clue.trap, 27, GOLD, { fontStyle: 'bold', align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5, 0));
    const body = this.para(W / 2, CONTENT_Y + 56, clue.lesson, 22, INK, 1040, 0.5);
    // the board before and after, as squares: column widths are the shares
    const S = 170;
    const y = Math.max(body.y + body.height + 40, CONTENT_Y + 250);
    const colors = SUSPECTS.map((s) => s.color);
    const names = SUSPECTS.map((s) => s.name);
    const one = SUSPECTS.map(() => 1);
    this.put(txt(this, W / 2 - 200, y - 50, 'Your board before this clue', 18, DIM).setOrigin(0.5, 0));
    this.put(txt(this, W / 2 - 200, y - 28, `(${this.fromShort})`, 15, '#7c7c7c', { fontStyle: 'italic' }).setOrigin(0.5, 0));
    this.put(new BayesSquare(this, W / 2 - 200 - S / 2, y, S, this.prior, one, colors, names, 0, { labelSize: 16 }));
    this.put(txt(this, W / 2, y + S / 2 - 16, '→', 34, GOLD).setOrigin(0.5, 0));
    this.put(txt(this, W / 2 + 200, y - 30, 'Your board now', 18, DIM).setOrigin(0.5, 0));
    this.put(new BayesSquare(this, W / 2 + 200 - S / 2, y, S, after, one, colors, names, 0, { labelSize: 16 }));
  }
}
