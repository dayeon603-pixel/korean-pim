/**
 * ICD-9-CM and ICD-10-CM diagnosis codes mapped to the Table 2 conditions of the Korean PIM 2018.
 *
 * Purpose: the layer that turns diagnosis codes in real records into Table 2's 18 conditions so the
 * condition axis can be evaluated.
 *
 * This mapping is not in the article. Table 2 states its conditions in clinical prose, such as a
 *   history of falls or fracture, and specifies no code ranges. The ranges below are our operational
 *   definition. Widening or narrowing them changes the counts. They have had no clinical review.
 *
 * Rules
 *  - Prefix matching. I50 matches I50.9, I5043, and so on.
 *  - History conditions look at both current diagnoses and history codes (Z and V).
 *  - Ambiguous conditions are drawn narrowly, since drawing them widely over-counts.
 *  - The age condition, primary prevention at 80 and over, is not a diagnosis and is supplied by the
 *    caller rather than handled here.
 */
'use strict';

const MAP = {
  // delirium, dementia, cognitive impairment — Kim's Table 2 bundles all three into one item
  dementia: {
    icd10: ['F00', 'F01', 'F02', 'F03', 'F05', 'G30', 'G31'],
    icd9:  ['290', '2941', '2942', '2948', '3310', '2930'],
    note: 'dementia (F00-F03, G30), delirium (F05, 293.0), other cognitive impairment',
  },
  // history of falls, fracture, syncope, orthostatic hypotension
  falls: {
    icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181', 'S72', 'R55', 'I951'],
    icd9:  ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588', '820', '7802', '4580'],
    note: 'fall events (W00-W19), history of falls (Z91.81), femoral fracture (S72/820), syncope (R55/780.2), orthostatic hypotension (I95.1/458.0)',
  },
  insomnia:      { icd10: ['G470', 'F510'],            icd9: ['78052', '30742'], note: 'insomnia' },
  parkinson:     { icd10: ['G20', 'G21'],              icd9: ['3320', '3321'],   note: 'Parkinson disease and secondary parkinsonism' },
  hf:            { icd10: ['I50'],                     icd9: ['428'],            note: 'heart failure' },
  arrhythmia:    { icd10: ['I47', 'I48', 'I49'],       icd9: ['427'],            note: 'arrhythmia, including atrial fibrillation' },
  htn:           { icd10: ['I10', 'I11', 'I12', 'I13', 'I15', 'I16'], icd9: ['401', '402', '403', '404', '405'], note: 'hypertension' },
  stroke_secondary: { icd10: ['I63', 'I693', 'Z8673'], icd9: ['434', '438', 'V1254'], note: 'ischaemic stroke and a history of it, the secondary-prevention population' },
  ulcer:         { icd10: ['K25', 'K26', 'K27', 'K28'], icd9: ['531', '532', '533', '534'], note: 'gastric and duodenal ulcer, active or by history' },
  constipation:  { icd10: ['K590'],                    icd9: ['5640'],           note: 'constipation' },
  ckd:           { icd10: ['N18'],                     icd9: ['585'],            note: 'chronic kidney disease' },
  bph:           { icd10: ['N40', 'R33'],              icd9: ['600', '78820'],   note: 'benign prostatic hyperplasia and urinary retention' },
  hyponatremia:  { icd10: ['E871'],                    icd9: ['2761'],           note: 'hyponatraemia and SIADH' },
  copd:          { icd10: ['J44'],                     icd9: ['496', '4912'],    note: 'chronic obstructive pulmonary disease' },
  bleeding:      { icd10: ['D68', 'D69', 'K922', 'I60', 'I61', 'I62', 'K920'], icd9: ['286', '287', '5789', '430', '431', '432'], note: 'coagulation disorder and active bleeding' },
  dm:            { icd10: ['E10', 'E11', 'E13'],       icd9: ['250'],            note: 'diabetes' },
  glaucoma:      { icd10: ['H40'],                     icd9: ['365'],            note: 'glaucoma' },
  // age80_primary is an age condition, not a diagnosis, so it is excluded
};

/** Diagnosis codes to an array of Table 2 condition ids. */
function conditionsFromIcd(codes) {
  const on = new Set();
  (codes || []).forEach(({ code, version }) => {
    const c = String(code || '').toUpperCase().replace(/\./g, '');
    Object.entries(MAP).forEach(([id, m]) => {
      const list = String(version) === '9' ? m.icd9 : m.icd10;
      if (list.some((p) => c.startsWith(p))) on.add(id);
    });
  });
  return [...on];
}

const coveredConditions = Object.keys(MAP);

module.exports = { MAP, conditionsFromIcd, coveredConditions, ageOnlyConditions: ['age80_primary'] };
