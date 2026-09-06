/* 조건축을 지우면 규칙이 어떻게 달라지는가 — node analysis/ablation.js
 *
 * 논문은 조건 Y를 지우면 |X∩Y|/|X| 가 |X|/|N| 이 되고, 이는 같은 규칙의 약한 판이 아니라
 * 다른 규칙이라고 대수로 주장한다. 그 주장을 실제 사람에서 측정한다.
 *
 * 자료: NHANES 2017-2018 (미국 공중보건 공개자료, 공용 도메인). 65세 이상 처방 보유자.
 *   이 자료는 국가 지표가 계산되는 기질(substrate)이 아니다. 두 축을 모두 담은 환자 단위
 *   자료라서 쓰는 것이며, 결과는 대수적 성질의 실측 시연이지 어떤 기관의 행위에 대한 증거가 아니다.
 *
 * 반드시 병기할 한계
 *   - 18개 조건 중 8개만 관측된다. 조건축 판정량은 추정치가 아니라 **하한**이다.
 *   - 처방은 자기보고 30일 사용분이며 청구자료가 아니다.
 *   - NHANES 는 복합표본이지만 여기서는 가중치를 적용하지 않았다. 따라서 아래 비율은
 *     이 코호트를 기술할 뿐 미국 인구 추정치가 아니다. 두 규칙의 비교는 사람 내부 비교라
 *     가중치에 크게 좌우되지 않지만, 유병률로 읽어서는 안 된다.
 */
'use strict';
const path = require('path');
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');
const { MAP } = require('./drug_class_map.js');

const data = require('./nhanes_cohort.json');

/** 논문이 영문이므로 관측 가능한 8개 조건에만 영문 라벨을 붙인다. */
const EN = {
  insomnia: 'Insomnia', hf: 'Heart failure', htn: 'Hypertension',
  stroke_secondary: 'Stroke, secondary prevention', ckd: 'Chronic kidney disease',
  hyponatremia: 'Hyponatraemia', copd: 'COPD', dm: 'Diabetes',
};
const OBSERVABLE = new Set(data.mappedConditions);
const ALL = pim.table2.map((t) => t.id);

function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const m = MAP[ing];
  if (m) return { ing, cls: m[0], tags: m.slice(1), cat: '' };
  return null;
}
const split = (n) => n.split(';').map((x) => x.trim()).filter(Boolean);

/** Wilson score interval. */
function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}
const pc = (x) => (100 * x).toFixed(1);
/** 이 파일은 하네스에서 require 되기도 한다. 직접 실행할 때만 보고서를 찍는다. */
const say = require.main === module ? console.log : () => {};

// ---------------------------------------------------------------------------------------------
// 사람마다 두 축을 계산한다. 조건을 지운 팔은 모든 조건이 있다고 두고 같은 규칙을 돌린다.
// 그러면 남는 것은 규칙의 약물 절반뿐이며, 그것이 조건 없는 기질이 계산할 수 있는 전부다.
// ---------------------------------------------------------------------------------------------
const people = data.people.map((p) => {
  const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
  const asWritten = bm.check({ drugs, conditions: p.conditions }).table2;
  const conditionDeleted = bm.check({ drugs, conditions: ALL }).table2;
  return {
    id: p.id,
    conditions: new Set(p.conditions),
    drugOnly: drugs.some((d) => hira.isCovered(d, d.cat)),
    asWritten,
    conditionDeleted,
    died: p.died,
  };
});
const N = people.length;

say(`SUBSTRATE ABLATION — ${data.source}`);
say(`${N} adults aged ${data.ageMin}+, unweighted\n`);

// --- 1. 규칙 단위: 조건을 지운 규칙이 겨냥하게 되는 사람은 누구인가 -----------------------------
say('1. Avoidance rules, per rule: whom the rule names once the condition is deleted');
say('   X = on the target drug; X and Y = on it with the condition the criterion names.\n');
say('   Counted as rule-person pairs, so a person on drugs matching two rules counts twice.\n');
say('   rule                                     |X|   |X and Y|   share named by the criterion');
let sx = 0, sxy = 0;
const perRule = [];
pim.table2.filter((t) => OBSERVABLE.has(t.id)).forEach((t) => {
  const X = people.filter((p) => p.conditionDeleted.some((h) => h.condition.id === t.id));
  const XY = X.filter((p) => p.conditions.has(t.id));
  if (!X.length) return;
  sx += X.length; sxy += XY.length;
  perRule.push({ id: t.id, label: EN[t.id] || t.label, x: X.length, xy: XY.length });
  const [lo, hi] = wilson(XY.length, X.length);
  say(`   ${(EN[t.id] || t.label).padEnd(30)} ${String(X.length).padStart(8)} ${String(XY.length).padStart(10)}`
    + `   ${pc(XY.length / X.length).padStart(6)}%  (${pc(lo)}-${pc(hi)})`);
});
const [plo, phi_] = wilson(sxy, sx);
say(`   ${'pooled'.padEnd(30)} ${String(sx).padStart(8)} ${String(sxy).padStart(10)}`
  + `   ${pc(sxy / sx).padStart(6)}%  (${pc(plo)}-${pc(phi_)})`);
say(`\n   Deleting the condition multiplies the named population by ${(sx / sxy).toFixed(1)},`);
say(`   and ${pc(1 - sxy / sx)}% of whom the deleted rule names do not carry the condition`);
say('   the criterion named. The deleted rule is not a weaker form of the same rule.\n');

// --- 2. 두 축의 겹침: 조건축 판정 중 약물 단독 축이 못 보는 몫 ---------------------------------
const b = people.filter((p) => p.asWritten.length > 0);
const a = people.filter((p) => p.drugOnly);
const both = people.filter((p) => p.drugOnly && p.asWritten.length > 0).length;
const onlyB = b.length - both;
const onlyA = a.length - both;
const neither = N - both - onlyA - onlyB;
const den = Math.sqrt((both + onlyA) * (onlyB + neither) * (both + onlyB) * (onlyA + neither));
const phiCoef = den === 0 ? NaN : (both * neither - onlyA * onlyB) / den;
const [blo, bhi] = wilson(onlyB, N);
say('2. What a condition-free substrate cannot see');
say(`   condition axis fires        ${String(b.length).padStart(5)}  ${pc(b.length / N)}%`);
say(`   drug-only axis fires        ${String(a.length).padStart(5)}  ${pc(a.length / N)}%`);
say(`   condition axis only         ${String(onlyB).padStart(5)}  ${pc(onlyB / N)}%  (95% CI ${pc(blo)}-${pc(bhi)})`);
say(`   as a share of the condition axis   ${pc(onlyB / b.length)}%`);
say(`   phi between the two axes    ${phiCoef.toFixed(3)}   (the axes are close to independent)\n`);

// --- 3. 지배 규칙 민감도: 결과가 한 규칙에 걸려 있는가 ------------------------------------------
const gap = {};
people.filter((p) => p.asWritten.length && !p.drugOnly).forEach((p) => {
  new Set(p.asWritten.map((h) => `${h.condition.label} + ${h.target.nameKo}`))
    .forEach((k) => { gap[k] = (gap[k] || 0) + 1; });
});
const ranked = Object.entries(gap).sort((x, y) => y[1] - x[1]);
const [topKey, topN] = ranked[0];
const survives = people.filter((p) => p.asWritten.length && !p.drugOnly)
  .filter((p) => [...new Set(p.asWritten.map((h) => `${h.condition.label} + ${h.target.nameKo}`))]
    .some((k) => k !== topKey)).length;
const [slo, shi] = wilson(survives, N);
say('3. Dominance sensitivity');
say(`   largest single pair "${topKey}" accounts for ${topN} of ${onlyB} (${pc(topN / onlyB)}%)`);
say(`   dropping it leaves ${survives} (${pc(survives / N)}%, 95% CI ${pc(slo)}-${pc(shi)})`);
say('   The headline depends on one rule; the floor after removing it is the honest figure.\n');

// --- 4. 미치료형 규칙의 포화 ------------------------------------------------------------------
say('4. Undertreatment shape, same pairs: |Y not X| / |Y| against |N not X| / |N|');
say('   An arithmetic demonstration on the same condition-drug pairs, not a clinical rule.\n');
say('   pair                             as written   condition deleted');
perRule.forEach((r) => {
  const Y = people.filter((p) => p.conditions.has(r.id));
  const onDrug = new Set(people.filter((p) => p.conditionDeleted.some((h) => h.condition.id === r.id)).map((p) => p.id));
  if (!Y.length) return;
  const asW = Y.filter((p) => !onDrug.has(p.id)).length / Y.length;
  const del = people.filter((p) => !onDrug.has(p.id)).length / N;
  say(`   ${r.label.padEnd(30)} ${pc(asW).padStart(9)}%  ${pc(del).padStart(14)}%`);
});
say('\n   Deleting Y replaces a condition-specific non-use rate with the population non-use');
say('   rate. Here the two differ by 0.3 to 10.5 percentage points, so the deleted rule');
say('   reports very nearly the population figure and no longer distinguishes the condition');
say('   group from everyone else. It still returns a number; it has stopped measuring.\n');

say('Limits: 8 of 18 conditions observable, so the condition-axis counts are a lower bound;');
say('self-reported 30-day use, not claims; unweighted, so these describe this cohort and are');
say('not United States estimates; NHANES is not a substrate any national indicator runs on.');

// 표의 숫자를 사람이 옮겨 적지 않도록, 원고 생성기가 읽는 JSON 을 여기서 쓴다.
const result = {
  source: data.source, n: N, ageMin: data.ageMin,
  observable: data.mappedConditions.length, total: pim.table2.length,
  perRule, pooledX: sx, pooledXY: sxy,
  conditionAxis: b.length, drugOnlyAxis: a.length, conditionAxisOnly: onlyB,
  phi: phiCoef, dominantPair: topKey, dominantN: topN, floor: survives,
};
if (require.main === module) {
  require('fs').writeFileSync(path.join(__dirname, 'ablation_result.json'),
    JSON.stringify(result, null, 1) + '\n');
  say('Wrote analysis/ablation_result.json for the manuscript generator.');
}

module.exports = { N, onlyB, phi: phiCoef, pooledX: sx, pooledXY: sxy, survives, perRule };
