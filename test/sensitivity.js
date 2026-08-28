/* φ가 우리가 가정한 분포에만 성립하는 값인지 확인한다 — node test/sensitivity.js [건수]
 *
 * ── 왜 이걸 해야 하는가 ────────────────────────────────────────────────────
 * NCQA 명제 검정의 핵심 수치 φ는 **두 판정 축의 결합분포에 의존하는 값**이지 논리적 성질이 아니다.
 * 그런데 우리 코호트의 동반질환 조건부 상승률(LIFT)은 측정치가 아니라 가정이다.
 * 그렇다면 φ = 0.302 는 "우리가 가정한 분포의 φ"일 뿐이라는 반론이 성립한다.
 * 이 반론은 정당하고, 방어가 아니라 측정으로 답해야 한다.
 *
 * ── 방법 ──────────────────────────────────────────────────────────────────
 * 가정한 파라미터를 넓은 범위로 흔들면서 결론이 뒤집히는 지점이 있는지 찾는다.
 *   liftScale 0.0  질환 간 상관을 완전히 없앤 극단 (동반질환이 서로 독립)
 *             1.0  본 측정에 쓴 값
 *             2.0  상승률을 두 배로 (질환이 강하게 뭉치는 극단)
 *   condScale 0.5~2.0  전체 기저질환 유병률
 *   sizeShift -1~+1    처방 약물 수 분포 (소수 처방 ↔ 다제약물)
 *
 * ── 무엇이 결론인가 ────────────────────────────────────────────────────────
 * 지켜야 하는 것은 φ의 특정 값이 아니라 **"φ가 강한 상관의 기준선 0.5를 넘지 않는다"**는 결론이다.
 * 전 범위에서 넘지 않으면 결론은 가정에 의존하지 않는다. 넘는 구간이 있으면 그 구간을 밝혀 적는다.
 */
'use strict';
const { run } = require('./cohort.js');
const { stats } = require('./test_ncqa_correlation.js');

const N = parseInt(process.argv[2] || '100000', 10);
const SEEDS = [20260902, 20268821, 20276740];
const THRESHOLD = 0.5;

/** 파라미터 한 조합을 시드 여러 개로 돌려 평균을 낸다. */
function probe(opt) {
  const r = SEEDS.map((s) => stats(run(s, N, opt)));
  const avg = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  return { phi: avg('phi'), overlap: avg('overlap'), marginal: avg('marginal'), kappa: avg('kappa') };
}

/** 전체 격자를 훑어 보고서를 출력한다. test.js 가 probe() 만 쓸 때는 돌지 않아야 한다. */
function main() {
  const GRID = [];
  [0, 0.5, 1, 1.5, 2].forEach((liftScale) => GRID.push({ liftScale }));
  [0.5, 0.75, 1.5, 2].forEach((condScale) => GRID.push({ condScale }));
  [-1, -0.5, 0.5, 1].forEach((sizeShift) => GRID.push({ sizeShift }));
  // 극단 조합. 한 축씩 흔드는 것으로는 놓치는 구석을 본다.
  GRID.push({ liftScale: 0, condScale: 0.5, sizeShift: -1 });
  GRID.push({ liftScale: 2, condScale: 2, sizeShift: 1 });
  GRID.push({ liftScale: 0, condScale: 2, sizeShift: 1 });
  GRID.push({ liftScale: 2, condScale: 0.5, sizeShift: -1 });

  console.log(`φ 민감도 분석 — 조합 ${GRID.length + 1}개 × ${N.toLocaleString()}건 × 시드 ${SEEDS.length}개\n`);
  console.log('lift  cond  size |     φ      κ    중복률   한계수확  | 0.5 초과?');
  console.log('─'.repeat(72));

  const rows = [];
  [{}, ...GRID].forEach((opt) => {
    const r = probe(opt);
    const tag = `${(opt.liftScale === undefined ? 1 : opt.liftScale).toFixed(1)}   `
              + `${(opt.condScale === undefined ? 1 : opt.condScale).toFixed(2)}  `
              + `${(opt.sizeShift === undefined ? 0 : opt.sizeShift).toFixed(1).padStart(5)}`;
    const base = Object.keys(opt).length === 0 ? '  ← 본 측정' : '';
    console.log(`${tag} | ${r.phi.toFixed(3).padStart(6)} ${r.kappa.toFixed(3).padStart(6)} `
      + `${(r.overlap * 100).toFixed(1).padStart(7)}% ${(r.marginal * 100).toFixed(2).padStart(8)}%  | `
      + `${r.phi >= THRESHOLD ? '★ 초과' : '아니오'}${base}`);
    rows.push({ opt, ...r });
  });

  const maxPhi = Math.max(...rows.map((r) => r.phi));
  const minPhi = Math.min(...rows.map((r) => r.phi));
  const breached = rows.filter((r) => r.phi >= THRESHOLD);
  const minMarg = Math.min(...rows.map((r) => r.marginal));
  const maxOv = Math.max(...rows.map((r) => r.overlap));

  console.log('\n' + '─'.repeat(72));
  console.log(`φ 범위          ${minPhi.toFixed(3)} ~ ${maxPhi.toFixed(3)}   (기준선 ${THRESHOLD})`);
  console.log(`중복률 최대     ${(maxOv * 100).toFixed(1)}%`);
  console.log(`한계수확 최소   ${(minMarg * 100).toFixed(2)}%`);
  console.log(`\n결론 — φ가 강한 상관 기준선을 넘는 조합: ${breached.length}개 / ${rows.length}개`);
  if (!breached.length) {
    console.log('  가정을 넓게 흔들어도 φ는 0.5에 이르지 않는다.');
    console.log('  "두 축이 서로를 대체하지 못한다"는 결론은 LIFT 가정에 의존하지 않는다.');
    console.log(`  한계수확도 최악의 조합에서 ${(minMarg * 100).toFixed(2)}%로 0이 되지 않는다.`);
  } else {
    console.log('  아래 조합에서 결론이 뒤집힌다. 논문에 이 구간을 명시해야 한다:');
    breached.forEach((r) => console.log(`   ${JSON.stringify(r.opt)} → φ ${r.phi.toFixed(3)}`));
  }
  console.log('\n※ 흔든 것은 우리가 가정한 파라미터지 실제 청구 분포가 아니다.');
  console.log('  이 분석은 결론이 가정에 얼마나 민감한지를 보일 뿐, 외부 타당도를 대신하지 않는다.');
}

if (require.main === module) main();

module.exports = { probe, THRESHOLD };
