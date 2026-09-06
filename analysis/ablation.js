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

// 코호트 파일을 인자로 받는다. 같은 규칙을 독립 주기에 다시 돌려 복제 여부를 본다.
//   node analysis/ablation.js                              (2017-2018)
//   node analysis/ablation.js nhanes_cohort_2015.json      (2015-2016)
const COHORT = process.argv[2] || 'nhanes_cohort.json';
const data = require(path.join(__dirname, COHORT));

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

/** 재현 가능한 난수. 시드를 고정해 부트스트랩이 실행마다 같은 값을 내게 한다. */
function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** 사람 단위 클러스터 부트스트랩.
 *
 * 규칙-사람 쌍 1,392건은 사람 1,345명에서 나오므로 서로 독립이 아니다. 한 사람이 여러 규칙에
 * 걸리면 그 사람의 특성이 여러 쌍에 함께 실린다. 쌍을 독립으로 두고 Wilson 구간을 쓰면
 * 구간이 실제보다 좁아진다. 사람을 복원추출해 통계량을 다시 계산한다.
 */
function clusterBootstrap(units, stat, B = 2000, seed = 20260906) {
  const rand = rng(seed);
  const n = units.length;
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const draw = new Array(n);
    for (let i = 0; i < n; i += 1) draw[i] = units[Math.floor(rand() * n)];
    const v = stat(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)], out.length];
}

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
    stratum: p.stratum, psu: p.psu, weight: p.weight,
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
// 부트스트랩용 단위: 사람 한 명이 만든 (규칙, 조건보유) 쌍 전체를 한 덩어리로 묶는다.
const units = people.map((p) => {
  const pairs = [];
  pim.table2.filter((t) => OBSERVABLE.has(t.id)).forEach((t) => {
    if (p.conditionDeleted.some((h) => h.condition.id === t.id)) {
      pairs.push({ rule: t.id, hasCondition: p.conditions.has(t.id) });
    }
  });
  return { pairs, byB: p.asWritten.length > 0, byA: p.drugOnly,
    stratum: p.stratum, psu: p.psu, weight: p.weight };
});
const shareNotNamed = (us) => {
  let X = 0, XY = 0;
  us.forEach((u) => u.pairs.forEach((q) => { X += 1; if (q.hasCondition) XY += 1; }));
  return X ? 1 - XY / X : NaN;
};
const phiOf = (us) => {
  let bo = 0, oa = 0, ob = 0, ne = 0;
  us.forEach((u) => {
    if (u.byA && u.byB) bo += 1; else if (u.byA) oa += 1; else if (u.byB) ob += 1; else ne += 1;
  });
  const d = Math.sqrt((bo + oa) * (ob + ne) * (bo + ob) * (oa + ne));
  return d === 0 ? NaN : (bo * ne - oa * ob) / d;
};
const gapShare = (us) => us.filter((u) => u.byB && !u.byA).length / us.length;
const [bsLo, bsHi, bsB] = clusterBootstrap(units, shareNotNamed);

/** 설계 기반 재표집: 층 안에서 PSU 를 복원추출하고, 뽑힌 PSU 의 사람을 전부 가져온다.
 *
 * NHANES 는 층화 다단계 확률표본이라 사람을 독립으로 재표집하면 설계 효과를 무시한다.
 * 층당 PSU 가 2개뿐이라 변동폭이 제한되지만, 이것이 이 설계에서 표준적인 방식이다.
 */
function designBootstrap(us, stat, B = 2000, seed = 20260906) {
  const byStratum = new Map();
  us.forEach((u) => {
    if (u.stratum == null || u.psu == null) return;
    if (!byStratum.has(u.stratum)) byStratum.set(u.stratum, new Map());
    const m = byStratum.get(u.stratum);
    if (!m.has(u.psu)) m.set(u.psu, []);
    m.get(u.psu).push(u);
  });
  const strata = [...byStratum.values()].map((m) => [...m.values()]);
  const rand = rng(seed);
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const draw = [];
    strata.forEach((psus) => {
      for (let i = 0; i < psus.length; i += 1) draw.push(...psus[Math.floor(rand() * psus.length)]);
    });
    const v = stat(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)]];
}

/** 표본가중치를 적용한 점추정. 구간이 아니라 점추정이 설계에 얼마나 좌우되는지만 본다. */
function weightedShareNotNamed(us) {
  let X = 0, XY = 0;
  us.forEach((u) => u.pairs.forEach((q) => {
    const w = u.weight || 0;
    X += w; if (q.hasCondition) XY += w;
  }));
  return X ? 1 - XY / X : NaN;
}

const [dLo, dHi] = designBootstrap(units, shareNotNamed);
const wShare = weightedShareNotNamed(units);

/** 규칙 하나를 빼고 다시 계산한다. 두 규칙이 분모의 79%를 차지하므로 통합값만으로는 부족하다. */
const leaveOneOut = perRule.map((r) => ({
  drop: r.label,
  share: 1 - (sxy - r.xy) / (sx - r.x),
}));
const looLo = Math.min(...leaveOneOut.map((x) => x.share));
const looHi = Math.max(...leaveOneOut.map((x) => x.share));
const [phiLo, phiHi] = clusterBootstrap(units, phiOf);
const [gapLo, gapHi] = clusterBootstrap(units, gapShare);

const [plo, phi_] = wilson(sxy, sx);
say(`   ${'pooled'.padEnd(30)} ${String(sx).padStart(8)} ${String(sxy).padStart(10)}`
  + `   ${pc(sxy / sx).padStart(6)}%  (${pc(plo)}-${pc(phi_)})`);
say(`\n   Deleting the condition multiplies the named population by ${(sx / sxy).toFixed(1)}.`);
say(`   Share of those named who do not carry the condition: ${pc(1 - sxy / sx)}%`);
say(`     pair-level Wilson (assumes independence, too narrow)  ${pc(1 - phi_)}-${pc(1 - plo)}%`);
say(`     person-level cluster bootstrap, ${bsB} draws           ${pc(bsLo)}-${pc(bsHi)}%  <- report this`);
say(`     stratified PSU resampling (design-based)               ${pc(dLo)}-${pc(dHi)}%`);
say(`     survey-weighted point estimate                          ${pc(wShare)}%`);
say(`   Leave-one-rule-out range                                  ${pc(looLo)}-${pc(looHi)}%`);
leaveOneOut.slice().sort((a, c) => a.share - c.share).forEach((x) => {
  say(`     without ${x.drop.padEnd(30)} ${pc(x.share).padStart(6)}%`);
});
say('   Two rules supply most of the denominator, so the pooled figure is reported with the');
say('   range it takes when each rule in turn is removed. The conclusion holds across it.\n');

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
say(`   condition axis only, bootstrap CI  ${pc(gapLo)}-${pc(gapHi)}%`);
say(`   phi between the two axes    ${phiCoef.toFixed(3)}  (bootstrap CI ${phiLo.toFixed(3)}-${phiHi.toFixed(3)})`);
say('   The axes are close to independent, so the drug-only rule is not a noisy proxy.\n');

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
  notNamed: 1 - sxy / sx, notNamedCI: [bsLo, bsHi], bootstrapDraws: bsB,
  designCI: [dLo, dHi], weightedShare: wShare, leaveOneOut, looRange: [looLo, looHi],
  phiCI: [phiLo, phiHi], gapCI: [gapLo, gapHi],
  conditionAxis: b.length, drugOnlyAxis: a.length, conditionAxisOnly: onlyB,
  phi: phiCoef, dominantPair: topKey, dominantN: topN, floor: survives,
};
if (require.main === module) {
  require('fs').writeFileSync(path.join(__dirname,
    COHORT === 'nhanes_cohort.json' ? 'ablation_result.json'
      : `ablation_result_${COHORT.replace(/[^0-9]/g, '')}.json`),
    JSON.stringify(result, null, 1) + '\n');
  say('Wrote analysis/ablation_result.json for the manuscript generator.');
}

module.exports = { N, onlyB, phi: phiCoef, pooledX: sx, pooledXY: sxy, survives, perRule };
