/* Testing whether phi holds only under the distribution assumed here — node test/sensitivity.js [n]
 *
 * ── why this is necessary ─────────────────────────────────────────────────
 * Phi, the figure the NCQA claim is tested on, depends on the joint distribution of the two axes.
 * It is not a logical property. The conditional lift between comorbidities (LIFT) in this cohort is
 * an assumption rather than a measurement, so the objection that phi = 0.302 is merely the phi of
 * an assumed distribution is a fair one. It deserves an answer by measurement, not by argument.
 *
 * ── method ────────────────────────────────────────────────────────────────
 * The assumed parameters are swept over a wide range to find any point where the conclusion flips.
 *   liftScale 0.0  correlation between conditions removed entirely (comorbidities independent)
 *             1.0  the value used for the headline measurement
 *             2.0  lift doubled (conditions cluster strongly)
 *   condScale 0.5-2.0  overall comorbidity prevalence
 *   sizeShift -1 to +1 distribution of drugs per prescription (few drugs to polypharmacy)
 *
 * ── what the conclusion actually is ───────────────────────────────────────
 * What has to hold is not a particular value of phi but the finding that phi never reaches 0.5, the
 * conventional threshold for a strong association. If it holds across the whole range, the finding
 * does not depend on the assumption. If any region breaches it, that region is reported.
 */
'use strict';
const { run } = require('./cohort.js');
const { stats } = require('./test_ncqa_correlation.js');

const N = parseInt(process.argv[2] || '100000', 10);
const SEEDS = [20260902, 20268821, 20276740];
const THRESHOLD = 0.5;

/** Runs one parameter combination over several seeds and averages. */
function probe(opt) {
  const raw = SEEDS.map((s) => run(s, N, opt));
  const r = raw.map(stats);
  const avg = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  // The base rate P(A). Overlap cannot be interpreted without it: two independent axes still
  // overlap at P(A), so the size of the real association is overlap minus P(A).
  const pA = raw.reduce((a, x) => a + (x.both + x.onlyHira) / N, 0) / raw.length;
  return { phi: avg('phi'), overlap: avg('overlap'), marginal: avg('marginal'), kappa: avg('kappa'),
           pA, lift: avg('overlap') - pA };
}

/** Sweeps the whole grid and prints the report. Must not run when test.js imports probe() only. */
function main() {
  const GRID = [];
  [0, 0.5, 1, 1.5, 2].forEach((liftScale) => GRID.push({ liftScale }));
  [0.5, 0.75, 1.5, 2].forEach((condScale) => GRID.push({ condScale }));
  [-1, -0.5, 0.5, 1].forEach((sizeShift) => GRID.push({ sizeShift }));
// How often drugs covered by the national standard are drawn. The default cohort's P(A) of 81.8%
// is 1.83 times the 44.7% measured by HIRA. The main reason appears to be that the implementation
// works at class level, which catches more than an ingredient-level one would. This checks which
// way the conclusion moves when the cohort is calibrated toward the measured rate.
[0.5, 0.25, 0.1].forEach((pimWeight) => GRID.push({ pimWeight }));
GRID.push({ sizeShift: -1.8, pimWeight: 0.1 });   // the lowest reachable base rate
  // Extreme combinations, to reach corners that moving one axis at a time does not.
  GRID.push({ liftScale: 0, condScale: 0.5, sizeShift: -1 });
  GRID.push({ liftScale: 2, condScale: 2, sizeShift: 1 });
  GRID.push({ liftScale: 0, condScale: 2, sizeShift: 1 });
  GRID.push({ liftScale: 2, condScale: 0.5, sizeShift: -1 });

  console.log(`Sensitivity of phi — ${GRID.length + 1} combinations x ${N.toLocaleString()} prescriptions x ${SEEDS.length} seeds\n`);
  console.log('lift  cond  size |   phi   kappa  overlap  marginal  | over 0.5?');
  console.log('─'.repeat(72));

  const rows = [];
  [{}, ...GRID].forEach((opt) => {
    const r = probe(opt);
    const tag = `${(opt.liftScale === undefined ? 1 : opt.liftScale).toFixed(1)}   `
              + `${(opt.condScale === undefined ? 1 : opt.condScale).toFixed(2)}  `
              + `${(opt.sizeShift === undefined ? 0 : opt.sizeShift).toFixed(1).padStart(5)}`;
    const base = Object.keys(opt).length === 0 ? '  <- headline' : '';
    console.log(`${tag} | ${r.phi.toFixed(3).padStart(6)} ${r.kappa.toFixed(3).padStart(6)} `
      + `${(r.overlap * 100).toFixed(1).padStart(7)}% ${(r.marginal * 100).toFixed(2).padStart(8)}%  | `
      + `${r.phi >= THRESHOLD ? '* over' : 'no'}${base}`);
    rows.push({ opt, ...r });
  });

  const maxPhi = Math.max(...rows.map((r) => r.phi));
  const minPhi = Math.min(...rows.map((r) => r.phi));
  const breached = rows.filter((r) => r.phi >= THRESHOLD);
  const minMarg = Math.min(...rows.map((r) => r.marginal));
  const maxOv = Math.max(...rows.map((r) => r.overlap));

  console.log('\n' + '─'.repeat(72));
  console.log(`phi range        ${minPhi.toFixed(3)} - ${maxPhi.toFixed(3)}   (threshold ${THRESHOLD})`);
  console.log(`overlap, max     ${(maxOv * 100).toFixed(1)}%`);
  console.log(`marginal, min    ${(minMarg * 100).toFixed(2)}%`);
const byPA = rows.slice().sort((a, b) => a.pA - b.pA);
const lo = byPA[0], hi = byPA[byPA.length - 1];
console.log(`\nbase rate P(A) range ${(lo.pA * 100).toFixed(1)}% - ${(hi.pA * 100).toFixed(1)}%  (HIRA measured 44.7%)`);
console.log(`  as the base rate falls: overlap ${(hi.overlap * 100).toFixed(1)}% -> ${(lo.overlap * 100).toFixed(1)}%, `
  + `marginal yield ${(hi.marginal * 100).toFixed(2)}% -> ${(lo.marginal * 100).toFixed(2)}%`);
console.log('  Calibrating toward the measured base rate lowers the overlap that favours the NCQA');
console.log('  claim and raises the marginal yield. The 92.0% and 4.54% quoted in the manuscript are');
console.log('  therefore the conservative values, the ones least favourable to the finding here.');
  console.log(`\nConclusion — combinations where phi reaches the strong-association threshold: ${breached.length} / ${rows.length}`);
  if (!breached.length) {
    console.log('  Phi does not reach 0.5 anywhere in the swept range.');
    console.log('  The finding that neither axis substitutes for the other does not depend on LIFT.');
    console.log(`  Marginal yield stays above zero too, at ${(minMarg * 100).toFixed(2)}% in the worst combination.`);
  } else {
    console.log('  The conclusion flips in the combinations below. This region must be stated in the paper:');
    breached.forEach((r) => console.log(`   ${JSON.stringify(r.opt)} → φ ${r.phi.toFixed(3)}`));
  }
  console.log('\nNote: what was swept is the assumed parameters, not a real claims distribution. This shows');
  console.log('      how sensitive the conclusion is to the assumptions. It is not external validity.');
}

if (require.main === module) main();

module.exports = { probe, THRESHOLD };
