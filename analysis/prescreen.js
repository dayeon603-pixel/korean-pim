/* 네 질문을 아직 지표가 되지 않은 규칙에 미리 돌린다 — node analysis/prescreen.js
 *
 * 논문의 절차는 지금까지 사후 설명이었다. 여기서는 **아직 어디에서도 지표로 운영된 적이 없는**
 * 규칙 18개, 곧 Kim 2018 표2의 조건부 기준에 절차를 걸어 사전 판정을 낸다. 가정이 아니라
 * 실제 문서와 실제 자료만 쓴다.
 *
 *   Q1  의도한 기질이 그 임상상태를 담는가.
 *       심평원 2022 보고서 <표 22> 가 KCD 코드로 결속한 조건이면 담는다. 결속하지 않았으면
 *       청구자료를 그대로 두고는 계산할 수 없다. (src/hira_kcd.js, 1차 문서에서 읽음)
 *   Q3  조건을 지워도 규칙이 그 위해를 여전히 재는가.
 *       그 약물의 해당 조건에 대한 양성예측도가 답한다. 낮을수록 조건이 지지대이고,
 *       지우면 다른 규칙이 된다. (analysis/ablation.js, NHANES 실측)
 *   Q4  채점 대상 기관이 그 정보를 보유하는가.
 *       조건이 다른 진료 건에 기록되면 보유하지 않는다. 심평원 2021 연구가 위보호제 지표를
 *       바로 이 이유로 배제했다.
 *
 * 판정은 임의의 임계값을 두지 않는다. Q1 이 아니오면 청구자료 위에서는 만들 수 없고,
 * Q1 이 예이면 Q3 의 값이 조건을 지울 때 잃는 것의 크기를 그대로 말해 준다.
 */
'use strict';
const pim = require('../src/index.js');
const kcd = require('../src/hira_kcd.js');
const abl = require('./ablation_result.json');

/** 논문이 영문이므로 18개 조건의 영문 라벨을 둔다. */
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

// 결속되지 않은 9개가 왜 실패했는지 나눈다. 전부 같은 이유로 실패한 것이 아니다.
// 원천 기준이 조건마다 유형을 적어 두었으므로(진단·병력·증상·연령·상태) 그것으로 가른다.
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
// 두 질문에서 동시에 걸리는 규칙이 가장 위험하다. 기질이 담지 못하는데 조건이 지지대인 경우다.
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
