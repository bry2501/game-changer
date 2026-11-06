import Phaser from 'phaser';
import { Sound } from './audio/Sound';
import { GameState } from './state/GameState';
import { CLUES } from './data/case1';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MemoryScene } from './scenes/MemoryScene';
import { WorldScene } from './scenes/WorldScene';
import { EvidenceScene } from './scenes/EvidenceScene';
import { BoardScene } from './scenes/BoardScene';
import { AccuseScene } from './scenes/AccuseScene';
import { EndingScene } from './scenes/EndingScene';
import { VIEW_H, VIEW_W } from './ui/widgets';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#050505',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_W,
    height: VIEW_H,
  },
  input: { activePointers: 3 },
  render: { antialias: true },
  scene: [BootScene, TitleScene, WorldScene, MemoryScene, EvidenceScene, BoardScene, AccuseScene, EndingScene],
});

// Audio may only start after a user gesture.
const unlockAudio = () => Sound.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// F toggles full screen anywhere in the game (a key press counts as the user gesture browsers require)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat) game.scale.toggleFullscreen();
});

// handy for automated testing / debugging
(window as unknown as { __game: Phaser.Game; __gs: typeof GameState }).__game = game;
(window as unknown as { __gs: typeof GameState }).__gs = GameState;
(window as unknown as { __clues: typeof CLUES }).__clues = CLUES;
