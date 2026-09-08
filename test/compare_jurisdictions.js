/* Retention of the condition axis by operating layer — node test/compare_jurisdictions.js */
'use strict';
const j = require('../src/jurisdictions.js');

console.log('The conditional (drug-disease) axis in older-adult PIM criteria, by operating layer\n');
console.log(j.regionCount + ' jurisdictions · ' + j.assessableCount + ' adjudicable jurisdiction x layer entries\n');

const mark = (v) => (v === null ? ' ?  ' : v ? 'kept' : 'lost');
j.LAYER_ORDER.forEach((layer) => {
  const rows = j.JURISDICTIONS.filter((x) => x.layer === layer);
  console.log(`── ${j.LAYER_EN[layer]} (${layer}) ` + '─'.repeat(Math.max(0, 52 - j.LAYER_KO[layer].length * 2)));
  rows.forEach((r) => {
    const cnt = r.conditionCount === null ? 'unknown' : `${r.conditionCount}`;
    console.log(`  [${mark(r.axisRetained)}] ${r.region.padEnd(9)} conditions ${cnt.padStart(7)}   ${r.instrument}`);
  });
  console.log('');
});

console.log('── gradient across layers ' + '─'.repeat(46));
console.log('layer                       adjudicable   kept   kept %');
j.byLayer().forEach((s) => {
  if (!s.judged) return;
  const pct = (s.retained / s.judged * 100).toFixed(0) + '%';
  console.log(`${s.layerEn.padEnd(27)} ${String(s.judged).padStart(8)} ${String(s.retained).padStart(9)} ${pct.padStart(8)}`);
});

console.log('\nObserved: the axis survives at the clinical-decision-support and quality-measure-spec');
console.log('          layers, and is absent in all four adjudicable entries at the payment layer.');
console.log('          The exception is one Japanese national guideline. There the axis was not deleted');
console.log('          but demoted from a dedicated table column to prose, and Japan has no PIM-based');
console.log('          national quality measure at all.');

console.log('\n── counterexamples to the hypothesis ' + '─'.repeat(46));
console.log('The claim that the condition axis is always dropped on the way to a national');
console.log('operating standard is refuted.\n');
j.counterExamples().forEach((r) => {
  console.log(`  · ${r.region} — ${r.instrument}`);
  console.log(`    ${r.conditionCount} conditions · layer: ${j.LAYER_EN[r.layer]}`);
});

console.log('\n── not adjudicable, or no comparator exists ' + '─'.repeat(32));
j.NOT_ASSESSABLE.forEach((r) => console.log(`  · ${r.region}: ${r.reason}`));

console.log('\nNote: item counts are not directly comparable across jurisdictions. The unit of counting');
console.log('      differs (ingredient / ingredient group / drug class / condition statement / measure rate).');
console.log('Note: this is a convenience sample selected to test a hypothesis, not a systematic review.');
console.log('      Selection bias cannot be ruled out.');
