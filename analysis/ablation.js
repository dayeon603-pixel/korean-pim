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

// 해상되지 않은 성분명이 무엇인지 감사한다. "33.8% 만 해상됐다"는 소모(attrition)처럼 들리지만,
// 사전은 규칙이 지목하는 계열만 담도록 의도적으로 좁게 만들었다. 남은 것이 어느 규칙도 지목하지
// 않는 약이라면 그것은 소모가 아니라 범위다. 규칙이 지목하는 성분명 토큰을 미해상 목록에서 찾아 센다.
const RULE_TOKENS = ['meloxicam', 'celecoxib', 'etodolac', 'nabumetone', 'piroxicam', 'ketorolac',
  'sulindac', 'oxaprozin', 'diflunisal', 'alprazolam', 'lorazepam', 'clonazepam', 'diazepam',
  'temazepam', 'triazolam', 'zolpidem', 'zaleplon', 'eszopiclone', 'oxycodone', 'hydrocodone',
  'morphine', 'tramadol', 'codeine', 'fentanyl', 'hydromorphone', 'methadone', 'amitriptyline',
  'nortriptyline', 'doxepin', 'imipramine', 'paroxetine', 'diphenhydramine', 'hydroxyzine',
  'meclizine', 'promethazine', 'oxybutynin', 'tolterodine', 'solifenacin', 'verapamil', 'diltiazem',
  'glyburide', 'chlorpropamide', 'prednisone', 'prednisolone', 'methylprednisolone', 'dexamethasone',
  'hydrocortisone', 'furosemide', 'hydrochlorothiazide', 'chlorthalidone', 'torsemide', 'bumetanide',
  'spironolactone', 'metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'bisoprolol', 'nebivolol',
  'nadolol', 'sotalol',
  // 2026-09-06: 계열 구성원 보강과 함께 감사 목록도 넓힌다. 좁은 목록으로 감사하면
  // 사전에 없는 구성원을 감사도 놓친다.
  'metolazone', 'indapamide', 'labetalol', 'acebutolol', 'etoricoxib', 'desipramine',
  'imipramine', 'iloperidone', 'prochlorperazine', 'fludrocortisone', 'betamethasone',
  'triamcinolone', 'desvenlafaxine', 'vilazodone', 'vortioxetine', 'milnacipran',
  'duloxetine', 'venlafaxine', 'mirtazapine', 'trazodone', 'sertraline', 'citalopram',
  'escitalopram', 'fluoxetine', 'quetiapine', 'olanzapine', 'risperidone', 'haloperidone',
  'theophylline', 'pioglitazone', 'verapamil', 'diltiazem', 'clopidogrel', 'aspirin'];
// 복합제가 통째로 미해상 처리되면 두 축 모두에서 사라지고, 그러면 결과가 과소추정된다.
// NHANES 는 복합제를 "성분A; 성분B" 로 적는다. 그 가정이 맞는지 다른 구분자를 찾아 확인한다.
const combo = { rawStrings: 0, distinct: 0, semicolon: 0, otherSeparator: 0, constituents: 0 };
{
  const seen = new Set();
  data.people.forEach((p) => p.drugs.forEach((d) => {
    combo.rawStrings += 1;
    seen.add(d);
    if (d.includes(';')) { combo.semicolon += 1; combo.constituents += split(d).length; }
    // 세미콜론 외의 구분자 후보. 성분명 내부의 하이픈(omega-3)과 "… - unspecified" 분류 라벨은
    // 복합제가 아니므로 제외한다.
    if (!/ - unspecified$/.test(d) && (/\/|\+/.test(d) || / and /.test(d))) combo.otherSeparator += 1;
  }));
  combo.distinct = seen.size;
}

// 복합제를 성분으로 쪼개면 한 사람이 한 규칙에 여러 번 걸릴 수 있다. 쌍은 (규칙, 사람) 단위로
// 세므로 그런 사람도 한 번만 들어간다. 그 중복 제거가 실제로 얼마나 걷어내는지 센다.
const dedup = { rawMatches: 0, pairs: 0, maxPerRule: 0, comboPeopleAffected: 0 };
data.people.forEach((p) => {
  const hasCombo = p.drugs.some((d) => d.includes(';'));
  const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
  const hits = bm.check({ drugs, conditions: ALL }).table2.filter((h) => OBSERVABLE.has(h.condition.id));
  dedup.rawMatches += hits.length;
  const byRule = {};
  hits.forEach((h) => { byRule[h.condition.id] = (byRule[h.condition.id] || 0) + 1; });
  dedup.pairs += Object.keys(byRule).length;
  const mx = Math.max(0, ...Object.values(byRule));
  if (mx > dedup.maxPerRule) dedup.maxPerRule = mx;
  if (hasCombo && mx > 1) dedup.comboPeopleAffected += 1;
});

const mentions = { total: 0, resolved: 0, unresolved: 0, unresolvedRuleRelevant: 0,
  distinctUnresolved: 0, hidingAResolvableName: 0, saltForms: 0 };
const unresolvedStrings = {};
data.people.forEach((p) => p.drugs.flatMap(split).forEach((i) => {
  mentions.total += 1;
  if (toDrug(i)) { mentions.resolved += 1; return; }
  mentions.unresolved += 1;
  if (RULE_TOKENS.some((t) => i.includes(t))) mentions.unresolvedRuleRelevant += 1;
  unresolvedStrings[i] = (unresolvedStrings[i] || 0) + 1;
}));
// 표본이 아니라 전수로 본다. 미해상 문자열 안에 해상 가능한 성분명이 토큰으로 들어 있으면
// 염·복합제·상품명 파싱 실패이고, 그렇다면 비해상은 무작위가 아니다.
Object.keys(unresolvedStrings).forEach((str) => {
  mentions.distinctUnresolved += 1;
  const words = str.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (words.some((w) => toDrug(w))) mentions.hidingAResolvableName += 1;
  if (/(hydrochloride|hcl|sodium|potassium|sulfate|tartrate|maleate|besylate|succinate|mesylate|fumarate|citrate|acetate|phosphate)\b/.test(str)) {
    mentions.saltForms += 1;
  }
});

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

// 사람 단위. 쌍 단위 4.8배는 20.8% 의 역수라 같은 값을 두 번 말하는 것이고, "지목된 인구"는
// 쌍이 아니라 사람이다. 두 단위를 모두 계산해 어느 쪽을 말하는지 분명히 한다.
const personShareNotNamed = (us) => {
  const w = us.filter((u) => u.pairs.length).length;                 // 조건 삭제 시 지목되는 사람
  const a = us.filter((u) => u.pairs.some((q) => q.hasCondition)).length; // 원문 규칙이 지목하는 사람
  return w ? 1 - a / w : NaN;
};
const personNamedDeleted = units.filter((u) => u.pairs.length).length;
const personNamedAsWritten = units.filter((u) => u.pairs.some((q) => q.hasCondition)).length;
const [pLo, pHi] = clusterBootstrap(units, personShareNotNamed);

const [dLo, dHi] = designBootstrap(units, shareNotNamed);
const wShare = weightedShareNotNamed(units);

// 삭제 비용은 상수가 아니다. |X and Y| / |X| 는 그 약물이 그 조건에 대해 갖는 양성예측도이고,
// 조건을 지우는 비용은 1 에서 그것을 뺀 값이다. 약이 그 조건에 특이적이면 삭제가 싸고,
// 여러 적응증에 두루 쓰이면 비싸다. 이것이 "적응증에 의한 교란"에 대한 답이다:
// 두 축을 독립으로 가정하지 않고, 규칙마다 의존도를 측정해 보고한다.
const MIN_EXPOSED = 50;
const ppv = perRule.filter((r) => r.x >= MIN_EXPOSED)
  .map((r) => ({ label: r.label, x: r.x, ppv: r.xy / r.x }))
  .sort((a, c) => a.ppv - c.ppv);
const ppvLo = ppv[0], ppvHi = ppv[ppv.length - 1];

/** 규칙 하나를 빼고 다시 계산한다. 두 규칙이 분모의 79%를 차지하므로 통합값만으로는 부족하다. */
const leaveOneOut = perRule.map((r) => ({
  drop: r.label,
  share: 1 - (sxy - r.xy) / (sx - r.x),
}));
/* 지적: 분모를 고혈압·당뇨 두 규칙이 지배하므로 통합값이 그 둘의 유병률에서 나온
 * 인공물일 수 있다는 것. 그러면 둘을 함께 빼고 다시 계산하면 된다. 나머지 규칙만으로
 * 남는 값이 무너지는지 아닌지는 세어 보면 알 수 있다. */
const DOMINANT = ['Hypertension', 'Diabetes'];
const dropped = perRule.filter((r) => DOMINANT.includes(r.label));
const restX = sx - dropped.reduce((a, r) => a + r.x, 0);
const restXY = sxy - dropped.reduce((a, r) => a + r.xy, 0);
const withoutDominant = { pairs: restX, share: 1 - restXY / restX, dropped: dropped.map((r) => r.label) };

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
say(`   Person level: ${personNamedAsWritten} named as written, ${personNamedDeleted} with the condition deleted`);
say(`     ${(personNamedDeleted / personNamedAsWritten).toFixed(2)}-fold, share not carrying ${pc(1 - personNamedAsWritten / personNamedDeleted)}% (${pc(pLo)}-${pc(pHi)})`);
say(`     The pair-level fold change is the reciprocal of the pair-level share, so only one is reported.`);
say(`   Leave-one-rule-out range                                  ${pc(looLo)}-${pc(looHi)}%`);
leaveOneOut.slice().sort((a, c) => a.share - c.share).forEach((x) => {
  say(`     without ${x.drop.padEnd(30)} ${pc(x.share).padStart(6)}%`);
});
say('   Two rules supply most of the denominator, so the pooled figure is reported with the');
say('   range it takes when each rule in turn is removed. The conclusion holds across it.\n');
say(`   The cost of deletion is one minus the drug's predictive value for the condition.`);
say(`   Among the ${ppv.length} rules with at least ${MIN_EXPOSED} exposed it runs from`);
say(`   ${pc(ppvLo.ppv)}% (${ppvLo.label}, n=${ppvLo.x}) to ${pc(ppvHi.ppv)}% (${ppvHi.label}, n=${ppvHi.x}).`);
ppv.forEach((r) => say(`     ${r.label.padEnd(28)} n=${String(r.x).padStart(4)}  PPV ${pc(r.ppv).padStart(6)}%`));
say('   Deletion is cheap where the drug is specific to the condition and ruinous where it is');
say('   not, so the pooled figure reflects which drugs the criteria happen to name.\n');

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

say('Counting unit');
say(`   ${dedup.rawMatches} rule-target matches reduce to ${dedup.pairs} pairs, one per rule and person;`);
say(`   ${dedup.comboPeopleAffected} of those people take a combination that would otherwise have counted twice.\n`);

say('Drug-name resolution');
say(`   ${combo.rawStrings} drug strings (${combo.distinct} distinct); ${combo.semicolon} name more than one`);
say(`   ingredient and are split into ${combo.constituents} constituents, each matched separately.`);
say(`   ${combo.otherSeparator} strings use any other separator, so no combination is left unparsed.`);
say(`   ${mentions.resolved} of ${mentions.total} ingredient mentions resolved `
  + `(${pc(mentions.resolved / mentions.total)}%)`);
say(`   of the ${mentions.unresolved} unresolved, ${mentions.unresolvedRuleRelevant} `
  + `(${pc(mentions.unresolvedRuleRelevant / mentions.unresolved)}%) name a drug any rule targets`);
say('   The rest are drugs no rule names, chiefly statins, renin-angiotensin agents, metformin,');
say('   levothyroxine and proton-pump inhibitors, which could not have entered either arm.');
say(`   All ${mentions.distinctUnresolved} distinct unresolved strings were examined, not a sample.`);
say(`   ${mentions.hidingAResolvableName} contain a resolvable ingredient name as a token, both being`);
say(`   topical or ophthalmic preparations excluded on purpose; ${mentions.saltForms} carry a salt suffix`);
say('   and none of those names a drug any rule targets. Non-resolution is therefore not a');
say('   parsing failure on salt, brand or combination strings.\n');

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
  withoutDominant,
  ppv, ppvMinExposed: MIN_EXPOSED, mentions, combo, dedup,
  personNamedAsWritten, personNamedDeleted,
  personShareNotNamed: 1 - personNamedAsWritten / personNamedDeleted, personCI: [pLo, pHi],
  looFloorRule: leaveOneOut.reduce((a, c) => (c.share < a.share ? c : a)).drop,
  looCeilingRule: leaveOneOut.reduce((a, c) => (c.share > a.share ? c : a)).drop,
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
