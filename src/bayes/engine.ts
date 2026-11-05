/**
 * Pure Bayesian helpers. A "distribution" is an array of non-negative numbers
 * over the suspects (same order everywhere), summing to 1.
 */
export type Dist = number[];

export function normalize(weights: number[]): Dist {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => w / total);
}

/** Unnormalized products prior_i * P(E | H_i). */
export function joint(prior: Dist, likelihoods: number[]): number[] {
  return prior.map((p, i) => p * likelihoods[i]);
}

/** P(E) = Σ P(E|H_i) P(H_i). */
export function evidenceProbability(prior: Dist, likelihoods: number[]): number {
  return joint(prior, likelihoods).reduce((a, b) => a + b, 0);
}

/** Bayes' rule: P(H_i | E) = P(E|H_i) P(H_i) / P(E). */
export function update(prior: Dist, likelihoods: number[]): Dist {
  return normalize(joint(prior, likelihoods));
}

/** Apply a sequence of independent pieces of evidence. Returns every intermediate posterior (index 0 = prior). */
export function chain(prior: Dist, evidence: number[][]): Dist[] {
  const out: Dist[] = [prior];
  let cur = prior;
  for (const lik of evidence) {
    cur = update(cur, lik);
    out.push(cur);
  }
  return out;
}

/** Likelihood ratio of hypothesis i against "not i", weighted by the prior over the others. */
export function likelihoodRatio(prior: Dist, likelihoods: number[], i: number): number {
  const others = prior.reduce((acc, p, j) => (j === i ? acc : acc + p), 0);
  if (others <= 0) return Infinity;
  const pNot = prior.reduce((acc, p, j) => (j === i ? acc : acc + p * likelihoods[j]), 0) / others;
  return pNot === 0 ? Infinity : likelihoods[i] / pNot;
}

/** Total variation distance between two distributions, in [0, 1]. */
export function totalVariation(a: Dist, b: Dist): number {
  return a.reduce((acc, x, i) => acc + Math.abs(x - b[i]), 0) / 2;
}

/** 0–100 score: 100 means the guess matched the true posterior exactly. */
export function scoreGuess(guess: Dist, truth: Dist): number {
  return Math.round(100 * (1 - totalVariation(normalize(guess), truth)));
}

export function argmax(d: number[]): number {
  let best = 0;
  for (let i = 1; i < d.length; i++) if (d[i] > d[best]) best = i;
  return best;
}

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}
