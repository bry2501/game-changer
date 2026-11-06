# Ghost Mystery

A mobile-friendly, silhouette-noir 2D side-scroller that teaches **Bayesian inference**.

You flicker into existence in a dark study, with no memory and no idea what you are. Your hand passes through a grandfather clock; the window shows no reflection. Drifting to a figure on the rug, you realise it is you: Alistair Finch, clockmaker, put to sleep for good by something in your evening tea. Memories return of the people in the house tonight. Then you search a two-storey house (drawers, cupboards, things to push aside) for the clues that matter among plenty that don't, and weigh each one properly to work out who did it.

## Play

```bash
npm install
npm run dev        # http://localhost:5173 (use --host to reach it from your phone)
npm run build      # type-check and production build in dist/
npm run preview    # serve the build
npm test           # Bayes engine and case design tests
```

### GitHub Pages

Browsers can't run the TypeScript source, so Pages must serve a **built** copy. Both Pages modes work:

- **Source: GitHub Actions** (recommended): `.github/workflows/deploy-pages.yml` tests, builds and publishes `dist/`.
- **Source: Deploy from a branch** (root): `index.html` sees that it's the raw source page on github.io and redirects to the pre-built copy in `docs/`.

After changing game code, run `npm run build:pages` and commit `docs/`. CI fails if `docs/` is out of date.

The game is best played in landscape. Controls:
- **Touch / mouse:** press and hold and the ghost drifts toward your finger. Tap the glowing clue to drift to it and examine it. **Suspects** opens the suspicion board.
- **Keyboard:** ← → or A/D to drift, Space or E to examine, B or Tab for the board.

Search by drifting up to anything that shimmers and tapping it (or pressing E). Most drawers hold nothing useful; the ghost will say so and move on. The stairs are in the hallway: tap them, or press ↑ / ↓.

There is a procedural 80s-synth soundtrack (WebAudio, no audio files) that starts on your first tap; the ♪ button mutes it.

There are no on-screen arrows. The ghost's own thoughts appear in a bubble beside it. A sequence of thoughts waits for you: tap, Space or → for the next one, ← or the ‹ on the bubble to go back. Notes and memories open as full overlays.

## Difficulty

Each mode plays the same mystery with a different number of suspects and clues, and a different amount of help.

| Mode | Suspects | What you do |
|---|---|---|
| Easy | Clara, Voss (5 clues) | For each suspect you pick a likelihood (Very unlikely 0.05 … Very likely 0.9) after a hint from the ghost; the ghost then offers its own estimate, which you can adopt. Every step of the math is shown with your numbers, then compared with the ghost's. |
| Medium | Clara, Voss, Pip (6 clues) | You pick the likelihoods, guess where the bars will land (scored), then compare your numbers with the ghost's. |
| Hard | Graves, Clara, Voss, Pip (7 clues) | You set your own prior and likelihoods from the ghost's words alone. No comparison until you accuse. |

In every mode **your likelihoods drive your board**, so a gut call that ignores the base rates or the ratios really can lead you to the wrong person. The ghost's estimates (the table below) are the reference the breakdown compares you against.

## The case, "The Clockmaker's Last Hour" (Hard mode)

The prior is opportunity: each person's hours inside the house divided by 10. That gives Graves 35%, Clara 30%, Voss 20% and Pip 15%.

| # | Clue | Trap | Leader afterwards |
|---|---|---|---|
| 1 | Butler's prints on the teacup | Non-diagnostic evidence (LR ≈ 1) | Graves 36% |
| 2 | Clara's angry letter | Vivid but weak (LR 2) | **Clara 45%** |
| 3 | Muddy boot print | Representativeness | **Pip 38%** |
| 4 | Partnership ledger | Genuinely diagnostic (LR 3.5) | Voss 62% |
| 5 | Phone log: Clara's alibi | Exculpatory evidence | Voss 68% |
| 6 | Greenhouse log: Pip's alibi | Evidence that cancels earlier evidence | Voss 85% |
| 7 | Cufflink engraved "V" | Prosecutor's fallacy | Voss 92% |

All story content and probabilities live in `src/data/case1.ts`. The tests in `src/bayes/engine.test.ts` check that the posterior chain matches this table and that the intuition traps are present.

## Code map

```
src/bayes/engine.ts       pure Bayes functions (update, chain, likelihood ratio, scoring)
src/data/case1.ts         suspects, priors, clues, likelihoods, lessons, dialogue
src/data/house.ts         rooms on two floors, stairs, and every searchable drawer / cupboard / object
src/audio/Sound.ts        procedural synth soundtrack and sound effects (WebAudio)
src/state/GameState.ts    difficulty, beliefs, history, localStorage save
src/scenes/               Boot (procedural textures), Title, World (incl. the amnesia opening), Memory, Evidence, Board, Accuse
src/ui/                   widgets (buttons, bars), procedural silhouette art, drift controls, thought bubble
```

There are no image assets: everything (the ghost, fog, clocks, rooms) is drawn in code with Phaser 3.
