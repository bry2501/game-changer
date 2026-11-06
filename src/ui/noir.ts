import Phaser from 'phaser';
import { H, VIEW_H, VIEW_W, W, fitCamera } from './widgets';

/**
 * Film noir: the camera renders in hard black and white (grayscale, extra contrast).
 * Colour is kept for key things in two ways:
 * - cutscenes bloom the whole camera back into colour, then drain it again;
 * - an "accent" camera draws a few chosen objects (the ghost, clue glints, the red rug)
 *   in colour on top of the grey world.
 * Post effects need WebGL; on a canvas renderer this all quietly does nothing.
 */
export class Noir {
  private fx?: Phaser.FX.ColorMatrix;
  /** 0 = black and white, 1 = full colour. */
  colour = 0;

  constructor(private scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, colour = 0) {
    if (scene.game.renderer.type === Phaser.WEBGL) this.fx = cam.postFX.addColorMatrix();
    this.set(colour);
  }

  set(colour: number) {
    this.colour = colour;
    const fx = this.fx;
    if (!fx) return;
    const n = 1 - colour; // how much noir
    fx.reset();
    fx.saturate(-n); // -1 is fully grey
    fx.contrast(0.6 * n, true); // deep shadows, hard highlights
    fx.brightness(1 - 0.06 * n, true);
  }

  /** Tween into colour (to = 1) or back to black and white (to = 0). */
  fade(to: number, ms: number, delay = 0) {
    const o = { v: this.colour };
    this.scene.tweens.add({ targets: o, v: to, duration: ms, delay, ease: 'Sine.easeInOut', onUpdate: () => this.set(o.v) });
  }
}

/**
 * A second camera, drawn over the grey main camera, that shows only the objects given to
 * `keep()`, in colour. It tracks the main camera exactly: scroll, zoom, rotation, and its
 * fades, flashes and shakes.
 */
export class AccentCamera {
  readonly cam: Phaser.Cameras.Scene2D.Camera;

  constructor(private scene: Phaser.Scene) {
    const main = scene.cameras.main;
    this.cam = fitCamera(scene.cameras.add(0, 0, VIEW_W, VIEW_H));
    // everything is the main camera's unless kept
    scene.children.list.forEach((o) => this.cam.ignore(o));
    const onAdd = (o: Phaser.GameObjects.GameObject) => this.cam.ignore(o);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd));

    // follow the main camera, after it has moved this frame, and share its effects.
    // (A restarted scene may keep its main camera, so always wrap the original methods.)
    const m = main as unknown as Record<string, (...a: unknown[]) => unknown> & { __orig?: Record<string, (...a: unknown[]) => unknown> };
    const orig = (m.__orig ??= {});
    const accent = this.cam as unknown as Record<string, (...a: unknown[]) => unknown>;
    orig.preRender ??= m.preRender;
    m.preRender = (...a: unknown[]) => {
      const r = orig.preRender.apply(main, a);
      this.cam.setScroll(main.scrollX, main.scrollY).setZoom(main.zoom).setRotation((main as unknown as { rotation: number }).rotation);
      return r;
    };
    for (const k of ['fade', 'fadeIn', 'fadeOut', 'flash', 'shake']) {
      orig[k] ??= m[k];
      m[k] = (...a: unknown[]) => {
        if (this.cam.scene) accent[k].apply(this.cam, a.filter((x) => typeof x !== 'function'));
        return orig[k].apply(main, a);
      };
    }
  }

  /** Draw these objects in colour, over the grey world. */
  keep(...objs: Phaser.GameObjects.GameObject[]) {
    const free = (o: Phaser.GameObjects.GameObject) => {
      o.cameraFilter &= ~this.cam.id;
      if (o instanceof Phaser.GameObjects.Container) o.list.forEach(free);
    };
    for (const o of objs) {
      this.scene.cameras.main.ignore(o);
      free(o);
    }

  }
}

/** Fine film grain over everything, shifting every frame. */
export function filmGrain(scene: Phaser.Scene, depth = 950, alpha = 0.07) {
  const grain = scene.add.tileSprite(0, 0, W, H, 'grain').setOrigin(0).setScrollFactor(0).setDepth(depth).setAlpha(alpha);
  const step = () => grain.setTilePosition(Math.random() * 256, Math.random() * 256);
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));
  return grain;
}
