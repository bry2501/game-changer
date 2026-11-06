/**
 * Generates a readable screenplay of Level 1 from the game's own data, so the
 * script can never drift from what the game says. Run:  npm run screenplay
 *
 * Story text, evidence, hints, lessons and the house all come from src/data.
 * A few fixed UI lines live inside the Phaser scenes (which can't run outside a
 * browser); those are mirrored below in UI and marked as such.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  ACCUSE_LINES,
  AFTER_MEMORY_THOUGHTS,
  AWAKEN_LINES,
  BODY_AFTER,
  BODY_LINES,
  CASE_TITLE,
  CLOCK_AFTER,
  CLOCK_LINES,
  CLUES,
  CULPRIT_INDEX,
  DRIFT_HINT,
  EPILOGUE_CORRECT,
  EPILOGUE_WRONG,
  Evidence,
  MEMORY_INTRO,
  MEMORY_OUTRO,
  PRIOR_SHEET,
  SUSPECTS,
  WINDOW_LINES,
  allSuspects,
  setCase,
} from '../src/data/case1';
import { CONCEPTS, conceptBody, numberWord } from '../src/data/lessons';
import { ROOMS, SEARCHABLES, roomAt } from '../src/data/house';
import { LEVELS } from '../src/state/GameState';
import { update } from '../src/bayes/engine';

setCase('easy');

/** UI copy mirrored from the scenes (TitleScene, EvidenceScene, AccuseScene). */
const UI = {
  titleTagline: 'The same night, three times. Solve a level to unlock the next.',
  ratePrompt: 'Rate it from 1 (very unlikely) to 5 (very likely). 3 means as likely as not. Judge this clue on its own, assuming this person did it.',
  rateFooter: 'There is no answer key for a rating. Say what you honestly think; your ratings are what move the board.',
  ratings: ['1 Very unlikely', '2 Unlikely', '3 As likely as not', '4 Likely', '5 Very likely'],
  ratingValues: [0.1, 0.3, 0.5, 0.7, 0.9],
  keepWords: ['keeps very little', 'keeps less than half', 'keeps half', 'keeps most', 'keeps almost all'],
  steps: [
    ['Before', 'Before the clue. Each bar is one person’s share of my suspicion. Together they fill the whole line.'],
    ['Step 1 of 3: shrink', 'Each share shrinks by how well the clue fits that person’s story. A good fit keeps most of it; a poor fit keeps little. The faded part is what the clue took away.'],
    ['Step 2 of 3: together', 'Put what’s left side by side. It no longer fills the whole line, because the clue took a piece of every share. The shorter what’s left, the more surprising this clue was overall.'],
    ['Step 3 of 3: stretch', `Stretch what’s left back to the full line, keeping the proportions. Whoever kept more than the others grows; whoever kept less shrinks. This is only fair because these ${numberWord(SUSPECTS.length)} stories cover every possibility between them.`],
  ],
};

/** How each clue's hiding place gives way when searched (stage directions). */
const SEARCH_ACTION: Record<string, string> = {
  letter: 'The drawer sticks, then slides out with a small wooden cry',
  boot: 'The fronds part around the ghost’s hand and settle again, trembling',
  ledger: 'The bottom drawer is stiff with disuse; it gives all at once, and the blank invoices slide against each other',
  phone: 'The drawer runs out on its runners with a long, dry rasp',
  cufflink: 'The ghost sinks to the rug where the chair has crushed the fringe; something small winks in the moonlight',
};

/** Designer's notes per clue, beyond what is computed (not shown in the game). */
const NOTES: Record<string, { ratio?: string; trap?: string; extra?: string[] }> = {
  letter: {
    ratio: ', barely worth mentioning',
    trap: '. A player who rates 5 / 1 jumps to about {swing} Clara on a draft that was never sent.',
  },
  boot: {
    extra: [
      'Background fact “Voss parks by the garden gate” is now stated in Scene 3, before the clue, so the likelihood is judged against known background, not invented after the fact.',
    ],
  },
  ledger: { trap: ', plus the real prosecutor’s fallacy (rating ≠ board), taught in the ghost’s line after the recap.' },
  phone: {
    extra: [
      'Timeline: the call covers the whole window the cup stood on the desk (9:30 to a little before 10). The original 9:35–9:50 call left ten minutes uncovered, so it could not support the alibi the ghost claimed.',
      'The 7:48 call for Voss is deliberately unmodelled (likelihood ratio 1). Either keep it as a Level 2 hook or remove it from the card.',
    ],
  },
  cufflink: {
    trap:
      ' (renamed). The old label “Prosecutor’s fallacy” was a misnomer: that fallacy is confusing P(evidence | guilt) with P(guilt | evidence). It is now taught where it actually occurs, at the ledger and at the accusation.',
    extra: [
      'Independence check: the old Voss page leaned on “he came back in a hurry”, the same story the boot print used, which would make the two clues dependent given Voss did it. The page now rests only on his two chances to lose the cufflink.',
    ],
  },
};

const out: string[] = [];
const w = (s = '') => out.push(s);
const dir = (s: string) => w(`*${s}*`);
const thoughts = (lines: string[], who = 'GHOST', how = 'thought') => {
  for (const l of lines.filter(Boolean)) w(`> **${who}** *(${how})*: ${l}`);
  w();
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const nearest = (v: number) => {
  // the 1-5 rating closest to a model likelihood (ties go up)
  let best = 0;
  UI.ratingValues.forEach((r, k) => {
    if (Math.abs(r - v) <= Math.abs(UI.ratingValues[best] - v) + 1e-9) best = k;
  });
  return best;
};

function evidence(doc: Evidence) {
  if (doc.kind === 'letter') {
    w('```');
    w(`                                                    ${doc.date}`);
    doc.lines.forEach((l, k) => w(`${k ? '    ' : ''}${l}`));
    w(`                                                    ${doc.sign}`);
    w('```');
  } else if (doc.kind === 'facts') {
    w('| | |');
    w('|---|---|');
    for (const [k, v] of doc.rows) w(`| **${k}** | ${v} |`);
  } else {
    w(`| ${doc.columns.join(' | ')} |`);
    w(`|${doc.columns.map(() => '---').join('|')}|`);
    for (const r of doc.rows) w(`| ${r.join(' | ')} |`);
    if (doc.foot) {
      w();
      w(`*${doc.foot}*`);
    }
  }
  w();
}

// ------------------------------------------------------------------ title
const L1 = LEVELS[0];
w(`# Ghost Mystery: Level 1 screenplay`);
w();
w(`*${CASE_TITLE}* · Level 1, “${L1.name}” · suspects: ${SUSPECTS.map((s) => s.name).join(' and ')}`);
w();
w('Generated from the game’s own data by `npm run screenplay`, including the hand revisions for Bayesian soundness and for narrative. Every line below is what the player sees, in play order.');
w('Stage directions are in *italics*. **Designer’s notes** (marked) are not shown in the game.');
w();
w('---');
w();
w('## Title screen');
w();
w('**GHOST MYSTERY**');
w(`*${CASE_TITLE}: a Bayesian whodunit*`);
w();
w(UI.titleTagline);
w();
w(`**Level 1 · ${L1.name}**: ${L1.desc}`);
w();
w('---');
w();

// ------------------------------------------------------------------ awakening
w('## Scene 1: Thrown into ghostly existence');
w();
dir('INT. THE STUDY, NIGHT. Black. Then a sound, before anything else: ticking. Dozens of small mechanisms, near and far, never quite in step, like rain beginning on a roof. Over several seconds the room fades up in moonlight: a desk, an unlit lamp, shelves of brass and glass. Above the floor a faint glow gathers, thickens, and becomes a small ghost, flickering like a candle in a draught. A low synth pad, barely there.');
w();
thoughts(AWAKEN_LINES);
dir('The ghost drifts toward a tall shape against the wall: a grandfather clock, its case dark as strong tea, the pendulum swinging slow and unhurried.');
w();
thoughts(CLOCK_LINES);
dir('It reaches out. Its hand passes straight through the case. A hollow note, like a wet finger drawn around the rim of a glass; the room shudders slightly.');
w();
thoughts(CLOCK_AFTER);
dir('It drifts to the window. Moonlight lies on the garden like frost. For a moment the pane brightens and becomes a mirror, and shows only the room.');
w();
thoughts(WINDOW_LINES);
dir('A glow gathers over a shape on the rug, the way light pools around a dropped coin. The player can move now.');
w();
thoughts(DRIFT_HINT);

// ------------------------------------------------------------------ the body
w('## Scene 2: The body');
w();
dir('The player drifts to the rug. Control is taken away. The music falls silent; there are only the clocks, and they seem to lean in. The camera pans slowly down and closes in on the body as the ghost sinks toward it.');
w();
const me = BODY_LINES.findIndex((l) => l.includes('it’s me'));
BODY_LINES.forEach((l, i) => {
  if (i === me) dir('A deep bell tolls. The clocks of the house, one after another, take up the note. The room shudders.');
  w(`> **GHOST** *(thought)*: ${l}`);
});
w();
dir('A warm flash. Another toll. The ghost shudders, and the room seems to tilt away from him.');
w();
thoughts(BODY_AFTER);

// ------------------------------------------------------------------ memories
w('## Scene 3: A memory returns');
w();
dir('MEMORY. An amber, softly blurred screen, like a photograph held too close to a flame. The ticking of the clocks fades to a murmur, as if heard through a wall. Faces rise out of the fog, one by one: the people who were in the house tonight. Everything in this scene is the ghost remembering, not seeing.');
w();
thoughts([MEMORY_INTRO], 'GHOST', 'remembering');
SUSPECTS.forEach((s, k) => {
  w(`### ${s.name}, ${s.role}`);
  w();
  thoughts([`“${s.memory}”`], 'GHOST', 'remembering');
  w(s.backstory);
  w();
  if (s.voices) {
    dir(s.voices.cue);
    w();
    for (const [who, words] of s.voices.lines) w(`> **${who === 'Voss' ? 'VOSS' : who.toUpperCase()}** *(memory)*: “${words}”`);
    w();
    if (s.voices.after) {
      w(s.voices.after);
      w();
    }
  }
  w(`**Tonight:** ${s.tonight}`);
  w();
  if (k < SUSPECTS.length - 1) {
    dir('The amber fogs over. Another face comes up through it.');
    w();
  }
});
w('### The memory ends');
w();
dir('The amber thins and fades. The ticking of the clocks returns, close and loud, as if a door had been opened.');
w();
thoughts(MEMORY_OUTRO);
dir('Back in the study. The room name and evidence counter appear.');
w();
thoughts(AFTER_MEMORY_THOUGHTS);
w('---');
w();

// ------------------------------------------------------------------ the house
w('## The house (exploration notes)');
w();
w('Two floors joined by the hallway stairs. Anything searchable shimmers identically, whether it hides a clue or nothing at all. A clue’s hiding place only becomes searchable once it is the next clue.');
w();
for (const floor of [0, 1]) {
  w(`**${floor === 0 ? 'Ground floor' : 'Upstairs'}:** ${ROOMS.filter((r) => r.floor === floor).map((r) => r.name).join(' → ')}`);
  w();
}
w('### First time entering each room');
w();
for (const r of ROOMS.filter((r) => r.thought)) w(`- **${r.name}**: *${r.thought}*`);
w();
w('### Every searchable spot');
w();
w('| Room | Spot | Holds | What the ghost says if it holds nothing relevant |');
w('|---|---|---|---|');
const active = new Set(CLUES.map((c) => c.id));
for (const s of SEARCHABLES.filter((x) => x.kind !== 'stairs')) {
  const holds = s.holds === 'prior' ? 'Household log' : s.holds && active.has(s.holds) ? `**Clue: ${CLUES.find((c) => c.id === s.holds)!.title}**` : '';
  const noise = s.noise ? s.noise.join(' ') : '';
  w(`| ${roomAt(s.floor, s.x).name} | ${s.label} | ${holds} | ${holds ? '' : noise} |`);
}
w();
w('---');
w();

// ------------------------------------------------------------------ the household log
w('## Evidence 0: The household log (the prior)');
w();
dir('On the side table in the study. The player searches it; the evidence screen opens.');
w();
w('**Evidence card: the household log, tonight (6 – 10 pm)**');
w();
evidence({
  kind: 'table',
  columns: ['Name', 'Signed in', 'Signed out', 'Inside, 6–10 pm'],
  rows: allSuspects().map((s) =>
    SUSPECTS.some((x) => x.id === s.id) ? [s.name, s.logIn, s.logOut, `${s.hoursInside} h`] : [s.name, s.absentLog[0], s.absentLog[1], '—'],
  ),
});
w(`> **GHOST** *(thought)*: ${PRIOR_SHEET.text}`);
w('>');
w(`> **GHOST** *(thought)*: ${PRIOR_SHEET.context}`);
w();
for (const s of SUSPECTS) {
  w(`**${s.name}** · *${s.name} was inside for ${s.hoursInside} hours.* Everyone together: ${PRIOR_SHEET.total} hours (shown as half-hour blocks, ${s.name}’s lit).`);
  w(`The lit blocks are ${s.name}’s share of all the time anyone spent inside. More time inside means more chances to reach my tea, so a bigger starting share of suspicion.`);
  w();
}
w('**Where my suspicion starts**: Each person’s share of the time inside becomes their starting share of suspicion. *(a single bar, names only)*');
w();
w(`**What the starting point means**: ${PRIOR_SHEET.lesson}`);
w('Every clue I find from now on will shift these shares. How far each one shifts them is the whole art.');
w();
const prior = SUSPECTS.map((s) => s.hoursInside / PRIOR_SHEET.total);
w(`> **Designer’s note (not shown in game):** prior = hours inside ÷ total: ${SUSPECTS.map((s, i) => `${s.name} ${s.hoursInside}/${PRIOR_SHEET.total} = ${pct(prior[i])}`).join(', ')}. Clara starts ahead purely on opportunity.`);
w('>');
w('> - The prior is a *subjective* starting point (degree of belief), and hours-inside is a transparent stand-in for it. Any coherent starting point is legitimate; what matters is that the evidence is allowed to move it.');
w(`> - The log is also what closes the hypothesis set. The stretch step in every update is only valid because ${SUSPECTS.map((s) => `“${s.name}”`).join(' and ')} are mutually exclusive and cover every possibility. The ghost says so out loud; keep that assumption visible in later levels, and give any third suspect a share.`);
w('> - Neither share is ever 0% or 100%, and no rating maps to 0 or 1, so no belief can become immune to later evidence.');
w('> - The hours-inside rule counts time before the tea existed. That is acceptable only because the ghost does not yet know when the tea was tampered with. A stricter alternative would count only the half hour the cup stood on the desk.');
w();
thoughts([...PRIOR_SHEET.reaction, PRIOR_SHEET.nextThought]);
w('---');
w();

// ------------------------------------------------------------------ clues
let belief = prior.slice();
const chainRows: string[] = [];
chainRows.push(`| Start (household log) | — | — | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`);
/** A clue's strength between the two suspects: its likelihood ratio, in whoever's favour. */
function strength(a: number, b: number) {
  const [A, B] = SUSPECTS.map((s) => s.name.replace('Mr. ', ''));
  const r = a / b;
  const big = r >= 1 ? r : 1 / r;
  const who = r >= 1 ? A : B;
  const f = (x: number) => String(+x.toFixed(2));
  const text = r >= 1 ? `${f(r)} : 1 for ${who}` : `${f(r)} : 1, i.e. ${f(big)} : 1 for ${who}`;
  return { text, short: `${f(big)} : 1 for ${who}`, word: big < 2 ? 'weak' : big < 4 ? 'moderate' : 'strong' };
}
CLUES.forEach((c, k) => {
  const spot = SEARCHABLES.find((s) => s.holds === c.id)!;
  const concept = CONCEPTS[Math.min(k, CONCEPTS.length - 1)];
  w(`## Clue ${k + 1} of ${CLUES.length}: ${c.title}`);
  w();
  const spotName = spot.label.includes('’s ') ? spot.label : `the ${spot.label.toLowerCase()}`;
  dir(`${roomAt(spot.floor, spot.x).name}${spot.floor === 1 ? ' (upstairs)' : ''}: the player searches ${spotName}. ${SEARCH_ACTION[c.id] ?? 'Something gives way'}; a chime; the evidence screen opens.`);
  w();
  w(`### Page: The clue`);
  w();
  w(`*Found: ${c.found}*`);
  w();
  w(`**Evidence card: ${c.title}**`);
  w();
  evidence(c.evidence);
  if (c.memory) {
    dir('MEMORY. A flicker: a cup set down on a blotter, the saucer chiming against the wood. Somewhere in the house, a clock strikes the half hour. The ghost goes very still, as he did before the amber memory.');
    thoughts([c.memory, ...c.context]);
  } else thoughts(c.context);
  w(`### Page: Lesson ${k + 1}: ${concept.title}`);
  w();
  w(conceptBody(concept, CLUES.length, 1));
  w();
  w('*(Below: the current suspicion bar, names only.)*');
  w();
  SUSPECTS.forEach((s, i) => {
    w(`### Page: Suppose ${s.name} did it.`);
    w();
    w(`**How likely would I be to find ${c.short}?**`);
    w(`*${UI.ratePrompt}*`);
    w();
    thoughts([c.hints[i]]);
    w(`[ ${UI.ratings.join(' ] [ ')} ]`);
    w();
    w(`*${UI.rateFooter}* After choosing: “You rated it N: …”`);
    w();
  });
  w('### Page: Update (the player steps through)');
  w();
  for (const [name, cap] of UI.steps) w(`- **${name}**: ${cap}`);
  w(`- Step 1 labels each bar “rated N: ${UI.keepWords.join(' / ')}”; step 3 marks each bar ▲ grew / ▼ shrank, with the old size outlined, and says in words how each share changed.`);
  w();
  w(`### Page: Recap: ${c.trap}`);
  w();
  w(c.lesson);
  w();
  w('*(Below: your board before this clue, and your board now.)*');
  w();

  // designer's Bayes box: the intended ratings (the story model sits exactly on the 1-5 scale)
  const ratingIdx = c.likelihoods.map(nearest);
  const lik = ratingIdx.map((r) => UI.ratingValues[r]);
  const kept = belief.map((b, i) => b * lik[i]);
  const total = kept.reduce((a, b) => a + b, 0);
  const after = update(belief, lik);
  const note = NOTES[c.id] ?? {};
  const ratio = strength(lik[0], lik[1]);
  const swing = update(belief, [0.9, 0.1])[0];
  w('> **Designer’s note (not shown in game): the intended reasoning**');
  w('>');
  w(
    `> - Intended ratings${k === 0 ? ` (1–5 map to ${UI.ratingValues.join(', ')})` : ''}: ${SUSPECTS.map((s, i) => `${s.name} **${ratingIdx[i] + 1}** (${lik[i]})`).join(', ')}. ` +
      `Likelihood ratio ${ratio.text}${note.ratio ?? ''}.`,
  );
  w(`> - With those ratings: before ${SUSPECTS.map((s, i) => `${s.name} ${pct(belief[i])}`).join(', ')} → keep ${SUSPECTS.map((s, i) => `${pct(belief[i])} × ${lik[i]} = ${pct(kept[i])}`).join('; ')} → together ${pct(total)} → stretched: ${SUSPECTS.map((s, i) => `**${s.name} ${pct(after[i])}**`).join(', ')}.`);
  w(`> - Trap: *${c.trap}*${(note.trap ?? '.').replace('{swing}', pct(swing))}`);
  for (const x of note.extra ?? []) w(`> - ${x}`);
  w();
  belief = after;
  chainRows.push(`| ${k + 1}. ${c.title} | ${ratingIdx.map((r) => r + 1).join(' / ')} | ${ratio.short} (${ratio.word}) | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`);

  dir('The overlay closes. Back in the house.');
  w();
  thoughts([...c.reaction, c.nextThought]);
  w('---');
  w();
});

// ------------------------------------------------------------------ the accusation
w('## The accusation');
w();
dir('After the last clue the body glows again, faintly, like a lamp left burning in an empty house. The player drifts to it and chooses “Name the culprit”. Between ticks, the clocks seem to hold their breath.');
w();
for (const l of ACCUSE_LINES) w(l);
w();
w(`[ ${SUSPECTS.map((s) => `${s.name}, ${s.role}`).join(' ] [ ')} ]  *(each with the player’s suspicion as a bar, no numbers)*`);
w();
const culprit = SUSPECTS[CULPRIT_INDEX];
const wrong = SUSPECTS.find((_, i) => i !== CULPRIT_INDEX)!;
w(`### If the player names ${culprit.name}: **Case Closed**`);
w();
dir('A bell tolls: one clear note, and every clock in the house answers it. The music brightens.');
w();
thoughts(EPILOGUE_CORRECT);
dir('The ghost rises and fades.');
w();
w(`**Level 1 solved** · You named ${culprit.name}, and you were right.`);
w('A chart of how the player’s suspicion moved, clue by clue, and the trap behind each clue. Then:');
w('“Your board moved most at clue N, (title). Every rating you made was yours, and the evidence added up.”');
w();
w('[ Read all lessons ] [ Title ] [ **Play Level 2 ›** ]');
w();
w(`### If the player names ${wrong.name}: **Case Reopened**`);
w();
thoughts([`“${wrong.name}!” ${EPILOGUE_WRONG[0]}`, ...EPILOGUE_WRONG.slice(1)]);
w(`**Not this time** · You named ${wrong.name}. It was not them.`);
w('“Look again at how strongly each clue fitted each story: a vivid clue can feel stronger than it is, and a quiet one can matter more than it seems.”');
w();
w('[ Read all lessons ] [ Title ] [ Try Level 1 again ]');
w();
const short = (x: (typeof SUSPECTS)[number]) => x.name.replace('Mr. ', '');
const obj = (x: (typeof SUSPECTS)[number]) => (x.pronoun === 'she' ? 'her' : 'him');
w('> **Designer’s note (not shown in game): the closing text depends on two things, whom the player named and whom the player’s own board favoured.**');
w('>');
w(`> - Named ${short(culprit)}, board favoured ${short(culprit)} (the intended path): “Every rating you made was yours, and the evidence added up.”`);
w(`> - Named ${short(culprit)}, board favoured ${short(wrong)}: “Right, but not by your own evidence. Your board still leaned toward ${wrong.name}. Which of your ratings kept ${obj(wrong)} there?” A right answer reached by hunch should not be praised as good reasoning.`);
w(`> - Named ${short(wrong)}, board favoured ${short(wrong)}: Case Reopened as written, plus: “Your board pointed to ${wrong.name}, so some of your ratings put it there. A sound process can still end wrong when a rating is off; go back to the ratings, not to a hunch.”`);
w(`> - Named ${short(wrong)}, board favoured ${short(culprit)}: Case Reopened, plus: “Your own board favoured ${culprit.name}, and you accused ${wrong.name} anyway. That was the gut feeling I warned you about.”`);
w();
w('---');
w();

// ------------------------------------------------------------------ appendix
w('## Appendix: the intended reasoning chain (designer’s notes)');
w();
w(`**How ratings become numbers.** A rating is the likelihood P(clue | this person did it): ${UI.ratingValues.map((v, k) => `${k + 1} → ${v}`).join(', ')}. It never reaches 0 or 1, so no story can be ruled out, or proved, by one clue. Only the *ratio* of the two ratings moves the board, which is why a clue rated the same for both suspects changes nothing.`);
w();
w('The board after each clue, if the player’s ratings match the intended ratings (a model answer, not an answer key):');
w();
w(`| After | Ratings (${SUSPECTS.map((s) => s.name).join(' / ')}) | Likelihood ratio | ${SUSPECTS.map((s) => s.name).join(' | ')} |`);
w(`|---|---|---|${SUSPECTS.map(() => '---').join('|')}|`);
for (const r of chainRows) w(r);
w();
const order = ['weak', 'moderate', 'strong'];
const strengths = CLUES.map((c) => strength(c.likelihoods[0], c.likelihoods[1]).word).sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', ');
w(`The old chain gave the letter (“vivid but weak”), the ledger (“genuinely diagnostic”) and the cufflink (“modest”) the same strength, 2.33 : 1, so the lessons contradicted the numbers. Strength now matches the lesson: ${strengths}. The ledger is deliberately only 3 : 1 because the ghost himself allows an honest supplier.`);
w();
// checks, computed rather than asserted
const liks = CLUES.map((c) => c.likelihoods);
const finalFrom = (p0: number) => liks.reduce((b, l) => update(b, l), [p0, 1 - p0])[0];
const orders = [liks, liks.slice().reverse(), [liks[2], liks[0], liks[4], liks[1], liks[3]]];
const sameAnyOrder = orders.every((o) => Math.abs(o.reduce((b, l) => update(b, l), prior)[0] - belief[0]) < 1e-12);
const fmt1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const listOf = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
w(
  `**Checks run** (by the generator, every time). Every posterior above is computed from the ratings. The final board is ${sameAnyOrder ? 'the same' : 'NOT the same'} for any order of the ${numberWord(CLUES.length)} clues. ` +
    `Starting Clara at 10%, 50%, 90% and 99% (same ratings) ends at ${listOf([0.1, 0.5, 0.9, 0.99].map((p) => fmt1(finalFrom(p))))}: priors wash out only when everyone shares the same likelihoods.`,
);
w();
w('**Assumptions the game makes (keep them visible in later levels).**');
w();
w(`1. One culprit, and the ${numberWord(SUSPECTS.length)} suspects cover every possibility, so the stretch step is valid.`);
w('2. Each clue’s likelihood depends only on who did it, not on other clues found (conditional independence given the culprit). Watch pairs that share a story.');
w('3. Background facts (Voss parks by the garden gate; Graves and Pip were out) are established before a clue uses them.');
w('4. Verbal labels map to fixed numbers for every player. People read “likely” differently, so the labels and numbers must stay locked together.');
w();

mkdirSync('screenplay', { recursive: true });
writeFileSync('screenplay/level-1.md', out.join('\n'));
console.log(`wrote screenplay/level-1.md (${out.length} lines)`);
