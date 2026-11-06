import Phaser from 'phaser';
import { Button, DIM, H, W, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { CLUES, CULPRIT_INDEX, EPILOGUE_CORRECT, EPILOGUE_WRONG, SUSPECTS } from '../data/case1';
import { GameState, LEVELS, levelOf, unlockLevel } from '../state/GameState';
import { argmax, pct } from '../bayes/engine';
import { beliefChart } from './BoardScene';
import { Sound } from '../audio/Sound';

export class AccuseScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private accused = -1;

  constructor() {
    super('Accuse');
  }

  create() {
    this.accused = -1;
    Sound.setTicking(false);
    Sound.setMood('memory');
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
      // Level 1 shows suspicion as a bar, not a number
      if (levelOf(GameState.difficulty) === 1) {
        b.add(this.add.rectangle(-100, 55, 200, 14, 0x0c1120).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a4566));
        b.add(this.add.rectangle(-100, 55, 200 * belief[i], 14, s.color, 0.9).setOrigin(0, 0.5));
      } else {
        b.add(txt(this, 0, 55, `board: ${pct(belief[i])}`, 22, '#dfe6ff').setOrigin(0.5));
      }
    });
    txt(this, W / 2, 520, 'Choose carefully. A ghost only gets one accusation.', 20, DIM, { fontStyle: 'italic' }).setOrigin(0.5);
  }

  private accuse(i: number) {
    this.accused = i;
    this.clear();
    const correct = i === CULPRIT_INDEX;
    Sound.toll();
    Sound.setMood(correct ? 'reveal' : 'emerge');
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
    const level = levelOf(GameState.difficulty);
    const data = GameState.data;
    const correct = this.accused === CULPRIT_INDEX;
    if (correct) unlockLevel(level + 1);
    const colors = SUSPECTS.map((s) => s.color);
    const journey = [data.prior, ...data.history.map((h) => h.belief)];

    txt(this, W / 2, 26, correct ? `Level ${level} solved` : 'Not this time', 34, correct ? '#9ff0b0' : '#ff9f9f', {
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const finalTop = argmax(data.belief);
    const verdict = correct
      ? `You named ${SUSPECTS[this.accused].name}, and you were right.`
      : `You named ${SUSPECTS[this.accused].name}. It was not them.` +
        (finalTop !== this.accused ? ` Your own board ended with ${SUSPECTS[finalTop].name} on top.` : '');
    txt(this, W / 2, 72, verdict, 20, '#dfe6ff').setOrigin(0.5, 0);

    // how the player's board moved, clue by clue
    txt(this, 40, 112, 'How your suspicion moved, clue by clue', 17, DIM);
    beliefChart(this, 40, 140, 520, 300, journey, CLUES.length);
    SUSPECTS.forEach((s, i) => txt(this, 40 + i * 130, 452, s.name, 17, hex(s.color)));

    const x0 = 600;
    txt(this, x0, 112, 'Clue \u2192 what it teaches', 17, DIM);
    txt(this, x0 + 470, 112, 'your board after', 17, DIM);
    CLUES.forEach((c, k) => {
      const y = 152 + k * 44;
      txt(this, x0, y - 11, `${k + 1}. ${c.trap}`, 16, '#dfe6ff', { wordWrap: { width: 450 } });
      const h = data.history[k];
      if (h) stackedBar(this, x0 + 470, y, 150, 18, h.belief, colors);
    });

    // a reflection in the player's own terms: where did their board change most?
    const moves = data.history.map((h, k) => Math.max(...h.belief.map((b, i) => Math.abs(b - journey[k][i]))));
    const big = moves.indexOf(Math.max(...moves));
    let summary = '';
    if (big >= 0) {
      summary = `Your board moved most at clue ${big + 1}, ${CLUES[big].title}. `;
      summary += correct
        ? 'Every rating you made was yours, and the evidence added up.'
        : 'Look again at how strongly each clue fitted each story: a vivid clue can feel stronger than it is, and a quiet one can matter more than it seems.';
    }
    txt(this, 40, 495, summary, 19, '#cfe6ff', { wordWrap: { width: 1200 }, lineSpacing: 4 });

    new Button(this, 200, H - 60, 'Read all lessons', () => this.showLessons(), { width: 300, height: 58, size: 22 });
    const next = LEVELS.find((l) => l.n === level + 1);
    if (correct && next) {
      new Button(this, W - 200, H - 60, `Play Level ${next.n} \u203A`, () => this.startLevel(next.id), { width: 300, height: 58, size: 22, stroke: 0x9ff0b0 });
    } else if (correct) {
      txt(this, W / 2, H - 120, 'Every level solved. The clocks can stop at last.', 20, '#9ff0b0', { fontStyle: 'italic' }).setOrigin(0.5);
      new Button(this, W - 200, H - 60, 'Back to title', () => this.toTitle(), { width: 300, height: 58, size: 22 });
    } else {
      new Button(this, W - 200, H - 60, `Try Level ${level} again`, () => this.startLevel(GameState.difficulty), { width: 300, height: 58, size: 22 });
    }
    new Button(this, W / 2, H - 60, 'Title', () => this.toTitle(), { width: 160, height: 58, size: 20 });
    GameState.clear();
  }

  private startLevel(id: (typeof LEVELS)[number]['id']) {
    GameState.newGame(id);
    this.scene.start('World');
  }

  private toTitle() {
    GameState.clear();
    this.scene.start('Title');
  }

  private showLessons() {
    overlayBackground(this, 0.985);
    txt(this, W / 2, 24, 'What each clue teaches', 30, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    CLUES.forEach((c, k) => {
      const y = 76 + k * 78;
      txt(this, 40, y, `${k + 1}. ${c.title}: ${c.trap}`, 18, '#ffe2a0', { fontStyle: 'bold' });
      txt(this, 40, y + 24, c.lesson, 15, '#dfe6ff', { wordWrap: { width: 1200 } });
    });
    new Button(this, W - 200, H - 40, 'Back', () => this.showBreakdown(), { width: 200, height: 50, size: 20 });
  }
}
