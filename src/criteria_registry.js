/**
 * Registry of potentially inappropriate medication criteria, for comparing whether each carries a
 * condition-dependent axis.
 *
 * Purpose: to compare, in one place, whether each criteria set has an axis that requires the
 *   patient's state, and how large it is. The question behind it is whether that axis survives into
 *   national operating standards.
 *
 * Rule: record a number only where it was verified. Anything unverified stays null with a reason.
 *   Where the full text sits behind copyright or a paywall, only the total is recorded and the
 *   condition count is left unverified.
 *   Estimates are not entered, because one would cost the whole table its credibility.
 */
'use strict';
const pim = require('./index.js');
const beers = require('./beers2023.js');
const hira = require('./hira2022.js');

const CRITERIA = [
  {
    id: 'kim2018', region: '한국', kind: '학술 합의',
    name: '한국형 노인 부적절약물 목록 (Kim et al., 2018)',
    source: 'Ann Geriatr Med Res 2018;22(3):121-129. DOI 10.4235/agmr.2018.22.3.121',
    drugOnlyItems: pim.coverage.table1,          // Table 1
    conditionCount: pim.coverage.table2Conditions, // Table 2
    conditionAxis: true,
    implemented: 'full',                          // implemented in full in this repository
    note: '표1 63항목 + 표2 18개 조건. 오픈액세스라 전량 구조화 가능했다.',
  },
  {
    id: 'beers2023', region: '미국', kind: '학술 합의',
    name: 'AGS Beers Criteria 2023',
    source: 'J Am Geriatr Soc 2023;71(7):2052-2081. DOI 10.1111/jgs.18372',
    drugOnlyItems: null,                          // Table 2; outside this study's scope and not counted
    conditionCount: beers.conditionCount,         // Table 3
    conditionAxis: true,
    implemented: 'table3-only',
    note: 'Table 3(약물-질환/증후군) 9개 조건만 비교용으로 구조화. AGS 저작물이라 전문 미수록.',
  },
  {
    id: 'stopp3', region: '유럽', kind: '학술 합의',
    name: 'STOPP/START version 3 (2023)',
    source: 'Eur Geriatr Med 2023. DOI 10.1007/s41999-023-00777-y',
    drugOnlyItems: null,
    conditionCount: null,                         // unverified
    conditionAxis: true,                          // structurally condition-stated, but the count is unverified
    implemented: 'none',
    totalCriteria: 133,                           // total STOPP criteria, verified
    note: 'STOPP 133개 기준이 생리계통별로 조직되고 임상 맥락과 함께 서술된다. '
        + '다만 전체 기준 목록 접근이 제한되어 **조건부 항목 수를 세지 못했다.** 미확인으로 둔다.',
  },
  {
    id: 'hira2022', region: '한국', kind: '국가 운영 기준',
    name: '심평원 노인 부적절 다약제 기준(안) (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    drugOnlyItems: hira.totalIngredients,         // 77 ingredients
    conditionCount: 0,
    conditionAxis: false,
    implemented: 'class-level',
    note: '후보 297개에서 77개 성분·14계열 확정. 기저질환 조건부 기준 없음. '
        + '최종 77개 성분명은 미공개라 계열 단위로만 구현.',
  },
];

/** Criteria sets with a condition axis, and those without. */
function split() {
  return {
    withAxis: CRITERIA.filter((c) => c.conditionAxis),
    withoutAxis: CRITERIA.filter((c) => !c.conditionAxis),
    counted: CRITERIA.filter((c) => c.conditionCount !== null),
    uncounted: CRITERIA.filter((c) => c.conditionCount === null),
  };
}

module.exports = { CRITERIA, split };
