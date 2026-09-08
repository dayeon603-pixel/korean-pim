/* Recomputes every number used in the abstract — node test/abstract_numbers.js
 *
 * The rule: every number in the abstract must be reproducible by one command. A number that cannot
 * be reproduced comes out of the abstract. This script enforces the rule. Where the abstract and
 * this output disagree, the abstract is wrong.
 *
 * The figures that need a large sample (phi, overlap, marginal yield) default to 200,000
 * prescriptions x 5 seeds. The values quoted in the abstract come from 1,000,000 x 5 seeds, so the
 * third decimal place may differ. Both are settable as arguments:
 *   node test/abstract_numbers.js 1000000 5
 */
'use strict';
const N = parseInt(process.argv[2] || '200000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

const pim = require('../src/index.js');
const beers = require('../src/beers2023.js');
const hira = require('../src/hira2022.js');
const jur = require('../src/jurisdictions.js');
const { run } = require('./cohort.js');
const { stats } = require('./test_ncqa_correlation.js');

const rows = [];
const put = (claim, got, src) => rows.push({ claim, got, src });

// ── size of the criteria ───────────────────────────────────
put('Table 1 items', `${pim.coverage.table1}`, 'src/index.js coverage.table1');
put('Table 2 conditions', `${pim.coverage.table2Conditions}`, 'src/index.js coverage.table2Conditions');
put('unique items', `${pim.coverage.unique}`, 'src/index.js coverage.unique');
put('Beers 2023 Table 3 conditions', `${beers.conditionCount}`, 'src/beers2023.js conditionCount');
put('condition axis in the national standard', `${hira.NATIONAL_CRITERIA.conditionBased ? 'present' : '0 (absent)'}`,
    'src/hira2022.js NATIONAL_CRITERIA.conditionBased');

// ── comparison across jurisdictions ────────────────────────
put('jurisdictions', `${jur.regionCount}`, 'src/jurisdictions.js regionCount');
put('adjudicable jurisdiction x layer entries', `${jur.assessableCount}`, 'src/jurisdictions.js assessableCount');
jur.byLayer().filter((l) => l.judged).forEach((l) => {
  put(`condition axis kept — ${l.layerEn}`, `${l.retained}/${l.judged}`, 'src/jurisdictions.js byLayer()');
});
put('Scotland, conditional indicators',
    `${jur.JURISDICTIONS.find((x) => x.id === 'sct-poly').conditionCount} rows`, 'src/jurisdictions.js sct-poly');
put('England, PINCER conditional indicators',
    `${jur.JURISDICTIONS.find((x) => x.id === 'eng-pincer').conditionCount}`, 'src/jurisdictions.js eng-pincer');
put('USA, HEDIS DDE conditions',
    `${jur.JURISDICTIONS.find((x) => x.id === 'us-hedis-dde').conditionCount}`, 'src/jurisdictions.js us-hedis-dde');

// ── testing the reason NCQA gave for retiring the measure ──
const acc = { phi: [], overlap: [], marginal: [], kappa: [] };
for (let r = 0; r < REPS; r++) {
  const st = stats(run(20260902 + r * 7919, N));
  Object.keys(acc).forEach((k) => acc[k].push(st[k]));
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((s, t) => s + (t - m) ** 2, 0) / (v.length - 1)); };
const src = `test/cohort.js + test/test_ncqa_correlation.js (${(N * REPS).toLocaleString()} prescriptions)`;
put('person-level overlap P(A|B)', `${(mean(acc.overlap) * 100).toFixed(1)}%`, src);
put('phi coefficient', mean(acc.phi).toFixed(3), src);
put('Cohen κ', mean(acc.kappa).toFixed(3), src);
put('marginal yield P(B and not A)', `${(mean(acc.marginal) * 100).toFixed(2)}% (sd ${(sd(acc.marginal) * 100).toFixed(2)})`, src);
put('share of condition findings that are exclusive', `${((1 - mean(acc.overlap)) * 100).toFixed(1)}%`, src);
// The marginal yield expressed relative to a base. Easier to interpret than phi, so this is the
// effect size the manuscript reports: by what percentage does the condition axis widen the
// population flagged, taking the drug-only axis as the denominator?
{
  const x = run(20260902, N);
  const byA = x.both + x.onlyHira;
  put('widening of the flagged population (synthetic)', `${(x.onlyT2 / byA * 100).toFixed(1)}%`, src);
}

// ── clinical importance ────────────────────────────────────
const ms = require('./missed_severity.js');
put('missed findings that Beers also designates', `${(ms.inBeers / ms.total * 100).toFixed(1)}% (${ms.inBeers}/${ms.total})`,
    'test/missed_severity.js');

const w = Math.max(...rows.map((r) => r.claim.length));
console.log(`Reproducing the abstract's numbers — ${N.toLocaleString()} prescriptions x ${REPS} seeds\n`);
rows.forEach((r) => console.log(`  ${r.claim.padEnd(w)}  ${String(r.got).padEnd(22)} ← ${r.src}`));
console.log(`\n${rows.length} figures. Where the abstract disagrees with this output, the abstract is wrong.`);
console.log('Note: the ingredient-level comparison (61/63, 96.8%) is checked separately in');
console.log('      test/compare_ingredient_level.js.');
