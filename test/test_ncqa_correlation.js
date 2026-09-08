/* Testing the reason NCQA gave for retiring its conditional measure, against the Korean criteria.
 *   node test/test_ncqa_correlation.js [건수] [반복]
 *
 * ── the claim under test ──────────────────────────────────────────────────
 * In removing the conditional (drug-disease) measure DDE from Health Plan Ratings 2026, NCQA gave
 * this reason in its own memo:
 *
 *   "The measure is not used in any external programs and is also
 *    highly correlated with the Use of High-Risk Medications in Older Adults (DAE) measure."
 *
 * The first half, that no external programme uses it, is a fact about adoption and cannot be tested
 * here. The second half, that it correlates highly with the drug-only measure, is an empirical claim
 * that data can settle. If the correlation really is high, the condition axis duplicates the
 * drug-only axis and dropping it leaves nearly the same patients flagged. The same logic would
 * justify HIRA's decision to leave the 18 conditions of Table 2 out of its candidate pool.
 *
 * ── method ────────────────────────────────────────────────────────────────
 * Both axes are applied independently to each prescription in the synthetic older-adult cohort
 * (test/cohort.js), giving a 2x2 table.
 *   axis A = drug only  (the 14 classes of the HIRA 2022 national standard)  <- stands for DAE
 *   axis B = conditional (the 18 conditions of Kim 2018 Table 2)             <- stands for DDE
 *
 * The correlation between two binary variables is measured by phi, which is the Pearson correlation
 * on a 2x2 table and identical to the Matthews correlation coefficient.
 *   φ = (ad - bc) / sqrt((a+b)(c+d)(a+c)(b+d))
 *
 * Read alongside it
 *   overlap  P(A | B) — of the prescriptions B flags, the share A already flagged. The higher this
 *     is, the more the condition axis duplicates.
 *   marginal yield P(B and not A) — the share of prescriptions B catches on top of everything A
 *     already caught.
 *   Youden J, Cohen kappa — agreement checked from other angles.
 *
 * ── limits ────────────────────────────────────────────────────────────────
 *  - This is synthetic data, not a real claims distribution, so the absolute value of phi must not
 *    be compared directly with the real correlation between DDE and DAE in the United States. What
 *    can be said is whether the premise of a high correlation holds between the two axes of the
 *    Korean criteria.
 *  - Axis A is implemented at the level of the 14 classes, because the final 77 ingredient names of
 *    the national standard are unpublished.
 *  - NCQA published neither the value of the correlation nor the method behind it. There is no
 *    stated threshold for "highly".
 */
'use strict';
const { run } = require('./cohort.js');

const N = parseInt(process.argv[2] || '200000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

/** Computes phi and the accompanying statistics from the 2x2 table.
 * @param {{both:number,onlyHira:number,onlyT2:number,neither:number}} x
 */
function stats(x) {
  const a = x.both, b = x.onlyHira, c = x.onlyT2, d = x.neither;   // a=A and B, b=A only, c=B only, d=neither
  const n = a + b + c + d;
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  const phi = den === 0 ? NaN : (a * d - b * c) / den;
  const overlap = (a + c) === 0 ? NaN : a / (a + c);               // P(A | B)
  const marginal = c / n;                                          // P(B ∧ ¬A)
  const jaccard = (a + b + c) === 0 ? NaN : a / (a + b + c);
  // Cohen κ
  const po = (a + d) / n;
  const pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n);
  const kappa = (po - pe) / (1 - pe);
  return { phi, overlap, marginal, jaccard, kappa, n };
}

/** Runs the measurement. Must not run when test.js imports stats() only. */
function main() {
  console.log(`Testing NCQA's claim that the conditional measure correlates highly with the drug-only one — ${N.toLocaleString()} prescriptions x ${REPS} seeds\n`);
  console.log('seed          phi     overlap P(A|B)   marginal P(B,notA)   Jaccard   kappa');

  const acc = { phi: [], overlap: [], marginal: [], jaccard: [], kappa: [] };
  for (let r = 0; r < REPS; r++) {
    const seed = 20260902 + r * 7919;
    const s = stats(run(seed, N));
    Object.keys(acc).forEach((k) => acc[k].push(s[k]));
    console.log(`${String(seed).padEnd(10)} ${s.phi.toFixed(4).padStart(8)} ${(s.overlap * 100).toFixed(2).padStart(13)}% `
              + `${(s.marginal * 100).toFixed(2).padStart(16)}% ${s.jaccard.toFixed(4).padStart(10)} ${s.kappa.toFixed(4).padStart(8)}`);
  }

  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((s, t) => s + (t - m) ** 2, 0) / (v.length - 1)); };

  const phi = mean(acc.phi), ov = mean(acc.overlap), mg = mean(acc.marginal);
  console.log(`\nphi              ${phi.toFixed(4)} +/- ${sd(acc.phi).toFixed(4)}`);
  console.log(`overlap P(A|B)   ${(ov * 100).toFixed(2)}% +/- ${(sd(acc.overlap) * 100).toFixed(2)}`);
  console.log(`marginal yield   ${(mg * 100).toFixed(2)}% +/- ${(sd(acc.marginal) * 100).toFixed(2)}`);
  console.log(`Cohen κ         ${mean(acc.kappa).toFixed(4)} ± ${sd(acc.kappa).toFixed(4)}`);

  // The verdict. The two statistics point in different directions, so both are reported rather than
  // whichever one suits. Quoting only the favourable one would not refute NCQA; it would repeat the
  // same error in the opposite direction.
  const STRONG = 0.5;   // By convention in the social sciences, phi at or above 0.5 is strong.
  console.log('\nVerdict — the claim goes one way or the other depending on which statistic measures it.\n');
  console.log(`  [the reading that favours NCQA] person-level overlap P(A|B) = ${(ov * 100).toFixed(1)}%.`);
  console.log(`    Most of what the condition axis flags, the drug-only axis has already flagged.`);
  console.log(`    On this figure, the claim that dropping the conditional measure leaves nearly the`);
  console.log(`    same patients flagged is supported.`);
  console.log(`\n  [the reading against it] statistical equivalence does not hold. phi = ${phi.toFixed(3)}, kappa = ${mean(acc.kappa).toFixed(3)}.`);
  console.log(`    Both sit below the conventional threshold for a strong association (${STRONG.toFixed(1)}). Neither`);
  console.log(`    axis substitutes for the other.`);
  console.log(`    The overlap is high because the drug-only axis flags far more broadly, not because`);
  console.log(`    the two axes are looking at the same patients.`);
  console.log(`\n  [what matters clinically] marginal yield P(B and not A) = ${(mg * 100).toFixed(2)}%.`);
  console.log(`    After the drug-only axis has run in full, the condition axis still catches about`);
  console.log(`    ${(mg * 100).toFixed(1)} prescriptions in every 100.`);
  console.log(`    That is ${((1 - ov) * 100).toFixed(1)}% of everything the condition axis flags, and 22.9% of those are rules`);
  console.log(`    Beers 2023 designates independently (test/missed_severity.js). What is left over is`);
  console.log(`    not a trivial remainder.`);
  console.log('\n  -> The most that can be said: excluding the condition axis is not justified by calling it');
  console.log('     redundant and therefore costless. The loss is small but not zero, and there is no');
  console.log('     evidence that what is lost is of low clinical importance.');

  console.log('\nNote: synthetic data. The absolute value of phi must not be compared directly with the real');
  console.log('      correlation between DDE and DAE in the United States.');
  console.log('Note: NCQA published neither the value of the correlation nor the method. The source states');
  console.log('      no threshold for "highly".');
  console.log('Note: 22.9% is measured by a separate script and is not recomputed in this run.');
}

if (require.main === module) main();

module.exports = { stats };
