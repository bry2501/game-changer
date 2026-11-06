import Phaser from 'phaser';
import { Button, DIM, H, INK, W, fadeThen, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { ACCUSE_LINES, CLUES, CULPRIT_INDEX, SUSPECTS } from '../data/case1';
import { CONCEPTS } from '../data/lessons';
import { GameState } from '../state/GameState';
import { argmax, update } from '../bayes/engine';
import { beliefChart } from './BoardScene';
import { BayesSquare } from '../ui/square';
import { Sound } from '../audio/Sound';

const RATING_OF: Record<string, number> = { '0.1': 1, '0.3': 2, '0.5': 3, '0.7': 4, '0.9': 5 };

/** The accusation, and afterwards the results: the player's journey, the lessons, and the math. */
export class AccuseScene extends Phaser.Scene {
  private accused = -1;
  private results = false;

  constructor() {
    super('Accuse');
  }

  init(data: { results?: boolean; accused?: number }) {
    this.results = !!data?.results;
    this.accused = data?.accused ?? -1;
  }

  create() {
    Sound.setTicking(false);
    this.cameras.main.setBackgroundColor('#05060a');
    this.add.image(W / 2, 260, 'moon').setScale(4).setAlpha(0.6);
    if (this.results) {
      Sound.setMood('memory');
      this.showResults();
    } else {
      Sound.setMood('memory');
      this.showChoice();
    }
    this.cameras.main.fadeIn(500);
  }

  private clear() {
    this.children.list.filter((o) => o.type !== 'Image').forEach((o) => o.destroy());
    this.children.list.slice().forEach((o) => o.type === 'Image' && (o as Phaser.GameObjects.Image).texture.key !== 'moon' && o.destroy());
  }

  // ---------------------------------------------------------------- 1. choose

  private showChoice() {
    const belief = GameState.data.belief;
    const top = argmax(belief);
    const fill = (s: string) => s.replace('{likely}', SUSPECTS[top].name).replace('{other}', SUSPECTS[1 - top].name);
    txt(this, W / 2, 56, ACCUSE_LINES[0], 28, '#ffe9b8').setOrigin(0.5);
    txt(this, W / 2, 100, ACCUSE_LINES[1], 21, DIM).setOrigin(0.5);
    SUSPECTS.forEach((s, i) => {
      const x = W / 2 + (i - (SUSPECTS.length - 1) / 2) * 300;
      const b = new Button(this, x, 280, `${s.name}`, () => this.accuse(i), { width: 260, height: 170, size: 32, stroke: s.color });
      b.label.setColor(hex(s.color)).setY(-30);
      b.add(txt(this, 0, 18, s.role, 18, DIM).setOrigin(0.5));
      // suspicion as a bar, not a number
      b.add(this.add.rectangle(-100, 52, 200, 14, 0x0c1120).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a4566));
      b.add(this.add.rectangle(-100, 52, 200 * belief[i], 14, s.color, 0.9).setOrigin(0, 0.5));
    });
    const opts = { align: 'center' as const, wordWrap: { width: 1060 }, lineSpacing: 4 };
    txt(this, W / 2, 425, fill(ACCUSE_LINES[2]), 21, '#cfe6ff', opts).setOrigin(0.5);
    txt(this, W / 2, 510, ACCUSE_LINES[3], 19, '#cfe6ff', opts).setOrigin(0.5);
    txt(this, W / 2, 600, ACCUSE_LINES[4], 20, DIM, { fontStyle: 'italic' }).setOrigin(0.5);
  }

  private accuse(i: number) {
    Sound.toll();
    fadeThen(this, 600, () => this.scene.start('Ending', { accused: i, correct: i === CULPRIT_INDEX }));
  }

  // ---------------------------------------------------------------- 2. results

  private showResults() {
    this.clear();
    overlayBackground(this, 0.97);
    const data = GameState.data;
    const correct = this.accused === CULPRIT_INDEX;
    const colors = SUSPECTS.map((s) => s.color);
    const journey = [data.prior, ...data.history.map((h) => h.belief)];

    txt(this, W / 2, 22, correct ? 'Case closed' : 'Not this time', 34, correct ? '#9ff0b0' : '#ff9f9f', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    const verdict = correct ? `You named ${SUSPECTS[this.accused].name}, and you were right.` : `You named ${SUSPECTS[this.accused].name}. It was not them.`;
    txt(this, W / 2, 66, verdict, 20, '#dfe6ff').setOrigin(0.5, 0);

    // how the player's board moved, clue by clue
    txt(this, 40, 106, 'How your suspicion moved, clue by clue', 17, DIM);
    beliefChart(this, 40, 134, 520, 290, journey, CLUES.length);
    SUSPECTS.forEach((s, i) => txt(this, 40 + i * 130, 436, s.name, 17, hex(s.color)));

    const x0 = 600;
    txt(this, x0, 106, 'Clue → what it teaches', 17, DIM);
    txt(this, x0 + 470, 106, 'your board after', 17, DIM);
    CLUES.forEach((c, k) => {
      const y = 142 + k * 42;
      txt(this, x0, y - 11, `${k + 1}. ${c.trap}`, 16, '#dfe6ff', { wordWrap: { width: 450 } });
      const h = data.history[k];
      if (h) stackedBar(this, x0 + 470, y, 150, 18, h.belief, colors);
    });

    // a reflection in the player's own terms, and whom their own board favoured
    const moves = data.history.map((h, k) => Math.max(...h.belief.map((b, i) => Math.abs(b - journey[k][i]))));
    const big = moves.indexOf(Math.max(...moves));
    const finalTop = argmax(data.belief);
    const parts: string[] = [];
    if (big >= 0 && moves[big] < 0.02) {
      parts.push('Your board hardly moved: when a clue gets the same rating for everyone, it leaves suspicion where it was. Try deciding, for each clue, whose story it fits better.');
    } else if (big >= 0) {
      parts.push(`Your board moved most at clue ${big + 1}, ${CLUES[big].title}.`);
      if (!correct) parts.push('Look again at how strongly each clue fitted each story: a vivid clue can feel stronger than it is, and a quiet one can matter more than it seems.');
    }
    const top = SUSPECTS[finalTop];
    const them = top.pronoun === 'she' ? 'her' : 'him';
    if (correct && finalTop === this.accused) parts.push('Every rating you made was yours, and the evidence added up.');
    else if (correct) parts.push(`Right, but not by your own evidence. Your board still leaned toward ${top.name}. Which of your ratings kept ${them} there?`);
    else if (finalTop === this.accused)
      parts.push(`Your board pointed to ${top.name}, so some of your ratings put it there. A sound process can still end wrong when a rating is off; go back to the ratings, not to a hunch.`);
    else parts.push(`Your own board favoured ${top.name}, and you accused ${SUSPECTS[this.accused].name} anyway. That was the gut feeling I warned you about.`);
    txt(this, 40, 480, parts.join(' '), 19, '#cfe6ff', { wordWrap: { width: 1200 }, lineSpacing: 4 });

    const y = H - 52;
    if (correct) {
      new Button(this, 170, y, 'See the math', () => this.showMath(0), { width: 260, height: 58, size: 22, stroke: 0xffe2a0 });
      new Button(this, 470, y, 'Read all lessons', () => this.showLessons(), { width: 280, height: 58, size: 21 });
      new Button(this, 780, y, 'Play again', () => this.playAgain(), { width: 240, height: 58, size: 21 });
      new Button(this, 1060, y, 'Title', () => this.toTitle(), { width: 200, height: 58, size: 21 });
    } else {
      new Button(this, 200, y, 'Read all lessons', () => this.showLessons(), { width: 300, height: 58, size: 21 });
      new Button(this, W / 2, y, 'Title', () => this.toTitle(), { width: 200, height: 58, size: 21 });
      new Button(this, W - 200, y, 'Try again', () => this.playAgain(), { width: 300, height: 58, size: 22, stroke: 0x9ff0b0 });
    }
    GameState.clear();
  }

  private playAgain() {
    GameState.newGame();
    this.scene.start('World');
  }

  private toTitle() {
    GameState.clear();
    this.scene.start('Title');
  }

  private showLessons() {
    this.clear();
    overlayBackground(this, 0.985);
    txt(this, W / 2, 20, 'What each clue teaches', 30, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    CLUES.forEach((c, k) => {
      const y = 70 + k * 84;
      txt(this, 40, y, `${k + 1}. ${c.title}: ${c.trap}`, 18, '#ffe2a0', { fontStyle: 'bold' });
      txt(this, 40, y + 24, c.lesson, 14, '#dfe6ff', { wordWrap: { width: 1200 } });
    });
    new Button(this, W - 160, H - 34, 'Back', () => this.showResults(), { width: 200, height: 48, size: 20 });
  }

  // ---------------------------------------------------------------- 3. the math, on request

  /**
   * The numbers behind the board, using the player's own ratings: each clue as counted
   * worlds (a square whose column widths are the shares and whose shaded heights are the
   * ratings), then the same step as odds. The last page sums up.
   */
  private showMath(k: number) {
    this.clear();
    overlayBackground(this, 0.985);
    const data = GameState.data;
    const n = CLUES.length;
    const nav = (to: number) => () => this.showMath(to);
    if (k > 0) new Button(this, 110, H - 40, '‹ Back', nav(k - 1), { width: 160, height: 50, size: 20 });
    new Button(this, W / 2, H - 40, 'Results', () => this.showResults(), { width: 180, height: 50, size: 20 });
    if (k < n) new Button(this, W - 120, H - 40, 'Next ›', nav(k + 1), { width: 180, height: 50, size: 20 });

    const [A, B] = SUSPECTS;
    const short = (s: (typeof SUSPECTS)[number]) => s.name.replace('Mr. ', '');
    if (k === n) return this.mathSummary();

    const c = CLUES[k];
    const h = data.history[k];
    const before = k === 0 ? data.prior : data.history[k - 1].belief;
    const lik = h?.playerLik ?? c.likelihoods;
    const after = update(before, lik);
    const r = lik.map((l) => RATING_OF[String(l)] ?? 3);

    txt(this, W / 2, 20, `See the math · Clue ${k + 1} of ${n}: ${c.title}`, 28, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    const colors = SUSPECTS.map((s) => s.color);
    const names = SUSPECTS.map((s) => s.name);
    txt(this, 210, 92, 'Every world, shared by suspicion; shaded where the clue turns up', 15, DIM, { align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5, 0);
    new BayesSquare(this, 60, 140, 300, before, lik, colors, names, 1);
    txt(this, 210, 488, 'Keep the shaded worlds, stretched to fill:', 15, DIM).setOrigin(0.5, 0);
    new BayesSquare(this, 160, 516, 100, after, SUSPECTS.map(() => 1), colors, ['', ''], 0);

    const a = Math.round(before[0] * 100);
    const b = 100 - a;
    const ka = before[0] * 100 * lik[0];
    const kb = before[1] * 100 * lik[1];
    const f = (x: number) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1));
    const worlds =
      `Picture ${a} worlds in which ${A.name} did it and ${b} in which ${short(B)} did. ` +
      `A ${r[0]} means the clue turns up in ${Math.round(lik[0] * 100)} of every 100 of ${A.name}’s worlds; a ${r[1]} means ${Math.round(lik[1] * 100)} of every 100 of ${short(B)}’s. ` +
      `That is ${f(ka)} worlds with the clue for ${A.name} and ${f(kb)} for ${short(B)}, ${f(ka + kb)} in all. ` +
      `${f(ka)} of those ${f(ka + kb)} are ${A.name}’s: ${Math.round(after[0] * 100)}%.`;
    const odds = (x: number) => (x >= 1 ? `${+x.toFixed(2)} : 1` : `1 : ${+(1 / x).toFixed(2)}`);
    const o0 = before[0] / before[1];
    const ratio = lik[0] / lik[1];
    const oddsLine =
      `The same step as odds, ${A.name} to ${short(B)}: ${odds(o0)} before, times the clue’s ratio ${r[0]} against ${r[1]} ` +
      `(${odds(ratio)}), makes ${odds(o0 * ratio)}. That is ${Math.round(after[0] * 100)}% ${A.name}, ${Math.round(after[1] * 100)}% ${short(B)}.`;
    let y = 100;
    const add = (t: Phaser.GameObjects.Text, gap = 22) => (y += t.height + gap);
    add(txt(this, 440, y, `Your ratings: ${A.name} ${r[0]}, ${short(B)} ${r[1]}.`, 22, '#9ff0b0'));
    add(txt(this, 440, y, worlds, 21, INK, { wordWrap: { width: 790 }, lineSpacing: 6 }));
    add(txt(this, 440, y, oddsLine, 20, '#cfe6ff', { wordWrap: { width: 790 }, lineSpacing: 6 }));
    add(
      txt(this, 440, y, Math.abs(ratio - 1) < 1e-9 ? 'Equal ratings: a ratio of 1 changes nothing.' : `Only the ratio matters: any two ratings ${ratio > 1 ? 'favouring' : 'against'} ${A.name} by ${odds(ratio)} would move the board exactly as far.`, 18, DIM, {
        wordWrap: { width: 790 },
      }),
    );
  }

  private mathSummary() {
    const data = GameState.data;
    const liks = CLUES.map((c, k) => data.history[k]?.playerLik ?? c.likelihoods);
    const from = (p: number) => liks.reduce((b, l) => update(b, l), [p, 1 - p])[0];
    txt(this, W / 2, 20, 'See the math · the whole case', 28, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    txt(this, 60, 80, 'The seven lessons', 20, DIM);
    CONCEPTS.forEach((c, k) => txt(this, 60, 112 + k * 34, `${k + 1}. ${c.title}`, 21, INK));
    const A = SUSPECTS[0].name;
    const starts = [0.1, 0.5, 0.9];
    const ends = starts.map((p) => `${Math.round(p * 100)}% → ${Math.max(0.1, Math.round(from(p) * 1000) / 10)}%`);
    txt(
      this,
      640,
      80,
      `Where you start matters less than you might think. With your seven ratings, starting ${A} at ` +
        `${ends.join(', ')} ${A} at the end. A different starting point changes the final board only a little, provided the ratings stay the same.`,
      21,
      '#cfe6ff',
      { wordWrap: { width: 580 }, lineSpacing: 6 },
    );
    txt(
      this,
      640,
      330,
      'Each clue multiplies the odds by the ratio of its two ratings. The order does not matter: seven clues in any order land in the same place. ' +
        'And because no rating is 0 or 1, no single clue can prove or rule out a story on its own.',
      19,
      DIM,
      { wordWrap: { width: 580 }, lineSpacing: 6 },
    );
  }
}
