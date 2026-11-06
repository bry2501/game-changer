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
  AFTER_MEMORY_THOUGHTS,
  AWAKEN_LINES,
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
  FINAL_THOUGHT,
  MEMORY_INTRO,
  MEMORY_OUTRO,
  PRIOR_SHEET,
  SUSPECTS,
  WINDOW_LINES,
  allSuspects,
  setCase,
} from '../src/data/case1';
import { CONCEPTS } from '../src/data/lessons';
import { ROOMS, SEARCHABLES, roomAt } from '../src/data/house';
import { LEVELS } from '../src/state/GameState';
import { update } from '../src/bayes/engine';

setCase('easy');

/** UI copy mirrored from the scenes (TitleScene, EvidenceScene, AccuseScene). */
const UI = {
  titleTagline: 'The same night, three times. Solve a level to unlock the next.',
  ratePrompt: 'Rate it from 1 (very unlikely) to 5 (very likely). 3 means you are not sure.',
  rateFooter: 'There is no right answer to match. Choose what makes sense to you.',
  ratings: ['1 Very unlikely', '2 Unlikely', '3 Not sure', '4 Likely', '5 Very likely'],
  ratingValues: [0.1, 0.3, 0.5, 0.7, 0.9],
  keepWords: ['keeps very little', 'keeps less than half', 'keeps half', 'keeps most', 'keeps almost all'],
  steps: [
    ['Before', 'Before the clue. Each bar is one person’s share of my suspicion. Together they fill the whole line.'],
    ['Step 1 of 3: shrink', 'Each share shrinks by how well the clue fits that person’s story. A good fit keeps most of it; a poor fit keeps little. The faded part is what the clue took away.'],
    ['Step 2 of 3: together', 'Put what’s left side by side. It no longer fills the whole line, because the clue took a piece of every share.'],
    ['Step 3 of 3: stretch', 'Stretch what’s left back to the full line, keeping the proportions. Whoever kept more than the others grows; whoever kept less shrinks.'],
  ],
  accuse: [
    'Back beside my body. It is time to name the culprit.',
    'Your board shows these beliefs. Who did it?',
    'Choose carefully. A ghost only gets one accusation.',
  ],
};

const out: string[] = [];
const w = (s = '') => out.push(s);
const dir = (s: string) => w(`*${s}*`);
const thoughts = (lines: string[], who = 'GHOST') => {
  for (const l of lines.filter(Boolean)) w(`> **${who}** *(thought)*: ${l}`);
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
w('Generated from the game’s own data by `npm run screenplay`. Every line below is what the player sees, in play order.');
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
dir('INT. THE STUDY, NIGHT. Black. The ticking of many clocks. Over several seconds the room fades up in moonlight. A faint glow gathers above the floor and becomes a small ghost, flickering. A soft, low synth pad.');
w();
thoughts(AWAKEN_LINES);
dir('The ghost drifts slowly to the grandfather clock.');
w();
thoughts(CLOCK_LINES);
dir('It reaches out. Its hand passes straight through the clock. A hollow sound; the room shudders slightly.');
w();
thoughts(CLOCK_AFTER);
dir('It drifts to the window. Moonlight on the garden. For a moment the pane brightens, showing only the room.');
w();
thoughts(WINDOW_LINES);
dir('A glow appears over a shape on the rug. The player can move now.');
w();
thoughts([DRIFT_HINT]);

// ------------------------------------------------------------------ the body
w('## Scene 2: The body');
w();
dir('The player drifts to the rug. Control is taken away. The music falls silent; only the clocks. The camera slowly pans down and closes in on the body as the ghost sinks toward it.');
w();
const me = BODY_LINES.findIndex((l) => l.includes('it’s me'));
BODY_LINES.forEach((l, i) => {
  if (i === me) dir('A deep bell tolls. The room shudders.');
  w(`> **GHOST** *(thought)*: ${l}`);
});
w();
dir('A warm flash. Another toll. Memories return.');
w();

// ------------------------------------------------------------------ memories
w('## Scene 3: A memory returns');
w();
dir('An amber, softly blurred screen. Faces rise out of the fog.');
w();
w(`*${MEMORY_INTRO}*`);
w();
for (const s of SUSPECTS) {
  w(`### ${s.name}, ${s.role}`);
  w();
  w(`> “${s.memory}”`);
  w();
  w(s.backstory);
  w();
  w(`**Tonight:** ${s.tonight}`);
  w();
}
w('### The memory ends');
w();
for (const l of MEMORY_OUTRO) w(`> ${l}`);
w();
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
  columns: ['Name', 'Signed in', 'Signed out', 'Inside'],
  rows: allSuspects().map((s) =>
    SUSPECTS.some((x) => x.id === s.id) ? [s.name, s.logIn, s.logOut, `${s.hoursInside} h`] : [s.name, s.absentLog[0], s.absentLog[1], '—'],
  ),
});
thoughts([`${PRIOR_SHEET.text} ${PRIOR_SHEET.context}`]);
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
w();
thoughts([...PRIOR_SHEET.reaction, PRIOR_SHEET.nextThought]);
w('---');
w();

// ------------------------------------------------------------------ clues
let belief = prior.slice();
const chainRows: string[] = [];
chainRows.push(`| Start (household log) | — | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`);
CLUES.forEach((c, k) => {
  const spot = SEARCHABLES.find((s) => s.holds === c.id)!;
  const concept = CONCEPTS[Math.min(k, CONCEPTS.length - 1)];
  w(`## Clue ${k + 1} of ${CLUES.length}: ${c.title}`);
  w();
  dir(`${roomAt(spot.floor, spot.x).name}${spot.floor === 1 ? ' (upstairs)' : ''}: the player searches the ${spot.label.toLowerCase()}. A drawer slides, a door swings, or an object is pushed aside; a chime; the evidence screen opens.`);
  w();
  w(`### Page: The clue`);
  w();
  w(`*Found: ${c.found}*`);
  w();
  w(`**Evidence card: ${c.title}**`);
  w();
  evidence(c.evidence);
  thoughts([c.context]);
  w(`### Page: Lesson ${k + 1}: ${concept.title}`);
  w();
  w(concept.body);
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

  // designer's Bayes box: the story model, mapped to the nearest ratings
  const ratingIdx = c.likelihoods.map(nearest);
  const lik = ratingIdx.map((r) => UI.ratingValues[r]);
  const kept = belief.map((b, i) => b * lik[i]);
  const total = kept.reduce((a, b) => a + b, 0);
  const after = update(belief, lik);
  const lr = (a: number, b: number) => +(a / b).toFixed(2);
  w('> **Designer’s note (not shown in game): the intended reasoning**');
  w('>');
  w(`> - Story model likelihoods: ${SUSPECTS.map((s, i) => `${s.name} ${c.likelihoods[i]}`).join(', ')} (ratio ${lr(c.likelihoods[0], c.likelihoods[1])} : 1). Closest ratings: ${SUSPECTS.map((s, i) => `${s.name} **${ratingIdx[i] + 1}**`).join(', ')}.`);
  w(`> - With those ratings: before ${SUSPECTS.map((s, i) => `${s.name} ${pct(belief[i])}`).join(', ')} → keep ${SUSPECTS.map((s, i) => `${pct(belief[i])} × ${lik[i]} = ${pct(kept[i])}`).join('; ')} → together ${pct(total)} → stretched: ${SUSPECTS.map((s, i) => `**${s.name} ${pct(after[i])}**`).join(', ')}.`);
  w(`> - Trap: *${c.trap}*.`);
  w();
  belief = after;
  chainRows.push(`| ${k + 1}. ${c.title} | ${ratingIdx.map((r) => r + 1).join(' / ')} | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`);

  dir('The overlay closes. Back in the house.');
  w();
  thoughts([...c.reaction, c.nextThought]);
  w('---');
  w();
});

// ------------------------------------------------------------------ the accusation
w('## The accusation');
w();
dir(`After the last clue the body glows again. The player drifts to it and chooses “Name the culprit”. ${FINAL_THOUGHT}`);
w();
for (const l of UI.accuse) w(l);
w();
w(`[ ${SUSPECTS.map((s) => `${s.name}, ${s.role}`).join(' ] [ ')} ]  *(each with the player’s suspicion as a bar, no numbers)*`);
w();
w(`### If the player names ${SUSPECTS[CULPRIT_INDEX].name}: **Case Closed**`);
w();
dir('A bell tolls. The music brightens.');
w();
thoughts(EPILOGUE_CORRECT);
dir('The ghost rises and fades.');
w();
w(`**Level 1 solved** · You named ${SUSPECTS[CULPRIT_INDEX].name}, and you were right.`);
w('A chart of how the player’s suspicion moved, clue by clue, and the trap behind each clue. Then:');
w('“Your board moved most at clue N, (title). Every rating you made was yours, and the evidence added up.”');
w();
w('[ Read all lessons ] [ Title ] [ **Play Level 2 ›** ]');
w();
const wrong = SUSPECTS.find((_, i) => i !== CULPRIT_INDEX)!;
w(`### If the player names ${wrong.name}: **Case Reopened**`);
w();
thoughts([`“${wrong.name}!” ${EPILOGUE_WRONG[0]}`, ...EPILOGUE_WRONG.slice(1)]);
w(`**Not this time** · You named ${wrong.name}. It was not them.`);
w('“Look again at how strongly each clue fitted each story: a vivid clue can feel stronger than it is, and a quiet one can matter more than it seems.”');
w();
w('[ Read all lessons ] [ Title ] [ Try Level 1 again ]');
w();
w('---');
w();

// ------------------------------------------------------------------ appendix
w('## Appendix: the intended reasoning chain (designer’s notes)');
w();
w('The board after each clue, if the player’s ratings match the story model (nearest 1–5 rating). The vivid letter puts Clara ahead; the quieter, lopsided clues bring Voss through.');
w();
w(`| After | Ratings (${SUSPECTS.map((s) => s.name).join(' / ')}) | ${SUSPECTS.map((s) => s.name).join(' | ')} |`);
w(`|---|---|${SUSPECTS.map(() => '---').join('|')}|`);
for (const r of chainRows) w(r);
w();

mkdirSync('screenplay', { recursive: true });
writeFileSync('screenplay/level-1.md', out.join('\n'));
console.log(`wrote screenplay/level-1.md (${out.length} lines)`);
