/* Applying both axes to real people — node analysis/nhanes.js
 *
 * The study's largest limitation was that the two axes were compared on a synthetic cohort. NHANES
 * 2017-2018 is released without an access review and links prescriptions, conditions, and mortality
 * at the person level, so the same comparison can be repeated on real people.
 *
 * ── Design choices that keep the comparison fair ──────────────────────────
 * Both axes are applied to the same input, passed through the same drug dictionary. A drug absent
 * from the dictionary contributes to neither axis. Giving one axis a wider dictionary would void the
 * comparison.
 *
 * ── Must accompany any reported figure ────────────────────────────────────
 *  - This is US data, not the Korean prescribing distribution.
 *  - Prescriptions are self-reported 30-day use, not claims.
 *  - Only 8 of Table 2's 18 conditions are observable, so the condition axis count is a lower bound
 *    rather than an estimate. Observing the other 10 would raise it.
 *  - Mortality is reported descriptively only. Follow-up is about two years, and exposure is heavily
 *    entangled with comorbidity burden, so an unadjusted association must not be read causally.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');
const { MAP } = require('./drug_class_map.js');

const COHORT = path.join(__dirname, 'nhanes_cohort.json');
if (!fs.existsSync(COHORT)) {
  console.error('cohort file not found. Run first: python3 analysis/nhanes_prepare.py');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(COHORT, 'utf8'));

/** Turn an ingredient name into evaluation input.
 *
 * Table 1 ingredients are resolved by the engine; anything outside it is resolved by the auxiliary
 * dictionary in drug_class_map. Anything neither resolves returns null and is excluded from both
 * axes. Giving one axis a wider dictionary would void the comparison.
 *
 * NHANES writes combinations as "ingredient A; ingredient B", so they are split and resolved apart.
 */
function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const m = MAP[ing];
  if (m) return { ing, cls: m[0], tags: m.slice(1), cat: '' };
  return null;
}

/** Expand combination and formulation strings into ingredients, so "acetaminophen; hydrocodone"
 * becomes two. */
function splitIngredients(name) {
  return name.split(';').map((x) => x.trim())
    // Strip route-of-administration labels. Topical and ophthalmic preparations are left in place so
    // the dictionary filters them out, since systemic exposure differs.
    .filter(Boolean);
}

let a = 0, b = 0, both = 0, onlyA = 0, onlyB = 0, neither = 0;
let withAnyDrug = 0, resolvedDrugs = 0, totalDrugs = 0;
const rows = [];

data.people.forEach((p) => {
  const parts = p.drugs.flatMap(splitIngredients);
  totalDrugs += parts.length;
  const drugs = parts.map(toDrug).filter(Boolean);
  resolvedDrugs += drugs.length;
  if (drugs.length) withAnyDrug++;

  const byA = drugs.some((d) => hira.isCovered(d, d.cat));            // drug-only axis
  const t2 = bm.check({ drugs, conditions: p.conditions }).table2;    // condition axis
  const byB = t2.length > 0;

  if (byA) a++;
  if (byB) b++;
  if (byA && byB) both++;
  else if (byA) onlyA++;
  else if (byB) onlyB++;
  else neither++;

  rows.push({ id: p.id, age: p.age, byA, byB, died: p.died, hits: t2 });
});

const N = data.people.length;
const pct = (x) => (x / N * 100).toFixed(1) + '%';
const phi = (() => {
  const den = Math.sqrt((both + onlyA) * (onlyB + neither) * (both + onlyB) * (onlyA + neither));
  return den === 0 ? NaN : (both * neither - onlyA * onlyB) / den;
})();
const overlap = both / (both + onlyB);
const marginal = onlyB / N;

console.log(`Applied to real records — ${data.source}\n`);
console.log(`${N} people (aged ${data.ageMin}+, holding a prescription)`);
console.log(`${resolvedDrugs} of ${totalDrugs} ingredient names resolved by the dictionary (${(resolvedDrugs / totalDrugs * 100).toFixed(1)}%)`);
console.log(`conditions ascertainable ${data.mappedConditions.length}/18 — ${data.mappedConditions.join(', ')}`);
console.log(`not ascertainable ${data.unmappedConditions.length} — ${data.unmappedConditions.join(', ')}\n`);

console.log('Contingency table of the two axes');
console.log(`  flagged by the drug-only axis A   ${String(a).padStart(5)}  ${pct(a)}`);
console.log(`  flagged by the condition axis B   ${String(b).padStart(5)}  ${pct(b)}`);
console.log(`  both                              ${String(both).padStart(5)}`);
console.log(`  A only                            ${String(onlyA).padStart(5)}`);
console.log(`  B only (the gap in the standard)  ${String(onlyB).padStart(5)}  ${pct(onlyB)}`);
console.log(`  neither                           ${String(neither).padStart(5)}`);

console.log('\nAssociation');
console.log(`  base rate P(A)      ${(a / N * 100).toFixed(1)}%   <- the baseline the overlap is read against`);
console.log(`  overlap P(A|B)      ${(overlap * 100).toFixed(1)}%   exceeds the base rate by ${((overlap - a / N) * 100).toFixed(1)} points`);
console.log(`  phi                 ${phi.toFixed(3)}`);
console.log(`  marginal P(B,notA)  ${(marginal * 100).toFixed(2)}%   ${(onlyB / b * 100).toFixed(1)}% of everything the condition axis flags`);

// Which conditions actually create the gap
const gap = {};
rows.filter((r) => r.byB && !r.byA).forEach((r) => {
  // One person can match the same condition more than once, so hits are deduplicated per condition.
  new Set(r.hits.map((h) => `${h.condition.label} + ${h.target.nameKo}`))
    .forEach((k) => { gap[k] = (gap[k] || 0) + 1; });
});
console.log('\n(condition + target) combinations behind the findings the standard misses');
Object.entries(gap).sort((x, y) => y[1] - x[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

// Mortality, descriptive only
const elig = rows.filter((r) => r.died === 0 || r.died === 1);
const rate = (f) => { const s = elig.filter(f); return s.length ? `${s.filter((r) => r.died === 1).length}/${s.length} (${(s.filter((r) => r.died === 1).length / s.length * 100).toFixed(1)}%)` : '-'; };
// If one rule dominates the result, the result rests entirely on that rule's validity. Find the
// dominant rule, remove it, recompute, and see whether the conclusion holds.
const top = Object.entries(gap).sort((x, y) => y[1] - x[1])[0];
if (top) {
  const [topKey, topN] = top;
  const survives = rows.filter((r) => r.byB && !r.byA)
    .filter((r) => [...new Set(r.hits.map((h) => `${h.condition.label} + ${h.target.nameKo}`))]
      .some((k) => k !== topKey));
  console.log(`\nLeave-out check for a dominant rule`);
  console.log(`  largest combination "${topKey}" ${topN} people (${(topN / onlyB * 100).toFixed(1)}% of the ${onlyB} in the gap)`);
  console.log(`  Removing it leaves a gap of ${survives.length} (${(survives.length / N * 100).toFixed(2)}%).`);
  console.log(`  Note: if the result leaned heavily on one rule, that rule's clinical validity would`);
  console.log(`        become a premise of the conclusion.`);
  console.log(`  Note: diabetes with a beta blocker is unique to Kim 2018. Beers 2023 Table 3 does not`);
  console.log(`        carry it.`);
}

console.log(`\nMortality (median follow-up about 2 years, unadjusted) — ${elig.length} eligible for follow-up`);
console.log(`  flagged by neither      ${rate((r) => !r.byA && !r.byB)}`);
console.log(`  drug-only axis only     ${rate((r) => r.byA && !r.byB)}`);
console.log(`  condition axis only     ${rate((r) => !r.byA && r.byB)}`);
console.log(`  both axes               ${rate((r) => r.byA && r.byB)}`);

console.log('\nNote: US data, not a Korean prescribing distribution. Prescriptions are self-reported');
console.log('      use over 30 days.');
console.log('Note: only 8 of the 18 conditions can be ascertained here, so the volume the condition');
console.log('      axis flags is a lower bound rather than an estimate.');
console.log('Note: mortality is unadjusted descriptive statistics. PIM exposure is entangled with');
console.log('      comorbidity burden, so none of it may be read causally.');

module.exports = { N, a, b, both, onlyA, onlyB, neither, phi, overlap, marginal, rows };
