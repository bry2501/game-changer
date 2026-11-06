import Phaser from 'phaser';
import { ACCENT, BarRow, Button, DIM, INK, W, fadeThen, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { CLUES, Evidence, PRIOR_SHEET, SUSPECTS, allSuspects } from '../data/case1';
import { GameState, StepRecord, levelOf, truePrior } from '../state/GameState';
import { joint, normalize, pct, update } from '../bayes/engine';
import { drawSuspect } from './MemoryScene';
import { CONCEPTS } from '../data/lessons';
import { Sound } from '../audio/Sound';

type Kind = 'prior' | 'clue';

interface Step {
  /** Short name shown in the breadcrumb at the top. */
  crumb: string;
  build: () => void;
}

const GOLD = '#ffe9b8';
const CONTENT_Y = 128;
const NAV_Y = 668;

/**
 * The player's 1–5 rating of how well a clue fits a story. Behind the scenes each rating
 * is a likelihood; Level 1 never shows those numbers, Level 2 shows them as percentages,
 * Level 3 as probabilities.
 */
const RATINGS = [
  { n: 1, word: 'Very unlikely', v: 0.1 },
  { n: 2, word: 'Unlikely', v: 0.3 },
  { n: 3, word: 'Not sure', v: 0.5 },
  { n: 4, word: 'Likely', v: 0.7 },
  { n: 5, word: 'Very likely', v: 0.9 },
];
const ratingOf = (v: number) => RATINGS.find((r) => Math.abs(r.v - v) < 1e-9)!;

/** Level 1's words for how much of a share a rating keeps. */
const KEEP_WORDS: Record<number, string> = {
  1: 'keeps very little',
  2: 'keeps less than half',
  3: 'keeps half',
  4: 'keeps most',
  5: 'keeps almost all',
};


/**
 * A note or clue, examined one idea at a time:
 *   the clue (as found, with the ghost's reading) → a concept lesson (one new idea per clue)
 *   → a 1–5 rating per suspect (the ghost hints, never answers) → [Level 2: guess]
 *   → the update, stepped through (before, shrink, together, stretch) → [Level 3: the formula] → recap.
 * Level 1 uses words only, Level 2 adds percentages, Level 3 probabilities and Bayes' formula.
 * The game follows only the player's choices.
 */
export class EvidenceScene extends Phaser.Scene {
  private kind: Kind = 'clue';
  private level: 1 | 2 | 3 = 1;
  private steps: Step[] = [];
  private index = 0;
  private page!: Phaser.GameObjects.Container;
  private crumbs: Phaser.GameObjects.Text[] = [];
  private nextBtn!: Button;
  private backBtn!: Button;
  private nextOverride?: () => void;
  private closing = false;
  /** Once the update is applied to the board, earlier pages can no longer be revisited. */
  private committed = false;

  // working state for this examination
  private prior: number[] = [];
  /** The player's likelihood for each suspect (undefined until rated). */
  private picks: (number | undefined)[] = [];
  private guess: number[] = [];
  private guessLocked = false;
  private rec?: StepRecord;
  /** Which step of the update animation is showing (0–3). */
  private phase = 0;

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
    this.guess = [];
    this.guessLocked = false;
    this.rec = undefined;
    this.nextOverride = undefined;
    this.phase = 0;
  }

  create() {
    this.level = levelOf(GameState.difficulty);
    overlayBackground(this);
    txt(this, W - 40, 30, `LEVEL ${this.level}`, 15, DIM).setOrigin(1, 0);
    this.page = this.add.container();
    this.backBtn = new Button(this, 130, NAV_Y, '‹ Back', () => this.go(-1), { width: 180, height: 56, size: 22 });
    this.nextBtn = new Button(this, W - 150, NAV_Y, 'Next ›', () => this.onNext(), { width: 240, height: 60, size: 24 });
    this.input.keyboard?.on('keydown-RIGHT', () => this.nextBtn.alpha === 1 && this.onNext());
    this.input.keyboard?.on('keydown-LEFT', () => this.backBtn.visible && this.go(-1));

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
    this.index = next;
    this.show();
  }

  /** The main button: a page-specific action if one is set, otherwise the next page. */
  private onNext() {
    if (this.nextOverride) {
      const f = this.nextOverride;
      this.nextOverride = undefined;
      f();
    } else this.go(1);
  }

  private show() {
    // cancel the previous page's pending animations before its objects are destroyed
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.page.list);
    this.page.removeAll(true);
    this.page.setAlpha(0);
    this.setNext('Next ›', true);
    this.steps[this.index].build();
    this.backBtn.setVisible(this.index > 0 && !this.committed);
    if (this.index === this.steps.length - 1 && this.nextBtn.label.text.startsWith('Next')) {
      this.setNext('Continue ›', this.nextBtn.alpha === 1);
    }
    this.crumbs.forEach((c, i) => c.setColor(i === this.index ? GOLD : i < this.index ? '#9fb0d6' : '#4a5677'));
    this.tweens.add({ targets: this.page, alpha: 1, duration: 250 });
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
      const t = txt(this, x, 82, l, 16, '#4a5677');
      this.crumbs.push(t);
      x += t.width;
      if (i < labels.length - 1) x += txt(this, x, 82, sep, 16, '#33405e').width;
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
    this.page.add(o);
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
      this.put(txt(this, x0 + 4, y, `Found: ${found}`, 18, '#8f9ab8', { fontStyle: 'italic', wordWrap: { width: w } }));
      y += 34;
    }
    const card = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    card.add(bg);
    card.add(txt(this, x0 + pad, y + 16, `EVIDENCE  \u00B7  ${heading.toUpperCase()}`, 15, '#8a6a44', { fontStyle: 'bold' }));
    let cy = y + 46;
    const ink = '#2a2118';
    const add = (t: Phaser.GameObjects.Text, gap = 6) => {
      card.add(t);
      cy += t.height + gap;
      return t;
    };
    if (doc.kind === 'letter') {
      add(txt(this, x0 + w - pad, cy, doc.date, 19, '#4a3a2a', { fontStyle: 'italic' }).setOrigin(1, 0), 2);
      doc.lines.forEach((l, k) =>
        add(txt(this, x0 + pad + (k ? 30 : 0), cy, l, k ? 27 : 23, ink, { fontStyle: 'italic', wordWrap: { width: w - pad * 2 - 30 } }), 8),
      );
      add(txt(this, x0 + w - pad - 40, cy, doc.sign, 25, ink, { fontStyle: 'italic' }).setOrigin(1, 0), 4);
    } else if (doc.kind === 'facts') {
      for (const [k, v] of doc.rows) {
        card.add(txt(this, x0 + pad, cy, k, 20, '#6b5236', { fontStyle: 'bold' }));
        add(txt(this, x0 + pad + 190, cy, v, 21, ink, { wordWrap: { width: w - pad * 2 - 190 } }), 6);
      }
    } else {
      // column positions from relative widths (equal unless the document says otherwise)
      const weights = doc.widths ?? doc.columns.map(() => 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const colX: number[] = [];
      weights.reduce((acc, wt, k) => ((colX[k] = x0 + pad + ((w - pad * 2) * acc) / total), acc + wt), 0);
      doc.columns.forEach((c, k) => card.add(txt(this, colX[k], cy, c, 17, '#6b5236', { fontStyle: 'bold' })));
      cy += 26;
      bg.lineStyle(1, 0xb9a882, 1);
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
      if (doc.foot) add(txt(this, x0 + pad, cy + 4, doc.foot, 18, '#4a3a2a', { fontStyle: 'italic', wordWrap: { width: w - pad * 2 } }), 6);
    }
    const h = cy - y + pad - 12;
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(x0 + 6, y + 8, w, h, 6);
    bg.fillStyle(0xe9dfc7, 0.97);
    bg.fillRoundedRect(x0, y, w, h, 6);
    bg.fillStyle(0xd3c5a5, 1);
    bg.fillTriangle(x0 + w - 34, y, x0 + w, y, x0 + w, y + 34);
    bg.lineStyle(1, 0xb9a882, 1);
    bg.strokeRoundedRect(x0, y, w, h, 6);
    card.sendToBack(bg);
    return y + h;
  }

  private ghostNote(y: number, text: string): number {
    const w = 900;
    const x0 = W / 2 - w / 2 + 50;
    const note = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    note.add(bg);
    const t = txt(this, x0 + 24, y + 16, text, 22, '#cfe6ff', { fontStyle: 'italic', wordWrap: { width: w - 48 }, lineSpacing: 5 });
    note.add(t);
    const h = t.height + 32;
    bg.fillStyle(0x0b1222, 0.9);
    bg.lineStyle(2, 0x9fd8ff, 0.45);
    bg.fillRoundedRect(x0, y, w, h, 18);
    bg.strokeRoundedRect(x0, y, w, h, 18);
    const glow = this.add.image(x0 - 52, y + h / 2, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    const ghost = this.add.image(x0 - 52, y + h / 2, 'ghost').setScale(0.42);
    note.add([glow, ghost]);
    bg.fillCircle(x0 - 14, y + h / 2 + 4, 6);
    bg.strokeCircle(x0 - 14, y + h / 2 + 4, 6);
    return y + h;
  }

  /** A compact ghost thought for the right-hand column. */
  private ghostHint(x: number, y: number, text: string): number {
    const w = 760;
    const note = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    note.add(bg);
    const t = txt(this, x + 56, y + 12, text, 19, '#cfe6ff', { fontStyle: 'italic', wordWrap: { width: w - 76 }, lineSpacing: 4 });
    note.add(t);
    const h = Math.max(t.height + 24, 56);
    bg.fillStyle(0x0b1222, 0.9);
    bg.lineStyle(2, 0x9fd8ff, 0.4);
    bg.fillRoundedRect(x, y, w, h, 14);
    bg.strokeRoundedRect(x, y, w, h, 14);
    note.add(this.add.image(x + 28, y + h / 2, 'ghost').setScale(0.3));
    return y + h;
  }

  /** Suspicion as one line shared between the suspects. Level 1 shows names only. */
  private beliefStrip(y: number, dist: number[], label: string, width = 720) {
    const x0 = W / 2 - width / 2;
    this.put(txt(this, W / 2, y, label, 18, DIM).setOrigin(0.5, 0));
    this.put(stackedBar(this, x0, y + 44, width, 28, dist, SUSPECTS.map((s) => s.color)));
    let x = x0;
    SUSPECTS.forEach((s, i) => {
      const t = txt(this, x, y + 68, this.level === 1 ? s.name : `${s.name} ${pct(dist[i])}`, 18, hex(s.color));
      this.put(t);
      x += Math.max(t.width + 24, width * dist[i]);
    });
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
    const L = this.level;
    const truth = truePrior();
    const total = PRIOR_SHEET.total;
    const steps: Step[] = [
      {
        crumb: 'The log',
        build: () => {
          this.title(PRIOR_SHEET.title);
          const active = new Set(SUSPECTS.map((s) => s.id));
          const rows = allSuspects().map((s) =>
            active.has(s.id) ? [s.name, s.logIn, s.logOut, `${s.hoursInside} h`] : [s.name, s.absentLog[0], s.absentLog[1], '—'],
          );
          const bottom = this.evidenceCard(
            CONTENT_Y + 6,
            'the household log, tonight (6 – 10 pm)',
            { kind: 'table', columns: ['Name', 'Signed in', 'Signed out', 'Inside'], rows, widths: [2, 2, 3.6, 1.2] },
            'on the side table in the study.',
          );
          this.ghostNote(bottom + 26, `${PRIOR_SHEET.text} ${PRIOR_SHEET.context}`);
        },
      },
    ];
    SUSPECTS.forEach((s, i) =>
      steps.push({
        crumb: s.name,
        build: () => {
          this.title(PRIOR_SHEET.title);
          this.suspectPortrait(i);
          this.para(470, CONTENT_Y + 30, `${s.name} was inside for ${s.hoursInside} hours.`, 30, hex(s.color), 760);
          this.para(470, CONTENT_Y + 90, `Everyone together: ${total} hours. Each block below is half an hour.`, 21, DIM, 760);
          this.hourBlocks(470, CONTENT_Y + 160, i);
          if (L === 1) {
            this.para(470, CONTENT_Y + 270, `The lit blocks are ${s.name}’s share of all the time anyone spent inside.`, 24, INK, 760);
            this.para(470, CONTENT_Y + 340, 'More time inside means more chances to reach my tea, so a bigger starting share of suspicion.', 21, '#cfe6ff', 760);
          } else if (L === 2) {
            this.para(470, CONTENT_Y + 270, `${s.hoursInside} of ${total} hours: ${s.hoursInside} ÷ ${total} = ${pct(truth[i])}`, 28, INK, 760);
            this.para(470, CONTENT_Y + 330, `So before any clue, ${s.name} gets ${pct(truth[i])} of my suspicion.`, 22, '#cfe6ff', 760);
          } else {
            this.para(470, CONTENT_Y + 270, `${s.name}’s share: ${s.hoursInside} of ${total} hours.`, 28, INK, 760);
            this.para(470, CONTENT_Y + 330, 'Keep that share in mind: in a moment you will set the starting point yourself.', 22, '#cfe6ff', 760);
          }
        },
      }),
    );
    steps.push({
      crumb: L === 3 ? 'Your prior' : 'Start',
      build: () => {
        if (L === 1) {
          this.title('Where my suspicion starts');
          this.para(W / 2, CONTENT_Y + 20, 'Each person’s share of the time inside becomes their starting share of suspicion.', 23, '#cfe6ff', 1000, 0.5);
          this.beliefStrip(CONTENT_Y + 120, truth, 'Before any clue:', 820);
          this.commitPrior(truth);
          return;
        }
        if (L === 2) {
          this.title('Where my suspicion starts: the prior');
          this.para(W / 2, CONTENT_Y + 10, 'Each person’s share of the time inside becomes their starting suspicion.', 23, '#cfe6ff', 1000, 0.5);
          this.barsTable(truth.map(() => 0), truth, (i) => `${SUSPECTS[i].hoursInside} ÷ ${total}`, true);
          this.commitPrior(truth);
          return;
        }
        // Level 3: the player sets the prior
        this.title('Your prior: P(H)');
        if (!this.guessLocked) {
          if (!this.guess.length) this.guess = SUSPECTS.map(() => 0.5);
          this.para(W / 2, CONTENT_Y + 10, 'Drag the bars to set YOUR starting suspicion. They are rescaled to add up to 100%.', 22, '#cfe6ff', 1000, 0.5);
          const rows = this.dragTable(this.guess);
          this.setNext('Commit prior', true, () => {
            this.guess = normalize(rows.map((r) => r.value));
            this.guessLocked = true;
            this.show();
          });
          return;
        }
        this.para(W / 2, CONTENT_Y + 10, 'Your prior is set. Every clue from now on updates YOUR numbers.', 23, '#cfe6ff', 1000, 0.5);
        this.barsTable(this.guess, this.guess, () => 'your choice', false);
        this.commitPrior(this.guess);
      },
    });
    steps.push({
      crumb: 'Lesson',
      build: () => {
        this.title('What the starting point means');
        this.para(W / 2, CONTENT_Y + 60, PRIOR_SHEET.lesson, 26, INK, 960, 0.5);
        this.para(W / 2, CONTENT_Y + 260, 'Every clue I find from now on will shift these shares. How far each one shifts them is the whole art.', 22, '#cfe6ff', 960, 0.5);
      },
    });
    return steps;
  }

  private commitPrior(p: number[]) {
    if (!this.committed) {
      GameState.setPrior(p);
      this.committed = true;
    }
  }

  /** Half-hour blocks: everyone's time inside, with this suspect's blocks lit. */
  private hourBlocks(x: number, y: number, focus: number) {
    const g = this.put(this.add.graphics());
    const cells = SUSPECTS.reduce((a, s) => a + s.hoursInside * 2, 0);
    const cw = Math.min(36, 740 / cells);
    let c = 0;
    SUSPECTS.forEach((s, i) => {
      for (let k = 0; k < s.hoursInside * 2; k++, c++) {
        g.fillStyle(s.color, i === focus ? 0.95 : 0.16);
        g.fillRoundedRect(x + c * cw, y, cw - 4, 46, 5);
      }
    });
  }

  // ================================================================== a clue

  private clueSteps(): Step[] {
    const L = this.level;
    const clue = CLUES[GameState.data.found];
    this.prior = GameState.data.belief.slice();
    const head = `Clue ${GameState.data.found + 1} of ${CLUES.length}: ${clue.title}`;

    const steps: Step[] = [
      {
        crumb: 'The clue',
        build: () => {
          this.title(head);
          const bottom = this.evidenceCard(CONTENT_Y + 4, clue.title, clue.evidence, clue.found);
          this.ghostNote(bottom + 24, clue.context);
        },
      },
      { crumb: 'Lesson', build: () => this.conceptPage(head) },
    ];
    SUSPECTS.forEach((s, i) => steps.push({ crumb: s.name, build: () => this.ratePage(i, clue, head) }));
    if (L === 2) steps.push({ crumb: 'Guess', build: () => this.guessPage(head) });
    steps.push({ crumb: 'Update', build: () => this.updatePage(head) });
    if (L === 3) steps.push({ crumb: 'Formula', build: () => this.formulaPage(head) });
    steps.push({ crumb: 'Recap', build: () => this.recapPage(head, clue) });
    return steps;
  }

  /**
   * The concept for this point in the case: one new idea per clue, building as you go.
   * It teaches how to reason, not what to conclude. Levels 2 and 3 add the numbers.
   */
  private conceptPage(head: string) {
    const L = this.level;
    const k = Math.min(GameState.data.found, CONCEPTS.length - 1);
    const c = CONCEPTS[k];
    this.title(head);
    this.put(txt(this, W / 2, CONTENT_Y + 2, `Lesson ${k + 1}: ${c.title}`, 28, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    let y = CONTENT_Y + 52;
    const add = (t: Phaser.GameObjects.Text, gap: number) => {
      y += t.height + gap;
      return t;
    };
    add(this.para(W / 2, y, c.body, 23, INK, 1000, 0.5), 18);
    if (L >= 2) add(this.para(W / 2, y, `In numbers: ${c.numbers}`, 20, '#cfe6ff', 1000, 0.5), 14);
    if (L === 3) add(this.para(W / 2, y, `In the formula: ${c.formula}`, 20, ACCENT, 1000, 0.5), 14);
    this.beliefStrip(Math.max(y + 10, CONTENT_Y + 330), this.prior, 'Before this clue, your suspicion is shared like this:');
  }

  /** The player rates, from 1 to 5, how well this clue would fit if this person did it. */
  private ratePage(i: number, clue: (typeof CLUES)[number], head: string) {
    const L = this.level;
    const s = SUSPECTS[i];
    this.title(head);
    this.suspectPortrait(i);
    this.para(470, CONTENT_Y + 6, `Suppose ${s.name} did it.`, 31, hex(s.color), 760);
    this.para(470, CONTENT_Y + 54, `How likely would I be to find ${clue.short}?`, 24, INK, 760);
    this.para(470, CONTENT_Y + 92, 'Rate it from 1 (very unlikely) to 5 (very likely). 3 means you are not sure.', 17, DIM, 760);

    // the ghost thinks out loud about this story, without giving a verdict
    const hintBottom = this.ghostHint(470, CONTENT_Y + 124, clue.hints[i]);
    const chosen = this.picks[i];
    const by = hintBottom + 56;
    RATINGS.forEach((r, k) => {
      const b = this.put(
        new Button(this, 470 + 74 + k * 154, by, `${r.n}\n${r.word}`, () => {
          if (this.committed) return;
          this.picks[i] = r.v;
          Sound.blip();
          this.show();
        }, { width: 146, height: 78, size: 17, stroke: chosen === r.v ? 0xffe2a0 : 0x5a6a90 }),
      );
      b.label.setAlign('center').setLineSpacing(4);
      if (chosen !== undefined && chosen !== r.v) b.setAlpha(0.5);
    });
    if (chosen === undefined) {
      this.para(470, by + 56, 'There is no right answer to match. Choose what makes sense to you.', 18, DIM, 760);
      this.setNext('Next ›', false);
      return;
    }
    const r = ratingOf(chosen);
    const meaning =
      L === 1
        ? `You rated it ${r.n}: ${r.word.toLowerCase()}.`
        : L === 2
          ? `You rated it ${r.n} (${r.word.toLowerCase()}). In the math, a ${r.n} counts as ${pct(r.v)}.`
          : `You rated it ${r.n} (${r.word.toLowerCase()}): P(clue | ${s.name}) = ${r.v}.`;
    this.para(470, by + 56, meaning, 20, '#9ff0b0', 760);
  }

  private get lik(): number[] {
    return this.picks.map((p) => p ?? 0.5);
  }

  /** Apply the player's ratings to their board (once). */
  private commitClue(guess?: number[]) {
    if (this.committed) return;
    this.rec = GameState.applyClue({ playerLik: this.lik, guess });
    this.committed = true;
  }

  /**
   * The update, one step at a time, at the player's pace:
   *   0. before: each person's share as a bar
   *   1. shrink: each share keeps only as much as the clue fits that story (the lost part stays, faded)
   *   2. together: what's left, side by side, no longer fills the line
   *   3. stretch: rescale back to the full line; old sizes outlined, with grew / shrank marks
   * Level 1 uses words only; Level 2 adds percentages; Level 3 uses probabilities.
   */
  private updatePage(head: string) {
    const L = this.level;
    const ph = this.phase;
    this.title(head);
    const lik = this.lik;
    const kept = joint(this.prior, lik);
    const total = kept.reduce((a, b) => a + b, 0);
    const after = update(this.prior, lik);
    if (ph >= 3) this.commitClue(L === 2 ? this.guess : undefined);

    const n = SUSPECTS.length;
    const X = 290;
    const BW = 640;
    const rowH = Math.min(74, 290 / n);
    const top = CONTENT_Y + 150;
    const fmt = (x: number) => (L === 2 ? pct(x) : x.toFixed(3));

    // the caption for this step
    const captions = [
      L === 3
        ? 'Before the clue. Each bar is a prior, P(H): that person\u2019s share of suspicion. Together they fill the line.'
        : `Before the clue. Each bar is one person\u2019s share of my suspicion. Together they fill the whole line${L === 2 ? ' (100%)' : ''}.`,
      L === 1
        ? 'Each share shrinks by how well the clue fits that person\u2019s story. A good fit keeps most of it; a poor fit keeps little. The faded part is what the clue took away.'
        : L === 2
          ? 'Multiply: each share keeps its rating\u2019s percentage. A 4 keeps 70%, a 2 keeps 30%. The faded part is what the clue took away.'
          : 'Multiply each prior by its likelihood: P(H) \u00D7 P(clue | H). The faded part is what the clue took away.',
      L === 1
        ? 'Put what\u2019s left side by side. It no longer fills the whole line, because the clue took a piece of every share.'
        : L === 2
          ? `Add up what\u2019s left: ${kept.map((x) => pct(x)).join(' + ')} = ${pct(total)}. It no longer fills 100%.`
          : `Add up the products: ${kept.map((x) => x.toFixed(3)).join(' + ')} = ${total.toFixed(3)}. That total is P(clue).`,
      L === 1
        ? 'Stretch what\u2019s left back to the full line, keeping the proportions. Whoever kept more than the others grows; whoever kept less shrinks.'
        : L === 2
          ? `Rescale: divide each by their total, ${pct(total)}, so they fill 100% again. Whoever kept more than average grows; whoever kept less shrinks.`
          : `Divide each product by P(clue) = ${total.toFixed(3)}. The result is the posterior, P(H | clue).`,
    ];
    const stepName = ['Before', 'Step 1 of 3: shrink', 'Step 2 of 3: together', 'Step 3 of 3: stretch'][ph];
    this.put(txt(this, W / 2, CONTENT_Y + 2, stepName, 22, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.para(W / 2, CONTENT_Y + 36, captions[ph], 20, '#cfe6ff', 1060, 0.5);

    SUSPECTS.forEach((s, i) => {
      const y = top + i * rowH;
      const r = ratingOf(lik[i]);
      this.put(txt(this, 60, y - 13, s.name, 23, hex(s.color), { fontStyle: 'bold' }));
      this.put(this.add.rectangle(X, y, BW, 26, 0x0c1120).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a4566));
      const priorW = BW * this.prior[i];
      const keptW = BW * kept[i];
      const postW = BW * after[i];
      const label = this.put(txt(this, X + BW + 16, y - 12, '', 18, INK));

      if (ph <= 2) {
        // the part the clue takes away stays visible, faded and outlined
        if (ph >= 1) {
          this.put(this.add.rectangle(X, y, priorW, 26, s.color, 0.16).setOrigin(0, 0.5).setStrokeStyle(1, s.color, 0.5));
        }
        const bar = this.put(this.add.rectangle(X, y, ph >= 1 ? keptW : priorW, 26, s.color, 0.92).setOrigin(0, 0.5));
        if (ph === 1) {
          bar.width = priorW;
          this.time.delayedCall(250 + i * 450, () => this.tweens.add({ targets: bar, width: keptW, duration: 700, ease: 'Sine.easeInOut' }));
        }
        if (ph === 0) label.setText(L === 1 ? '' : L === 2 ? pct(this.prior[i]) : this.prior[i].toFixed(3));
        else
          label.setText(
            L === 1
              ? `rated ${r.n}: ${KEEP_WORDS[r.n]}`
              : L === 2
                ? `${pct(this.prior[i])} \u00D7 ${pct(lik[i])} = ${pct(kept[i])}`
                : `${this.prior[i].toFixed(3)} \u00D7 ${lik[i]} = ${kept[i].toFixed(3)}`,
          );
      } else {
        // stretched: the new share, with the old size outlined for comparison
        const bar = this.put(this.add.rectangle(X, y, keptW, 26, s.color, 0.92).setOrigin(0, 0.5));
        this.put(this.add.rectangle(X, y, priorW, 30).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff, 0.55));
        if (L === 2 && this.guess.length) {
          this.put(this.add.rectangle(X + BW * this.guess[i], y, 4, 38, 0x9ff0b0).setOrigin(0.5));
        }
        this.time.delayedCall(700, () => this.tweens.add({ targets: bar, width: postW, duration: 900, ease: 'Sine.easeInOut' }));
        const d = after[i] - this.prior[i];
        const mark = Math.abs(d) < 0.01 ? '= about the same' : d > 0 ? '\u25B2 grew' : '\u25BC shrank';
        label.setText(L === 1 ? mark : `${fmt(this.prior[i])} \u2192 ${fmt(after[i])}  ${mark.split(' ')[0]}`);
        label.setColor(Math.abs(d) < 0.01 ? INK : d > 0 ? '#9ff0b0' : '#ff9f9f').setAlpha(0);
        this.time.delayedCall(1500, () => this.tweens.add({ targets: label, alpha: 1, duration: 400 }));
      }
    });

    // the leftovers side by side (step 2), then stretched to the full line (step 3)
    const cy = top + n * rowH + 22;
    if (ph >= 2) {
      this.put(txt(this, 60, cy - 12, ph === 2 ? 'What\u2019s left' : 'Stretched', 18, DIM));
      this.put(this.add.rectangle(X, cy, BW, 26, 0x0c1120).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a4566));
      const strip = this.put(this.add.container(X, cy));
      let x = 0;
      SUSPECTS.forEach((s, i) => {
        const w = BW * kept[i];
        strip.add(this.add.rectangle(x, 0, w, 26, s.color, 0.92).setOrigin(0, 0.5));
        x += w;
      });
      if (ph === 2) {
        strip.setAlpha(0);
        this.tweens.add({ targets: strip, alpha: 1, duration: 600, delay: 200 });
        this.put(txt(this, X + BW * total + 8, cy - 11, L === 1 ? '\u2190 short of the full line' : `\u2190 ${L === 2 ? pct(total) : total.toFixed(3)} of the line`, 17, GOLD));
      } else {
        this.time.delayedCall(200, () => this.tweens.add({ targets: strip, scaleX: 1 / total, duration: 900, ease: 'Sine.easeInOut' }));
      }
    }

    if (ph === 3) {
      const words = SUSPECTS.map((s, i) => {
        const d = after[i] - this.prior[i];
        const how = Math.abs(d) < 0.01 ? 'stayed about the same' : d > 0 ? (d > 0.15 ? 'grew a lot' : 'grew') : d < -0.15 ? 'shrank a lot' : 'shrank';
        return `${s.name}\u2019s share ${how}.`;
      });
      const note =
        L === 2 && this.rec?.score !== undefined
          ? `Your guess (green line) scored ${this.rec.score}/100.  ` + words.join('  ')
          : words.join('  ') + '  White outline = the size before this clue.';
      this.para(W / 2, cy + 40, note, 19, INK, 1080, 0.5);
    }

    // the player steps through at their own pace
    if (ph < 3) {
      this.setNext(`Show step ${ph + 1} \u203A`, true, () => {
        this.phase = ph + 1;
        Sound.blip();
        this.show();
      });
    }
  }

  /** Level 2: before rescaling, the player guesses where the bars will land. */
  private guessPage(head: string) {
    this.title(head);
    if (this.guessLocked) {
      this.para(W / 2, CONTENT_Y + 120, 'Guess locked in. Now let’s check it.', 24, '#cfe6ff', 1000, 0.5);
      return;
    }
    this.para(
      W / 2,
      CONTENT_Y + 4,
      'The points don’t add up to 100 any more. Before we rescale: where do you think each share will land? Drag the bars.',
      22,
      '#cfe6ff',
      1060,
      0.5,
    );
    if (!this.guess.length) this.guess = this.prior.slice();
    const rows = this.dragTable(this.guess, this.prior);
    this.setNext('Lock in', true, () => {
      this.guess = normalize(rows.map((r) => r.value));
      this.guessLocked = true;
      this.go(1);
    });
  }

  /** Level 3: the same update written as Bayes\u2019 formula, with every number in place. */
  private formulaPage(head: string) {
    this.title(head);
    this.commitClue();
    const lik = this.lik;
    const j = joint(this.prior, lik);
    const pE = j.reduce((a, b) => a + b, 0);
    const post = update(this.prior, lik);
    const sumEq = j.reduce((a, x) => a + +x.toFixed(3), 0).toFixed(3) === pE.toFixed(3) ? '=' : '\u2248';
    this.para(W / 2, CONTENT_Y + 0, 'P(H | clue)  =  P(clue | H) \u00D7 P(H)  \u00F7  P(clue)', 26, GOLD, 1060, 0.5);
    this.para(W / 2, CONTENT_Y + 44, `P(clue) = ${j.map((x) => x.toFixed(3)).join(' + ')} ${sumEq} ${pE.toFixed(3)}`, 20, '#cfe6ff', 1060, 0.5);
    this.barsTable(this.prior, post, (i) => `${lik[i]} \u00D7 ${this.prior[i].toFixed(3)} \u00F7 ${pE.toFixed(3)}`, true, undefined, true, CONTENT_Y + 150);
    this.para(
      W / 2,
      CONTENT_Y + 462,
      'Each prior is multiplied by P(clue | H) \u00F7 P(clue): above 1 it grows, below 1 it shrinks. Exactly the shrink-and-stretch you just watched.',
      18,
      DIM,
      1040,
      0.5,
    );
  }

  private recapPage(head: string, clue: (typeof CLUES)[number]) {
    this.title(head);
    this.commitClue();
    const after = this.rec?.belief ?? GameState.data.belief;
    this.put(txt(this, W / 2, CONTENT_Y + 6, clue.trap, 27, GOLD, { fontStyle: 'bold', align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5, 0));
    this.para(W / 2, CONTENT_Y + 64, clue.lesson, 24, INK, 980, 0.5);
    this.beliefStrip(CONTENT_Y + 270, this.prior, 'Your board before this clue:');
    this.beliefStrip(CONTENT_Y + 380, after, 'Your board now:');
  }

  // ================================================================== shared tables

  /** Rows of before → after bars, revealed one at a time. */
  private barsTable(
    before: number[],
    after: number[],
    formula: (i: number) => string,
    animate: boolean,
    marker?: number[],
    showBefore = false,
    top = CONTENT_Y + 130,
  ) {
    const rowH = Math.min(86, 320 / SUSPECTS.length);
    SUSPECTS.forEach((s, i) => {
      const y = top + i * rowH;
      const row = this.put(this.add.container(0, 0).setAlpha(animate ? 0 : 1));
      row.add(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      row.add(txt(this, 240, y - 12, `${formula(i)}  =`, 21, DIM));
      if (showBefore) row.add(this.add.rectangle(600, y, 400 * before[i], 26, s.color, 0.22).setOrigin(0, 0.5));
      const bar = new BarRow(this, 600, y, 400, s.color, before[i], (v) => pct(v), { height: 26 });
      row.add(bar);
      if (marker) bar.showMarker(marker[i]);
      const go = () => {
        this.tweens.add({ targets: row, alpha: 1, duration: 300 });
        bar.setValue(after[i], true);
        bar.setLabel(showBefore ? `${pct(before[i])} → ${pct(after[i])}` : pct(after[i]));
      };
      if (animate) this.time.delayedCall(300 + i * 600, go);
      else go();
    });
  }

  /** Draggable guess bars; labels show the normalized share. Optional faint "before" bars. */
  private dragTable(initial: number[], before?: number[]): BarRow[] {
    const rowH = Math.min(86, 340 / SUSPECTS.length);
    const rows: BarRow[] = [];
    const refresh = () => {
      const n = normalize(rows.map((r) => r.value));
      rows.forEach((r, i) => r.setLabel(pct(n[i])));
    };
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 130 + i * rowH;
      this.put(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      if (before) {
        this.put(txt(this, 280, y - 12, `before: ${pct(before[i])}`, 20, DIM));
        this.put(this.add.rectangle(480, y, 520 * before[i], 30, s.color, 0.2).setOrigin(0, 0.5));
      }
      const r = this.put(
        new BarRow(this, 480, y, 520, s.color, initial[i], () => '', { draggable: true, step: 0.01, min: 0.01, height: 30 }),
      );
      r.onChange = refresh;
      rows.push(r);
    });
    refresh();
    return rows;
  }
}

export type { Evidence };
