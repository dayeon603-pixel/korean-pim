/* Class and tag dictionary for drugs outside Table 1 — the minimum needed to apply either axis to
 * real care data.
 *
 * Why it is needed: the engine knows only the 63 ingredient keys of Table 1, yet both axes name
 *   drugs outside it. Table 2 targets verapamil, COX-2 inhibitors, opioids, and others by condition,
 *   and the 14 classes of the national criteria include ingredients absent from Table 1. Without a
 *   dictionary, both axes fall silent on real prescriptions.
 *
 * Design rules
 *   1. Ingredients already in Table 1 are not added. They could disagree with the engine's verdict,
 *      and if they did there would be no basis for deciding which is right. A test blocks duplicates.
 *   2. Drugs relevant to neither axis, such as statins and ACE inhibitors, are not added. They would
 *      change no verdict and only enlarge the dictionary.
 *   3. The dictionary must not favour one axis. Classes used by the drug-only axis and by the
 *      condition axis are filled to the same standard.
 *   4. Clinically distinct drugs are not merged. Tamsulosin and silodosin are uroselective and are
 *      kept apart from Table 2's peripheral alpha-1 blockers (terazosin, doxazosin, prazosin).
 *      Merging them would over-flag under the falls condition.
 *
 * Value format: [class key, ...tags]
 *
 * Nineteen ingredients already in Table 1 (terazosin, doxazosin, prazosin, ibuprofen, naproxen,
 * diclofenac, indomethacin, ketorolac, sulindac, ticlopidine, aspirin, quetiapine, risperidone,
 * temazepam, clonazepam, chlordiazepoxide, methocarbamol, scopolamine, metoclopramide) were removed
 * from the draft. The engine already knows them.
 */
'use strict';

const MAP = {
  // ── Opioids (Table 2: falls, chronic constipation) ────────────────────
  tramadol: ['opioid'], hydrocodone: ['opioid'], oxycodone: ['opioid'],
  morphine: ['opioid'], fentanyl: ['opioid'], codeine: ['opioid'],
  hydromorphone: ['opioid'], methadone: ['opioid'], buprenorphine: ['opioid'],

  // ── Peripheral alpha-1 blockers (Table 2: falls) ──────────────────────
  // Tamsulosin, silodosin, and naftopidil are uroselective and excluded. See UROSELECTIVE below.

  // ── NSAIDs (Table 2: heart failure, ulcer, CKD / national criteria: non-selective) ──
  // 2026-09-06: the etodolac entry had been swallowed by the comment line above and was inactive.
  // Split onto its own line to restore it.
  etodolac: ['nsaid', 'nsaid', 'nsaid_ns'],
  // Meloxicam leans COX-2 selective, so it does not carry the nsaid_ns tag. It escapes the ulcer
  // rule, which names non-selective NSAIDs, and matches only the heart failure, hypertension, and
  // CKD rules, which name NSAIDs generally.
  meloxicam: ['nsaid', 'nsaid'],
  nabumetone: ['nsaid', 'nsaid', 'nsaid_ns'],
  celecoxib: ['cox2', 'cox2'],
  etoricoxib: ['cox2', 'cox2'],

  // ── 2026-09-06: class membership filled out ───────────────────────────────
  // The dictionary is a hand-written flat list rather than an ontology, so members of a class a rule
  // names can be missing. All unresolved strings were reviewed as a census, and members belonging to
  // classes used by the observable conditions (diuretics, beta-blockers, COX-2 inhibitors,
  // corticosteroids, antipsychotics, antidepressants, tricyclics) were filled in. Topical, ophthalmic,
  // and otic preparations remain excluded, since systemic exposure differs.
  // A name variant. Table 1 keys this as glibenclamide; US data writes glyburide. A standard
  // ontology would have united them as one concept; string matching misses it.
  glyburide: ['su', 'sulfonylurea'],
  metolazone: ['diuretic', 'diuretic'],
  labetalol: ['bb', 'betablocker'],
  acebutolol: ['bb', 'betablocker'],
  hydrocortisone: ['cortico', 'corticosteroid'],
  fludrocortisone: ['cortico', 'corticosteroid'],
  betamethasone: ['cortico', 'corticosteroid'],
  triamcinolone: ['cortico', 'corticosteroid'],
  desvenlafaxine: ['snri', 'antidepressant'],
  milnacipran: ['snri', 'antidepressant'],
  vilazodone: ['antidep_other', 'antidepressant'],
  vortioxetine: ['antidep_other', 'antidepressant'],
  desipramine: ['tca', 'antidepressant', 'tca'],
  iloperidone: ['antipsych', 'antipsychotic'],
  prochlorperazine: ['antipsych', 'antipsychotic'],

  // ── Beta-blockers (Table 2: masking of hypoglycaemia in diabetes) ─────
  metoprolol: ['bb', 'betablocker'], carvedilol: ['bb', 'betablocker'],
  atenolol: ['bb', 'betablocker'], propranolol: ['bb', 'betablocker'],
  nebivolol: ['bb', 'betablocker'], bisoprolol: ['bb', 'betablocker'],
  sotalol: ['bb', 'betablocker'], nadolol: ['bb', 'betablocker'],

  // ── Systemic corticosteroids (Table 2: diabetes) ──────────────────────
  // Inhaled and topical preparations are excluded; systemic exposure differs.
  prednisone: ['cortico', 'corticosteroid'], prednisolone: ['cortico', 'corticosteroid'],
  methylprednisolone: ['cortico', 'corticosteroid'], dexamethasone: ['cortico', 'corticosteroid'],

  // ── Diuretics (Table 2: hyponatraemia) ────────────────────────────────
  furosemide: ['diuretic', 'diuretic'], hydrochlorothiazide: ['diuretic', 'diuretic'],
  chlorthalidone: ['diuretic', 'diuretic'], torsemide: ['diuretic', 'diuretic'],
  bumetanide: ['diuretic', 'diuretic'], indapamide: ['diuretic', 'diuretic'],
  spironolactone: ['kdiuretic', 'diuretic'], triamterene: ['kdiuretic', 'diuretic'],
  eplerenone: ['kdiuretic', 'diuretic'], amiloride: ['kdiuretic', 'diuretic'],

  // ── Antithrombotics (Table 2: bleeding risk, ulcer history) ───────────
  clopidogrel: ['antiplatelet'], cilostazol: ['antiplatelet'],
  prasugrel: ['antiplatelet'], ticagrelor: ['antiplatelet'],
  warfarin: ['anticoag'], apixaban: ['noac'], rivaroxaban: ['noac'],
  dabigatran: ['noac'], edoxaban: ['noac'],

  // ── Non-dihydropyridine calcium channel blockers (Table 2: heart failure) ──
  verapamil: ['ccbnd'], diltiazem: ['ccbnd'],

  // ── Anticonvulsants (Table 2: hyponatraemia) ──────────────────────────
  carbamazepine: ['anticonv', 'anticonvulsant'], oxcarbazepine: ['anticonv', 'anticonvulsant'],
  gabapentin: ['anticonv', 'anticonvulsant'], pregabalin: ['anticonv', 'anticonvulsant'],
  levetiracetam: ['anticonv', 'anticonvulsant'], phenytoin: ['anticonv', 'anticonvulsant'],
  valproate: ['anticonv', 'anticonvulsant'], lamotrigine: ['anticonv', 'anticonvulsant'],
  topiramate: ['anticonv', 'anticonvulsant'],

  // ── Antidepressants (national criteria class / Table 2: hyponatraemia) ──
  sertraline: ['ssri', 'antidepressant'], citalopram: ['ssri', 'antidepressant'],
  escitalopram: ['ssri', 'antidepressant'], fluoxetine: ['ssri', 'antidepressant'],
  paroxetine: ['ssri', 'antidepressant'], duloxetine: ['snri', 'antidepressant'],
  venlafaxine: ['snri', 'antidepressant'], mirtazapine: ['antidep_other', 'antidepressant'],
  bupropion: ['antidep_other', 'antidepressant'], trazodone: ['antidep_other', 'antidepressant'],

  // ── Antipsychotics (national criteria class / Table 2: dementia) ──────
  aripiprazole: ['antipsych', 'antipsychotic'], ziprasidone: ['antipsych', 'antipsychotic'],
  paliperidone: ['antipsych', 'antipsychotic'], lurasidone: ['antipsych', 'antipsychotic'],

  // ── Benzodiazepines (national criteria class / Table 2: dementia, falls) ──
  oxazepam: ['bzd', 'benzodiazepine'],

  // ── H2 blockers (Table 2: dementia) ───────────────────────────────────
  ranitidine: ['h2ra', 'h2ra'], famotidine: ['h2ra', 'h2ra'], nizatidine: ['h2ra', 'h2ra'],

  // ── Muscle relaxants (national criteria class) ────────────────────────
  cyclobenzaprine: ['musclerelax'],
  baclofen: ['musclerelax'], tizanidine: ['musclerelax'], carisoprodol: ['musclerelax'],

  // ── Anticholinergics (Table 2: dementia, BPH, constipation, glaucoma) ──
  meclizine: ['antihist1', 'anticholinergic'], dicyclomine: ['antispas', 'anticholinergic'],
  promethazine: ['antihist1', 'anticholinergic'],
  tolterodine: ['oab', 'anticholinergic'], solifenacin: ['oab', 'anticholinergic'],
  darifenacin: ['oab', 'anticholinergic'], trospium: ['oab', 'anticholinergic'],

  // ── Other ingredients named by Table 2 ────────────────────────────────
  theophylline: ['xanthine'], caffeine: ['stimulant'], methylphenidate: ['stimulant'],
  pseudoephedrine: ['decongest'], phenylephrine: ['decongest'],
  pioglitazone: ['tzd'],
  clonidine: ['clonidine'], disopyramide: ['disopyramide'],
  carboplatin: ['onco'], cisplatin: ['onco'], cyclophosphamide: ['onco'], vincristine: ['onco'],
};

/** Uroselective alpha blockers. These must be kept apart from Table 2's peripheral alpha-1 blockers.
 *  Merging them over-flags under the falls condition. Recorded here as a deliberate exclusion. */
const UROSELECTIVE = ['tamsulosin', 'silodosin', 'naftopidil'];

module.exports = { MAP, UROSELECTIVE };
