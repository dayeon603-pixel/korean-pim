/* 초록에 쓴 숫자를 전부 다시 계산한다 — node test/abstract_numbers.js
 *
 * 원칙: 초록에 들어가는 모든 숫자는 명령 한 줄로 재현돼야 한다. 재현 안 되면 초록에서 뺀다.
 * 이 스크립트는 그 원칙을 강제한다. 초록의 수치와 여기 출력이 다르면 초록이 틀린 것이다.
 *
 * 대규모 표본이 필요한 수치(φ·중복률·한계수확)는 기본 20만건×5시드로 돌린다.
 * 초록에 쓴 값은 100만건×5시드이므로 소수 셋째 자리에서 다를 수 있다. 인자로 조절한다:
 *   node test/abstract_numbers.js 1000000 5
 */
'use strict';
const N = parseInt(process.argv[2] || '200000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

const pim = require('../src/index.js');
const beers = require('../src/beers2023.js');
const hira = require('../src/hira2022.js');
const jur = require('../src/jurisdictions.js');
const { run } = require('./cohort.js');
const { stats } = require('./test_ncqa_correlation.js');

const rows = [];
const put = (claim, got, src) => rows.push({ claim, got, src });

// ── 기준 규모 ──────────────────────────────────────────────
put('표1 항목', `${pim.coverage.table1}개`, 'src/index.js coverage.table1');
put('표2 조건', `${pim.coverage.table2Conditions}개`, 'src/index.js coverage.table2Conditions');
put('고유 항목', `${pim.coverage.unique}개`, 'src/index.js coverage.unique');
put('Beers 2023 Table 3 조건', `${beers.conditionCount}개`, 'src/beers2023.js conditionCount');
put('국가 기준 조건부 축', `${hira.NATIONAL_CRITERIA.conditionBased ? '있음' : '0개(없음)'}`,
    'src/hira2022.js NATIONAL_CRITERIA.conditionBased');

// ── 관할 비교 ──────────────────────────────────────────────
put('판정 가능한 관할', `${jur.regionCount}곳`, 'src/jurisdictions.js regionCount');
put('판정 가능한 관할×계층', `${jur.assessableCount}건`, 'src/jurisdictions.js assessableCount');
jur.byLayer().filter((l) => l.judged).forEach((l) => {
  put(`조건부 축 유지 — ${l.layerKo}`, `${l.retained}/${l.judged}`, 'src/jurisdictions.js byLayer()');
});
put('스코틀랜드 조건부 지표',
    `${jur.JURISDICTIONS.find((x) => x.id === 'sct-poly').conditionCount}행`, 'src/jurisdictions.js sct-poly');
put('잉글랜드 PINCER 조건부',
    `${jur.JURISDICTIONS.find((x) => x.id === 'eng-pincer').conditionCount}개`, 'src/jurisdictions.js eng-pincer');
put('미국 HEDIS DDE 조건',
    `${jur.JURISDICTIONS.find((x) => x.id === 'us-hedis-dde').conditionCount}개`, 'src/jurisdictions.js us-hedis-dde');

// ── NCQA 배제 사유 검정 ────────────────────────────────────
const acc = { phi: [], overlap: [], marginal: [], kappa: [] };
for (let r = 0; r < REPS; r++) {
  const st = stats(run(20260902 + r * 7919, N));
  Object.keys(acc).forEach((k) => acc[k].push(st[k]));
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((s, t) => s + (t - m) ** 2, 0) / (v.length - 1)); };
const src = `test/cohort.js + test/test_ncqa_correlation.js (${(N * REPS).toLocaleString()}건)`;
put('환자 단위 중복률 P(A|B)', `${(mean(acc.overlap) * 100).toFixed(1)}%`, src);
put('φ 계수', mean(acc.phi).toFixed(3), src);
put('Cohen κ', mean(acc.kappa).toFixed(3), src);
put('한계수확 P(B∧¬A)', `${(mean(acc.marginal) * 100).toFixed(2)}% (표준편차 ${(sd(acc.marginal) * 100).toFixed(2)})`, src);
put('조건부 판정 중 배타적 비율', `${((1 - mean(acc.overlap)) * 100).toFixed(1)}%`, src);
// 한계수확을 상대 규모로 본 값. φ 보다 해석 기준이 분명해 본문의 효과 크기 서술에 쓴다.
// 약물 단독 축이 판정한 인구를 기준으로 조건부 축이 판정 대상을 몇 % 넓히는가.
{
  const x = run(20260902, N);
  const byA = x.both + x.onlyHira;
  put('판정 대상 확대율 (합성)', `${(x.onlyT2 / byA * 100).toFixed(1)}%`, src);
}

// ── 임상 중요도 ────────────────────────────────────────────
const ms = require('./missed_severity.js');
put('놓친 판정 중 Beers도 지정', `${(ms.inBeers / ms.total * 100).toFixed(1)}% (${ms.inBeers}/${ms.total})`,
    'test/missed_severity.js');

const w = Math.max(...rows.map((r) => r.claim.length));
console.log(`초록 수치 재현 — ${N.toLocaleString()}건 × 시드 ${REPS}개\n`);
rows.forEach((r) => console.log(`  ${r.claim.padEnd(w)}  ${String(r.got).padEnd(22)} ← ${r.src}`));
console.log(`\n총 ${rows.length}개 수치. 초록의 값과 다르면 초록이 틀린 것이다.`);
console.log('※ 성분 단위 대조(61/63, 96.8%)는 test/compare_ingredient_level.js 에서 별도로 확인한다.');
