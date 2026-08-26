/**
 * 노인 부적절약물 기준 레지스트리 — 조건부 판정 축의 유무를 기준 간 비교하기 위한 표.
 *
 * 목적: "환자 상태를 함께 봐야 성립하는 판정 축"이 각 기준에 있는지, 있다면 규모가 어떤지를
 *   한 자리에서 비교한다. 이 축이 국가 운영 기준에서 사라지는지를 보기 위한 것이다.
 *
 * 원칙: **확인한 것만 숫자로 적고, 확인하지 못한 것은 null로 두고 이유를 남긴다.**
 *   전문이 저작권·유료 장벽 뒤에 있는 기준은 총량만 적고 조건부 항목 수는 미확인으로 둔다.
 *   추정치를 넣으면 비교표 전체의 신뢰가 사라지므로 넣지 않는다.
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
    drugOnlyItems: pim.coverage.table1,          // 표1
    conditionCount: pim.coverage.table2Conditions, // 표2
    conditionAxis: true,
    implemented: 'full',                          // 이 저장소에 전량 구현
    note: '표1 63항목 + 표2 18개 조건. 오픈액세스라 전량 구조화 가능했다.',
  },
  {
    id: 'beers2023', region: '미국', kind: '학술 합의',
    name: 'AGS Beers Criteria 2023',
    source: 'J Am Geriatr Soc 2023;71(7):2052-2081. DOI 10.1111/jgs.18372',
    drugOnlyItems: null,                          // Table 2. 본 연구 범위 밖이라 세지 않음
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
    conditionCount: null,                         // ← 미확인
    conditionAxis: true,                          // 구조적으로 조건 서술형이나 개수는 미확인
    implemented: 'none',
    totalCriteria: 133,                           // STOPP 기준 총수(확인됨)
    note: 'STOPP 133개 기준이 생리계통별로 조직되고 임상 맥락과 함께 서술된다. '
        + '다만 전체 기준 목록 접근이 제한되어 **조건부 항목 수를 세지 못했다.** 미확인으로 둔다.',
  },
  {
    id: 'hira2022', region: '한국', kind: '국가 운영 기준',
    name: '심평원 노인 부적절 다약제 기준(안) (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    drugOnlyItems: hira.totalIngredients,         // 77개 성분
    conditionCount: 0,
    conditionAxis: false,
    implemented: 'class-level',
    note: '후보 297개에서 77개 성분·14계열 확정. 기저질환 조건부 기준 없음. '
        + '최종 77개 성분명은 미공개라 계열 단위로만 구현.',
  },
];

/** 조건부 축을 가진 기준 / 갖지 않은 기준 */
function split() {
  return {
    withAxis: CRITERIA.filter((c) => c.conditionAxis),
    withoutAxis: CRITERIA.filter((c) => !c.conditionAxis),
    counted: CRITERIA.filter((c) => c.conditionCount !== null),
    uncounted: CRITERIA.filter((c) => c.conditionCount === null),
  };
}

module.exports = { CRITERIA, split };
