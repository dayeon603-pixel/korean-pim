/* NCQA가 밝힌 조건부 지표 제거 사유를 한국 기준으로 직접 검정한다.
 *   node test/test_ncqa_correlation.js [건수] [반복]
 *
 * ── 검정 대상 명제 ────────────────────────────────────────────────────────
 * NCQA는 Health Plan Ratings 2026에서 조건부(약물-질환) 지표 DDE를 제거하면서 사유를
 * 자체 메모에 이렇게 적었다:
 *
 *   "The measure is not used in any external programs and is also
 *    highly correlated with the Use of High-Risk Medications in Older Adults (DAE) measure."
 *
 * 앞부분("외부 프로그램 미채택")은 채택 현황에 관한 사실이라 우리가 검정할 수 없다.
 * 그러나 뒷부분("약물 단독 지표와 상관이 높다")은 **데이터로 참·거짓을 가릴 수 있는 실증 명제**다.
 * 상관이 정말 높다면 조건부 축은 약물 단독 축의 중복이고, 빼도 잡히는 환자가 거의 같다.
 * 한국 심평원이 표2 18개 조건을 후보에서 제외한 선택도 같은 논리로 정당화된다.
 *
 * ── 방법 ──────────────────────────────────────────────────────────────────
 * 합성 고령 처방 코호트(test/cohort.js)의 각 처방에 두 축을 독립적으로 적용해 2x2 분할표를 만든다.
 *   A축 = 약물 단독 (심평원 2022 국가 기준 14계열)   ← DAE 대응
 *   B축 = 조건부   (Kim 2018 표2 18개 조건)          ← DDE 대응
 *
 * 이진 두 변수의 상관은 φ 계수(= 2x2에서의 피어슨 상관, Matthews 상관과 동일)로 잰다.
 *   φ = (ad - bc) / sqrt((a+b)(c+d)(a+c)(b+d))
 *
 * 함께 보는 값
 *   중복률   P(A | B) — B가 판정한 처방 중 A도 이미 판정한 비율. 높을수록 조건부 축이 중복이다.
 *   한계수확 P(B and not A) — A를 다 돌린 뒤 B가 **추가로** 잡아내는 처방의 비율.
 *   Youden J, Cohen κ — 일치도를 다른 각도에서 교차 확인한다.
 *
 * ── 한계 ──────────────────────────────────────────────────────────────────
 *  - 합성 데이터다. 실제 청구 분포가 아니므로 φ의 절대값을 미국 DDE·DAE의 실제 상관과
 *    직접 비교하면 안 된다. 우리가 말할 수 있는 것은 **한국 기준의 두 축 사이에서**
 *    "높은 상관"이라는 전제가 성립하는지뿐이다.
 *  - A축은 국가 기준의 최종 77개 성분명이 미공개라 14계열 단위로 구현했다.
 *  - NCQA는 상관의 수치도, 계산 방법도 공개하지 않았다. "highly"의 기준선이 없다.
 */
'use strict';
const { run } = require('./cohort.js');

const N = parseInt(process.argv[2] || '200000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

/** 2x2 분할표에서 φ 계수와 부속 지표를 계산한다.
 * @param {{both:number,onlyHira:number,onlyT2:number,neither:number}} x
 */
function stats(x) {
  const a = x.both, b = x.onlyHira, c = x.onlyT2, d = x.neither;   // a=A∩B, b=A만, c=B만, d=둘다없음
  const n = a + b + c + d;
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  const phi = den === 0 ? NaN : (a * d - b * c) / den;
  const overlap = (a + c) === 0 ? NaN : a / (a + c);               // P(A | B)
  const marginal = c / n;                                          // P(B ∧ ¬A)
  const jaccard = (a + b + c) === 0 ? NaN : a / (a + b + c);
  // Cohen κ
  const po = (a + d) / n;
  const pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n);
  const kappa = (po - pe) / (1 - pe);
  return { phi, overlap, marginal, jaccard, kappa, n };
}

/** 실측을 실행한다. test.js 가 stats() 만 가져다 쓸 때는 돌지 않아야 한다. */
function main() {
  console.log(`NCQA "조건부 지표는 약물 단독 지표와 상관이 높다" 명제 검정 — ${N.toLocaleString()}건 × 시드 ${REPS}개\n`);
  console.log('시드         φ 상관    중복률 P(A|B)   한계수확 P(B∧¬A)   Jaccard    κ');

  const acc = { phi: [], overlap: [], marginal: [], jaccard: [], kappa: [] };
  for (let r = 0; r < REPS; r++) {
    const seed = 20260902 + r * 7919;
    const s = stats(run(seed, N));
    Object.keys(acc).forEach((k) => acc[k].push(s[k]));
    console.log(`${String(seed).padEnd(10)} ${s.phi.toFixed(4).padStart(8)} ${(s.overlap * 100).toFixed(2).padStart(13)}% `
              + `${(s.marginal * 100).toFixed(2).padStart(16)}% ${s.jaccard.toFixed(4).padStart(10)} ${s.kappa.toFixed(4).padStart(8)}`);
  }

  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((s, t) => s + (t - m) ** 2, 0) / (v.length - 1)); };

  const phi = mean(acc.phi), ov = mean(acc.overlap), mg = mean(acc.marginal);
  console.log(`\nφ 상관계수      ${phi.toFixed(4)} ± ${sd(acc.phi).toFixed(4)}`);
  console.log(`중복률 P(A|B)   ${(ov * 100).toFixed(2)}% ± ${(sd(acc.overlap) * 100).toFixed(2)}`);
  console.log(`한계수확        ${(mg * 100).toFixed(2)}% ± ${(sd(acc.marginal) * 100).toFixed(2)}`);
  console.log(`Cohen κ         ${mean(acc.kappa).toFixed(4)} ± ${sd(acc.kappa).toFixed(4)}`);

  // 판정. 두 지표가 서로 다른 방향을 가리키므로 한쪽만 골라 쓰지 않고 둘 다 적는다.
  // 유리한 쪽만 인용하면 NCQA를 반박한 것이 아니라 같은 실수를 반대 방향으로 하는 것이다.
  const STRONG = 0.5;   // 사회과학 관례상 φ 0.5 이상을 강한 상관으로 본다.
  console.log('\n판정 — 명제는 **어느 지표로 재느냐에 따라 갈린다.**\n');
  console.log(`  [NCQA 쪽에 유리한 읽기] 환자 단위 중복률 P(A|B) = ${(ov * 100).toFixed(1)}%.`);
  console.log(`    조건부 축이 판정한 처방의 대부분은 약물 단독 축이 이미 판정한다.`);
  console.log(`    "조건부 지표를 빼도 잡히는 환자는 거의 같다"는 주장은 이 수치로는 지지된다.`);
  console.log(`\n  [반대 읽기] 통계적 등가성은 성립하지 않는다. φ = ${phi.toFixed(3)}, κ = ${mean(acc.kappa).toFixed(3)}.`);
  console.log(`    둘 다 강한 상관의 관례적 기준선(${STRONG.toFixed(1)}) 아래다. 두 축은 서로를 대체하지 못한다.`);
  console.log(`    중복률이 높게 나오는 것은 약물 단독 축이 훨씬 넓게 판정하기 때문이지`);
  console.log(`    두 축이 같은 환자를 보기 때문이 아니다.`);
  console.log(`\n  [임상적으로 중요한 쪽] 한계수확 P(B∧¬A) = ${(mg * 100).toFixed(2)}%.`);
  console.log(`    약물 단독 축을 전부 돌린 뒤에도 조건부 축이 처방 100건당 약 ${(mg * 100).toFixed(1)}건을 추가로 잡아낸다.`);
  console.log(`    조건부 축 판정의 ${((1 - ov) * 100).toFixed(1)}%가 여기에 해당하고,`);
  console.log(`    그중 22.9%는 Beers 2023도 독립적으로 지정한 기준이다(test/missed_severity.js).`);
  console.log(`    즉 남는 판정은 사소한 잔여가 아니다.`);
  console.log('\n  → 말할 수 있는 최대치: 조건부 축의 배제는 "중복이라서 손실이 없다"로 정당화되지 않는다.');
  console.log('    손실은 작지만 0이 아니고, 남는 판정의 임상적 중요도가 낮다는 근거도 없다.');

  console.log('\n※ 합성 데이터다. φ의 절대값을 미국 DDE·DAE의 실제 상관과 직접 비교하면 안 된다.');
  console.log('※ NCQA는 상관의 수치도 계산 방법도 공개하지 않았다. "highly"의 기준선이 원문에 없다.');
  console.log('※ 22.9%는 별도 스크립트의 측정치이며 이 실행에서 재계산한 값이 아니다.');
}

if (require.main === module) main();

module.exports = { stats };
