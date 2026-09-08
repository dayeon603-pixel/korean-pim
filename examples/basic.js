/* Run: node examples/basic.js
 *
 * Drug and class names print in English where the data carries them. Condition labels and the
 * rationale text stay in Korean: they are the source article's own words, and paraphrasing them
 * into English would misrepresent what the criteria say. */
'use strict';
const pim = require('../src/index.js');

console.log(`Korean PIM 2018 — ${pim.coverage.table1} Table 1 items + ${pim.coverage.table2Conditions} Table 2 conditions = ${pim.coverage.unique} unique items\n`);

// 1) is a single ingredient one to use with caution in older adults?
console.log('zolpidem:', pim.checkIngredient('zolpidem').reason);
console.log('glimepiride:', pim.checkIngredient('glimepiride'), '<- not in the source article, so no finding\n');

// 2) adjudicate a medication list together with the patient's conditions
const result = pim.check({
  drugs: ['warfarin', 'chlorpheniramine', 'zolpidem', 'amlodipine'],
  conditions: ['dementia', 'falls', 'bleeding'],
});

console.log('[Table 1 · regardless of condition]');
result.table1.forEach((h) => {
  console.log(`  ${h.item.drug} (${h.item.group}) — ${h.item.reason}${h.doseConditional ? ` [dose condition ${h.item.dose}]` : ''}`);
});

console.log('\n[Table 2 · conditional on a comorbidity]');
result.table2.forEach((h) => {
  console.log(`  ${h.condition.label} + ${h.target.nameKo} → ${h.drugs.map((d) => d.name).join(', ')}`);
  console.log(`    rationale: ${h.condition.reason}`);
});

// 3) the condition list, for an input form
console.log(`\n[${pim.conditions.length} conditions and histories to collect]`);
console.log(' ', pim.conditions.map((c) => `${c.label}(${c.kind})`).join(' · '));
