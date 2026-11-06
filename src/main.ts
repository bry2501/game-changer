import Phaser from 'phaser';
import { Sound } from './audio/Sound';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MemoryScene } from './scenes/MemoryScene';
import { WorldScene } from './scenes/WorldScene';
import { EvidenceScene } from './scenes/EvidenceScene';
import { BoardScene } from './scenes/BoardScene';
import { AccuseScene } from './scenes/AccuseScene';
import { H, W } from './ui/widgets';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05060a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  input: { activePointers: 3 },
  render: { antialias: true },
  scene: [BootScene, TitleScene, WorldScene, MemoryScene, EvidenceScene, BoardScene, AccuseScene],
});

// Audio may only start after a user gesture.
const unlockAudio = () => Sound.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// handy for automated testing / debugging
(window as unknown as { __game: Phaser.Game }).__game = game;
