# Ghost Mystery

A mobile-friendly, silhouette-noir 2D side-scroller that teaches **Bayesian inference**.

You flicker into existence in a dark study, with no memory and no idea what you are. Drifting closer to a figure on the rug, you realise it is you: Alistair Finch, clockmaker, put to sleep for good by something in your evening tea. Memories return of the four people in the house tonight. From there you float through your house, gather evidence, and weigh it properly to work out who did it. The case is designed so that **gut instinct points to the wrong person**. Vivid clues create false leaders, and only careful updating (prior × likelihood, normalized) finds the culprit.

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

There are no on-screen arrows. The ghost's own thoughts appear in a bubble beside it; notes and memories open as full overlays.

## Difficulty

All three modes use the same case and clues; they differ in how much help you get.

| Mode | What you do |
|---|---|
| Easy | The ghost shows the full Bayes update: prior × P(E\|H) ÷ P(E) → posterior. |
| Medium | You drag the bars to guess each posterior, then see the true answer, your score (0–100) and the lesson. |
| Hard | You choose your own prior and P(E\|H) for every suspect, using only verbal hints. There is no feedback until you accuse; then the breakdown shows where your model drifted. |

## The case, "The Clockmaker's Last Hour"

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
src/state/GameState.ts    difficulty, beliefs, history, localStorage save
src/scenes/               Boot (procedural textures), Title, World (incl. the amnesia opening), Memory, Evidence, Board, Accuse
src/ui/                   widgets (buttons, bars), procedural silhouette art, drift controls, thought bubble
```

There are no image assets: everything (the ghost, fog, clocks, rooms) is drawn in code with Phaser 3.
