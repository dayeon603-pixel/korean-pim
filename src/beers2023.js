/**
 * AGS Beers Criteria 2023 — Table 3 (약물-질환/증후군 상호작용) 비교용 구조화.
 *
 * 출처: 2023 American Geriatrics Society Beers Criteria® Update Expert Panel.
 *   American Geriatrics Society 2023 updated AGS Beers Criteria for potentially
 *   inappropriate medication use in older adults.
 *   J Am Geriatr Soc. 2023;71(7):2052-2081. DOI: 10.1111/jgs.18372
 *
 * ⚠ 저작권: Beers Criteria®는 미국노인병학회(AGS)의 저작물이며 등록상표다.
 *   이 파일은 **기준 전문을 재배포하지 않는다.** 조건부 기준의 존재 여부와 대상 약물군을
 *   비교하기 위해 필요한 최소한만 구조화했고, 근거(rationale)·권고문·근거수준은 옮기지 않았다.
 *   실제 임상 사용은 반드시 AGS 원문을 확인해야 한다. https://doi.org/10.1111/jgs.18372
 *
 * 왜 필요한가:
 *   "국가 기준이 조건부 축을 뺀다"는 관찰이 한국만의 현상인지 확인하려면 비교 대상이 필요하다.
 *   Beers는 세계에서 가장 널리 쓰이는 노인 부적절약물 기준이고, Table 3이 조건부 축이다.
 *   조건 수를 비교하면 이렇게 된다.
 *     Kim 2018 표2   18개 조건
 *     Beers 2023 T3   9개 조건
 *     심평원 2022     0개 조건  ← 국가 운영화 단계에서 축 자체가 사라진다
 *
 * 주의: Beers 2023 개정에서 일부 기준이 Table 3에서 Table 4(신중 사용)·Table 6(신기능)으로
 *   이동했다(원문 변경 요약에 명시). 여기서는 2023판 Table 3에 남아 있는 조건만 담는다.
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

// Kim 2018 표2 조건 id와의 대응. 양쪽에 다 있는 조건을 세기 위한 것.
const KIM_EQUIVALENT = {
  hf: 'hf', dementia: 'dementia', falls: 'falls', parkinson: 'parkinson', ulcer: 'ulcer', bph: 'bph',
  // Beers에만 있는 조건
  syncope: null, delirium: 'dementia', incontinence_women: null,
  // 참고: Kim 표2의 'dementia'는 "섬망·치매·인지장애"를 한 항목으로 묶는다.
  //       Beers는 Delirium과 Dementia를 따로 둔다. 여기서는 Kim 쪽 1개에 Beers 2개가 대응한다.
};

function targetHits(t, drug) {
  if (t.ing) return drug.ing === t.ing;
  if (t.cls) return drug.cls === t.cls;
  if (t.tag) return [drug.cls, ...(drug.tags || [])].includes(t.tag);
  return false;  // 매핑 대상 밖(덱스트로메토르판-퀴니딘 등 국내 미유통 조합)
}

/** 조건 id 배열 × 약물 배열 → Beers Table 3 판정 */
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
