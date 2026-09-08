/**
 * The drug criteria of the 2022 HIRA report, Management Criteria for Inappropriate Polypharmacy in
 * Older Adults.
 *
 * Source: Health Insurance Review and Assessment Service, publication number G000F8Q-2022-170,
 * December 2022.
 *   Principal investigators Yoon Sang-heon and Kim Dong-sook. repository.hira.or.kr
 *
 * Why this file exists:
 *   This report is the draft criteria for inappropriate polypharmacy in older adults adopted by the
 *   national review and assessment agency.
 *   A candidate pool of 297 (Beers 144, Korea PIM 63, DUR older-adult cautions 90, Ah et al. 138)
 *   was filtered by nine clinical experts down to 77 ingredients in 14 classes (report Table 21).
 *
 *   What matters: the "Korea PIM 63" that entered the pool is Kim 2018 Table 1 alone.
 *   Table 2, the 18 condition-dependent rules, never entered consideration for the national criteria
 *   at all.
 *   The entire axis that requires the patient's state is therefore missing from the national criteria.
 *   This file is the baseline against which that gap is quantified.
 *
 * Limit: report Table 21 publishes only classes and ingredient counts; the individual ingredient
 * names sit in a spreadsheet appendix.
 *   This file therefore implements the criteria at class level only, attaching the matching keys we
 *   mapped to each class.
 *   Ingredient-level comparison requires the appendix itself and has not been done.
 */
'use strict';

// Report Table 21 (14 classes, 77 ingredients) plus Table 28 (observed prescribing in claims)
// prevalence = share (%) of the 684,538 older adults prescribed at least one potentially
// inappropriate drug who received this class
const CLASSES = [
  { no: 1,  organ: 'Anticholinergics',      name: 'First-generation antihistamines',              n: 12, prevalence: 23.3, match: { tag: 'anticholinergic', cls: 'anticholinergic' } },
  { no: 2,  organ: 'Anticholinergics',      name: 'Antispasmodics',                               n: 6,  prevalence: 3.3,  match: { cls: 'antispas' } },
  { no: 3,  organ: 'Cardiovascular',        name: 'Clonidine for first-line treatment of hypertension', n: 1, prevalence: 0.0, match: { ing: 'clonidine' } },
  { no: 4,  organ: 'Cardiovascular',        name: 'Disopyramide',                                 n: 1,  prevalence: 0.0,  match: { ing: 'disopyramide' } },
  { no: 5,  organ: 'Central nervous system', name: 'Antidepressants, alone or in combination',    n: 7,  prevalence: 21.6, match: { tag: 'antidepressant' } },
  { no: 6,  organ: 'Central nervous system', name: 'Antipsychotics',                              n: 12, prevalence: 1.9,  match: { tag: 'antipsychotic' } },
  { no: 7,  organ: 'Central nervous system', name: 'Barbiturates',                                n: 7,  prevalence: 0.2,  match: { cls: 'barbiturate' } },
  { no: 8,  organ: 'Central nervous system', name: 'Benzodiazepines - Short and intermediate acting', n: 5, prevalence: 5.2, match: { tag: 'benzodiazepine', sub: 'short' } },
  { no: 9,  organ: 'Central nervous system', name: 'Benzodiazepines - Long acting',               n: 11, prevalence: 43.3, match: { tag: 'benzodiazepine', sub: 'long' } },
  { no: 10, organ: 'Central nervous system', name: 'Z-drugs',                                     n: 3,  prevalence: 24.3, match: { cls: 'zdrug' } },
  { no: 11, organ: 'Gastrointestinal',      name: 'Metoclopramide',                               n: 1,  prevalence: 6.5,  match: { ing: 'metoclopramide' } },
  { no: 12, organ: 'Pain medications',      name: 'Non-cyclooxygenase-selective NSAIDs',          n: 3,  prevalence: 3.0,  match: { tag: 'nsaid_ns' } },
  { no: 13, organ: 'Pain medications',      name: 'Ketorolac, includes parenteral',               n: 1,  prevalence: 0.1,  match: { ing: 'ketorolac' } },
  { no: 14, organ: 'Pain medications',      name: 'Skeletal muscle relaxants',                    n: 7,  prevalence: 13.6, match: { cls: 'musclerelax' } },
];

// National claims figures as published in the report: 2017 cohort, outpatients aged 65 and over
const CLAIMS = {
  year: 2017,
  elderlyOutpatients: 7079211,        // aged 65 and over with an outpatient prescription in 2017
  polypharmacyCohort: 3397087,        // five or more drugs for 90 days or more
  pimUsers: 684538,                   // at least one potentially inappropriate drug
  pimUserRate: 44.7,                  // share (%) of the polypharmacy cohort
  ddiUsers: 21991, ddiRate: 1.4,      // contraindicated combinations
  dupClassUsers: 1014021, dupClassRate: 66.2,   // duplicate therapeutic classes
  dupIngredientUsers: 468039, dupIngredientRate: 30.6, // same ingredient duplicated across institutions
  inappropriatePolypharmacy: 245477, inappropriateRate: 16.0, // ten or more drugs for 90 days or more, with an inappropriate drug
  harmOddsRatio: [1.32, 1.35],        // odds of admission, emergency visit, and death in the inappropriate-polypharmacy group
  topDdiPair: 'hydroxyzine + escitalopram',
};

const CANDIDATE_SOURCES = { total: 297, erRelated: 210, beers: 144, koreaPim: 63, durElderly: 90, ahYoungmi: 138 };

const NATIONAL_CRITERIA = {
  age: '65세 이상',
  general: '의약품 10종 이상을 90일 이상 복용',
  drug: '① 잠재적 부적절 약물 목록(77개 성분/14계열) 포함, 또는 ② 병용금기, 또는 ③ 중복처방(효능군·동일성분)',
  conditionBased: false,   // no condition-dependent criteria. This is where the study starts.
};

function drugKeys(d) { return [d.cls, ...(d.tags || [])]; }

/** Which of HIRA's 14 classes a drug falls into, or null. The long- and short-acting benzodiazepine
 *  split uses the cat field from Kim 2018. */
function classify(drug, catHint) {
  for (let i = 0; i < CLASSES.length; i++) {
    const c = CLASSES[i], m = c.match;
    if (m.ing && drug.ing === m.ing) return c;
    if (m.cls && drug.cls === m.cls) return c;
    if (m.tag && drugKeys(drug).includes(m.tag)) {
      if (!m.sub) return c;
      const cat = catHint || '';
      if (m.sub === 'long' && cat.includes('장시간')) return c;
      if (m.sub === 'short' && (cat.includes('단·중시간') || cat.includes('단시간'))) return c;
      continue;
    }
  }
  return null;
}

function isCovered(drug, catHint) { return classify(drug, catHint) !== null; }

const totalIngredients = CLASSES.reduce((s, c) => s + c.n, 0);   // 77

module.exports = {
  source: '건강보험심사평가원(2022). 노인의 부적절한 다약제 사용 관리 기준 마련. 발간등록번호 G000F8Q-2022-170',
  CLASSES, CLAIMS, CANDIDATE_SOURCES, NATIONAL_CRITERIA,
  classify, isCovered, totalIngredients,
};
