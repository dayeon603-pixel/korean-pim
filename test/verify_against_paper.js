/* Source agreement check — node test/verify_against_paper.js
 *
 * Source: article text at e-agmr.org (DOI 10.4235/agmr.2018.22.3.121), retrieved 2026-08-26.
 * REF_TABLE1 and REF_TABLE2 below are the reference copy transcribed from the article. If our JSON
 * departs from it, this fails.
 * Changing the data means changing this file too, which is what prevents items from quietly
 * appearing or disappearing.
 */
'use strict';
const pim = require('../src/index.js');

// ── Table 1 as published: 63 drug-only items, in the article's order ──
const REF_TABLE1 = [
  'Chlorpromazine', 'Haloperidol', 'Risperidone', 'Olanzapine', 'Clozapine', 'Quetiapine',
  'Amitriptyline', 'Amoxapine', 'Clomipramine', 'Doxepin (>6 mg/day)', 'Nortriptyline', 'Imipramine',
  'Alprazolam', 'Lorazepam', 'Temazepam', 'Triazolam',
  'Chlordiazepoxide', 'Clonazepam', 'Diazepam', 'Flurazepam', 'Bromazepam', 'Clobazam', 'Flunitrazepam',
  'Zolpidem', 'Benztropine', 'Trihexyphenidyl',
  'Chlorpheniramine', 'Dimenhydrinate', 'Diphenhydramine', 'Hydroxyzine', 'Triprolidine',
  'Dronedarone', 'Amiodarone', 'Flecainide', 'Digoxin', 'Ticlopidine',
  'Metoclopramide', 'Cimetidine', 'Clidinium-chlordiazepoxide', 'Scopolamine',
  'Doxazosin', 'Prazosin', 'Terazosin', 'Desmopressin', 'Oxybutynin',
  'Estrogens ± progestins', 'Growth hormone', 'Insulin, sliding scale', 'Glibenclamide (glyburide)',
  'Pethidine (meperidine)', 'Pentazocine',
  'Aspirin (>325 mg/day)', 'Diclofenac', 'Indomethacin', 'Ibuprofen', 'Dexibuprofen', 'Ketorolac',
  'Mefenamic acid', 'Naproxen', 'Piroxicam', 'Sulindac',
  'Methocarbamol', 'Orphenadrine',
];

// ── Table 2 as published: 18 conditions. paperGroups holds the drug groups exactly as the article
//    names them. expanded holds the ingredients we enumerated where the article names only a group,
//    which is our mapping layer, not the article's content. ──
const REF_TABLE2 = [
  { id: 'dementia', paperGroups: ['Anticholinergics', 'Antipsychotics', 'Benzodiazepines', 'Zolpidem', 'H2 antagonists', 'Pethidine'] },
  { id: 'falls', paperGroups: ['Anticholinergics', 'Anticonvulsants', 'Antipsychotics', 'Benzodiazepines', 'Zolpidem', 'Opioids', 'Peripheral alpha-1 blockers'] },
  { id: 'insomnia', paperGroups: ['Caffeine', 'Methylphenidate', 'Phenylephrine', 'Pseudoephedrine', 'Theophylline'] },
  { id: 'parkinson', paperGroups: ['Antipsychotics', 'Metoclopramide'] },
  { id: 'hf', paperGroups: ['Verapamil', 'Diltiazem', 'NSAIDs', 'COX-2 inhibitors', 'Pioglitazone', 'TCAs'] },
  { id: 'arrhythmia', paperGroups: ['TCAs'] },
  { id: 'htn', paperGroups: ['NSAIDs'] },
  { id: 'age80_primary', paperGroups: ['Aspirin'] },
  { id: 'stroke_secondary', paperGroups: ['Aspirin + clopidogrel 병용'] },
  { id: 'ulcer', paperGroups: ['Aspirin (>325 mg/day)', 'Non-COX-2-selective NSAIDs'] },
  { id: 'constipation', paperGroups: ['Anticholinergics', 'Opioids'] },
  { id: 'ckd', paperGroups: ['NSAIDs', 'COX-2 inhibitors'] },
  { id: 'bph', paperGroups: ['Anticholinergics'] },
  { id: 'hyponatremia', paperGroups: ['Diuretics', 'Antipsychotics', 'Antidepressants'],
    expanded: ['carbamazepine', 'oxcarbazepine', 'carboplatin', 'cyclophosphamide', 'cisplatin', 'vincristine'] },
  { id: 'copd', paperGroups: ['Theophylline (단독요법)'] },
  { id: 'bleeding', paperGroups: ['Aspirin', 'Clopidogrel', 'Ticlopidine', 'NSAIDs', 'Warfarin'],
    expanded: ['dabigatran', 'rivaroxaban', 'apixaban', 'edoxaban'] },
  { id: 'dm', paperGroups: ['Beta-blockers', 'Corticosteroids'] },
  { id: 'glaucoma', paperGroups: ['Anticholinergics'] },
];

let pass = 0, fail = 0; const failed = [];
const check = (n, c) => { if (c) pass++; else { fail++; failed.push(n); console.log(`  ✗ ${n}`); } };

console.log('Verification against the source — Ann Geriatr Med Res 2018;22(3):121-129 (checked at e-agmr.org, 2026-08-26)\n');

console.log('[Table 1]');
const ours1 = pim.table1.map((x) => x.drug);
check(`63 items (source ${REF_TABLE1.length} / here ${ours1.length})`, REF_TABLE1.length === 63 && ours1.length === 63);
check('item sets match exactly', JSON.stringify(ours1) === JSON.stringify(REF_TABLE1));
REF_TABLE1.forEach((d) => check(`present in the source: ${d}`, ours1.includes(d)));
ours1.forEach((d) => check(`no item absent from the source: ${d}`, REF_TABLE1.includes(d)));

console.log('[Table 2]');
check(`18 conditions (source ${REF_TABLE2.length} / here ${pim.table2.length})`, REF_TABLE2.length === 18 && pim.table2.length === 18);
check('condition ids appear in the same order', JSON.stringify(pim.table2.map((c) => c.id)) === JSON.stringify(REF_TABLE2.map((c) => c.id)));
REF_TABLE2.forEach((ref) => {
  const ours = pim.byCondition.get(ref.id);
  if (!ours) { check(`condition present: ${ref.id}`, false); return; }
  const tokens = ours.targets.map((t) => t.token);
  ref.paperGroups.forEach((g) => check(`${ref.id} source drug group present: ${g}`, tokens.includes(g)));
  const extra = tokens.filter((t) => !ref.paperGroups.includes(t));
  const allowed = ref.expanded || [];
  check(`${ref.id} targets beyond the source are mapping-layer expansions only (${extra.length})`, extra.every((e) => allowed.includes(e)));
});

console.log(`\nverification against the source: ${pass} passed / ${fail} failed (${pass + fail} checks)`);
if (fail) { console.log('failed:\n - ' + failed.join('\n - ')); process.exit(1); }
console.log('\nNote: the item set and the structure of the conditions match the source. A word-for-word');
console.log('      comparison of the rationale text and the dose thresholds is not yet complete. See');
console.log('      VERIFICATION.md.');
