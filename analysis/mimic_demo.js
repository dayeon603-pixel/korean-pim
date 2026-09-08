/**
 * Condition-axis evaluation demonstrated on real records — MIMIC-IV Clinical Database Demo v2.2
 *
 * Run: node analysis/mimic_demo.js <MIMIC demo hosp directory>
 *
 * Data: MIMIC-IV Clinical Database Demo v2.2, 100 patients.
 *   A PhysioNet open release, accessible without a credentialing review (ODC-BY 1.0).
 *   Johnson A, Bulgarelli L, Pollard T, Horng S, Celi LA, Mark R.
 *   MIMIC-IV Clinical Database Demo (version 2.2). PhysioNet. 2023.
 *
 * What this is and is not
 *   It is: a demonstration that the Korean PIM 2018 engine runs on real clinical records.
 *   It is not: an estimate of PIM exposure among Korean older adults. MIMIC holds US intensive care
 *          admissions for 100 patients. These rates must not be read as Korean epidemiology.
 *
 * Remaining limits
 *   - Drug name mapping is string normalisation and does not pass through RxNorm or any standard
 *     code system.
 *   - The ICD-to-condition mapping is our operational definition and has had no clinical review.
 *   - These are inpatient prescriptions, which differ from outpatient polypharmacy.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');
const hira = require('../src/hira2022.js');
const { conditionsFromIcd } = require('./icd_map.js');

const DIR = process.argv[2];
if (!DIR) { console.error('usage: node analysis/mimic_demo.js <MIMIC demo hosp directory>'); process.exit(1); }

function readCsvGz(file) {
  const text = zlib.gunzipSync(fs.readFileSync(path.join(DIR, file))).toString('utf8');
  const lines = text.split('\n').filter((l) => l.length);
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    // handle commas inside quoted fields
    const cells = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

// ── Drug name normalisation: MIMIC mixes brand names, formulations, and salt forms ──
const STRIP = /\b(iv|po|oral|inj|injection|tablet|tab|cap|capsule|solution|soln|syringe|flush|bag|premix|human|citrate|sulfate|hcl|hydrochloride|sodium|tartrate|succinate|maleate|besylate|mesylate|fumarate|bitartrate|acetate|conjugated|suspension|patch|buffered|disintegrating|protocol|ciwa|desensitization)\b/g;
function normDrug(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(STRIP, ' ')
    .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}
const T1 = pim.table1.map((x) => x.ingredient);
function toIngredients(drugName) {
  const n = normDrug(drugName);
  return T1.filter((ing) => n.includes(ing));
}

console.log('Conditional adjudication on real records — MIMIC-IV Demo v2.2\n');

const patients = readCsvGz('patients.csv.gz');
const dx = readCsvGz('diagnoses_icd.csv.gz');
const rx = readCsvGz('prescriptions.csv.gz');
console.log(`${patients.length} patients · ${dx.length.toLocaleString()} diagnoses · ${rx.length.toLocaleString()} prescriptions`);

const elderly = patients.filter((p) => parseInt(p.anchor_age, 10) >= 65);
console.log(`${elderly.length} aged 65+ (ages ${Math.min(...elderly.map((p) => +p.anchor_age))}-${Math.max(...elderly.map((p) => +p.anchor_age))})\n`);

const dxBy = {}, rxBy = {};
dx.forEach((d) => { (dxBy[d.subject_id] = dxBy[d.subject_id] || []).push({ code: d.icd_code, version: d.icd_version }); });
rx.forEach((r) => { (rxBy[r.subject_id] = rxBy[r.subject_id] || []).push(r.drug); });

let anyT1 = 0, anyT2 = 0, onlyT2 = 0, byHira = 0, noDx = 0;
const t1Counter = {}, t2Counter = {}, examples = [];

elderly.forEach((p) => {
  const age = parseInt(p.anchor_age, 10);
  const ings = [...new Set((rxBy[p.subject_id] || []).flatMap(toIngredients))];
  const drugs = ings.map((ing) => {
    const k = pim.checkIngredient(ing);
    return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  });
  const codes = dxBy[p.subject_id] || [];
  if (!codes.length) noDx++;
  const conds = conditionsFromIcd(codes);
  if (age >= 80) conds.push('age80_primary');

  const r = pim.check({ drugs: ings, conditions: conds });
  const hiraHit = drugs.some((d) => hira.isCovered(d, d.cat));

  if (r.table1.length) { anyT1++; r.table1.forEach((h) => { t1Counter[h.item.nameKo] = (t1Counter[h.item.nameKo] || 0) + 1; }); }
  if (r.table2.length) {
    anyT2++;
    r.table2.forEach((h) => { const k = `${h.condition.label} + ${h.target.nameKo}`; t2Counter[k] = (t2Counter[k] || 0) + 1; });
  }
  if (hiraHit) byHira++;
  if (r.table2.length && !hiraHit) {
    onlyT2++;
    if (examples.length < 6) examples.push({ age, ings: ings.slice(0, 8), conds,
      hits: [...new Set(r.table2.map((h) => `${h.condition.label} + ${h.target.nameKo}`))].slice(0, 3) });
  }
});

const pct = (n) => `${(n / elderly.length * 100).toFixed(1)}%`;
console.log('── findings (' + elderly.length + ' patients aged 65+) ──');
console.log(`Table 1 (regardless of condition)   ${anyT1} (${pct(anyT1)})`);
console.log(`Table 2 (conditional)               ${anyT2} (${pct(anyT2)})`);
console.log(`national standard (drug only)       ${byHira} (${pct(byHira)})`);
console.log(`missed by the standard, caught by T2 ${onlyT2} (${pct(onlyT2)})`);
console.log(`patients with no diagnosis code     ${noDx}`);

console.log('\n── most frequent Table 1 findings ──');
Object.entries(t1Counter).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));

console.log('\n── most frequent Table 2 findings ──');
Object.entries(t2Counter).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));

if (examples.length) {
  console.log('\n── cases the national standard misses ──');
  examples.forEach((e, i) => {
    console.log(`  ${i + 1}. age ${e.age} · drugs ${e.ings.join(', ')}`);
    console.log(`     conditions ${e.conds.join(', ')}`);
    console.log(`     finding ${e.hits.join(' / ')}`);
  });
}

console.log('\nNote: MIMIC-IV holds US intensive care admissions, and the demo edition covers 100');
console.log('      patients. These rates show that the engine runs on real records. They are not');
console.log('      epidemiological estimates for Korea.');
console.log('Note: drug names are matched by string normalisation and the ICD-to-condition mapping is');
console.log('      an operational definition. Neither has been reviewed clinically.');
