/**
 * Terminology binding — whether a rule can execute without human interpretation.
 *
 * ── Why measure this ──────────────────────────────────────────────────────
 * The study observed that the condition axis disappears at layers close to payment. Observation
 * alone does not say why. This module measures the mechanism.
 *
 * For a rule to be computed as an indicator, two things must be given as codes.
 *   The drug axis: which drug. ATC, main ingredient code, product code.
 *   The condition axis: which patient state. ICD or KCD, Read codes, a value set.
 *
 * The point is that binding the two axes costs different amounts.
 *   A drug arrives already coded by dispensing and billing. The binding is a by-product.
 *   A patient state does not. When an academic criterion states its condition in clinical prose,
 *   whoever wants to use that axis has to author the value set themselves.
 *
 * ── What is counted ───────────────────────────────────────────────────────
 * sourceBound: items for which the source document itself gives a standard code. Codes we added
 *              later are not counted.
 * authoredBy : whether the jurisdiction operating that axis authored the binding itself, and in
 *              which terminology.
 *
 * ── Limits ────────────────────────────────────────────────────────────────
 *  - Binding was counted as a binary. Partial binding, where only some conditions carry codes, was
 *    not observed.
 *  - The cost of authoring was not measured in money. Only whether it happened is recorded.
 *  - Beers Tables 2, 4, and 6 are not structured here, so only the condition axis, Table 3, is in
 *    scope.
 */
'use strict';
const pim = require('./index.js');
const beers = require('./beers2023.js');
const hira = require('./hira2022.js');

/** Table 1 items with a single five-level ATC code. Combination products, salt-form splits, drug
 * groups, and dosing regimens are excluded. */
function atcSingleMapped() {
  return pim.table1.filter((x) => x.atc && typeof x.atc === 'string').length;
}

const CRITERIA_BINDING = [
  {
    id: 'kim2018-t1', name: '한국형 PIM 2018 표1', axis: '약물',
    total: pim.coverage.table1,
    sourceBound: null,          // the source names ingredients; it does not carry ATC codes
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

/** How each jurisdiction operating a condition axis obtained its binding. Every entry cited by name
 *  in the manuscript was confirmed against the primary document. */
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

/** Bindings authored by this study. This is the manuscript's own output. */
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
  /** Share of axis-retaining jurisdictions that authored the binding themselves. */
  get authoredAmongRetained() {
    const r = AUTHORED_BINDINGS.filter((x) => x.authored);
    const lost = AUTHORED_BINDINGS.filter((x) => !x.authored);
    return { retained: r.length, retainedAuthored: r.filter((x) => x.system).length, lost: lost.length };
  },
};
