/* 국가 기준이 놓치는 조건부 판정을, 원문이 명시한 유해사례로 분류한다.
 *   node test/missed_harm.js
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * "조건부 축이 처방의 4.54%를 추가로 판정한다"는 것만으로는 그 판정이 임상적으로 중요한지 알 수 없다.
 * **경고(flag)는 위해(harm)가 아니다.** 이 구분을 흐리면 안 된다.
 *
 * 우리는 임상 결과를 추적하지 못했고 앞으로도 이 저장소 안에서는 못 한다. 그러나 한 단계는 갈 수 있다.
 * 각 기준이 **어떤 유해사례를 겨냥해 만들어졌는지**는 원문(Kim 2018 표2)에 사유로 적혀 있다.
 * 놓치는 판정을 그 사유로 분류하면 "무엇을 놓치는가"를 유해사례의 종류로 말할 수 있다.
 *
 * ── 한계(반드시 함께 읽을 것) ──────────────────────────────────────────────
 *  - 이것은 **기준이 겨냥한 위해의 분류**이지 위해가 실제로 발생했다는 근거가 아니다.
 *  - 빈도·중증도 가중치가 없다. 조합 하나가 다른 조합 하나와 같은 무게로 세어진다.
 *  - 분모가 35개 조합으로 작아 비율의 정밀도가 낮다.
 */
'use strict';
const pim = require('../src/index.js');
const ms = require('./missed_severity.js');

/** 원문 사유를 유해사례 범주로 묶는다. 근거 없는 세분류를 만들지 않으려고 큰 덩어리로만 나눈다. */
const HARM_CLASS = [
  { id: 'fall_cns', label: '낙상·의식·인지', match: /낙상|운동실조|정신운동|실신|섬망|인지|파킨슨|CNS/ },
  { id: 'bleed_gi', label: '출혈·소화관', match: /출혈|궤양|변비/ },
  { id: 'organ', label: '장기기능 악화', match: /신손상|신기능|심부전|부정맥|고혈압|저나트륨|요저류|요류|녹내장|혈당|저혈당/ },
  { id: 'no_benefit', label: '이익 근거 부족', match: /근거 부족|더 효과적인/ },
];

function classify(reason) {
  const hit = HARM_CLASS.find((h) => h.match.test(reason));
  return hit || { id: 'other', label: '기타' };
}

const byCond = {};
pim.table2.forEach((c) => { byCond[c.label] = c.reason; });

const rows = ms.rows.map((r) => {
  const reason = byCond[r.cond] || '';
  return { ...r, reason, harm: classify(reason) };
});

/** 유해사례 범주별 집계. 계산은 항상 수행하고 출력만 report() 로 미룬다. */
const tally = {};
rows.forEach((r) => {
  tally[r.harm.label] = tally[r.harm.label] || { n: 0, inBeers: 0, conds: new Set() };
  tally[r.harm.label].n += 1;
  if (r.inBeers) tally[r.harm.label].inBeers += 1;
  tally[r.harm.label].conds.add(r.cond);
});

/** 보고서를 출력한다. 다른 스크립트가 수치만 쓸 때는 돌지 않아야 한다. */
function report() {
  console.log('국가 기준이 놓치는 조건부 판정 — 원문이 명시한 유해사례별 분류\n');
  console.log(`대상: 국가 기준의 약물 목록으로 잡히지 않는 (조건 × 대상) 조합 ${rows.length}건\n`);

  const w = Math.max(...Object.keys(tally).map((k) => k.length));
  console.log('유해사례 범주'.padEnd(w) + '   조합   비율    Beers 중복   해당 조건');
  Object.entries(tally)
    .sort((a, b) => b[1].n - a[1].n)
    .forEach(([label, v]) => {
      console.log(`${label.padEnd(w)} ${String(v.n).padStart(5)} ${(v.n / rows.length * 100).toFixed(1).padStart(6)}% `
        + `${String(v.inBeers).padStart(10)}   ${[...v.conds].join(', ')}`);
    });

  console.log('\n-- 조합별 상세 --');
  rows.slice().sort((a, b) => a.harm.label.localeCompare(b.harm.label)).forEach((r) => {
    console.log(`  [${r.harm.label}] ${r.cond} + ${r.target}`);
    console.log(`      원문 사유: ${r.reason}${r.inBeers ? '  (Beers 2023도 지정)' : ''}`);
  });

  console.log('\n※ 기준이 **겨냥한** 위해의 분류이지 위해가 발생했다는 근거가 아니다.');
  console.log('※ 빈도·중증도 가중치가 없다. 조합 하나를 다른 조합 하나와 같은 무게로 셌다.');
  console.log(`※ 분모가 ${rows.length}개 조합으로 작아 비율의 정밀도가 낮다.`);
}

if (require.main === module) report();

module.exports = { rows, tally, HARM_CLASS };
