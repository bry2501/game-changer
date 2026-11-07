/**
 * Generates the whole game's screenplay from its own data, so the script can never
 * drift from what the game says. Run:  npm run screenplay
 *
 * Story text, evidence, hints, lessons, the house and the endings come from src/data.
 * Designer's notes that are not in the data live below, in NOTES; every number in them
 * is computed, not typed.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  ENDING_CORRECT,
  ENDING_WRONG,
  EndLine,
  Evidence,
  HOW_IT_WORKS,
  LOG_ROWS,
  MEMORY_INTRO,
  MEMORY_OUTRO,
  PRIOR_SHEET,
  SUSPECTS,
  TITLE_TAGLINE,
  WINDOW_LINES,
} from '../src/data/case1';
import { CONCEPTS, numberWord } from '../src/data/lessons';
import { KEEP_WORDS, RATING_VALUES, RATING_WORDS, UNCHANGED, UPDATE_STEPS } from '../src/data/ui';
import { ROOMS, SEARCHABLES, roomAt } from '../src/data/house';
import { chain, update } from '../src/bayes/engine';

/** Designer's notes per clue, beyond what is computed (not shown in the game). */
const NOTES: Record<string, { ratio?: string; trapLabel?: string; trap?: string; extra?: string[] }> = {
  letter: {
    ratio: ', barely worth mentioning',
    trap: '. A player who rates 5 / 1 jumps to about {swing51} Clara on a draft that was never sent.',
  },
  will: {
    trapLabel: 'Double counting (old news)',
    trap: '. A player who rates 5 / 2 jumps to about {swing52} Clara on a fact the board already carried.',
    extra: [
      'Symmetry: both suspects lose under the new will (Clara the house, Thomas his cottage and his garden), and the single signing on Monday at ten threatens them equally, so the schedule favours neither. The ghost says so.',
      'Independence: the draft’s existence depends on John, not on the culprit, so it is rated on its own.',
    ],
  },
  boot: {
    extra: [
      'Background fact “Thomas leaves his bicycle by the garden gate” is stated in Scene 3, before the clue. “Edgar mops the floor every evening before six” is first stated on this clue’s page; the household-log line “Edgar went home at six” is the natural place to add it if you want it known beforehand.',
    ],
  },
  foxgloves: {
    trap: ', plus the real prosecutor’s fallacy (rating ≠ board), taught in the ghost’s line after the recap.',
    extra: [
      'The innocent explanation is built in: a gardener trims plants all the time, which is why this is 3 : 1 and not stronger.',
      'Independence: rated on its own. It does not lean on the boot print, even though the ghost walks from one to the other.',
    ],
  },
  slip: {
    trapLabel: 'Myside bias: evidence that cuts against your favourite',
    trap: '. A player who stops searching after the foxgloves never finds this clue. A player who dismisses it (3 / 3) ends the game with Clara at {dismiss} instead of {final}.',
    extra: [
      'The innocent explanation is planted, not invented afterwards: Scene 3 says Clara has nagged John about his sleep since the spring. The ending reveals the slip was a peace offering. A rating of 2 (unlikely, not impossible) is the model answer for what the ghost knows at this point.',
    ],
  },
  phone: {
    extra: [
      'Timeline: the call covers the whole window the cup stood on the desk (9:30 to a little before 10).',
      'The 7:48 call for Thomas is deliberately unmodelled (likelihood ratio 1). The ending closes it on purpose: some scraps stay unexplained, and the verdict does not need them.',
    ],
  },
  knife: {
    trap: '. The old label “Prosecutor’s fallacy” was a misnomer: that fallacy is confusing P(evidence | guilt) with P(guilt | evidence). It is taught where it actually occurs, at the foxgloves and at the accusation.',
    extra: [
      'Independence check: the Thomas page rests only on his two chances to lose the knife. It does not lean on the boot print or the foxgloves, which would make the clues dependent given Thomas is the murderer.',
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
const short = (i: number) => SUSPECTS[i].name.replace('Mr. ', '');
const liks = CLUES.map((c) => c.likelihoods);
const prior = SUSPECTS.map((s) => s.hoursInside / PRIOR_SHEET.total);
const rating = (v: number) => RATING_VALUES.findIndex((r) => Math.abs(r - v) < 1e-9) + 1;
/** Clara's final share if one clue's ratings were swapped for others. */
const finalWith = (k: number, l: number[]) => chain(prior, liks.map((x, j) => (j === k ? l : x)))[CLUES.length][0];

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

/** A clue's strength between the two suspects: its likelihood ratio, in whoever's favour. */
function strength(a: number, b: number) {
  const r = a / b;
  const f = (x: number) => String(+x.toFixed(2));
  if (Math.abs(r - 1) < 1e-9) return { text: '1 : 1', short: '1 : 1', word: 'old news' };
  const big = r >= 1 ? r : 1 / r;
  const who = r >= 1 ? short(0) : short(1);
  const text = r >= 1 ? `${f(r)} : 1 for ${who}` : `${f(r)} : 1, i.e. ${f(big)} : 1 for ${who}`;
  return { text, short: `${f(big)} : 1 for ${who}`, word: big < 2 ? 'weak' : big < 4 ? 'moderate' : 'strong' };
}

// ------------------------------------------------------------------ title
w(`# Ghost Mystery: ${CASE_TITLE.replace("'", '’')} (screenplay)`);
w();
w(`*A Bayesian whodunit* · ${numberWord(CLUES.length)} clues · suspects: ${SUSPECTS.map((s) => s.name).join(' and ')}`);
w();
w('Generated from the game’s own data by `npm run screenplay`. It is a complete, standalone game: there are no further levels. Every line below is what the player sees, in play order.');
w('Stage directions are in *italics*. **Designer’s notes** (marked) are not shown in the game.');
w();
w('---');
w();
w('## Title screen');
w();
w('**GHOST MYSTERY**');
w(`*${CASE_TITLE}: a Bayesian whodunit*`);
w();
w(TITLE_TAGLINE);
w();
w(`**How it works**: ${HOW_IT_WORKS}`);
w();
w('[ Begin ]  *(and Continue, when a saved game exists)*');
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
  if (i === me) dir('A deep bell tolls. The clocks of the house, one after another, take up the note. Ten strokes. The room shudders.');
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
    for (const [who, words] of s.voices.lines) w(`> **${who.toUpperCase()}** *(memory)*: “${words}”`);
    w();
    if (s.voices.after) {
      w(s.voices.after);
      w();
    }
  }
  if (s.tonight) {
    w(`**Tonight:** ${s.tonight}`);
    w();
  }
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
for (const s of SEARCHABLES.filter((x) => x.kind !== 'stairs')) {
  const clue = CLUES.find((c) => c.id === s.holds);
  const holds = s.holds === 'prior' ? 'Household log' : clue ? `**Clue: ${clue.title}**` : '';
  w(`| ${roomAt(s.floor, s.x).name} | ${s.label} | ${holds} | ${holds ? '' : (s.noise ?? []).join(' ')} |`);
}
w();
w('> **Designer’s note (not shown in game):** the kitchen and morning room are not explorable. Clara spends the whole hour in the kitchen, which is why her room and the landing are empty; the light under the kitchen door is visible in the ending. The office holds no clue in this version; it is atmosphere only.');
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
evidence({ kind: 'table', columns: ['Name', 'Signed in', 'Signed out'], rows: LOG_ROWS });
w(`> **GHOST** *(thought)*: ${PRIOR_SHEET.text}`);
w('>');
w(`> **GHOST** *(thought)*: ${PRIOR_SHEET.context}`);
w();
SUSPECTS.forEach((s, i) => {
  w(`**${s.name}** · *How long was ${s.name} inside?* The log says ${s.name} signed in at ${s.logIn} and out at ${s.logOut}. How many hours between 6 and 10 pm was ${s.pronoun} in the house? *(four blocks, “1 hour” to “4 hours”; choosing one lights it and every block to its left; the player lights the right number to continue)*`);
  w(`If wrong: “Not quite. Check the times again: in at ${s.logIn}, out at ${s.logOut}, and only the hours between 6 and 10 pm count.”`);
  w(`Once right: *${s.name} was inside for ${s.hoursInside} hours.* The lit blocks are ${s.name}’s share of all the time anyone spent inside, ${s.hoursInside} out of ${PRIOR_SHEET.total} hours.${i === 0 ? ' More time inside means more chances to reach my tea, so a bigger starting share of suspicion.' : ''}`);
  w();
});
w(`**Where my suspicion starts**: ${PRIOR_SHEET.lesson} *(the hour blocks from the two log pages slide into one row of five, the gaps close, and the row becomes the starting bar; each name sits under its share with “N of 5 hours”)**`);
w();
w(`> **Designer’s note (not shown in game):** prior = hours inside ÷ total: ${SUSPECTS.map((s, i) => `${s.name} ${s.hoursInside}/${PRIOR_SHEET.total} = ${pct(prior[i])}`).join(', ')}. Clara starts ahead purely on opportunity.`);
w('>');
w('> - The prior is a *subjective* starting point (degree of belief), and hours-inside is a transparent stand-in for it. Any coherent starting point is legitimate; what matters is that the evidence is allowed to move it.');
w(`> - The log is also what closes the hypothesis set. The stretch step in every update is only valid because ${SUSPECTS.map((s) => `“${s.name}”`).join(' and ')} are mutually exclusive and cover every possibility. The ghost says so out loud; the ending restates it. If you ever add a third suspect, give them a share.`);
w('> - Neither share is ever 0% or 100%, and no rating maps to 0 or 1, so no belief can become immune to later evidence.');
w('> - The hours-inside rule counts time before the tea existed. That is acceptable only because the ghost does not yet know when the tea was tampered with. A stricter alternative would count only the half hour the cup stood on the desk.');
w();
thoughts([...PRIOR_SHEET.reaction, PRIOR_SHEET.nextThought]);
w('---');
w();

// ------------------------------------------------------------------ clues
let belief = prior.slice();
const chainRows: string[] = [`| Start (household log) | — | — | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`];
CLUES.forEach((c, k) => {
  const spot = SEARCHABLES.find((s) => s.holds === c.id)!;
  const concept = CONCEPTS[k];
  w(`## Clue ${k + 1} of ${CLUES.length}: ${c.title}`);
  w();
  const spotName = spot.label.includes('’s ') ? spot.label : `the ${spot.label.toLowerCase()}`;
  dir(`${roomAt(spot.floor, spot.x).name}${spot.floor === 1 ? ' (upstairs)' : ''}: the player searches ${spotName}. ${c.searchCue}; a chime; the evidence screen opens.`);
  w();
  w('### Page: The clue');
  w();
  w(`*${c.found}*`);
  w();
  w(`**Evidence card: ${c.title}**`);
  w();
  evidence(c.evidence);
  if (c.memory) {
    dir(c.memoryCue ?? 'MEMORY.');
    thoughts([c.memory, ...c.context]);
  } else thoughts(c.context);
  w(`### Page: Lesson ${k + 1}: ${concept.title}`);
  w();
  w(concept.body);
  w();
  w('*(Below: the current suspicion bar, names only.)*');
  w();
  SUSPECTS.forEach((s, i) => {
    w(`### Page: Suppose ${s.name} is the murderer.`);
    w();
    w(`**How likely would I be to find ${c.short}?**`);
    w();
    thoughts([c.hints[i]]);
    w(`[ ${RATING_WORDS.map((r, n) => `${n + 1} ${r} ${Math.round(RATING_VALUES[n] * 100)}%`).join(' ] [ ')} ]`);
    w();
    w('After choosing: “You rated it N: …, a P% chance.”');
    w();
  });
  w('### Page: Update (the player steps through, on a square of possible worlds)');
  w();
  for (const [name, cap, key] of UPDATE_STEPS) w(`- **${name}**: ${cap.replace('{n}', numberWord(SUSPECTS.length))} *(Key: ${key})*`);
  w(`- Step 1 labels each suspect “rated N: ${KEEP_WORDS.join(' / ')}”; step 3 marks each ▲ grew / ▼ shrank, with the old border dashed, and says in words how each share changed.`);
  if (Math.abs(c.likelihoods[0] - c.likelihoods[1]) < 1e-9) w(`- When both ratings match, step 3 marks both “unchanged” and says so in words: “${UNCHANGED}”`);
  w();
  w('### Page: The math');
  w();
  w(`*(The same update as Bayes’ rule, one hypothesis per suspect: ${SUSPECTS.map((s, i) => `H${i + 1} “${s.name} is the murderer”`).join(', ')}, and E finding ${c.short}. P(H1 | E) = P(H1) · P(E | H1) ÷ [P(H1) · P(E | H1) + P(H2) · P(E | H2)]. One formula that transforms in place as the player steps through: the rule in symbols with a key; then each symbol becomes the person or the clue (P(Clara) · P(letter given Clara) over the same for both suspects); then each becomes the player’s number, worked to the answer, with the second suspect’s line beneath.)*`);
  {
    const lik = c.likelihoods;
    const j = belief.map((p, i) => p * lik[i]);
    const pE = j.reduce((a, b) => a + b, 0);
    w();
    w(`- **P(H1), P(H2)**, your board so far: ${SUSPECTS.map((s, i) => `${s.name} ${pct(belief[i])}`).join(', ')} *(numbers here follow the designed ratings)*`);
    w(`- **P(E | H1), P(E | H2)**, your ratings: ${SUSPECTS.map((s, i) => `${s.name} ${pct(lik[i])}`).join(', ')}`);
    w(`- **The denominator**, the clue at all: ${j.map((_, i) => `${pct(belief[i])} × ${pct(lik[i])}`).join(' + ')} = ${j.map(pct).join(' + ')} = ${pct(pE)}`);
    w(`- **P(H1 | E), P(H2 | E)**, the new board: ${SUSPECTS.map((s, i) => `${s.name} ${pct(j[i] / pE)}`).join(', ')}`);
  }
  w();
  w(`### Page: Recap: ${c.trap}`);
  w();
  w(c.lesson);
  w();
  w('*(Below: your board before this clue, and your board now, as two squares.)*');
  w();

  // designer's Bayes box: the intended ratings
  const lik = c.likelihoods;
  const kept = belief.map((b, i) => b * lik[i]);
  const total = kept.reduce((a, b) => a + b, 0);
  const after = update(belief, lik);
  const note = NOTES[c.id] ?? {};
  const ratio = strength(lik[0], lik[1]);
  const same = Math.abs(lik[0] - lik[1]) < 1e-9;
  const fill = (t: string) =>
    t
      .replace('{swing51}', pct(update(belief, [0.9, 0.1])[0]))
      .replace('{swing52}', pct(update(belief, [0.9, 0.3])[0]))
      .replace('{dismiss}', pct(finalWith(k, [0.5, 0.5])))
      .replace('{final}', pct(chain(prior, liks)[CLUES.length][0]));
  w('> **Designer’s note (not shown in game): the intended reasoning**');
  w('>');
  w(
    `> - Intended ratings${k === 0 ? ` (1–5 map to ${RATING_VALUES.join(', ')})` : ''}: ${SUSPECTS.map((s, i) => `${s.name} **${rating(lik[i])}** (${lik[i]})`).join(', ')}. ` +
      `Likelihood ratio ${ratio.text}${note.ratio ?? ''}.`,
  );
  w(
    `> - With those ratings: before ${SUSPECTS.map((s, i) => `${s.name} ${pct(belief[i])}`).join(', ')} → keep ${SUSPECTS.map((s, i) => `${pct(belief[i])} × ${lik[i]} = ${pct(kept[i])}`).join('; ')} → together ${pct(total)} → stretched: ${SUSPECTS.map((s, i) => `**${s.name} ${pct(after[i])}**`).join(', ')}${same ? ' (unchanged)' : ''}.`,
  );
  w(`> - Trap: *${note.trapLabel ?? c.trap}*${fill(note.trap ?? '.')}`);
  for (const x of note.extra ?? []) w(`> - ${x}`);
  w();
  belief = after;
  chainRows.push(`| ${k + 1}. ${c.title} | ${lik.map(rating).join(' / ')} | ${ratio.short} (${ratio.word}) | ${SUSPECTS.map((_, i) => pct(belief[i])).join(' | ')} |`);

  dir('The overlay closes. Back in the house.');
  w();
  thoughts([...c.reaction, c.nextThought]);
  w('---');
  w();
});

// ------------------------------------------------------------------ the accusation and the endings
const ending = (lines: EndLine[]) => {
  let open = false;
  for (const l of lines) {
    if (l.who === 'direction') {
      if (open) w();
      dir(l.text);
      w();
      open = false;
      continue;
    }
    const who = l.who === 'clara' ? '**CLARA**' : '**GHOST**';
    const how = l.who === 'imagining' ? ' *(imagining)*' : l.who === 'ghost' ? ' *(thought)*' : l.how ? ` *(${l.how})*` : '';
    w(`> ${who}${how}: ${l.text}`);
    open = true;
  }
  if (open) w();
};

w('## The accusation');
w();
dir('After the last clue the body glows again. The player drifts to it and chooses “Name the culprit”. In the hall, the great clock is about to strike eleven.');
w();
for (const l of ACCUSE_LINES) w(l.replace('{likely}', '[the likelier suspect]').replace('{other}', '[the other]'));
w();
w(`[ ${SUSPECTS.map((s) => `${s.name}, ${s.role}`).join(' ] [ ')} ]  *(each with the player’s suspicion as a bar, no numbers)*`);
w();
w(`> **Designer’s note (not shown in game):** the bracketed names follow the player’s own board, so the line is never false. On the intended path the likelier suspect is ${short(CULPRIT_INDEX)} and the other is ${SUSPECTS[1 - CULPRIT_INDEX].name}.`);
w();
const culprit = SUSPECTS[CULPRIT_INDEX];
const wrong = SUSPECTS[1 - CULPRIT_INDEX];
w(`### If the player names ${culprit.name}: **Case Closed**`);
w();
ending(ENDING_CORRECT);
w(`**Case closed** · You named ${culprit.name}, and you were right.`);
w('A chart of how the player’s suspicion moved, clue by clue, and the trap behind each clue. Then:');
w('“Your board moved most at clue N, (title). Every rating you made was yours, and the evidence added up.”');
w();
w('[ **See the math** ] [ Read all lessons ] [ Play again ] [ Title ]');
w();
w('> **Designer’s note (not shown in game): the “See the math” screen.** Optional, shown on request after the verdict. For each clue it replays the player’s own ratings as counted worlds, beside the square: column widths are the shares, shaded heights the ratings. Example for the letter, if the player rated Clara 4 and Thomas 3: “Picture 60 worlds in which Clara is the murderer and 40 in which Thomas is. A 4 means the clue turns up in 70 of every 100 of Clara’s worlds; a 3 means 50 of every 100 of Thomas’s. That is 42 worlds with the clue for Clara and 20 for Thomas, 62 in all. 42 of those 62 are Clara’s: 68%.” Then the same step as odds (prior odds × ratio = new odds). The last page lists the seven lessons and shows, from the player’s own ratings, that a different starting point would have changed the final board only a little.');
w();
w('> **Designer’s note (not shown in game): closing text depends on two things, whom the player named and whom the player’s own board favoured.**');
w('>');
w(`> - Named ${short(CULPRIT_INDEX)}, board favoured ${short(CULPRIT_INDEX)} (the intended path): “Every rating you made was yours, and the evidence added up.”`);
w(`> - Named ${short(CULPRIT_INDEX)}, board favoured ${wrong.name}: “Right, but not by your own evidence. Your board still leaned toward ${wrong.name}. Which of your ratings kept her there?” A right answer reached by hunch should not be praised as good reasoning.`);
w(`> - Named ${wrong.name}, board favoured ${wrong.name}: Case Reopened, plus: “Your board pointed to ${wrong.name}, so some of your ratings put it there. A sound process can still end wrong when a rating is off; go back to the ratings, not to a hunch.”`);
w(`> - Named ${wrong.name}, board favoured ${short(CULPRIT_INDEX)}: Case Reopened, plus: “Your own board favoured ${culprit.name}, and you accused ${wrong.name} anyway. That was the gut feeling I warned you about.”`);
w();
w(`### If the player names ${wrong.name}: **Case Reopened**`);
w();
ending(ENDING_WRONG.map((l) => ({ ...l, text: l.text.replace('{name}', wrong.name) })));
w(`**Not this time** · You named ${wrong.name}. It was not them.`);
w('“Look again at how strongly each clue fitted each story: a vivid clue can feel stronger than it is, and a quiet one can matter more than it seems.”');
w();
w('[ Read all lessons ] [ Title ] [ Try again ]');
w();
w('---');
w();

// ------------------------------------------------------------------ appendix
w('## Appendix: the intended reasoning chain (designer’s notes)');
w();
w(`**How ratings become numbers.** A rating is the likelihood P(clue | this person is the murderer): ${RATING_VALUES.map((v, k) => `${k + 1} → ${v}`).join(', ')}. It never reaches 0 or 1, so no story can be ruled out, or proved, by one clue. Only the *ratio* of the two ratings moves the board, which is why a clue rated the same for both suspects changes nothing.`);
w();
w('The board after each clue, if the player’s ratings match the intended ratings (a model answer, not an answer key):');
w();
w(`| After | Ratings (${SUSPECTS.map((s) => s.name).join(' / ')}) | Likelihood ratio | ${SUSPECTS.map((s) => s.name).join(' | ')} |`);
w(`|---|---|---|${SUSPECTS.map(() => '---').join('|')}|`);
for (const r of chainRows) w(r);
w();
w('**Arc.** Clara leads, then loses ground to the print and the foxgloves, then comes back with the slip just when the player thinks it is settled, then is cleared by the alibi. The two clues that move the board least (the will, the knife) teach the lessons about old news and about clues that fit both stories. The twist and the alibi are what make the ending earn its relief.');
w();
w('**Timeline.** The investigation takes place between ten and eleven. Clara is in the kitchen for the whole hour and comes to the study at eleven, as she does every night. Tea at 9:30; drunk a little before ten; Clara’s call 9:28 to 9:57; Thomas signed out at eight; the chemist at 6:40; Clara signed in at seven; the quarrel and the letter on Tuesday; the signing on Monday at ten. Edgar mops the conservatory floor before he leaves at six, so any print there after six is from tonight.');
w();
// checks, computed rather than asserted
const perms = <T,>(xs: T[]): T[][] => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
const orders = perms(liks);
const end = belief[0];
const allSame = orders.every((o) => Math.abs(chain(prior, o)[CLUES.length][0] - end) < 1e-12);
const sweep = [0.1, 0.5, 0.9, 0.99].map((p) => chain([p, 1 - p], liks)[CLUES.length][0]);
const fmt = (x: number) => (x < 0.1 ? `${(x * 100).toFixed(1)}%` : pct(x));
const list = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const idx = (id: string) => CLUES.findIndex((c) => c.id === id);
w(
  `**Checks run** (by the generator, every time). Every posterior above is computed from the ratings. The final board is ${allSame ? 'the same' : 'NOT the same'} for all ${orders.length.toLocaleString('en-GB')} orderings of the ${numberWord(CLUES.length)} clues. ` +
    `Starting Clara at 10%, 50%, 90% and 99% (same ratings) ends at ${list(sweep.map(fmt))}: priors wash out only when everyone shares the same likelihoods. ` +
    `Player-error cases, for the feedback text: rating the letter 5 / 1 ends at ${fmt(finalWith(idx('letter'), [0.9, 0.1]))} Clara; ` +
    `rating the will 5 / 2 (counting the quarrel twice) ends at ${fmt(finalWith(idx('will'), [0.9, 0.3]))}; ` +
    `dismissing the slip (3 / 3) ends at ${fmt(finalWith(idx('slip'), [0.5, 0.5]))}; over-reacting to it (5 / 1) ends at ${fmt(finalWith(idx('slip'), [0.9, 0.1]))}.`,
);
w();
w('**Assumptions the game makes.**');
w();
w(`1. One culprit, and the ${numberWord(SUSPECTS.length)} suspects cover every possibility, so the stretch step is valid.`);
w('2. Each clue’s likelihood depends only on who the murderer is, not on other clues found (conditional independence given the culprit). The letter and the will concern the same quarrel, so the will is deliberately rated as old news rather than as new motive evidence.');
w('3. Background facts (Thomas leaves his bicycle by the garden gate; Poe and Edgar were out; Clara nags about John’s sleep; the single Monday signing threatens Clara and Thomas equally) are established before a clue uses them.');
w('4. Verbal labels map to fixed numbers for every player. People read “likely” differently, so the labels and numbers must stay locked together.');
w('5. The ghost searches where he already suspects, so clues are not a random sample. Likelihoods should be judged as “would I have found this here whoever the murderer is?” The foxglove reaction has the ghost admit he has not looked for evidence against Thomas, and the slip is found because he then does.');
w('6. The ghost’s unmodelled facts (the 7:48 call, what was really in the bottle) stay unexplained on purpose. The verdict does not need them.');
w();

mkdirSync('screenplay', { recursive: true });
rmSync('screenplay/level-1.md', { force: true });
writeFileSync('screenplay/the-clockmakers-last-hour.md', out.join('\n'));
console.log(`wrote screenplay/the-clockmakers-last-hour.md (${out.length} lines)`);
