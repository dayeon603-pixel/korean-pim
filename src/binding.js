/**
 * 용어 결속(terminology binding) 측정 — 판정 규칙이 사람의 해석 없이 실행될 수 있는가.
 *
 * ── 왜 이 측정인가 ────────────────────────────────────────────────────────
 * 본 연구는 조건부 판정 축이 지불에 가까운 계층에서 사라진다는 것을 관찰했다.
 * 그러나 관찰만으로는 왜 그런지 알 수 없다. 이 모듈은 그 기전을 재기 위한 것이다.
 *
 * 판정 규칙이 지표로 산출되려면 두 가지가 코드로 지정돼야 한다.
 *   약물 축 — 어떤 약인가. ATC·주성분코드·제품코드
 *   조건 축 — 어떤 환자 상태인가. ICD/KCD·Read code·값집합(value set)
 *
 * 핵심은 **두 축의 결속 비용이 다르다**는 점이다.
 *   약물은 조제·청구 과정에서 이미 코드가 붙어 나온다. 결속이 부산물로 따라온다.
 *   환자 상태는 그렇지 않다. 학술 기준이 임상 용어로만 조건을 쓰면,
 *   그 축을 쓰려는 쪽이 값집합을 **직접 저작**해야 한다.
 *
 * ── 무엇을 세는가 ─────────────────────────────────────────────────────────
 * sourceBound: **원문 자체가** 표준 코드를 지정한 항목 수. 우리가 나중에 붙인 것은 세지 않는다.
 * authoredBy : 그 축을 운영한 관할이 결속을 직접 저작했는지, 저작했다면 어떤 체계로.
 *
 * ── 한계 ──────────────────────────────────────────────────────────────────
 *  - 결속 여부는 이분법으로 셌다. 부분 결속(예: 일부 조건만 코드 지정)은 관측되지 않았다.
 *  - 저작 비용을 금액으로 재지 않았다. 저작 여부만 기록한다.
 *  - Beers Table 2/4/6 은 구조화하지 않아 조건 축(Table 3)만 대상으로 한다.
 */
'use strict';
const pim = require('./index.js');
const beers = require('./beers2023.js');
const hira = require('./hira2022.js');

/** 표1 항목 중 ATC 5단계 코드가 단일 매핑된 수. 복합제·염 분기·성분군·투여요법은 제외된다. */
function atcSingleMapped() {
  return pim.table1.filter((x) => x.atc && typeof x.atc === 'string').length;
}

const CRITERIA_BINDING = [
  {
    id: 'kim2018-t1', name: '한국형 PIM 2018 표1', axis: '약물',
    total: pim.coverage.table1,
    sourceBound: null,          // 원문은 성분명으로 지정한다. ATC 코드를 싣지는 않는다.
    codeSystem: '성분명(코드 아님)',
    mappable: atcSingleMapped(),
    note: '원문은 코드를 싣지 않으나 성분명이 곧 결속 단서가 된다. WHO ATC 5단계로 옮기면 '
        + `${atcSingleMapped()}/${pim.coverage.table1} 이 단일 매핑되고, 나머지 4항목은 `
        + '복합제·염 형태 분기·성분군·투여 요법이라 단일 코드가 성립하지 않는다. '
        + '즉 약물 축은 **기계적으로 결속 가능**하다.',
  },
  {
    id: 'kim2018-t2', name: '한국형 PIM 2018 표2', axis: '조건',
    total: pim.coverage.table2Conditions,
    sourceBound: 0,
    codeSystem: null,
    mappable: null,
    note: '원문은 조건을 임상 용어로만 기술한다(예: "낙상·골절·실신·기립성 저혈압 병력"). '
        + '진단코드 범위를 지정하지 않으므로, 이 축을 지표로 쓰려면 값집합을 **직접 저작**해야 한다. '
        + '저작 결과는 저작자마다 달라질 수 있고 판정 건수도 함께 달라진다.',
  },
  {
    id: 'beers2023-t3', name: 'AGS Beers 2023 Table 3', axis: '조건',
    total: beers.conditionCount,
    sourceBound: 0,
    codeSystem: null,
    mappable: null,
    note: '동일하다. 조건을 임상 용어로 기술하며 코드를 싣지 않는다. '
        + '미국에서 이 축을 지표로 만든 NCQA 가 값집합을 별도로 저작한 것이 그 방증이다.',
  },
  {
    id: 'hira2022', name: '심평원 2022 국가 기준', axis: '약물',
    total: hira.totalIngredients,
    sourceBound: null,
    codeSystem: '성분명(최종 목록 미공개)',
    mappable: null,
    note: '약물 축만 존재한다. 조건 축이 없으므로 조건 결속이 필요하지 않다.',
  },
];

/** 조건부 축을 운영한 관할이 결속을 어떻게 마련했는가.
 *  본문에서 이름으로 인용하는 건은 모두 1차 원문에서 해당 표기를 직접 확인했다. */
const AUTHORED_BINDINGS = [
  {
    region: '잉글랜드', instrument: 'PINCER 처방안전 지표', authored: true,
    system: 'Read code',
    evidence: '"Patients aged ≥18 years with a Read code for peptic ulcer or ...", '
            + '"... with a Read code for asthma at least ..."',
  },
  {
    region: '미국', instrument: 'NCQA HEDIS DDE', authored: true,
    system: 'value set',
    evidence: 'Fractures Value Set, Dementia Value Set 등 조건마다 값집합을 별도로 정의한다.',
  },
  {
    region: '스코틀랜드', instrument: 'Polypharmacy Guidance 2026-2029', authored: true,
    system: '조작적 정의',
    evidence: '"Documented dementia (or on donepezil, rivastigmine, galantamine or memantine) '
            + 'and HbA1c less than 53 mmol/mol" 처럼 진단·투약·검사치를 조합해 정의한다.',
  },
  {
    region: '일본', instrument: '厚生労働省 지침 별표2', authored: false,
    system: null,
    evidence: '조건이 「推奨される使用法」 산문 안에 남아 코드로 지정되지 않는다. '
            + '「対象となる患者群」 열은 문서 전체에서 출현하지 않는다.',
  },
  {
    region: '한국', instrument: '심평원 2022 국가 기준', authored: false,
    system: null,
    evidence: '조건 축 자체가 없어 결속 대상이 존재하지 않는다.',
  },
];

/** 본 연구가 저작한 결속. 이것이 이 논문의 산출물이다. */
function ourBinding() {
  const icd = require('../analysis/icd_map.js');
  const mapped = pim.table2.filter((c) => icd.MAP[c.id]).length;
  return {
    total: pim.coverage.table2Conditions,
    mapped,
    unmapped: pim.table2.filter((c) => !icd.MAP[c.id]).map((c) => c.id),
    system: 'ICD-10-CM / ICD-9-CM 접두 일치',
    note: 'KCD-8 은 ICD-10 의 한국 표준판이므로 상병코드 축으로 이어진다. '
        + '연령 조건은 진단이 아니므로 결속 대상에서 제외한다.',
  };
}

module.exports = {
  CRITERIA_BINDING, AUTHORED_BINDINGS, atcSingleMapped, ourBinding,
  /** 축을 유지한 관할 중 결속을 저작한 비율 */
  get authoredAmongRetained() {
    const r = AUTHORED_BINDINGS.filter((x) => x.authored);
    const lost = AUTHORED_BINDINGS.filter((x) => !x.authored);
    return { retained: r.length, retainedAuthored: r.filter((x) => x.system).length, lost: lost.length };
  },
};
