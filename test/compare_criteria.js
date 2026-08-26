/* 기준 비교 — node test/compare_criteria.js
 *
 * 질문: 국가 기준(심평원 2022, 77개 성분 14계열)과 Kim 2018 한국형 PIM은 무엇이 다른가.
 *
 * 이 비교가 성립하는 이유: 심평원 보고서가 후보 목록 출처를 표로 공개했고
 * 거기에 "Korea PIM 63"이 들어 있다. 즉 Kim 2018의 표1은 국가 기준 검토 대상이었고,
 * 표2(기저질환 조건부 18개 조건)는 후보에조차 들어가지 않았다.
 * 이 스크립트는 그 공백이 실제로 어느 정도인지 센다.
 */
'use strict';
const pim = require('../src/index.js');
const hira = require('../src/hira2022.js');
const beers = require('../src/beers2023.js');

const line = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
console.log('기준 비교 — 심평원 2022 국가 기준(안) vs Kim 2018 한국형 PIM\n');
console.log(hira.source);
console.log(`Kim MY et al., Ann Geriatr Med Res 2018;22(3):121-129`);

line('1. 두 기준의 구조');
console.log(`심평원 2022   약물 ${hira.totalIngredients}개 성분 / ${hira.CLASSES.length}계열 · 기저질환 조건부 기준 ${hira.NATIONAL_CRITERIA.conditionBased ? '있음' : '없음'}`);
console.log(`Kim 2018      표1 ${pim.coverage.table1}개 성분 · 표2 ${pim.coverage.table2Conditions}개 기저질환 조건 (고유 ${pim.coverage.unique}항목)`);
console.log(`\n심평원 기준(안): ${hira.NATIONAL_CRITERIA.age} + ${hira.NATIONAL_CRITERIA.general}`);
console.log(`                 + ${hira.NATIONAL_CRITERIA.drug}`);

line('2. 국가 기준의 후보 목록 출처 (보고서 표 20)');
Object.entries(hira.CANDIDATE_SOURCES).forEach(([k, v]) => {
  const label = { total: '후보 합계', erRelated: '응급실 내원 영향 약물', beers: 'Beers Criteria',
    koreaPim: 'Korea PIM  ← Kim 2018 표1', durElderly: 'DUR 노인주의', ahYoungmi: '아영미 등(2020)' }[k];
  console.log(`  ${String(v).padStart(4)}  ${label}`);
});
console.log(`\n  Korea PIM 후보 수 63 = Kim 2018 표1 항목 수 ${pim.coverage.table1}  →  일치`);
console.log(`  Kim 2018 표2 ${pim.coverage.table2Conditions}개 조건은 후보 목록 어디에도 없음`);

line('3. Kim 2018 표1 63항목 중 국가 기준 14계열이 덮는 범위');
const covered = [], uncovered = [];
pim.table1.forEach((x) => {
  const drug = { ing: x.ingredient, cls: x.classKey, tags: x.tags };
  const c = hira.classify(drug, x.classKo);
  (c ? covered : uncovered).push({ item: x, hiraClass: c });
});
console.log(`덮임    ${covered.length}/${pim.coverage.table1} (${(covered.length / pim.coverage.table1 * 100).toFixed(1)}%)`);
console.log(`안 덮임 ${uncovered.length}/${pim.coverage.table1} (${(uncovered.length / pim.coverage.table1 * 100).toFixed(1)}%)`);
console.log('\n국가 기준 14계열이 포괄하지 않는 Kim 2018 표1 약물:');
const byCat = {};
uncovered.forEach((u) => { (byCat[u.item.classKo] = byCat[u.item.classKo] || []).push(u.item.nameKo); });
Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)
  .forEach(([cat, names]) => console.log(`  ${String(names.length).padStart(2)}종  ${cat.padEnd(20)} ${names.join(', ')}`));

line('4. 국가 기준에 있으나 Kim 2018 표1에 없는 계열');
const kimKeys = new Set(pim.table1.flatMap((x) => [x.classKey, ...x.tags]));
hira.CLASSES.forEach((c) => {
  const m = c.match;
  const inKim = (m.ing && pim.isTable1(m.ing)) || (m.cls && kimKeys.has(m.cls)) || (m.tag && kimKeys.has(m.tag));
  if (!inKim) console.log(`  ${c.name} (${c.n}개 성분, 청구 ${c.prevalence}%)`);
});

line('5. 국가 청구 실측 (보고서 표 27~35, 2017년 코호트)');
const C = hira.CLAIMS;
console.log(`65세 이상 외래 처방 환자        ${C.elderlyOutpatients.toLocaleString()}명`);
console.log(`다약제(5종+ 90일+) 코호트       ${C.polypharmacyCohort.toLocaleString()}명`);
console.log(`부적절 약물 1종 이상 사용       ${C.pimUsers.toLocaleString()}명 (${C.pimUserRate}%)`);
console.log(`병용금기                        ${C.ddiUsers.toLocaleString()}명 (${C.ddiRate}%) · 최다 ${C.topDdiPair}`);
console.log(`효능군 중복                     ${C.dupClassUsers.toLocaleString()}명 (${C.dupClassRate}%)`);
console.log(`부적절 다약제(10종+90일+PIM)    ${C.inappropriatePolypharmacy.toLocaleString()}명 (${C.inappropriateRate}%)`);
console.log(`입원·응급실·사망 확률           ${C.harmOddsRatio[0]}~${C.harmOddsRatio[1]}배`);

line('6. 처방 빈도 상위 계열 (보고서 표 28)');
[...hira.CLASSES].sort((a, b) => b.prevalence - a.prevalence).slice(0, 6)
  .forEach((c) => console.log(`  ${String(c.prevalence).padStart(5)}%  ${c.name}`));

line('결론');
console.log(`국가 기준은 Kim 2018 표1의 ${(covered.length / pim.coverage.table1 * 100).toFixed(0)}%를 계열 단위로 포괄하지만,`);
console.log(`**표2의 ${pim.coverage.table2Conditions}개 기저질환 조건은 후보 검토 대상에도 포함되지 않았다.**`);
console.log(`환자 상태를 함께 봐야 성립하는 판정 축이 국가 기준에 존재하지 않는다.`);
console.log(`\n※ 보고서 표 21은 계열과 성분 개수만 공개한다. 성분 단위 대조는 부록 원본 입수 후에 가능하다.`);

line('7. 조건부 판정 축의 3자 비교');
console.log(`Kim 2018 표2 (한국, 학술 합의)      ${pim.coverage.table2Conditions}개 조건`);
console.log(`Beers 2023 Table 3 (미국, 학술 합의) ${beers.conditionCount}개 조건`);
console.log(`심평원 2022 (한국, 국가 운영 기준)   ${hira.NATIONAL_CRITERIA.conditionBased ? '있음' : '0개 조건'}`);
console.log(`\n${beers.source}`);
console.log(`${beers.copyright}`);

const kimIds = new Set(pim.conditions.map((c) => c.id));
const shared = [], beersOnly = [], kimOnly = [];
beers.TABLE3.forEach((c) => {
  const eq = beers.KIM_EQUIVALENT[c.id];
  if (eq && kimIds.has(eq)) shared.push({ beers: c, kim: eq });
  else beersOnly.push(c);
});
const beersMapped = new Set(Object.values(beers.KIM_EQUIVALENT).filter(Boolean));
pim.conditions.forEach((c) => { if (!beersMapped.has(c.id)) kimOnly.push(c); });

console.log(`\n양쪽에 모두 있는 조건  ${shared.length}개`);
shared.forEach((s) => console.log(`   ${s.beers.nameKo}`));
console.log(`\nBeers에만 있는 조건    ${beersOnly.length}개`);
beersOnly.forEach((c) => console.log(`   ${c.nameKo} (${c.name})`));
console.log(`\nKim 2018에만 있는 조건 ${kimOnly.length}개`);
kimOnly.forEach((c) => console.log(`   ${c.label}`));

line('8. 이 비교가 말하는 것');
console.log(`학술 합의 기준은 두 나라 모두 조건부 축을 갖는다 (한국 ${pim.coverage.table2Conditions}개, 미국 ${beers.conditionCount}개).`);
console.log(`한국형 기준이 미국 기준보다 조건부 항목을 ${pim.coverage.table2Conditions - beers.conditionCount}개 더 갖는다.`);
console.log(`그런데 국가 운영 기준(심평원 2022)에서는 그 축이 통째로 사라진다.`);
console.log(`\n즉 조건부 기준의 소실은 "한국형 목록이 부실해서"가 아니라`);
console.log(`**학술 합의를 국가 운영 기준으로 옮기는 단계에서 발생한다.**`);
console.log(`\n※ Beers 2023은 일부 기준을 Table 3에서 Table 4·6으로 옮겼다. 여기서는 2023판 Table 3만 센다.`);
