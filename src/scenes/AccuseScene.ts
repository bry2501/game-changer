import Phaser from 'phaser';
import { Button, DIM, H, W, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { CLUES, CULPRIT_INDEX, EPILOGUE_CORRECT, EPILOGUE_WRONG, SUSPECTS } from '../data/case1';
import { GameState, trueChain } from '../state/GameState';
import { argmax, pct, totalVariation, update } from '../bayes/engine';
import { beliefChart } from './BoardScene';

export class AccuseScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private accused = -1;

  constructor() {
    super('Accuse');
  }

  create() {
    this.accused = -1;
    this.cameras.main.setBackgroundColor('#05060a');
    this.add.image(W / 2, 260, 'moon').setScale(4).setAlpha(0.6);
    this.layer = this.add.container();
    this.showChoice();
    this.cameras.main.fadeIn(500);
  }

  private clear() {
    this.layer.removeAll(true);
    this.children.list.filter((o) => o.type !== 'Image' && o !== this.layer).forEach((o) => o.destroy());
  }

  // ---------------------------------------------------------------- 1. choose

  private showChoice() {
    const belief = GameState.data.belief;
    txt(this, W / 2, 60, 'Back beside my body. It is time to name the culprit.', 30, '#ffe9b8').setOrigin(0.5);
    txt(this, W / 2, 110, 'Your board shows these beliefs. Who did it?', 22, DIM).setOrigin(0.5);
    SUSPECTS.forEach((s, i) => {
      const x = W / 2 + (i - (SUSPECTS.length - 1) / 2) * 300;
      const b = new Button(this, x, 330, `${s.name}`, () => this.accuse(i), {
        width: 260,
        height: 180,
        size: 32,
        stroke: s.color,
      });
      b.label.setColor(hex(s.color)).setY(-30);
      b.add(txt(this, 0, 20, s.role, 18, DIM).setOrigin(0.5));
      b.add(txt(this, 0, 55, `board: ${pct(belief[i])}`, 22, '#dfe6ff').setOrigin(0.5));
    });
    txt(this, W / 2, 520, 'Choose carefully. A ghost only gets one accusation.', 20, DIM, { fontStyle: 'italic' }).setOrigin(0.5);
  }

  private accuse(i: number) {
    this.accused = i;
    this.clear();
    const correct = i === CULPRIT_INDEX;
    const lines = correct ? EPILOGUE_CORRECT : [`"${SUSPECTS[i].name}!" ` + EPILOGUE_WRONG[0], ...EPILOGUE_WRONG.slice(1)];
    let k = 0;
    const title = txt(this, W / 2, 120, correct ? 'Case Closed' : 'Case Reopened', 52, correct ? '#9ff0b0' : '#ff9f9f', {
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const line = txt(this, W / 2, 330, '', 28, '#eef3ff', { align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5);
    const glow = this.add.image(W / 2, 520, 'glow').setScale(2).setBlendMode(Phaser.BlendModes.ADD);
    const ghost = this.add.image(W / 2, 520, 'ghost').setScale(0.7);
    this.tweens.add({ targets: [ghost, glow], y: '-=12', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const show = () => {
      line.setText(lines[k]).setAlpha(0);
      this.tweens.add({ targets: line, alpha: 1, duration: 500 });
    };
    show();
    const next = new Button(this, W - 150, H - 60, 'Next ▸', () => {
      k++;
      if (k < lines.length) return show();
      if (correct) {
        this.tweens.add({ targets: [ghost, glow], alpha: 0, y: '-=200', duration: 1800 });
      }
      title.destroy();
      line.destroy();
      next.destroy();
      this.time.delayedCall(correct ? 1200 : 0, () => {
        ghost.destroy();
        glow.destroy();
        this.showBreakdown();
      });
    }, { width: 200, height: 56 });
  }

  // ---------------------------------------------------------------- 2. breakdown

  private showBreakdown() {
    overlayBackground(this, 0.97);
    const d = GameState.difficulty;
    const data = GameState.data;
    const truth = trueChain();
    const colors = SUSPECTS.map((s) => s.color);

    txt(this, W / 2, 28, 'The Bayesian Breakdown', 34, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    const verdict =
      this.accused === CULPRIT_INDEX
        ? `You accused ${SUSPECTS[this.accused].name}: correct.`
        : `You accused ${SUSPECTS[this.accused].name}. The evidence pointed to ${SUSPECTS[CULPRIT_INDEX].name} at ${pct(truth[truth.length - 1][CULPRIT_INDEX])}.`;
    txt(this, W / 2, 72, verdict, 20, this.accused === CULPRIT_INDEX ? '#9ff0b0' : '#ff9f9f').setOrigin(0.5, 0);

    // chart: truth solid, player dashed (when the player's numbers differ)
    txt(this, 40, 112, 'True posterior after each clue' + (d === 'easy' ? '' : ' (solid) vs. yours (dashed)'), 17, DIM);
    beliefChart(this, 40, 140, 520, 300, truth, CLUES.length);
    if (d === 'hard') {
      beliefChart(this, 40, 140, 520, 300, [data.prior, ...data.history.map((h) => h.belief)], CLUES.length, {
        dashed: true,
        alpha: 0.8,
      });
    } else if (d === 'medium') {
      const guesses = [truth[0], ...data.history.map((h) => h.guess ?? h.belief)];
      beliefChart(this, 40, 140, 520, 300, guesses, CLUES.length, { dashed: true, alpha: 0.8 });
    }
    SUSPECTS.forEach((s, i) => txt(this, 40 + i * 130, 452, s.name, 17, hex(s.color)));

    // per-clue table
    const x0 = 600;
    txt(this, x0, 112, 'Clue → trap', 17, DIM);
    txt(this, x0 + 410, 112, 'truth', 17, DIM);
    if (d !== 'easy') txt(this, x0 + 530, 112, 'you', 17, DIM);
    const stepErr: number[] = [];
    CLUES.forEach((c, k) => {
      const y = 152 + k * 44;
      txt(this, x0, y - 11, `${k + 1}. ${c.trap}`, 16, '#dfe6ff', { wordWrap: { width: 400 } });
      stackedBar(this, x0 + 410, y, 110, 18, truth[k + 1], colors);
      const h = data.history[k];
      if (!h) return;
      if (d === 'medium' && h.guess) {
        stackedBar(this, x0 + 530, y, 110, 18, h.guess, colors);
        stepErr.push(totalVariation(h.guess, truth[k + 1]));
      } else if (d === 'hard' && h.playerLik) {
        stackedBar(this, x0 + 530, y, 110, 18, h.belief, colors);
        // isolate this step: apply the player's likelihoods to the TRUE previous belief
        stepErr.push(totalVariation(update(truth[k], h.playerLik), truth[k + 1]));
      }
    });

    // takeaway
    let summary = '';
    if (d === 'easy') {
      const leaders = truth.slice(1).map(argmax);
      const wrongLead = leaders.map((l, k) => (l !== CULPRIT_INDEX ? `${SUSPECTS[l].name} after clue ${k + 1}` : '')).filter(Boolean);
      summary = `The lead changed hands: ${wrongLead.join(', ')}. Loud clues created false leaders; the quiet, diagnostic ones decided the case.`;
    } else if (stepErr.length) {
      const worst = stepErr.indexOf(Math.max(...stepErr));
      const c = CLUES[worst];
      const avg = Math.round(100 * (1 - stepErr.reduce((a, b) => a + b, 0) / stepErr.length));
      summary = `Update accuracy: ${avg}/100. Your biggest drift was clue ${worst + 1} (${c.title}): ${c.trap}.`;
      if (d === 'hard') {
        const lik = data.history[worst].playerLik!;
        summary += ` You set P(E|H) = [${lik.map((v) => v.toFixed(2)).join(', ')}]; the ghost's model says [${c.likelihoods.join(', ')}].`;
      }
    }
    txt(this, 40, 495, summary, 19, '#cfe6ff', { wordWrap: { width: 1200 }, lineSpacing: 4 });

    new Button(this, 200, H - 60, 'Read all lessons', () => this.showLessons(), { width: 300, height: 58, size: 22 });
    new Button(this, W - 200, H - 60, 'Back to title', () => {
      GameState.clear();
      this.scene.start('Title');
    }, { width: 300, height: 58, size: 22 });
    GameState.clear();
  }

  private showLessons() {
    overlayBackground(this, 0.985);
    txt(this, W / 2, 24, 'What each clue teaches', 30, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    CLUES.forEach((c, k) => {
      const y = 76 + k * 78;
      txt(this, 40, y, `${k + 1}. ${c.title}: ${c.trap}`, 18, '#ffe2a0', { fontStyle: 'bold' });
      txt(this, 40, y + 24, c.lesson, 15, '#dfe6ff', { wordWrap: { width: 1200 } });
    });
    new Button(this, W - 200, H - 40, 'Back to title', () => this.scene.start('Title'), { width: 280, height: 50, size: 20 });
  }
}
