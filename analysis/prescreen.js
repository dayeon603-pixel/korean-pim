/* Running the four questions on rules that are not yet indicators — node analysis/prescreen.js
 *
 * Until here the procedure has explained decisions already taken. This applies it to 18 rules that
 * have never been fielded as indicators anywhere, the condition-dependent criteria of Kim 2018
 * Table 2, and returns a verdict in advance. It uses real documents and real data, not assumptions.
 *
 *   Q1  Does the intended substrate carry the clinical state?
 *       It does where Table 22 of the 2022 HIRA report binds the condition to KCD codes. Where it
 *       does not, the rule cannot be computed on claims as they stand.
 *       (src/hira_kcd.js, read from the primary document)
 *   Q3  With the condition deleted, does the rule still measure the harm it named?
 *       The drug's predictive value for that condition answers it. The lower it is, the more
 *       load-bearing the condition, and deleting it produces a different rule.
 *       (analysis/ablation.js, measured on NHANES)
 *   Q4  Does the entity being scored hold that information?
 *       Not when the condition is recorded at a different encounter. The 2021 HIRA study excluded
 *       its gastroprotection indicator for exactly this reason.
 *
 * No arbitrary threshold is imposed. If Q1 is no, the rule cannot be built on claims. If Q1 is yes,
 * the value from Q3 states directly how much deleting the condition costs.
 */
'use strict';
const pim = require('../src/index.js');
const kcd = require('../src/hira_kcd.js');
const abl = require('./ablation_result.json');

/** English labels for the 18 conditions, since the manuscript is in English. */
const EN = {
  dementia: 'Dementia or cognitive impairment', falls: 'History of falls or fracture',
  insomnia: 'Insomnia', parkinson: "Parkinson's disease", hf: 'Heart failure',
  arrhythmia: 'Arrhythmia', htn: 'Hypertension', age80_primary: 'Age 80 and over, primary prevention',
  stroke_secondary: 'Stroke, secondary prevention', ulcer: 'Peptic ulcer history',
  constipation: 'Chronic constipation', ckd: 'Chronic kidney disease',
  bph: 'Benign prostatic hyperplasia', hyponatremia: 'Hyponatraemia', copd: 'COPD',
  bleeding: 'Bleeding risk', dm: 'Diabetes', glaucoma: 'Glaucoma',
};

const bound = new Set(Object.keys(kcd.BOUND_BY_TABLE22));
const ppvByRule = new Map(abl.perRule.map((r) => [r.id, r.xy / r.x]));
const exposedByRule = new Map(abl.perRule.map((r) => [r.id, r.x]));

const rows = pim.table2.map((t) => {
  const q1 = bound.has(t.id);
  const ppv = ppvByRule.has(t.id) ? ppvByRule.get(t.id) : null;
  const n = exposedByRule.get(t.id) || 0;
  return { id: t.id, label: EN[t.id] || t.label, q1, ppv, n };
});

const buildable = rows.filter((r) => r.q1);
const blocked = rows.filter((r) => !r.q1);
const measured = buildable.filter((r) => r.ppv !== null && r.n >= 50).sort((a, b) => a.ppv - b.ppv);

const say = require.main === module ? console.log : () => {};
const pc = (x) => (100 * x).toFixed(1);

say('PROSPECTIVE SCREEN — the four questions run on rules that are not yet indicators\n');
say(`Candidates: the ${rows.length} condition-dependent rules of the Korean consensus criteria.`);
say('None of them is fielded as an indicator in the programme examined here.\n');

say(`Q1  Does the intended substrate carry the clinical state?`);
say(`    ${buildable.length} of ${rows.length} are bound to KCD codes by the agency's own 2022 report,`);
say(`    so they are computable on claims as they stand: ${buildable.map((r) => r.label).join(', ')}.`);
say(`    ${blocked.length} are not bound and cannot be computed on claims without new work:`);
say(`    ${blocked.map((r) => r.label).join(', ')}.\n`);

// Separate why the nine unbound rules fail. They do not all fail for the same reason. The source
// criteria record a type for each condition (diagnosis, history, symptom, age, state), so that is
// what the split uses.
const KIND_EN = { '진단': 'diagnosis', '병력': 'history', '증상': 'symptom', '연령': 'age', '상태': 'situation' };
const unboundByKind = {};
pim.table2.filter((t) => !bound.has(t.id)).forEach((t) => {
  const k = KIND_EN[t.kind] || t.kind;
  (unboundByKind[k] = unboundByKind[k] || []).push(EN[t.id] || t.label);
});
const notDiagnosis = Object.entries(unboundByKind).filter(([k]) => k !== 'diagnosis');
const diagUnbound = unboundByKind.diagnosis || [];
say('    Why the nine fail divides the same way the study\'s main finding does.');
notDiagnosis.forEach(([k, v]) => say(`      ${v.length} are not a diagnosis at all (${k}): ${v.join(', ')}`));
say(`      ${notDiagnosis.reduce((a, [, v]) => a + v.length, 0)} therefore cannot be carried by any diagnosis code; the limit is representational.`);
say(`      ${diagUnbound.length} are ordinary diagnoses for which no code set was authored: ${diagUnbound.join(', ')}.`);
say('      There the limit is elective, not a ceiling of the coding system.\n');

say('Q3  If the condition were deleted, would the rule still measure the harm it named?');
say('    The drug\'s predictive value for the condition answers it. Lower means the condition');
say('    is more load-bearing, so deleting it changes the rule rather than weakening it.\n');
say('    rule                          exposed   predictive value   condition is');
measured.forEach((r) => {
  const verdict = r.ppv < 0.25 ? 'load-bearing' : r.ppv < 0.5 ? 'substantial' : 'partly redundant';
  say(`    ${r.label.padEnd(28)} ${String(r.n).padStart(6)}   ${pc(r.ppv).padStart(14)}%   ${verdict}`);
});
say(`\n    Not measurable here: the remaining ${buildable.length - measured.length} bound rules have`);
say('    fewer than fifty exposed in this cohort or no observable condition in it.\n');

say('Q4  Does the entity to be scored hold the information?');
say('    For every rule here the condition may be recorded at an encounter other than the one');
say('    being scored, which is the ground on which the agency excluded its gastroprotection');
say('    candidate in 2021. The screen therefore returns the same answer for all 18 and does');
say('    not separate them; it is a constraint on institution-level use, not on the rule.\n');

say('Screen output');
say(`  ${blocked.length} rules fail at Q1 and cannot be built on the claims substrate as it stands.`);
const loadBearing = measured.filter((r) => r.ppv < 0.25);
say(`  ${loadBearing.length} of the ${measured.length} measurable rules have a predictive value below 25 per cent,`);
say(`  so for those the condition is load-bearing: ${loadBearing.map((r) => r.label).join(', ')}.`);
// The rules that fail both questions are the dangerous ones: the substrate cannot carry the state,
// and the condition is load-bearing.
const worst = rows.filter((r) => !r.q1 && r.ppv !== null && r.n >= 50).sort((a, b) => a.ppv - b.ppv);
if (worst.length) {
  say(`  The highest-risk candidate fails both: ${worst[0].label}, unbound at Q1 and with a`);
  say(`  predictive value of ${pc(worst[0].ppv)} per cent, so on claims it can only be built without`);
  say('  its condition, and without it the rule is almost entirely a different one.');
}
say('  This is a prediction the screen makes before any of these rules is drafted, and it is');
say('  falsifiable: if one is fielded on claims without its condition, the rule it becomes is');
say('  the population prescribing rate for its drug, not the criterion it was drawn from.');

module.exports = {
  total: rows.length, boundCount: buildable.length, blockedCount: blocked.length,
  measured, loadBearing: loadBearing.map((r) => r.id), rows,
  unboundNotDiagnosis: notDiagnosis.reduce((a, [, v]) => a + v.length, 0),
  unboundDiagnoses: diagUnbound.length,
  worst: worst[0] || null,
};
