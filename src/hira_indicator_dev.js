/* HIRA 2021 indicator-development report — the deliberation record.
 *
 * Source (read directly, 2026-09-01):
 *   건강보험심사평가원. 「환자안전 중심 약제평가 지표 개발 연구」. 발간등록번호 G000F8Q-2021-15. 2021.
 *   https://repository.hira.or.kr/bitstream/2019.oak/2998/2/환자안전 중심 약제평가 지표 개발 연구.pdf
 *
 * Why this document matters.
 *   It is the study that produced the elderly-medication indicator HIRA later fielded
 *   (노인주의 의약품 처방률, introduced 2023). It records nine candidate indicators, the
 *   feasibility tier assigned to each, and the verbatim expert-panel reasons. It therefore
 *   supplies what a cross-country tabulation cannot: the agency's own stated reasons for
 *   keeping or dropping a condition-dependent specification.
 *
 * How to read `conditionDependence`.
 *   none    - the indicator is computable from a drug list alone.
 *   combo   - requires co-occurrence of two or more drugs, still drug-only.
 *   context - requires a clinical context established by something other than the drug pair
 *             itself (a diagnosis, a risk state, or the absence of a protective drug).
 *
 * `statedReason` quotes are verbatim Korean from the report. They are the primary evidence and
 * must not be paraphrased in code. Translations are provided separately and are ours.
 */
'use strict';

/** Report identity, so downstream output can cite without a second lookup. */
const SOURCE = {
  issuer: '건강보험심사평가원',
  title: '환자안전 중심 약제평가 지표 개발 연구',
  registration: 'G000F8Q-2021-15',
  year: 2021,
  url: 'https://repository.hira.or.kr/bitstream/2019.oak/2998/2/',
  accessed: '2026-09-01',
  access: 'full text downloaded and read',
};

/** The nine candidate indicators, as listed in <요약표 9> and <요약표 10>. */
const CANDIDATES = [
  {
    no: 1,
    nameKo: '노인환자에서 항콜린 작용이 중간 혹은 높은 2가지 이상 성분 동시처방률',
    nameEn: 'Concurrent prescription of two or more moderate/high anticholinergic ingredients, age 65+',
    tier: '중기',
    conditionDependence: 'combo',
    fielded: false,
    statedReason: '임상적 중요성에 대한 논란의 여지가 없음',
  },
  {
    no: 2,
    nameKo: '노인환자에서 치매치료를 위해 1가지 이상의 약물을 처방받고, 중간 혹은 높은 항콜린 작용이 있는 1가지 이상의 약물 동시처방률',
    nameEn: 'Anticholinergic co-prescription in patients receiving anti-dementia drugs, age 65+',
    tier: '장기',
    conditionDependence: 'context',
    fielded: false,
    // The condition (dementia) was operationalised through a DRUG proxy, not a diagnosis code.
    // The panel identified the misclassification this causes and proposed a diagnosis binding.
    // The proposal was not adopted and the indicator was tiered out.
    statedReason:
      '치매치료제 성분에 대한 해당 진료과의 임상자문이 필요하며, Gingko 성분이 포함되어 있으나 해당 약물을 사용한다고 해서 치매 환자라고 보기 어렵다.',
    bindingProposal:
      '대상 환자는 치매치료제를 처방받은 환자가 아닌, 치매 상병으로 진단받고 치매치료제를 처방받은 환자(진성 치매환자)로 분모를 제한하는 방안의 타당성 및 내부 심사위원 등의 자문이 필요하다.',
    bindingProposalDate: '2021-07-24',
    bindingProposalAdopted: false,
  },
  {
    no: 3,
    nameKo: '노인환자에서 중추 신경계 약물 3가지 이상 성분 동시처방률',
    nameEn: 'Concurrent prescription of three or more CNS-active ingredients, age 65+',
    tier: '중기',
    conditionDependence: 'combo',
    fielded: false,
    statedReason: '해당지표는 특정과에만 집중되어 있는 경향성이 있음',
  },
  {
    no: 4,
    nameKo: '스테로이드 2가지 이상 성분 동시처방률',
    nameEn: 'Concurrent prescription of two or more corticosteroid ingredients',
    tier: '장기',
    conditionDependence: 'combo',
    fielded: false,
    statedReason:
      '현재 지표는 외국의 종합병원에서 장기간 사용으로 인한 골절위험을 나타내는 지표이나, 국내의 경우 의원의 오남용 문제가 제기되고 있어 국내의 문제점을 대변하는 지표로 부적절함',
  },
  {
    no: 5,
    nameKo: '노인환자의 노인주의 의약품 처방률',
    nameEn: 'Prescribing rate of drugs flagged for caution in older adults',
    tier: '단기',
    conditionDependence: 'none',
    fielded: true,                    // fielded 2023 as a monitoring indicator
    statedReason: 'DUR 기준 노인주의 의약품(61개)과 비교 검토 필요함 - 현재 61개 중 37개만 포함되어 있음',
  },
  {
    no: 6,
    nameKo: '베라파밀과 베타블로커 동시처방률',
    nameEn: 'Concurrent prescription of verapamil and a beta-blocker',
    tier: '장기',
    conditionDependence: 'combo',
    fielded: false,
    statedReason: '해당 영역 범위가 다른 지표에 비해 너무 세밀하고 협소한 지표이므로 평가지표로 적절하지 않음',
  },
  {
    no: 7,
    nameKo: '노인환자에서 위보호제 없이 NSAID 및 Aspirin 혹은 clopidogrel 동시처방률',
    nameEn: 'NSAID plus aspirin or clopidogrel without gastroprotection, age 65+',
    tier: '장기',
    conditionDependence: 'context',
    fielded: false,
    // The stated obstacle is the unit of analysis, not the availability of codes.
    statedReason:
      '임상적으로 논란의 여지가 없는 좋은 지표이나 환자단위 지표이며 개별 의료기관 평가는 불가능함',
    statedReason2: '국가단위 지표로는 산출 가능하지만, 병원 평가로는 적절하지 않음',
  },
  {
    no: 8,
    nameKo: '노인환자의 항정신병 약물 처방률',
    nameEn: 'Antipsychotic prescribing rate, age 65+',
    tier: '단기',
    conditionDependence: 'none',
    fielded: false,
    // Internationally this criterion is stated as antipsychotics IN DEMENTIA. Here the
    // condition qualifier is absent and the indicator is a plain drug-class rate.
    statedReason: '국가단위 지표로는 산출 가능하지만, 병원 평가로는 적절하지 않음',
  },
  {
    no: 9,
    nameKo: '75세 이상 환자 중 5개 이상 의약품 처방률',
    nameEn: 'Five or more concurrent medications, age 75+',
    tier: '단기',
    conditionDependence: 'none',
    fielded: false,
    // A direct statement that the comorbidity-driven subset could not be readily defined.
    statedReason: '만성질환 약제 처방개수를 고려해야 하나, 이를 제외하는 방법이 쉽지 않음',
  },
];

/** Tier is the report's own feasibility grading (요약표 10). 단기 = implementable now. */
const TIER_BASIS = '실행가능성이 높아 단기유형으로 분류된 지표는 5번 노인환자의 노인주의 의약품 처방률, 8번 노인환자의 항정신병 약물 처방률, 9번 75세 이상 환자 중 5개 이상 의약품 처방률임';

/** Cross-tabulate feasibility tier against condition dependence. */
function tierByDependence() {
  const out = {};
  CANDIDATES.forEach((c) => {
    out[c.tier] = out[c.tier] || { none: 0, combo: 0, context: 0, ids: [] };
    out[c.tier][c.conditionDependence] += 1;
    out[c.tier].ids.push(c.no);
  });
  return out;
}

/** Candidates whose specification needs a clinical context beyond the drug list itself. */
function contextDependent() {
  return CANDIDATES.filter((c) => c.conditionDependence === 'context');
}

/** Every context-dependent candidate that did not reach the short-term tier. */
function contextTieredOut() {
  return contextDependent().filter((c) => c.tier !== '단기');
}

module.exports = { SOURCE, CANDIDATES, TIER_BASIS, tierByDependence, contextDependent, contextTieredOut };
