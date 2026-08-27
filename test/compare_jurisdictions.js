/* 국가 운영 계층별 조건부 축 존치 비교 — node test/compare_jurisdictions.js */
'use strict';
const j = require('../src/jurisdictions.js');

console.log('노인 부적절약물 기준의 조건부(약물-질환) 판정 축 — 국가 운영 계층별 존치\n');
console.log('관할 ' + j.regionCount + '곳 · 판정 가능한 관할×계층 ' + j.assessableCount + '건\n');

const mark = (v) => (v === null ? ' ?  ' : v ? '유지' : '소실');
j.LAYER_ORDER.forEach((layer) => {
  const rows = j.JURISDICTIONS.filter((x) => x.layer === layer);
  console.log(`── ${j.LAYER_KO[layer]} (${layer}) ` + '─'.repeat(Math.max(0, 52 - j.LAYER_KO[layer].length * 2)));
  rows.forEach((r) => {
    const cnt = r.conditionCount === null ? '미확인' : `${r.conditionCount}개`;
    console.log(`  [${mark(r.axisRetained)}] ${r.region.padEnd(6)} 조건부 ${cnt.padStart(6)}   ${r.instrument}`);
  });
  console.log('');
});

console.log('── 계층 기울기 ' + '─'.repeat(46));
console.log('계층                    판정가능   축 유지   유지율');
j.byLayer().forEach((s) => {
  if (!s.judged) return;
  const pct = (s.retained / s.judged * 100).toFixed(0) + '%';
  console.log(`${s.layerKo.padEnd(20)} ${String(s.judged).padStart(8)} ${String(s.retained).padStart(9)} ${pct.padStart(8)}`);
});

console.log('\n관찰: 임상의사결정지원·품질지표 사양 계층에서는 조건부 축이 유지되고,');
console.log('      지불·재정 인센티브 계층에서는 판정 가능한 4건 모두에서 소실한다.');
console.log('      예외는 일본 국가 지침 1건이다. 이 경우 축이 삭제된 것이 아니라');
console.log('      표의 전용 열에서 산문 서술로 강등됐고, 일본에는 PIM 기반 국가 품질지표 자체가 없다.');

console.log('\n── 가설의 반례 ' + '─'.repeat(46));
console.log('"조건부 축은 국가 운영화에서 반드시 탈락한다"는 명제는 반증됐다.\n');
j.counterExamples().forEach((r) => {
  console.log(`  · ${r.region} — ${r.instrument}`);
  console.log(`    조건부 ${r.conditionCount}개 · 계층 ${j.LAYER_KO[r.layer]}`);
});

console.log('\n── 판정 불가 · 비교 대상 부재 ' + '─'.repeat(32));
j.NOT_ASSESSABLE.forEach((r) => console.log(`  · ${r.region}: ${r.reason}`));

console.log('\n※ 관할 간 항목 수의 직접 비교는 성립하지 않는다. 세는 단위가 다르다');
console.log('  (성분 / 성분군 / 약효군 / 조건 statement / 지표 rate).');
console.log('※ 가설 검정을 위해 선택된 편의표본이며 체계적 문헌고찰이 아니다. 선택편의를 배제할 수 없다.');
