/* 사전이 불완전하면 결과가 편향되는가 — node analysis/dict_sensitivity.js
 *
 * 원고는 미해상 약물이 "검정력을 깎을 뿐 대비를 편향시키지 않는다"고 적었다. 그것은 결측이
 * 무작위라는 가정이고, 가정은 측정으로 대체할 수 있다.
 *
 * 방법: 사전과 표1 성분키에서 항목을 무작위로 덜어내고 같은 절제 분석을 다시 돌린다.
 *   빠진 항목이 규칙의 약물 절반에 걸리면 그 사람은 두 팔 모두에서 사라진다. 그래서 |X| 와
 *   |X∩Y| 가 함께 줄고, 비율이 흔들리지 않아야 한다는 것이 원고의 주장이다. 흔들리면 주장이 틀렸다.
 *
 * 이 검사는 "빠진 것이 무엇인지" 를 알 필요가 없다. 실제로 빠진 것을 알 수 없으므로,
 * 임의로 빼 보는 것이 확인할 수 있는 최선이다.
 */
'use strict';
const path = require('path');
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const { MAP } = require('./drug_class_map.js');

const data = require('./nhanes_cohort.json');
const OBSERVABLE = new Set(data.mappedConditions);
const ALL = pim.table2.map((t) => t.id);
const split = (n) => n.split(';').map((x) => x.trim()).filter(Boolean);

function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** 사전 일부를 가린 채 성분명을 해석한다. hidden 에 든 이름은 없는 것처럼 취급한다. */
function makeToDrug(hidden) {
  return (ing) => {
    if (hidden.has(ing)) return null;
    const k = pim.checkIngredient(ing);
    if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
    const m = MAP[ing];
    if (m) return { ing, cls: m[0], tags: m.slice(1), cat: '' };
    return null;
  };
}

/** 가린 사전으로 통합 비율을 다시 계산한다. */
function shareNotNamed(hidden) {
  const toDrug = makeToDrug(hidden);
  let X = 0, XY = 0;
  data.people.forEach((p) => {
    const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
    const deleted = bm.check({ drugs, conditions: ALL }).table2;
    const seen = new Set();
    deleted.forEach((h) => {
      if (!OBSERVABLE.has(h.condition.id) || seen.has(h.condition.id)) return;
      seen.add(h.condition.id);
      X += 1;
      if (p.conditions.includes(h.condition.id)) XY += 1;
    });
  });
  return X ? 1 - XY / X : NaN;
}

// 가릴 수 있는 이름: 보조 사전 전체와, 표1 성분 가운데 실제 코호트에 등장하는 것.
const inCohort = new Set();
data.people.forEach((p) => p.drugs.flatMap(split).forEach((i) => inCohort.add(i)));
const hideable = [...new Set([...Object.keys(MAP), ...[...inCohort].filter((i) => pim.checkIngredient(i))])]
  .filter((i) => inCohort.has(i));

const base = shareNotNamed(new Set());
const say = require.main === module ? console.log : () => {};
const pc = (x) => (100 * x).toFixed(1);

say('DICTIONARY ABLATION — does an incomplete dictionary bias the contrast?\n');
say(`Baseline share not carrying the condition: ${pc(base)}%`);
say(`Names that could be hidden (present in the cohort and resolvable): ${hideable.length}\n`);
say('  hidden   replicates      median      2.5th-97.5th      shift from baseline');

const REPLICATES = 200;
const results = [];
[0.05, 0.10, 0.20, 0.40].forEach((frac, fi) => {
  const rand = rng(20260906 + fi);
  const vals = [];
  for (let r = 0; r < REPLICATES; r += 1) {
    const hidden = new Set(hideable.filter(() => rand() < frac));
    const v = shareNotNamed(hidden);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  const lo = vals[Math.floor(0.025 * vals.length)];
  const hi = vals[Math.floor(0.975 * vals.length)];
  results.push({ frac, median: med, lo, hi, shift: med - base });
  say(`  ${(100 * frac).toFixed(0).padStart(4)}%   ${String(vals.length).padStart(6)}      `
    + `${pc(med).padStart(5)}%      ${pc(lo)}-${pc(hi)}%        ${(100 * (med - base)).toFixed(1).padStart(5)} points`);
});

const worst = results.reduce((a, c) => (Math.abs(c.shift) > Math.abs(a.shift) ? c : a));
say(`\nHiding two fifths of the resolvable names at random moves the estimate by `
  + `${(100 * results[results.length - 1].shift).toFixed(1)} points.`);
say('An incomplete dictionary removes a person from both arms of the contrast at once, so it');
say('costs precision and leaves the ratio where it was. That is measured here, not assumed.');

module.exports = { base, hideable: hideable.length, replicates: REPLICATES, results, worstShift: worst.shift };
