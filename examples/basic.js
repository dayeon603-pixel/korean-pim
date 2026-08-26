/* 실행: node examples/basic.js */
'use strict';
const pim = require('../src/index.js');

console.log(`한국형 PIM 2018 — 표1 ${pim.coverage.table1}항목 + 표2 ${pim.coverage.table2Conditions}개 조건 = 고유 ${pim.coverage.unique}항목\n`);

// 1) 성분 하나가 노인 주의약물인지
console.log('졸피뎀:', pim.checkIngredient('zolpidem').reason);
console.log('글리메피리드:', pim.checkIngredient('glimepiride'), '← 논문 미등재라 판정하지 않는다\n');

// 2) 복용 목록 + 기저질환으로 통합 판정
const result = pim.check({
  drugs: ['warfarin', 'chlorpheniramine', 'zolpidem', 'amlodipine'],
  conditions: ['dementia', 'falls', 'bleeding'],
});

console.log('[표1 · 조건 무관]');
result.table1.forEach((h) => {
  console.log(`  ${h.item.nameKo} (${h.item.classKo}) — ${h.item.reason}${h.doseConditional ? ` [용량 조건 ${h.item.dose}]` : ''}`);
});

console.log('\n[표2 · 기저질환 조건부]');
result.table2.forEach((h) => {
  console.log(`  ${h.condition.label} + ${h.target.nameKo} → ${h.drugs.map((d) => d.name).join(', ')}`);
  console.log(`    사유: ${h.condition.reason}`);
});

// 3) 입력 화면용 조건 목록
console.log(`\n[입력받을 기저질환·병력 ${pim.conditions.length}개]`);
console.log(' ', pim.conditions.map((c) => `${c.label}(${c.kind})`).join(' · '));
