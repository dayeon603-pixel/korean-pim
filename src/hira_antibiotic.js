/* HIRA drug-benefit appropriateness assessment — the within-agency control.
 *
 * Source (read directly, 2026-09-01):
 *   Health Insurance Review and Assessment Service. 2023 Drug Benefit Appropriateness Assessment
 *   Results (「2023년 약제급여 적정성 평가 결과」). July 2024.
 *   https://www.hira.or.kr/cms/open/04/04/12/2024_17.pdf
 *
 * Why this matters.
 *   The same agency, the same assessment programme, and the same annual report carry both
 *   an antibiotic indicator set whose denominators are defined by named KCD code ranges and
 *   an elderly-medication indicator whose denominator is every diagnosis. The antibiotic
 *   indicators are publicly graded and carry money. The elderly indicator is monitoring only.
 *   That removes the usual confounders of a cross-country comparison: the coding system, the
 *   claims infrastructure, the assessment methodology, and the operating body are held fixed.
 *
 * Record locality.
 *   `sameClaimAsDrug` records whether the condition that defines the denominator appears on
 *   the same claim record as the prescription being counted. Acute respiratory
 *   infection is coded as the principal diagnosis on the visit that generates the antibiotic
 *   prescription. A chronic comorbidity that makes a drug inappropriate for an older adult is
 *   generally established on other encounters. This field is the discriminating variable
 *   between two competing explanations and is annotated per row.
 */
'use strict';

const SOURCE = {
  issuer: '건강보험심사평가원',
  title: '2023년 약제급여 적정성 평가 결과',
  published: '2024-07',
  url: 'https://www.hira.or.kr/cms/open/04/04/12/2024_17.pdf',
  accessed: '2026-09-01',
  access: 'full text downloaded and read',
};

/**
 * The indicator definition itself, from HIRA's own indicator page rather than from the annual
 * results narrative. Obtained after a reviewer objected that the annual report is a results
 * document and not a specification. The objection was fair and this is the answer to it: the
 * definition, the code range and the formula are published by the agency's assessment management division on its open-data
 * portal, dated 2023-08-11.
 */
const OFFICIAL_DEFINITION = {
  url: 'https://opendata.hira.or.kr/op/opc/olapEvaInfoTab1.do?docNo=05-003',
  maintainer: '건강보험심사평가원 평가관리부',
  dated: '2023-08-11',
  accessed: '2026-09-01',
  // The Ko fields are verbatim from the agency's page. The En fields beside them are ours.
  definitionKo: '급성상기도감염(J00-J06) 상병의 항생제 처방 빈도를 나타내는 지표',
  definitionEn: 'An indicator of how often antibiotics are prescribed for a diagnosis of acute '
               + 'upper respiratory infection (J00-J06).',
  formulaKo: '급성상기도감염 항생제 처방률 = (항생제 총처방횟수 / 총내원횟수) * 100',
  formulaEn: 'rate = (total antibiotic prescriptions / total visits) * 100',
  scopeKo: '「전체」는 상급종합병원, 종합병원, 병원, 요양병원, 정신병원, 의원 건강보험 심사결정분을 대상으로 함',
  scopeEn: '"All" covers health-insurance claims adjudicated for tertiary hospitals, general '
          + 'hospitals, hospitals, long-term care hospitals, psychiatric hospitals and clinics.',
  // Published series from the same page, extending one year beyond the 2023 results report.
  seriesPct: { 2020: 36.21, 2021: 35.33, 2022: 32.49, 2023: 41.59, 2024: 45.38 },
};

/**
 * Evidence grade for the payment claim, stated separately because it is weaker than the
 * definition claim and a reviewer downgraded it once already.
 *
 * What is read: HIRA states, in its own published annual report, that this indicator is in the
 *   clinic-level differential payment programme and that the adjustment was widened in 2017 from
 *   one percent to a maximum of five percent, applied to claims adjudicated in 2018. See HISTORY below.
 * What is not read: the differential payment implementation plan itself, which would give the
 * formula by which the
 *   adjustment is computed. Attempts to reach it in this session failed. Nothing here depends on
 *   the formula, only on the fact of inclusion and the stated maximum rate.
 */
const PAYMENT_EVIDENCE = {
  claim: 'The acute upper respiratory infection antibiotic indicator is in the clinic-level '
       + 'differential payment programme, with the adjustment widened in 2017 to a maximum of five per cent.',
  restsOn: "issuing body's own annual report, the 추진 경과 (programme history) section",
  notObtained: '가감지급 세부시행계획, the differential payment implementation plan itself',
};

/**
 * Layers a specification can reach, ordered by proximity to payment.
 * Used elsewhere in this repository; repeated here so the module stands alone.
 */
const LAYERS = ['guideline', 'decision-support', 'measure-specification', 'public-rating', 'payment'];

const INDICATORS = [
  {
    id: 'uri_abx',
    nameKo: '급성상기도감염 항생제처방률',
    nameEn: 'Antibiotic prescribing rate, acute upper respiratory infection',
    kind: '평가지표',              // assessment indicator
    codes: ['J00-J06'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,          // principal diagnosis on the prescribing visit
    publiclyGraded: true,           // five bands, absolute thresholds since 2023
    reachesPayment: true,
    quote: '가. 급성상기도감염(J00-J06) 항생제',
    quoteEn: 'a. Acute upper respiratory infection (J00-J06), antibiotics',
  },
  {
    id: 'lri_abx',
    nameKo: '급성하기도감염 항생제처방률',
    nameEn: 'Antibiotic prescribing rate, acute lower respiratory infection',
    kind: '평가지표',
    codes: ['J20-J22'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,
    publiclyGraded: true,
    reachesPayment: false,          // graded, but not identified as a differential-payment quality indicator
    quote: '2020년: 급성하기도감염(J20-J22) 항생제 처방률 평가 지표 도입',
    quoteEn: '2020: assessment indicator introduced for the antibiotic prescribing rate in acute '
           + 'lower respiratory infection (J20-J22)',
  },
  {
    id: 'uri_broad',
    nameKo: '급성상기도감염 광범위 항생제처방률',
    nameEn: 'Broad-spectrum antibiotic rate in acute upper respiratory infection',
    kind: '평가지표',
    codes: ['J00-J06'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,
    publiclyGraded: false,
    reachesPayment: false,
    quote: '③ 급성 상기도감염 광범위 항생제처방률 (세파3세대이상, 퀴놀론계, 마크로라이드계)',
    quoteEn: '(3) Broad-spectrum antibiotic rate in acute upper respiratory infection '
           + '(third-generation cephalosporins and above, quinolones, macrolides)',
  },
  {
    id: 'resp_abx',
    nameKo: '호흡기계질환 항생제처방률',
    nameEn: 'Antibiotic prescribing rate, respiratory disease',
    kind: '모니터링지표',           // monitoring indicator
    codes: ['J00-J47'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,
    publiclyGraded: false,
    reachesPayment: false,
    quote: '2) 호흡기계질환(J00-J47) 항생제',
    quoteEn: '2) Respiratory disease (J00-J47), antibiotics',
  },
  {
    id: 'other_resp_abx',
    nameKo: '그 외 호흡기계질환 항생제처방률',
    nameEn: 'Antibiotic prescribing rate, other respiratory disease',
    kind: '모니터링지표',
    codes: ['J09-J18', 'J30-J47'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,
    publiclyGraded: false,
    reachesPayment: false,
    quote: '3) 그 외 호흡기계질환(J09-J18, J30-J47) 항생제',
    quoteEn: '3) Other respiratory disease (J09-J18, J30-J47), antibiotics',
  },
  {
    id: 'gi_drug',
    nameKo: '소화기관용약 처방률',
    nameEn: 'Gastrointestinal drug prescribing rate',
    kind: '평가지표',
    // An exclusion value set, not an inclusion one. Four ranges, authored by HIRA.
    excludeCodes: ['K20-K93', 'C15-C26', 'M00-M25', 'M40-M54'],
    codeSystem: 'KCD',
    conditionBound: true,
    sameClaimAsDrug: true,
    publiclyGraded: false,
    reachesPayment: false,
    quote:
      '소화기관용약 처방이 필요한 일부질환(소화기계 질환(K20-K93), 소화기관 악성신생물(C15-C26), 관절병증(M00-M25), 배병증(M40-M54))은 평가대상 상병에서 배제함',
    quoteEn: 'Conditions for which a gastrointestinal drug is genuinely indicated are excluded '
           + 'from the assessed diagnoses: gastrointestinal disease (K20-K93), malignant '
           + 'neoplasms of the digestive organs (C15-C26), arthropathies (M00-M25) and '
           + 'dorsopathies (M40-M54).',
  },
  {
    id: 'elderly_caution',
    nameKo: '노인주의 의약품 처방률',
    nameEn: 'Prescribing rate of drugs flagged for caution in older adults',
    kind: '모니터링지표',
    codes: [],
    codeSystem: null,
    conditionBound: false,
    sameClaimAsDrug: null,          // no condition is required, so the question does not arise
    publiclyGraded: false,
    reachesPayment: false,
    introduced: 2023,
    // The denominator is explicitly every diagnosis.
    quote: '65세 이상 의과외래환자 대상으로 전체상병의 심사결정분 기준임',
    quoteEn: 'Based on adjudicated claims for medical outpatients aged 65 and over, across every '
           + 'diagnosis (전체상병).',
    drugSource:
      '식품의약품 안전처 「의약품 적정사용을 위한 주의 정보의 공고-노인주의」 기준 항콜린계·벤조디아제핀계·항정신병제 성분(해열진통소염제 제외) 대상임',
    drugSourceEn:
      'Anticholinergic, benzodiazepine and antipsychotic ingredients, excluding antipyretic '
      + 'analgesics and anti-inflammatories, per the Ministry of Food and Drug Safety notice on '
      + 'caution information for the appropriate use of medicines (elderly caution).',
  },
];

/**
 * Programme history, verbatim. The payment mechanism predates the elderly indicator by a
 * decade, so the elderly indicator's absence from it is not explained by programme immaturity.
 */
const HISTORY = [
  { year: 2001, ko: '약제급여 적정성 평가 실시(항생제, 주사제, 투약일당 약품비, 약품목수)',
    en: 'Drug benefit appropriateness assessment begins (antibiotics, injections, drug cost per dosing day, number of drug items)' },
  { year: 2006, ko: '평가결과 공개, 6품목이상 처방비율·소화기관용약 처방률 추가',
    en: 'Results published; rate of prescriptions with 6 or more items and gastrointestinal drug rate added' },
  { year: 2011, ko: '심사·평가 연계(지표연동자율개선제), 평가결과 등급공개 실시',
    en: 'Review and assessment linked (indicator-linked voluntary improvement scheme); results published as grades' },
  { year: 2013, ko: '의원급 외래 약제적정성평가 가감지급사업 도입 - (질지표) 항생제, 주사제, 6품목이상처방비율',
    en: 'Differential payment programme introduced for clinic outpatient drug assessment; quality indicators are antibiotics, injections and the rate of prescriptions with 6 or more items' },
  { year: 2014, ko: '세파3세대이상, 퀴놀론계 항생제처방률 평가 및 연령별 정보 제공',
    en: 'Prescribing rates for third-generation-and-above cephalosporins and quinolones assessed, with information provided by age' },
  { year: 2015, ko: '항생제·주사제처방률 의료질 평가 연계(의료질평가지원금)',
    en: 'Antibiotic and injection prescribing rates linked to healthcare quality assessment (quality assessment subsidy)' },
  { year: 2017, ko: "급성상기도감염 항생제처방률 가감지급 모형개선('18년 심사결정분) - 상대평가→절대평가(목표치 제시), 가감률 확대(1%→최대 5%)",
    en: 'Differential payment model revised for the acute upper respiratory infection antibiotic rate (claims adjudicated in 2018): relative assessment replaced by absolute assessment against a stated target, and the adjustment widened from 1% to a maximum of 5%' },
  { year: 2020, ko: '급성하기도감염(J20-J22) 항생제 처방률 평가 지표 도입',
    en: 'Assessment indicator introduced for the antibiotic prescribing rate in acute lower respiratory infection (J20-J22)' },
  { year: 2023, ko: '항생제 사용량 및 처방일수, 노인주의 의약품 처방률 모니터링 지표 도입',
    en: 'Monitoring indicators introduced for antibiotic volume and days of therapy, and for the prescribing rate of drugs flagged for caution in older adults' },
];

/** Highest layer each indicator reaches, from the fields above. */
function highestLayer(ind) {
  if (ind.reachesPayment) return 'payment';
  if (ind.publiclyGraded) return 'public-rating';
  return 'measure-specification';
}

/** Split the programme's indicators by whether a patient condition defines the denominator. */
function byConditionBinding() {
  return {
    bound: INDICATORS.filter((i) => i.conditionBound),
    unbound: INDICATORS.filter((i) => !i.conditionBound),
  };
}

module.exports = { SOURCE, OFFICIAL_DEFINITION, PAYMENT_EVIDENCE, LAYERS, INDICATORS, HISTORY, highestLayer, byConditionBinding };
