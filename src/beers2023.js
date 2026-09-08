/**
 * AGS Beers Criteria 2023, Table 3, drug-disease and drug-syndrome interactions, structured for
 * comparison.
 *
 * Source: 2023 American Geriatrics Society Beers Criteria® Update Expert Panel.
 *   American Geriatrics Society 2023 updated AGS Beers Criteria for potentially
 *   inappropriate medication use in older adults.
 *   J Am Geriatr Soc. 2023;71(7):2052-2081. DOI: 10.1111/jgs.18372
 *
 * Copyright: the Beers Criteria are a work of the American Geriatrics Society and a registered
 *   trademark.
 *   This file does not redistribute the criteria. It structures the minimum needed to compare
 *   whether a condition-dependent criterion exists and which drug groups it names. Rationale,
 *   recommendations, and evidence grades are not reproduced.
 *   For clinical use, consult the AGS source. https://doi.org/10.1111/jgs.18372
 *
 * Why this is needed:
 *   Testing whether the observation that national criteria drop the condition axis is peculiar to
 *   Korea requires something to compare against.
 *   Beers is the most widely used such criteria set, and Table 3 is its condition axis.
 *   Comparing condition counts gives:
 *     Kim 2018 Table 2   18 conditions
 *     Beers 2023 Table 3  9 conditions
 *     HIRA 2022           0 conditions  — the axis disappears at the national operating stage
 *
 * Note: the 2023 update moved some criteria out of Table 3 into Table 4 (use with caution) and
 *   Table 6 (renal function), as its own change summary states. Only conditions remaining in the
 *   2023 Table 3 are held here.
 */
'use strict';

const TABLE3 = [
  { id: 'hf', organ: 'Cardiovascular', name: 'Heart Failure', nameKo: '심부전',
    targets: [{ kr: '실로스타졸', ing: 'cilostazol' }, { kr: '덱스트로메토르판-퀴니딘' },
      { kr: '비DHP 칼슘차단제(딜티아젬·베라파밀)', cls: 'ccbnd' }, { kr: '드로네다론', ing: 'dronedarone' },
      { kr: 'NSAID 및 COX-2 억제제', tag: 'nsaid' }, { kr: '티아졸리딘디온(피오글리타존)', ing: 'pioglitazone' }] },

  { id: 'syncope', organ: 'Cardiovascular', name: 'Syncope', nameKo: '실신',
    targets: [{ kr: '일부 항정신병약(클로르프로마진·올란자핀)', tag: 'antipsychotic' },
      { kr: '콜린에스터라제 억제제(도네페질·갈란타민·리바스티그민)', cls: 'chei' },
      { kr: '비선택적 말초 알파-1 차단제(독사조신·프라조신·테라조신)', cls: 'alpha1' },
      { kr: '3차 아민 TCA(아미트립틸린·클로미프라민·독세핀·이미프라민)', tag: 'tca' }] },

  { id: 'delirium', organ: 'Central Nervous System', name: 'Delirium', nameKo: '섬망',
    targets: [{ kr: '항콜린제', tag: 'anticholinergic' }, { kr: '항정신병약', tag: 'antipsychotic' },
      { kr: '벤조디아제핀', tag: 'benzodiazepine' }, { kr: '스테로이드(경구·주사)', cls: 'cortico' },
      { kr: 'H2 수용체 길항제(시메티딘·파모티딘·니자티딘)', tag: 'h2ra' },
      { kr: 'Z-drug(에스조피클론·잘레플론·졸피뎀)', cls: 'zdrug' }, { kr: '오피오이드', cls: 'opioid' }] },

  { id: 'dementia', organ: 'Central Nervous System', name: 'Dementia or cognitive impairment', nameKo: '치매·인지장애',
    targets: [{ kr: '항콜린제', tag: 'anticholinergic' }, { kr: '항정신병약(만성·지속 필요시 사용)', tag: 'antipsychotic' },
      { kr: '벤조디아제핀', tag: 'benzodiazepine' }, { kr: 'Z-drug', cls: 'zdrug' }] },

  { id: 'falls', organ: 'Central Nervous System', name: 'History of falls or fractures', nameKo: '낙상·골절 병력',
    targets: [{ kr: '항콜린제', tag: 'anticholinergic' }, { kr: '항우울제(SNRI·SSRI·TCA)', tag: 'antidepressant' },
      { kr: '항경련제', tag: 'anticonvulsant' }, { kr: '항정신병약', tag: 'antipsychotic' },
      { kr: '벤조디아제핀', tag: 'benzodiazepine' }, { kr: 'Z-drug', cls: 'zdrug' }, { kr: '오피오이드', cls: 'opioid' }] },

  { id: 'parkinson', organ: 'Central Nervous System', name: 'Parkinson disease', nameKo: '파킨슨병',
    targets: [{ kr: '항구토제(메토클로프라미드·프로클로르페라진·프로메타진)', ing: 'metoclopramide' },
      { kr: '항정신병약(클로자핀·피마반세린·쿠에티아핀 제외)', tag: 'antipsychotic' }] },

  { id: 'ulcer', organ: 'Gastrointestinal', name: 'History of gastric or duodenal ulcers', nameKo: '위·십이지장 궤양 병력',
    targets: [{ kr: '아스피린', ing: 'aspirin' }, { kr: '비COX-2 선택적 NSAID', tag: 'nsaid_ns' }] },

  { id: 'incontinence_women', organ: 'Kidney/urinary tract', name: 'Urinary incontinence (all types) in women', nameKo: '여성 요실금',
    targets: [{ kr: '비선택적 말초 알파-1 차단제', cls: 'alpha1' }, { kr: '경구·경피 에스트로겐', ing: 'estrogen' }] },

  { id: 'bph', organ: 'Kidney/urinary tract', name: 'Lower urinary tract symptoms, BPH', nameKo: '하부요로증상·전립선비대',
    targets: [{ kr: '강한 항콜린제(요실금용 항무스카린제 제외)', tag: 'anticholinergic' }] },
];

// Correspondence with Kim 2018 Table 2 condition ids, used to count conditions present in both.
const KIM_EQUIVALENT = {
  hf: 'hf', dementia: 'dementia', falls: 'falls', parkinson: 'parkinson', ulcer: 'ulcer', bph: 'bph',
  // conditions unique to Beers
  syncope: null, delirium: 'dementia', incontinence_women: null,
  // Note: Kim's 'dementia' bundles delirium, dementia, and cognitive impairment into one item,
  //       whereas Beers keeps delirium and dementia apart. One Kim item maps to two Beers items.
};

function targetHits(t, drug) {
  if (t.ing) return drug.ing === t.ing;
  if (t.cls) return drug.cls === t.cls;
  if (t.tag) return [drug.cls, ...(drug.tags || [])].includes(t.tag);
  return false;  // outside the mapping, such as dextromethorphan-quinidine, not marketed in Korea
}

/** Condition ids and drugs to Beers Table 3 hits. */
function check(conditionIds, drugs) {
  const on = new Set(conditionIds || []);
  const out = [];
  TABLE3.forEach((c) => {
    if (!on.has(c.id)) return;
    c.targets.forEach((t) => {
      const hit = (drugs || []).filter((d) => targetHits(t, d));
      if (hit.length) out.push({ condition: c, target: t, drugs: hit });
    });
  });
  return out;
}

module.exports = {
  source: 'AGS 2023 Beers Criteria Update Expert Panel. J Am Geriatr Soc. 2023;71(7):2052-2081. DOI 10.1111/jgs.18372',
  copyright: 'Beers Criteria®는 American Geriatrics Society의 저작물·등록상표. 이 파일은 비교 목적의 부분 구조화이며 기준 전문이 아니다.',
  TABLE3, KIM_EQUIVALENT, check, conditionCount: TABLE3.length,
};
