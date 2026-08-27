/* 국가 기준 공백 측정 (대규모) — node test/measure_gap.js [건수] [반복]
 *
 * 심평원 2022 국가 기준은 약물 단독 기준이라 기저질환 조건부 판정을 할 수 없다.
 * 같은 처방을 두 기준으로 판정해 "국가 기준으로는 판정되지 않고 표2로만 판정되는" 비율을 센다.
 * 시드를 바꿔 여러 번 돌려 추정치가 안정적인지 함께 본다.
 *
 * 코호트 생성기는 test/cohort.js 로 분리했다. test_ncqa_correlation.js 가 같은 코호트를 써야 하기 때문이다.
 */
'use strict';
const { run } = require('./cohort.js');

const N = parseInt(process.argv[2] || '1000000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

console.log(`국가 기준 공백 측정 — ${N.toLocaleString()}건 × 시드 ${REPS}개\n`);
console.log('시드        국가기준     표2      둘다   국가만   표2만(공백)   표2 중 놓친 비율');
const gaps = [], shares = [];
for (let r = 0; r < REPS; r++) {
  const seed = 20260902 + r * 7919;
  const t0 = Date.now();
  const x = run(seed, N);
  const gap = x.onlyT2 / N * 100, share = x.onlyT2 / x.t2Flag * 100;
  gaps.push(gap); shares.push(share);
  console.log(`${String(seed).padEnd(10)} ${String(x.hiraFlag).padStart(8)} ${String(x.t2Flag).padStart(8)} ${String(x.both).padStart(8)} ${String(x.onlyHira).padStart(7)} ${(String(x.onlyT2)+'  ('+gap.toFixed(2)+'%)').padStart(16)} ${(share.toFixed(2)+'%').padStart(10)}   [${((Date.now()-t0)/1000).toFixed(1)}s]`);
}
const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); };
console.log(`\n공백 비율        평균 ${mean(gaps).toFixed(3)}%  표준편차 ${sd(gaps).toFixed(4)}  범위 ${Math.min(...gaps).toFixed(2)}~${Math.max(...gaps).toFixed(2)}`);
console.log(`표2 중 놓친 비율 평균 ${mean(shares).toFixed(3)}%  표준편차 ${sd(shares).toFixed(4)}  범위 ${Math.min(...shares).toFixed(2)}~${Math.max(...shares).toFixed(2)}`);
console.log(`\n총 ${(N * REPS).toLocaleString()}건 판정. 합성 데이터이며 실제 처방 분포가 아니다.`);
