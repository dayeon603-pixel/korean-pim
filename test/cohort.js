/* Synthetic older-adult prescribing cohort generator — shared input for the axis comparisons.
 *
 * Lifted unchanged out of measure_gap.js, because several experiments have to see the same cohort
 * for their results to be comparable. The refactor was checked by confirming that the previous
 * measurement (4.54%) still reproduces exactly.
 *
 * run(seed, N) generates N prescriptions and returns the 2x2 table of the two axes.
 *   hiraFlag  count flagged by the national standard (drug-only axis)
 *   t2Flag    count flagged by Kim 2018 Table 2 (condition axis)
 *   both / onlyHira / onlyT2 / neither
 *
 * Important: the generator never consults the adjudication rules. Generating data from a rule and
 *   then adjudicating it with that same rule would be circular. Drug selection weights come from
 *   measured national claims prevalence; comorbidities come from published statistics and an
 *   ASSUMED conditional lift (LIFT). LIFT is an assumption, not a measurement.
 *
 * Limit: this is synthetic data. It is not a real prescribing distribution, so no rate produced
 * here may be read as a reduction in clinical alerts.
 */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');

const POOL = {
  bp: ['amlodipine','losartan','valsartan','lisinopril','telmisartan','bisoprolol','carvedilol','verapamil','diltiazem','doxazosin','terazosin','prazosin'],
  diuretic: ['furosemide','hydrochlorothiazide','spironolactone'],
  diabetes: ['metformin','glimepiride','glibenclamide','sitagliptin','linagliptin','pioglitazone','dapagliflozin'],
  lipid: ['simvastatin','atorvastatin','rosuvastatin'],
  analgesic: ['acetaminophen','ibuprofen','naproxen','diclofenac','aceclofenac','meloxicam','celecoxib','piroxicam','mefenamic','indomethacin','tramadol','codeine','pethidine','pentazocine'],
  gi: ['omeprazole','esomeprazole','rabeprazole','pantoprazole','cimetidine','metoclopramide'],
  sedative: ['zolpidem','diazepam','lorazepam','alprazolam','clonazepam','triazolam','bromazepam'],
  psych: ['escitalopram','paroxetine','amitriptyline','nortriptyline','imipramine','haloperidol','risperidone','quetiapine','olanzapine'],
  antihistamine: ['chlorpheniramine','diphenhydramine','hydroxyzine','dimenhydrinate','cetirizine','levocetirizine','loratadine'],
  muscle_relaxant: ['eperisone','baclofen','methocarbamol','orphenadrine'],
  antithrombotic: ['aspirin','clopidogrel','warfarin','apixaban','rivaroxaban','edoxaban','cilostazol','ticlopidine'],
  cardiac: ['digoxin','amiodarone','dronedarone','flecainide'],
  urologic: ['oxybutynin','tamsulosin','desmopressin'],
  respiratory: ['theophylline','pseudoephedrine','phenylephrine'],
  neuro: ['donepezil','rivastigmine','gabapentin','pregabalin','carbamazepine','oxcarbazepine','cholinealfoscerate'],
  other: ['levothyroxine','alendronate','prednisolone','methylphenidate','caffeine'],
};
const EXTRA = { losartan:'arb', valsartan:'arb', telmisartan:'arb', lisinopril:'acei', amlodipine:'bp', bisoprolol:'bb',
  carvedilol:'bb', verapamil:'ccbnd', diltiazem:'ccbnd', furosemide:['diuretic','diuretic'], hydrochlorothiazide:['diuretic','diuretic'],
  spironolactone:['kdiuretic','diuretic'], metformin:'dm', glimepiride:'su', sitagliptin:'dm2', linagliptin:'dm2', pioglitazone:'tzd',
  dapagliflozin:'dm2', simvastatin:'statin', atorvastatin:'statin', rosuvastatin:'statin', acetaminophen:'apap', celecoxib:'cox2',
  aceclofenac:['nsaid','nsaid'], meloxicam:['nsaid','nsaid'], tramadol:'opioid', codeine:'opioid', omeprazole:'ppi', esomeprazole:'ppi',
  rabeprazole:'ppi', pantoprazole:'ppi', escitalopram:['ssri','antidepressant'], paroxetine:['ssri','antidepressant'],
  cetirizine:'antihist2', levocetirizine:'antihist2', loratadine:'antihist2', eperisone:'musclerelax', baclofen:'musclerelax',
  clopidogrel:'antiplatelet', warfarin:'anticoag', apixaban:'noac', rivaroxaban:'noac', edoxaban:'noac', cilostazol:'antiplatelet',
  tamsulosin:'alpha1a', donepezil:'chei', rivastigmine:'chei', gabapentin:['anticonv','anticonvulsant'], pregabalin:['anticonv','anticonvulsant'],
  carbamazepine:'anticonv', oxcarbazepine:'anticonv', cholinealfoscerate:'nootropic', levothyroxine:'thyroid', alendronate:'bisphos',
  prednisolone:['cortico','corticosteroid'], theophylline:'xanthine', pseudoephedrine:'decongest', phenylephrine:'decongest',
  methylphenidate:'stimulant', caffeine:'stimulant' };
const AREAS = Object.keys(POOL);
// Baseline prevalences. Where a measured Korean figure exists, the measured figure is used.
// Taken from HIRA 2022 Table 25, comorbidity in the 2017 polypharmacy cohort of 1.53 million
// older adults. It is built on claims diagnosis codes, so it differs from survey-based prevalence
// and captures only what was diagnosed and coded. Chronic kidney disease at 2.1%, for instance,
// sits far below the national health survey estimate because only coded N18 is counted.
// Items with no measured figure (insomnia, Parkinson's, arrhythmia and so on) are assumptions,
// and KOREA_SOURCE marks which is which.
const COND_BASE = { htn:0.676, dementia:0.120, stroke_secondary:0.052, dm:0.384, hf:0.052, ckd:0.021,
  arrhythmia:0.08, falls:0.069, insomnia:0.22, ulcer:0.151, constipation:0.20, bph:0.16, glaucoma:0.05,
  copd:0.047, parkinson:0.03, hyponatremia:0.04, bleeding:0.06, age80_primary:0.20 };

/** Where each prevalence comes from. 'hira' = measured in HIRA Table 25, 'assumed' = assumed here.
 *  The cardiovascular figure of 15.5% aggregates ischaemic heart disease, heart failure and stroke,
 *  so it was divided equally across the three. The respiratory figure of 14.2% aggregates COPD,
 *  pneumonia and asthma, so COPD was given a third. Both splits are operational decisions made
 *  here; the source does not break the figures down. */
const KOREA_SOURCE = { htn:'hira', dementia:'hira', dm:'hira', ulcer:'hira', ckd:'hira', falls:'hira',
  stroke_secondary:'hira-split', hf:'hira-split', copd:'hira-split',
  arrhythmia:'assumed', insomnia:'assumed', constipation:'assumed', bph:'assumed', glaucoma:'assumed',
  parkinson:'assumed', hyponatremia:'assumed', bleeding:'assumed', age80_primary:'assumed' };
const LIFT = { dm:{htn:1.6}, ckd:{htn:1.8,dm:2.0}, hf:{htn:1.7}, arrhythmia:{hf:2.2}, falls:{dementia:1.9},
  insomnia:{dementia:1.5}, bleeding:{stroke_secondary:1.8}, hyponatremia:{ckd:1.8,hf:1.5} };
const BUCKETS = [[1,2],[3,4],[5,6],[7,9],[10,14]], BW = [14,22,28,24,12];

function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const e = EXTRA[ing];
  return Array.isArray(e) ? { ing, cls: e[0], tags: [e[1]], cat: '' } : { ing, cls: e || 'other', tags: [], cat: '' };
}
/** Whether a drug falls in one of the 14 national classes. Used to pick what pimWeight adjusts. */
const COVERED = {};
const W = {}; Object.values(POOL).flat().forEach((i) => {
  const d = toDrug(i); const c = hira.classify(d, d.cat);
  W[i] = c ? Math.max(0.3, c.prevalence / 5) : 1;
  COVERED[i] = !!hira.isCovered({ ing: d.ing, cls: d.cls, tags: d.tags }, d.cat);
});

// mulberry32, which mixes the seed properly. The LCG used before collapsed onto the same
// trajectory under a small change of seed, so different seeds produced identical results.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a cohort and returns the 2x2 table of the two axes.
 *
 * @param {number} seedInit random seed
 * @param {number} N number of prescriptions
 * @param {{liftScale?:number, condScale?:number, sizeShift?:number}} [opt]
 *   Sensitivity-analysis parameters. The defaults (1, 1, 0) are the setting used for the headline
 *   measurement.
 *   liftScale multiplier on the conditional lift between comorbidities. LIFT is an assumption
 *     rather than a measurement, so how far the conclusion depends on it must be checked. At 0 the
 *     correlation between conditions is removed entirely.
 *   condScale multiplier on overall comorbidity prevalence.
 *   sizeShift pushes the distribution of drugs per prescription up or down (-1 to +1).
 *   pimWeight multiplier on the selection weight of drugs covered by the national standard. Below
 *     1, PIM drugs are drawn less often. This is the handle that moves the table furthest. The
 *     default cohort fires the drug-only axis on 81.8% of prescriptions, 1.83 times the measured
 *     rate in the HIRA report, where 44.7% of older adults on polypharmacy carry at least one
 *     listed drug. Whether the conclusion survives calibration to that external measurement must
 *     be checked.
 */
function run(seedInit, N, opt) {
  const o = opt || {};
  const liftScale = o.liftScale === undefined ? 1 : o.liftScale;
  const condScale = o.condScale === undefined ? 1 : o.condScale;
  const sizeShift = o.sizeShift === undefined ? 0 : o.sizeShift;
  const pimWeight = o.pimWeight === undefined ? 1 : o.pimWeight;
  const rnd = mulberry32(seedInit);
  const pickW = (a, w) => { const t = w.reduce((x,y)=>x+y,0); let r = rnd()*t; for (let i=0;i<a.length;i++){ r-=w[i]; if(r<=0) return a[i]; } return a[a.length-1]; };
  let hiraFlag=0, t2Flag=0, onlyT2=0, both=0, neither=0, onlyHira=0;
  for (let n = 0; n < N; n++) {
    // Above 0, sizeShift tilts the weights toward polypharmacy; below 0, toward small prescriptions.
    const bw = BW.map((w, i) => Math.max(0.01, w * (1 + sizeShift * (i - (BW.length - 1) / 2) / 2)));
    const [lo, hi] = pickW(BUCKETS, bw);
    const cnt = lo + Math.floor(rnd() * (hi - lo + 1));
    const chosen = new Set(); let g = 0;
    while (chosen.size < cnt && g++ < 300) {
      const pool = POOL[AREAS[Math.floor(rnd() * AREAS.length)]];
      chosen.add(pickW(pool, pool.map((i) => W[i] * (COVERED[i] ? pimWeight : 1))));
    }
    const conds = [];
    for (const [id, base] of Object.entries(COND_BASE)) {
      let p = Math.min(0.95, base * condScale); const lf = LIFT[id];
      // Pulls the lift toward 1 (liftScale<1) or away from it (>1), tuning how strongly the
      // conditions correlate.
      if (lf) for (const [pre, m] of Object.entries(lf)) {
        if (conds.includes(pre)) p = Math.min(0.95, p * (1 + (m - 1) * liftScale));
      }
      if (rnd() < p) conds.push(id);
    }
    let drugs = [...chosen].map(toDrug);
    // Noise is injected at the same rate as simulate.js so the two run under identical conditions.
    if (rnd() < 0.15) {
      const k = Math.floor(rnd() * 4);
      if (k === 0) drugs.push({ ing: 'not_a_real_' + Math.floor(rnd() * 999), cls: 'other', tags: [], cat: '' });
      else if (k === 1) drugs.push({ ing: '', cls: '', tags: [], cat: '' });
      else if (k === 2 && drugs.length) drugs.push({ ...drugs[0] });
      else conds.push('nonexistent_condition');
    }
    const byHira = drugs.some((d) => hira.isCovered(d, d.cat));
    const byT2 = bm.check({ drugs, conditions: conds }).table2.length > 0;
    if (byHira) hiraFlag++;
    if (byT2) t2Flag++;
    if (byHira && byT2) both++;
    else if (byHira) onlyHira++;
    else if (byT2) onlyT2++;
    else neither++;
  }
  return { hiraFlag, t2Flag, both, onlyHira, onlyT2, neither };
}

module.exports = { run, POOL, COND_BASE, KOREA_SOURCE, LIFT, COVERED, toDrug, mulberry32 };
