/* Substrate against layer — node analysis/substrate.js
 *
 * The layer hypothesis failed to replicate (analysis/multidomain.js). Six of the eight domain
 * analysts independently proposed the same replacement: the condition axis survives where the
 * data feed the instrument is computed over already carries the condition, for reasons unrelated
 * to the safety rule. This script tests that against the same 103 instruments.
 *
 * THE CIRCULARITY PROBLEM, STATED FIRST BECAUSE IT GOVERNS WHAT MAY BE CLAIMED.
 *   The classifiers knew the outcome. A classifier that reasons "this indicator uses SNOMED
 *   refsets, so its substrate must carry conditions" has restated the outcome, not explained it.
 *   A second agent audited each domain for exactly this and reported downgrade fractions from
 *   0.53 to 1.00, mean about 0.74. Their objection is correct and is not repairable by dropping
 *   rows, because it attaches to the reasoning rather than to identifiable rows.
 *
 *   One direction survives the objection. Classifying an instrument as running on a
 *   dispensing-only or drug-sales feed rests on documented properties of named national datasets:
 *   the NHS BSA prescribing extract, Scotland's Prescribing Information System, ECDC's ATC/DDD
 *   consumption returns, and NCPDP pharmacy transactions carry a drug, a quantity, a prescriber
 *   and a patient identifier, and no diagnosis. That is a fact about the dataset, established
 *   without reference to any indicator built on it. The negative direction is therefore reportable
 *   and the positive direction is not.
 *
 * So this script reports the negative direction as a result and the positive direction as an
 * association that cannot be separated from its own definition.
 */
'use strict';
const path = require('path');
const data = require(path.join('..', 'data', 'substrate_classification.json'));

const rows = data.rows.filter((r) => r.retained !== null && r.retained !== undefined);
const line = (n = 76) => '-'.repeat(n);
const pct = (k, n) => (n ? (100 * k / n).toFixed(1) : '  -  ').padStart(6);

/** Wilson score interval, so small cells are not read as precise. */
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

/** Matthews correlation for a 2x2, used only to put the two models on one scale. */
function phi(a, b, c, d) {
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den ? (a * d - b * c) / den : NaN;
}

function group(field) {
  const t = new Map();
  rows.forEach((r) => {
    const k = String(r[field]);
    if (!t.has(k)) t.set(k, [0, 0]);
    t.get(k)[r.retained ? 0 : 1] += 1;
  });
  return [...t.entries()].sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1]));
}

function show(field, title, note) {
  console.log(`\n${title}`);
  if (note) console.log(`  ${note}`);
  console.log('  ' + 'value'.padEnd(30) + 'kept'.padStart(6) + 'lost'.padStart(6) + 'n'.padStart(5) + 'kept %'.padStart(9) + '   95% CI');
  group(field).forEach(([k, [a, b]]) => {
    const [lo, hi] = wilson(a, a + b);
    console.log('  ' + k.slice(0, 28).padEnd(30) + String(a).padStart(6) + String(b).padStart(6) +
      String(a + b).padStart(5) + pct(a, a + b).padStart(9) + `   ${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}`);
  });
}

console.log('SUBSTRATE AGAINST LAYER');
console.log(line());
console.log(`Instruments: ${rows.length}. Evidence grade: ${data.provenance.grade}.`);
console.log('Audit note, in full, because it limits what follows:');
console.log('  ' + data.provenance.audit.replace(/(.{74}\S*)\s/g, '$1\n  '));

// ------------------------------------------------------- the reportable result
console.log('\n\n1. THE NEGATIVE DIRECTION — feeds that carry no diagnosis');
console.log(line());
const drugOnlyFeeds = new Set(['dispensing-only', 'aggregate-sales']);
const noDx = rows.filter((r) => drugOnlyFeeds.has(r.substrate));
const withDx = rows.filter((r) => !drugOnlyFeeds.has(r.substrate));
const nk = noDx.filter((r) => r.retained).length;
const wk = withDx.filter((r) => r.retained).length;
const [nlo, nhi] = wilson(nk, noDx.length);
const [wlo, whi] = wilson(wk, withDx.length);
console.log(`  dispensing or sales feed   ${nk}/${noDx.length} retained  ${pct(nk, noDx.length)}%  95% CI ${(100 * nlo).toFixed(0)}-${(100 * nhi).toFixed(0)}`);
console.log(`  every other feed           ${wk}/${withDx.length} retained  ${pct(wk, withDx.length)}%  95% CI ${(100 * wlo).toFixed(0)}-${(100 * whi).toFixed(0)}`);
console.log(`  pooled base rate           ${rows.filter((r) => r.retained).length}/${rows.length}  ${pct(rows.filter((r) => r.retained).length, rows.length)}%`);
console.log('\n  The two instruments in the first group that did retain the axis:');
noDx.filter((r) => r.retained).forEach((r) => {
  console.log(`    ${r.jurisdiction} — ${r.instrument.slice(0, 62)}`);
  console.log(`      Both draw a condition from enrollment or medical-claims data rather than from`);
  console.log(`      the dispensing transaction, so the substrate label is likely wrong for them.`);
});

// -------------------------------------------------- the contaminated direction
console.log('\n\n2. THE POSITIVE DIRECTION — reported, not claimed');
console.log(line());
show('substrate', 'Retention by substrate',
  'Every row below except the dispensing and sales rows is exposed to the circularity the audit found.');
const a = rows.filter((r) => r.substrateCarriesCondition === true && r.retained).length;
const b = rows.filter((r) => r.substrateCarriesCondition === true && !r.retained).length;
const c = rows.filter((r) => r.substrateCarriesCondition === false && r.retained).length;
const d = rows.filter((r) => r.substrateCarriesCondition === false && !r.retained).length;
console.log(`\n  substrateCarriesCondition x retained: phi = ${phi(a, b, c, d).toFixed(3)}  (${a}, ${b}, ${c}, ${d})`);
console.log('  For comparison the layer model on the same instruments has no trend at all:');
console.log('  Cochran-Armitage z = -0.58, p = 0.559 (analysis/multidomain.js).');
console.log('  The contrast in magnitude is the finding. The value of phi itself is not, because');
console.log('  the classification that produces it is partly a restatement of the outcome.');

// ------------------------------------------------------------ the refinements
console.log('\n\n3. THE TWO REFINEMENTS PROPOSED ALONGSIDE IT');
console.log(line());
show('conditionRole', 'Is the condition load-bearing or severable',
  'Proposed by the atrial fibrillation analyst: an undertreatment rule cannot be computed without\n  the condition, because its numerator is the absence of a drug and absence has no population.');
show('codingPressure', 'Why the condition is recorded',
  'Proposed by the antipsychotics analyst: conditions that justify reimbursement are already coded.');
console.log('\n  The coding-pressure refinement is NOT supported as stated. Conditions recorded for');
console.log('  clinical reasons only do as well as conditions recorded to justify payment. What');
console.log('  separates the groups is whether the condition is in the feed at all, not why it is');
console.log('  there. This also removes the reimbursement-coupling explanation drafted earlier in');
console.log('  MECHANISM.md, which predicted the opposite.');

// ------------------------------------------------------------------- outliers
console.log('\n\n4. THE CASE THAT MOST DAMAGES THE SUBSTRATE MODEL');
console.log(line());
console.log('  Korea\'s national DUR system was reported by the polypharmacy analyst to transmit');
console.log('  주상병코드 and 임부여부 in the same message it uses to screen prescriptions, and to apply');
console.log('  neither to its pregnancy-contraindication grading, handing that judgement back to the');
console.log('  prescriber. If that is right, the condition is present in the feed and the rule still');
console.log('  drops it, which is a direct counterexample. THIS IS NOT VERIFIED. It rests on an');
console.log('  agent report and the web-search budget was exhausted before it could be checked');
console.log('  against the DUR message specification. It must be verified or removed before use.');
