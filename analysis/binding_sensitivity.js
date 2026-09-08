/* How much does a verdict move when the binding is drawn differently?
 *   node analysis/binding_sensitivity.js <MIMIC demo hosp directory>
 *
 * ── Why measure this ──────────────────────────────────────────────────────
 * The study argues that academic criteria state their conditions in clinical prose, so a value set
 * must be authored, and that different authors may produce different ones. An argument is not enough.
 * It becomes a measurement only by binding the same condition statement two different ways, both
 * defensible from the source, and measuring how far the counts separate.
 *
 * ── Design ────────────────────────────────────────────────────────────────
 * Pick items where the source bundles several concepts into one condition. Table 2's falls condition,
 * for instance, bundles four: history of falls, fracture, syncope, and orthostatic hypotension.
 *   Narrow binding: only the core concept named in the condition (fall events, history of falls).
 *   Wide binding: every concept the source enumerates (adding fracture, syncope, orthostatic
 *   hypotension).
 * Both are defensible from the source, which does not say which is correct.
 *
 * ── Interpretation ────────────────────────────────────────────────────────
 * A large gap between the two means that condition's indicator value depends on whoever authored the
 * binding, which is to say an indicator that does not publish its binding cannot be reproduced. A
 * small gap means the condition is insensitive to that choice.
 *
 * ── Limits ────────────────────────────────────────────────────────────────
 *  - No verdict is given on which binding is correct, because there is no correct answer. Only the
 *    spread is measured.
 *  - The MIMIC-IV demo holds 44 intensive care patients, so absolute rates are not the prevalence of
 *    a general older population.
 *  - Both variants are the author's. Neither is a value set authored by another institution.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');

const dir = process.argv[2];
if (!dir) { console.error('usage: node analysis/binding_sensitivity.js <hosp directory>'); process.exit(1); }

function readCsv(name) {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
  const rows = raw.trim().split('\n');
  const head = rows[0].replace(/\r/g, '').split(',');
  return rows.slice(1).map((r) => {
    const v = r.replace(/\r/g, '').split(',');
    return Object.fromEntries(head.map((h, i) => [h, v[i]]));
  });
}

/** Conditions where the source bundles several concepts. Both narrow and wide readings are
 * defensible from it. */
const VARIANTS = {
  falls: {
    text: '낙상·골절·실신·기립성 저혈압 병력',
    narrow: { icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181'],
              icd9: ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588'], why: 'fall events and a history of falls only' },
    broad:  { icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181', 'S72', 'R55', 'I951'],
              icd9: ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588', '820', '7802', '4580'],
              why: 'extends to the fracture, syncope and orthostatic hypotension the source lists' },
  },
  dementia: {
    text: '섬망·치매·인지장애',
    narrow: { icd10: ['F00', 'F01', 'F02', 'F03', 'G30'], icd9: ['290', '3310'], why: 'dementia only' },
    broad:  { icd10: ['F00', 'F01', 'F02', 'F03', 'F05', 'G30', 'G31'],
              icd9: ['290', '2941', '2942', '2948', '3310', '2930'], why: 'extends to delirium and other cognitive impairment' },
  },
  ulcer: {
    text: '위·십이지장 궤양 병력',
    narrow: { icd10: ['K25', 'K26'], icd9: ['531', '532'], why: 'gastric and duodenal ulcer only' },
    broad:  { icd10: ['K25', 'K26', 'K27', 'K28'], icd9: ['531', '532', '533', '534'],
              why: 'extends to ulcer of unspecified site and anastomotic ulcer' },
  },
  ckd: {
    text: '만성 콩팥병',
    narrow: { icd10: ['N183', 'N184', 'N185'], icd9: ['5853', '5854', '5855', '5856'],
              why: 'stage 3 and above only, the point at which dose reduction is usually required' },
    broad:  { icd10: ['N18'], icd9: ['585'], why: 'all stages' },
  },
  bleeding: {
    text: '출혈 위험 상황',
    narrow: { icd10: ['D68', 'D69'], icd9: ['286', '287'], why: 'coagulation and platelet disorders only' },
    broad:  { icd10: ['D68', 'D69', 'K922', 'I60', 'I61', 'I62', 'K920'],
              icd9: ['286', '287', '5789', '431', '432', '4553'], why: 'extends to actual bleeding events' },
  },
};

const dx = readCsv('diagnoses_icd.csv.gz');
const pts = readCsv('patients.csv.gz');
const age = Object.fromEntries(pts.map((p) => [p.subject_id, parseInt(p.anchor_age, 10)]));
const byPt = {};
dx.forEach((d) => {
  if (!(age[d.subject_id] >= 65)) return;
  (byPt[d.subject_id] = byPt[d.subject_id] || []).push(d);
});
const N = Object.keys(byPt).length;

function count(spec) {
  return Object.values(byPt).filter((codes) => codes.some((d) => {
    const list = d.icd_version === '10' ? spec.icd10 : spec.icd9;
    return list.some((p) => d.icd_code.startsWith(p));
  })).length;
}

const label = Object.fromEntries(pim.table2.map((c) => [c.id, c.label]));
console.log(`How the finding moves with the choice of binding — MIMIC-IV Demo, ${N} patients aged 65+\n`);
console.log('condition'.padEnd(18) + 'narrow  broad   diff   ratio   source condition statement');
console.log('─'.repeat(88));

const rows = [];
Object.entries(VARIANTS).forEach(([cid, v]) => {
  const n = count(v.narrow), b = count(v.broad);
  const ratio = n === 0 ? null : b / n;
  rows.push({ cid, n, b, ratio });
  console.log(`${(label[cid] || cid).padEnd(18)}${String(n).padStart(4)}  ${String(b).padStart(5)}  `
    + `${String(b - n).padStart(5)}  ${(ratio === null ? '  —' : ratio.toFixed(1) + 'x').padStart(6)}   ${v.text}`);
});

const valid = rows.filter((r) => r.ratio !== null);
const maxR = Math.max(...valid.map((r) => r.ratio));
const changed = rows.filter((r) => r.b !== r.n).length;
console.log('\n' + '─'.repeat(88));
console.log(`conditions whose count changed with the binding ${changed}/${rows.length}`);
console.log(`largest movement ${maxR.toFixed(1)}x`);
console.log('\nBoth variants are defensible from the source, which does not say which is correct.');
console.log('An indicator that does not publish its binding is therefore not reproducible, even by');
console.log('someone working from the same criteria.');
console.log('\nNote: no verdict is given on which binding is correct, because there is no correct answer.');
console.log('      Only the spread between them is measured.');
console.log('Note: 44 intensive care patients, so the absolute rates are not the prevalence of');
console.log('      a general older population.');
console.log("Note: both variants are the author's. Neither is a value set authored by another institution.");

module.exports = { N, rows, maxRatio: maxR, changed };
