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
  console.error('코호트 파일이 없다. 먼저 실행: python3 analysis/nhanes_prepare.py');
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

console.log(`실제 진료자료 적용 — ${data.source}\n`);
console.log(`대상 ${N}명 (${data.ageMin}세 이상, 처방 보유)`);
console.log(`성분명 ${totalDrugs}건 중 사전 해석 ${resolvedDrugs}건 (${(resolvedDrugs / totalDrugs * 100).toFixed(1)}%)`);
console.log(`확인 가능한 조건 ${data.mappedConditions.length}/18 — ${data.mappedConditions.join(', ')}`);
console.log(`미확인 ${data.unmappedConditions.length}개 — ${data.unmappedConditions.join(', ')}\n`);

console.log('두 판정 축의 분할표');
console.log(`  약물 단독 축 판정 A      ${String(a).padStart(5)}명  ${pct(a)}`);
console.log(`  조건부 축 판정   B      ${String(b).padStart(5)}명  ${pct(b)}`);
console.log(`  둘 다                  ${String(both).padStart(5)}명`);
console.log(`  A만                    ${String(onlyA).padStart(5)}명`);
console.log(`  **B만 (국가 기준 공백)** ${String(onlyB).padStart(5)}명  ${pct(onlyB)}`);
console.log(`  판정 없음               ${String(neither).padStart(5)}명`);

console.log('\n연관 지표');
console.log(`  기저 발화율 P(A)   ${(a / N * 100).toFixed(1)}%   ← 중복률의 기준선`);
console.log(`  중복률 P(A|B)      ${(overlap * 100).toFixed(1)}%   기저율 초과분 ${((overlap - a / N) * 100).toFixed(1)}%p`);
console.log(`  φ 계수             ${phi.toFixed(3)}`);
console.log(`  한계수확 P(B∧¬A)   ${(marginal * 100).toFixed(2)}%   조건부 축 판정의 ${(onlyB / b * 100).toFixed(1)}%`);

// Which conditions actually create the gap
const gap = {};
rows.filter((r) => r.byB && !r.byA).forEach((r) => {
  // One person can match the same condition more than once, so hits are deduplicated per condition.
  new Set(r.hits.map((h) => `${h.condition.label} + ${h.target.nameKo}`))
    .forEach((k) => { gap[k] = (gap[k] || 0) + 1; });
});
console.log('\n국가 기준이 놓친 판정을 만든 (조건 + 대상) 조합');
Object.entries(gap).sort((x, y) => y[1] - x[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}명  ${k}`));

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
  console.log(`\n지배 규칙 제거 검사`);
  console.log(`  최다 조합 "${topKey}" ${topN}명 (공백 ${onlyB}명의 ${(topN / onlyB * 100).toFixed(1)}%)`);
  console.log(`  이 조합을 빼면 공백은 ${survives.length}명 (${(survives.length / N * 100).toFixed(2)}%)로 줄어든다.`);
  console.log(`  ※ 결과가 한 규칙에 크게 의존한다면 그 규칙의 임상적 타당성이 결론의 전제가 된다.`);
  console.log(`  ※ 당뇨-베타차단제는 Kim 2018에는 있으나 Beers 2023 Table 3에는 없는 한국형 기준 고유 항목이다.`);
}

console.log(`\n사망 (추적 중앙값 약 2년, 보정 없음) — 추적 적격 ${elig.length}명`);
console.log(`  판정 없음        ${rate((r) => !r.byA && !r.byB)}`);
console.log(`  약물 단독 축만    ${rate((r) => r.byA && !r.byB)}`);
console.log(`  조건부 축만      ${rate((r) => !r.byA && r.byB)}`);
console.log(`  두 축 모두       ${rate((r) => r.byA && r.byB)}`);

console.log('\n※ 미국 자료이며 한국의 처방 분포가 아니다. 처방은 자기보고 30일 사용분이다.');
console.log('※ 18개 조건 중 8개만 확인 가능하므로 조건부 축의 판정량은 추정치가 아니라 **하한**이다.');
console.log('※ 사망은 보정하지 않은 기술통계다. PIM 노출은 동반질환 부담과 얽혀 있어 인과로 읽으면 안 된다.');

module.exports = { N, a, b, both, onlyA, onlyB, neither, phi, overlap, marginal, rows };
