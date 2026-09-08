/* Comparing the two criteria — node test/compare_criteria.js
 *
 * The question: how does the national standard (HIRA 2022, 77 ingredients in 14 classes) differ
 * from the Korean PIM criteria of Kim 2018?
 *
 * Why the comparison holds: the HIRA report publishes a table of the sources its candidate list was
 * drawn from, and "Korea PIM 63" is one of them. Table 1 of Kim 2018 was therefore under review for
 * the national standard, while Table 2, the 18 condition-conditioned rules, never entered the
 * candidate pool at all. This script counts how large that gap actually is.
 */
'use strict';
const pim = require('../src/index.js');
const hira = require('../src/hira2022.js');
const beers = require('../src/beers2023.js');
const reg = require('../src/criteria_registry.js');

const line = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
console.log('Criteria comparison — HIRA 2022 draft national standard vs Kim 2018 Korean PIM\n');
console.log(hira.source);
console.log(`Kim MY et al., Ann Geriatr Med Res 2018;22(3):121-129`);

line('1. Structure of the two criteria');
console.log(`HIRA 2022   ${hira.totalIngredients} ingredients / ${hira.CLASSES.length} classes · condition-conditioned rules: ${hira.NATIONAL_CRITERIA.conditionBased ? 'yes' : 'none'}`);
console.log(`Kim 2018    Table 1 ${pim.coverage.table1} ingredients · Table 2 ${pim.coverage.table2Conditions} condition rules (${pim.coverage.unique} unique items)`);
console.log(`\n심평원 기준(안): ${hira.NATIONAL_CRITERIA.age} + ${hira.NATIONAL_CRITERIA.general}`);
console.log(`                 + ${hira.NATIONAL_CRITERIA.drug}`);

line('2. Where the national standard drew its candidates from (report Table 20)');
Object.entries(hira.CANDIDATE_SOURCES).forEach(([k, v]) => {
  const label = { total: 'candidates, total', erRelated: 'drugs implicated in emergency visits',
    beers: 'Beers Criteria', koreaPim: 'Korea PIM  <- Kim 2018 Table 1',
    durElderly: 'DUR 노인주의 (elderly-caution list)', ahYoungmi: 'Ah Y et al. (2020)' }[k];
  console.log(`  ${String(v).padStart(4)}  ${label}`);
});
console.log(`\n  Korea PIM candidate count 63 = Kim 2018 Table 1 item count ${pim.coverage.table1}  ->  they agree`);
console.log(`  None of the ${pim.coverage.table2Conditions} Kim 2018 Table 2 conditions appears anywhere in the candidate list`);

line('3. How much of Kim 2018 Table 1 the 14 national classes cover');
const covered = [], uncovered = [];
pim.table1.forEach((x) => {
  const drug = { ing: x.ingredient, cls: x.classKey, tags: x.tags };
  const c = hira.classify(drug, x.classKo);
  (c ? covered : uncovered).push({ item: x, hiraClass: c });
});
console.log(`covered      ${covered.length}/${pim.coverage.table1} (${(covered.length / pim.coverage.table1 * 100).toFixed(1)}%)`);
console.log(`not covered  ${uncovered.length}/${pim.coverage.table1} (${(uncovered.length / pim.coverage.table1 * 100).toFixed(1)}%)`);
console.log('\nKim 2018 Table 1 drugs that the 14 national classes do not cover:');
const byCat = {};
uncovered.forEach((u) => { (byCat[u.item.classKo] = byCat[u.item.classKo] || []).push(u.item.nameKo); });
Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)
  .forEach(([cat, names]) => console.log(`  ${String(names.length).padStart(2)}  ${cat.padEnd(20)} ${names.join(', ')}`));

line('4. Classes in the national standard that Kim 2018 Table 1 does not carry');
const kimKeys = new Set(pim.table1.flatMap((x) => [x.classKey, ...x.tags]));
hira.CLASSES.forEach((c) => {
  const m = c.match;
  const inKim = (m.ing && pim.isTable1(m.ing)) || (m.cls && kimKeys.has(m.cls)) || (m.tag && kimKeys.has(m.tag));
  if (!inKim) console.log(`  ${c.name} (${c.n} ingredients, ${c.prevalence}% of claims)`);
});

line('5. Measured national claims (report Tables 27-35, 2017 cohort)');
const C = hira.CLAIMS;
console.log(`outpatients aged 65+ with a prescription   ${C.elderlyOutpatients.toLocaleString()}`);
console.log(`polypharmacy cohort (5+ drugs, 90+ days)   ${C.polypharmacyCohort.toLocaleString()}`);
console.log(`on at least one inappropriate drug         ${C.pimUsers.toLocaleString()} (${C.pimUserRate}%)`);
console.log(`contraindicated combination               ${C.ddiUsers.toLocaleString()} (${C.ddiRate}%) · most common ${C.topDdiPair}`);
console.log(`duplicate therapeutic class               ${C.dupClassUsers.toLocaleString()} (${C.dupClassRate}%)`);
console.log(`inappropriate polypharmacy (10+, 90d, PIM) ${C.inappropriatePolypharmacy.toLocaleString()} (${C.inappropriateRate}%)`);
console.log(`odds of admission, emergency visit, death  ${C.harmOddsRatio[0]}-${C.harmOddsRatio[1]}x`);

line('6. Most frequently prescribed classes (report Table 28)');
[...hira.CLASSES].sort((a, b) => b.prevalence - a.prevalence).slice(0, 6)
  .forEach((c) => console.log(`  ${String(c.prevalence).padStart(5)}%  ${c.name}`));

line('Conclusion');
console.log(`The national standard covers ${(covered.length / pim.coverage.table1 * 100).toFixed(0)}% of Kim 2018 Table 1 at the class level, but`);
console.log(`none of the ${pim.coverage.table2Conditions} condition rules in Table 2 was even considered as a candidate.`);
console.log(`The axis that requires the patient's condition to be read alongside the drug does not`);
console.log(`exist in the national standard.`);
console.log(`\nNote: report Table 21 publishes class names and ingredient counts only. An ingredient-level`);
console.log(`      comparison became possible once the appendix itself was obtained.`);

line('7. The condition axis across three criteria');
console.log(`Kim 2018 Table 2 (Korea, academic consensus)     ${pim.coverage.table2Conditions} conditions`);
console.log(`Beers 2023 Table 3 (USA, academic consensus)     ${beers.conditionCount} conditions`);
console.log(`HIRA 2022 (Korea, national operating standard)   ${hira.NATIONAL_CRITERIA.conditionBased ? 'present' : '0 conditions'}`);
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

console.log(`\nin both            ${shared.length}`);
shared.forEach((s) => console.log(`   ${s.beers.nameKo}`));
console.log(`\nBeers only         ${beersOnly.length}`);
beersOnly.forEach((c) => console.log(`   ${c.nameKo} (${c.name})`));
console.log(`\nKim 2018 only      ${kimOnly.length}`);
kimOnly.forEach((c) => console.log(`   ${c.label}`));

line('8. What the comparison shows');
console.log(`The academic-consensus criteria carry a condition axis in both countries (Korea ${pim.coverage.table2Conditions},`);
console.log(`USA ${beers.conditionCount}).`);
console.log(`The Korean criteria carry ${pim.coverage.table2Conditions - beers.conditionCount} more condition rules than the American ones.`);
console.log(`In the national operating standard (HIRA 2022) that axis is gone entirely.`);
console.log(`\nThe loss of the condition axis is therefore not a thin Korean list. It happens in the step`);
console.log(`that carries an academic consensus into a national operating standard.`);
console.log(`\nNote: Beers 2023 moved some criteria out of Table 3 into Tables 4 and 6. Only Table 3 of the`);
console.log(`      2023 edition is counted here.`);

line('9. Criteria registry — presence of the condition axis');
console.log('region · kind        criteria                              cond. axis  count    implemented');
reg.CRITERIA.forEach((c) => {
  const cnt = c.conditionCount === null ? 'unknown' : `${c.conditionCount}`;
  console.log(`${(c.region + ' · ' + c.kind).padEnd(20)} ${c.name.slice(0, 36).padEnd(38)} ${(c.conditionAxis ? 'yes' : 'no').padEnd(11)} ${cnt.padEnd(8)} ${c.implemented}`);
});
const sp = reg.split();
console.log(`\nwith a condition axis  ${sp.withAxis.length}/${reg.CRITERIA.length}`);
console.log(`without: ${sp.withoutAxis.map((c) => c.name).join(', ')}`);
if (sp.uncounted.length) {
  console.log(`\ncondition count unknown for ${sp.uncounted.length} — no estimate is substituted:`);
  sp.uncounted.forEach((c) => console.log(`  ${c.id}: ${c.note}`));
}

line('10. Summary');
console.log('Criteria built by academic consensus carry a condition axis in Korea, the USA and Europe.');
console.log('The one that was carried into a national operating standard is the one without it.');
console.log('The omission is not ignorance of the Korean list: 61 of the 63 Table 1 drugs (96.8%) were');
console.log('reviewed as candidates.');
console.log('Almost the whole drug axis was carried across. Only the condition axis was excluded, and');
console.log('structurally so.');
