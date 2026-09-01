/* 성분 단위 대조 — node test/compare_ingredient_level.js
 *
 * 심평원 2022 보고서 부록1(후보 297개 성분 목록)의 원문 텍스트에 대해
 * Kim 2018 표1 63종이 실제로 후보에 올랐는지를 성분명 직접 검색으로 확인한다.
 *
 * 왜 직접 검색인가: 부록은 2단 표라 열 파싱이 성분명을 잘라먹는다.
 * 실제로 첫 시도에서 Doxepin·Digoxin·Insulin·Aspirin을 "없음"으로 잘못 판정했다
 * (원문에는 "Doxepin >6 mg/day", "Digoxin for first-line treatment of..." 형태로 존재).
 * 그래서 파싱 대신 원문 텍스트에서 성분명을 직접 찾는 방식으로 바꿨다.
 *
 * 한계: 부록1은 **후보 297개** 목록이다. 최종 채택된 77개 성분명은 보고서에 공개되지 않았다.
 * 따라서 "후보에 올랐는가"까지만 확인할 수 있고 "최종 목록에 남았는가"는 확인할 수 없다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const pim = require('../src/index.js');

const RAW = fs.readFileSync(path.join(__dirname, '../data/hira2022_appendix1_raw.txt'), 'utf8').toLowerCase();

// 성분명 이형 표기. 원문이 다른 이름을 쓰는 경우를 함께 찾는다.
const ALIAS = {
  glibenclamide: ['glyburide'],
  pethidine: ['meperidine'],
  mefenamic: ['mefenamic acid'],
  insulin_sliding: ['insulin'],
  estrogen: ['estrogen', 'estrogens'],
  somatropin: ['growth hormone', 'somatropin'],
  clidinium: ['clidinium'],
  chlorpheniramine: ['chlorpheniramine', 'chlorphenamine'],
};

function inAppendix(ing) {
  const keys = [ing.replace(/_/g, ' '), ...(ALIAS[ing] || [])];
  return keys.some((k) => RAW.includes(k.toLowerCase()));
}

const found = [], missing = [];
pim.table1.forEach((x) => (inAppendix(x.ingredient) ? found : missing).push(x));

/** 보고서를 출력한다. 다른 스크립트가 수치만 가져다 쓸 때는 돌지 않아야 한다. */
function report() {
  console.log('성분 단위 대조 — Kim 2018 표1 63종 vs 심평원 2022 후보 목록(부록1, 297개)\n');
  console.log(`후보 목록에 존재    ${found.length}/63 (${(found.length / 63 * 100).toFixed(1)}%)`);
  console.log(`후보 목록에 없음    ${missing.length}/63 (${(missing.length / 63 * 100).toFixed(1)}%)\n`);
  if (missing.length) {
    console.log('국가 기준 후보 검토 대상에 오르지 않은 Kim 2018 표1 약물:');
    missing.forEach((x) => console.log(`  ${x.nameKo.padEnd(12)} ${x.drug}  [${x.classKo}]`));
  }
  console.log('\n※ 부록1은 후보 297개 목록이다. 최종 채택 77개의 성분명은 보고서에 공개되지 않아,');
  console.log('   "후보에 올랐는가"까지만 확인할 수 있다. 최종 채택 여부는 확인 불가.');
  console.log('※ 표2의 18개 기저질환 조건은 후보 목록 자체가 약물 단위라 대응 항목이 존재하지 않는다.');
}

if (require.main === module) report();


module.exports = { found: found.length, missing: missing.map((x) => x.drug) };
