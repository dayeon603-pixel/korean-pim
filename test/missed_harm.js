/* Classifies the condition findings the national standard misses by the harm the source names.
 *   node test/missed_harm.js
 *
 * ── why this is needed ─────────────────────────────────────────────────────
 * Knowing that the condition axis flags a further 4.54% of prescriptions says nothing about whether
 * those findings matter clinically. A flag is not a harm, and that distinction must not be blurred.
 *
 * No clinical outcome was tracked here, and none can be tracked from inside this repository. One
 * step is still available. The harm each rule was written to prevent is stated as its rationale in
 * the source (Kim 2018 Table 2). Classifying the missed findings by that rationale makes it
 * possible to say what is missed in terms of the kind of harm at stake.
 *
 * ── limits, to be read alongside the result ────────────────────────────────
 *  - This classifies the harm a rule targets. It is not evidence that any harm occurred.
 *  - There is no weighting by frequency or severity. One combination counts as much as any other.
 *  - The denominator is 35 combinations, so the percentages are imprecise.
 */
'use strict';
const pim = require('../src/index.js');
const ms = require('./missed_severity.js');

/** Groups the source rationales into harm categories. The groups are kept coarse so as not to
 *  invent distinctions the source does not support. The patterns match the Korean rationale text
 *  in the data, so they stay in Korean. */
const HARM_CLASS = [
  { id: 'fall_cns', label: 'falls, consciousness, cognition', match: /낙상|운동실조|정신운동|실신|섬망|인지|파킨슨|CNS/ },
  { id: 'bleed_gi', label: 'bleeding, gastrointestinal', match: /출혈|궤양|변비/ },
  { id: 'organ', label: 'organ function', match: /신손상|신기능|심부전|부정맥|고혈압|저나트륨|요저류|요류|녹내장|혈당|저혈당/ },
  { id: 'no_benefit', label: 'insufficient evidence of benefit', match: /근거 부족|더 효과적인/ },
];

function classify(reason) {
  const hit = HARM_CLASS.find((h) => h.match.test(reason));
  return hit || { id: 'other', label: 'other' };
}

const byCond = {};
pim.table2.forEach((c) => { byCond[c.label] = c.reason; });

const rows = ms.rows.map((r) => {
  const reason = byCond[r.cond] || '';
  return { ...r, reason, harm: classify(reason) };
});

/** Tallies by harm category. The computation always runs; only printing is deferred to report(). */
const tally = {};
rows.forEach((r) => {
  tally[r.harm.label] = tally[r.harm.label] || { n: 0, inBeers: 0, conds: new Set() };
  tally[r.harm.label].n += 1;
  if (r.inBeers) tally[r.harm.label].inBeers += 1;
  tally[r.harm.label].conds.add(r.cond);
});

/** Prints the report. Must not run when another script imports the figures only. */
function report() {
  console.log('Condition findings the national standard misses, by the harm the source names\n');
  console.log(`Scope: ${rows.length} (condition x target) combinations that the national drug list does not catch\n`);

  const w = Math.max(...Object.keys(tally).map((k) => k.length));
  console.log('harm category'.padEnd(w) + '   combos   share   also Beers   conditions');
  Object.entries(tally)
    .sort((a, b) => b[1].n - a[1].n)
    .forEach(([label, v]) => {
      console.log(`${label.padEnd(w)} ${String(v.n).padStart(5)} ${(v.n / rows.length * 100).toFixed(1).padStart(6)}% `
        + `${String(v.inBeers).padStart(10)}   ${[...v.conds].join(', ')}`);
    });

  console.log('\n-- combination detail --');
  rows.slice().sort((a, b) => a.harm.label.localeCompare(b.harm.label)).forEach((r) => {
    console.log(`  [${r.harm.label}] ${r.cond} + ${r.target}`);
    console.log(`      source rationale: ${r.reason}${r.inBeers ? '  (Beers 2023 designates it too)' : ''}`);
  });

  console.log('\nNote: this classifies the harm each rule targets. It is not evidence that harm occurred.');
  console.log('Note: there is no weighting by frequency or severity. One combination counts as much as');
  console.log('      any other.');
  console.log(`Note: the denominator is ${rows.length} combinations, so the percentages are imprecise.`);
}

if (require.main === module) report();

module.exports = { rows, tally, HARM_CLASS };
