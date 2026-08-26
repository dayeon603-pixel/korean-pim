/**
 * 심평원(HIRA) 2022 「노인의 부적절한 다약제 사용 관리 기준 마련」 약물 기준.
 *
 * 출처: 건강보험심사평가원, 발간등록번호 G000F8Q-2022-170 (2022-12).
 *   연구책임자 윤상헌·김동숙. repository.hira.or.kr
 *
 * 왜 이 파일이 필요한가:
 *   이 보고서는 국가 심사평가기관이 채택한 노인 부적절 다약제 기준(안)이다.
 *   후보 297개(Beers 144 · Korea PIM 63 · DUR 노인주의 90 · 아영미 등 138)를
 *   임상전문가 9인 자문으로 걸러 **77개 성분 / 14개 계열**을 확정했다(보고서 표 21).
 *
 *   중요한 점: 후보에 들어간 "Korea PIM 63"은 Kim 2018 **표1**뿐이다.
 *   **표2(기저질환 조건부 18개 조건)는 국가 기준 검토 대상에 아예 포함되지 않았다.**
 *   즉 환자 상태를 함께 봐야 성립하는 기준 축이 국가 기준에서 통째로 빠져 있다.
 *   이 파일은 그 공백을 정량화하기 위한 비교 기준선이다.
 *
 * 한계: 보고서 표 21은 계열과 성분 개수만 공개하고 개별 성분명은 부록(엑셀)에 있다.
 *   따라서 여기서는 **계열 단위**로만 구현하고, 각 계열에 우리가 매핑한 판정 키를 붙였다.
 *   성분 단위 대조는 부록 원본을 입수해야 가능하며 미완료다.
 */
'use strict';

// 보고서 표 21 (14계열, 총 77개 성분) + 표 28 (실제 청구 처방 현황)
// prevalence = 잠재적 부적절 약물을 1종 이상 처방받은 노인 684,538명 중 해당 계열 비율(%)
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

// 보고서에 실린 국가 청구 실측치 (2017년 코호트, 65세 이상 외래)
const CLAIMS = {
  year: 2017,
  elderlyOutpatients: 7079211,        // 2017년 외래 처방 받은 65세 이상
  polypharmacyCohort: 3397087,        // 5종 이상 90일 이상
  pimUsers: 684538,                   // 잠재적 부적절 약물 1종 이상 사용
  pimUserRate: 44.7,                  // 다약제 복용 환자 중 비율(%)
  ddiUsers: 21991, ddiRate: 1.4,      // 병용금기
  dupClassUsers: 1014021, dupClassRate: 66.2,   // 효능군 중복
  dupIngredientUsers: 468039, dupIngredientRate: 30.6, // 타기관 동일성분 중복
  inappropriatePolypharmacy: 245477, inappropriateRate: 16.0, // 10종+90일+ & 부적절약물
  harmOddsRatio: [1.32, 1.35],        // 부적절 다약제군의 입원·응급실·사망 확률
  topDdiPair: 'hydroxyzine + escitalopram',
};

const CANDIDATE_SOURCES = { total: 297, erRelated: 210, beers: 144, koreaPim: 63, durElderly: 90, ahYoungmi: 138 };

const NATIONAL_CRITERIA = {
  age: '65세 이상',
  general: '의약품 10종 이상을 90일 이상 복용',
  drug: '① 잠재적 부적절 약물 목록(77개 성분/14계열) 포함, 또는 ② 병용금기, 또는 ③ 중복처방(효능군·동일성분)',
  conditionBased: false,   // ← 기저질환 조건부 기준 없음. 이 연구의 출발점.
};

function drugKeys(d) { return [d.cls, ...(d.tags || [])]; }

/** 약물 하나가 HIRA 14계열 중 어디에 걸리는지. 없으면 null.
 *  벤조디아제핀 장·단시간형 구분은 Kim 2018의 cat 표기를 이용한다. */
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
