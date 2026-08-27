/* 놓친 판정의 임상 중요도 분류 — node test/missed_severity.js
 *
 * 질문: 국가 기준이 놓치는 조건부 판정은 임상적으로 중요한가, 사소한가.
 *
 * 방법: "국가 기준의 약물 목록으로는 잡히지 않고 Kim 2018 표2로만 잡히는" (조건 x 대상) 조합을
 *   전수 열거하고, 각각이 **Beers 2023 Table 3에도 등재된 기준인지** 대조한다.
 *   Beers는 별도의 전문가 패널이 독립적으로 근거를 검토해 만든 국제 기준이다.
 *   두 학술 기준이 각각 같은 조건을 지정했다면 그 판정의 임상적 중요도가 높다고 볼 근거가 된다.
 *
 * 한계
 *  - Beers 등재 여부를 임상 중요도의 **대리지표**로 쓴다. harm 데이터가 아니다.
 *  - 우리가 구조화한 Beers는 Table 3(조건부 9개)뿐이다. Table 2/4/6은 비교 대상에 없다.
 *  - 국가 기준의 최종 77개 성분명이 미공개라 계열 단위로만 "잡히는지"를 판단했다.
 */
'use strict';
const pim = require('../src/index.js');
const beers = require('../src/beers2023.js');
const hira = require('../src/hira2022.js');

// Kim 표2 조건 id -> Beers Table 3 조건 id. 대응이 없는 조건은 빈 배열.
// Kim은 섬망·치매·인지장애를 한 항목으로 묶고 Beers는 Delirium/Dementia를 나누므로 1:2로 대응한다.
const KIM_TO_BEERS = {
  dementia: ['dementia', 'delirium'],
  // Kim의 falls 조건 원문은 "낙상·골절·실신·기립성 저혈압 병력"이다.
  // Beers는 Syncope를 별도 조건으로 분리하므로 둘 다 대응시킨다.
  falls: ['falls', 'syncope'],
  parkinson: ['parkinson'],
  hf: ['hf'],
  ulcer: ['ulcer'],
  bph: ['bph'],
  insomnia: [], arrhythmia: [], htn: [], age80_primary: [], stroke_secondary: [],
  constipation: [], ckd: [], hyponatremia: [], copd: [], bleeding: [], dm: [], glaucoma: [],
};

/** 표2의 대상이 지칭하는 약물이 국가 기준 14계열로도 잡히는가.
 *  true=국가 기준이 약물 단독으로 이미 잡음, false=못 잡음, null=표1 밖이라 판단 불가 */
function targetCoveredByNational(target) {
  const probes = [];
  pim.table1.forEach((x) => {
    const d = { ing: x.ingredient, cls: x.classKey, tags: x.tags };
    // pim.table2 의 대상 필드는 ingredient/class/tag 다 (beers2023 은 ing/cls/tag 로 다르다)
    const hit = target.ingredient ? d.ing === target.ingredient
      : target.class ? d.cls === target.class
      : target.tag ? [d.cls, ...d.tags].includes(target.tag)
      : false;
    if (hit) probes.push({ d, cat: x.classKo });
  });
  if (!probes.length) return null;
  return probes.some((p) => hira.isCovered(p.d, p.cat));
}

// 두 기준의 대상을 비교하기 위한 공통 약물 집합.
// 표1 63종에 더해, 표2에서만 언급되는 성분(베라파밀·테오필린 등)도 넣어야 대응이 성립한다.
const UNIVERSE = pim.table1.map((x) => ({ ing: x.ingredient, cls: x.classKey, tags: x.tags.slice() }));
const EXTRA_CLASS = {
  verapamil: 'ccbnd', diltiazem: 'ccbnd', pioglitazone: 'tzd', theophylline: 'xanthine',
  caffeine: 'stimulant', methylphenidate: 'stimulant', phenylephrine: 'decongest',
  pseudoephedrine: 'decongest', carbamazepine: 'anticonv', oxcarbazepine: 'anticonv',
  carboplatin: 'onco', cisplatin: 'onco', cyclophosphamide: 'onco', vincristine: 'onco',
  clopidogrel: 'antiplatelet', warfarin: 'anticoag', dabigatran: 'noac', rivaroxaban: 'noac',
  apixaban: 'noac', edoxaban: 'noac', celecoxib: 'cox2', cilostazol: 'antiplatelet',
  donepezil: 'chei', galantamine: 'chei', rivastigmine: 'chei',
};
const seenIng = new Set(UNIVERSE.map((d) => d.ing));
Object.entries(EXTRA_CLASS).forEach(([ing, cls]) => {
  if (!seenIng.has(ing)) UNIVERSE.push({ ing, cls, tags: [] });
});
// 태그 보완: 계열만으로 잡히지 않는 태그 기반 대상(nsaid, diuretic 등)을 위해
UNIVERSE.forEach((d) => {
  if (d.cls === 'diuretic' || d.cls === 'kdiuretic') d.tags.push('diuretic');
  if (d.cls === 'nsaid') d.tags.push('nsaid', 'nsaid_ns');
  if (d.cls === 'cox2') d.tags.push('cox2');
  if (d.cls === 'bb') d.tags.push('betablocker');
  if (d.cls === 'cortico') d.tags.push('corticosteroid');
  if (d.cls === 'anticonv') d.tags.push('anticonvulsant');
  if (d.cls === 'ssri' || d.cls === 'anticholinergic') d.tags.push('antidepressant');
  d.tags = [...new Set(d.tags)];
});

/** 대상 하나를 약물 집합으로 푼다. kim 은 ingredient/class/tag, beers 는 ing/cls/tag 필드를 쓴다. */
function resolveTarget(t, kind) {
  const ing = kind === 'kim' ? t.ingredient : t.ing;
  const cls = kind === 'kim' ? t.class : t.cls;
  const tag = t.tag;
  const out = new Set();
  UNIVERSE.forEach((d) => {
    if (ing && d.ing === ing) out.add(d.ing);
    else if (cls && d.cls === cls) out.add(d.ing);
    else if (tag && [d.cls, ...d.tags].includes(tag)) out.add(d.ing);
  });
  return out;
}

const rows = [];
pim.table2.forEach((c) => {
  c.targets.forEach((t) => {
    if (t.all) return;                                  // 병용 조건은 별도 성격이라 제외
    const covered = targetCoveredByNational(t);
    if (covered === true) return;                       // 국가 기준이 약물 단독으로 이미 잡음
    const beersIds = KIM_TO_BEERS[c.id] || [];
    // 두 기준은 같은 대상을 서로 다른 층위로 지정한다.
    // 예: 심부전에 대해 Kim은 성분(verapamil), Beers는 계열(비DHP CCB)로 적는다.
    // 따라서 필드끼리 비교하면 놓친다. 양쪽을 약물 집합으로 풀어서 교집합을 본다.
    const kimSet = resolveTarget(t, 'kim');
    const inBeers = beersIds.some((bid) => {
      const bc = beers.TABLE3.find((b) => b.id === bid);
      if (!bc) return false;
      return bc.targets.some((bt) => {
        const bSet = resolveTarget(bt, 'beers');
        return [...kimSet].some((x) => bSet.has(x));
      });
    });
    rows.push({ cond: c.label, condId: c.id, target: t.nameKo, inBeers, judgable: covered !== null });
  });
});

const inB = rows.filter((r) => r.inBeers);
const notB = rows.filter((r) => !r.inBeers);
const pct = (n) => (n / rows.length * 100).toFixed(1);

/** 보고서를 출력한다. 다른 스크립트가 수치만 가져다 쓸 때는 돌지 않아야 한다. */
function report() {
  console.log('국가 기준이 놓치는 조건부 판정의 임상 중요도\n');
  console.log(`국가 기준의 약물 목록으로 잡히지 않는 (조건 x 대상) 조합: ${rows.length}건`);
  console.log(`  그중 Beers 2023 Table 3에도 등재   ${inB.length}건 (${pct(inB.length)}%)`);
  console.log(`  Kim 2018에만 존재                 ${notB.length}건 (${pct(notB.length)}%)`);

  console.log('\n-- 두 국제 학술 기준이 각각 지정한 조합 (중요도 높음) --');
  inB.forEach((r) => console.log(`  ${r.cond} + ${r.target}`));

  console.log('\n-- Kim 2018에만 있는 조합 (한국형 기준 고유) --');
  const byCond = {};
  notB.forEach((r) => { (byCond[r.cond] = byCond[r.cond] || []).push(r.target); });
  Object.entries(byCond).forEach(([c, ts]) => console.log(`  ${c.padEnd(24)} ${ts.join(', ')}`));

  console.log('\n* Beers 등재 여부를 임상 중요도의 대리지표로 사용했다. harm 데이터가 아니다.');
  console.log('* 구조화한 Beers는 Table 3(조건부)뿐이며 Table 2/4/6은 비교 대상에 없다.');
  console.log('* 국가 기준의 최종 성분명이 미공개라 계열 단위로 판단했다.');
}

if (require.main === module) report();

module.exports = { total: rows.length, inBeers: inB.length, kimOnly: notB.length, rows };
