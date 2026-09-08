/**
 * KCD bindings the 2022 HIRA report had already authored, and the comorbidity figures it computed
 * on a domestic cohort.
 *
 * ── What this file overturns ──────────────────────────────────────────────
 * This study first held that the academic criteria give no codes for their conditions, so an
 * operating body must author the value sets itself, and that the unallocated burden explained the
 * exclusion of the condition axis. Reading the HIRA report directly established something more
 * precise.
 *
 *   The bindings already exist. Table 22 of that same report, listing disease names and KCD codes
 *   for comorbidity analysis, assigns KCD codes to 13 disease groups, and Table 25 uses those codes
 *   to compute the comorbidity profile of a polypharmacy cohort of older adults.
 *
 * So both the data and the bindings were present. What was missing is the step of applying those
 * bindings to the criteria themselves. The condition axis never entered the candidate pool at all,
 * and the criteria that were adopted carry the drug-only axis. What explains the exclusion is not the
 * absence of a binding but its non-application.
 *
 * ── Source ────────────────────────────────────────────────────────────────
 * Health Insurance Review and Assessment Service. Management Criteria for Inappropriate
 * Polypharmacy in Older Adults. 2022.
 * Publication number G000F8Q-2022-170. Table 22 (p. 59), Table 25 (p. 63), text p. 66.
 * Transcribed by the author from the source PDF on 2026-08-31.
 */
'use strict';

/** Table 22: disease names and KCD codes used for comorbidity analysis, transcribed as printed. */
const TABLE22 = [
  { no: 1, ko: '고혈압', en: 'Hypertension', kcd: ['I10', 'I11', 'I12', 'I13', 'I14', 'I15'] },
  { no: 2, ko: '고지혈증', en: 'Lipidemia', kcd: ['E78'] },
  { no: 3, ko: '당뇨', en: 'Diabetes mellitus', kcd: ['E10', 'E11', 'E12', 'E13', 'E14'] },
  { no: 4, ko: '허혈성심장질환', en: 'Ischemic heart disease', kcd: ['I21', 'I22', 'I23', 'I24', 'I25'], group: '심뇌혈관질환' },
  { no: 4, ko: '심부전', en: 'Heart failure', kcd: ['I50', 'I51', 'I52'], group: '심뇌혈관질환' },
  { no: 4, ko: '뇌졸중', en: 'Stroke (including TIA)', kcd: ['I60', 'I61', 'I62', 'I63', 'I64'], group: '심뇌혈관질환' },
  { no: 5, ko: '위궤양', en: 'Peptic ulcer', kcd: ['K25', 'K26', 'K27', 'K28'] },
  { no: 6, ko: '만성 신질환', en: 'Renal disease', kcd: ['N18'] },
  { no: 7, ko: '간부전', en: 'Hepatic disease', kcd: ['B18', 'B19', 'K70-K77'] },
  { no: 8, ko: '만성 폐색성 폐질환', en: 'COPD', kcd: ['J43', 'J44'], group: '호흡기계질환' },
  { no: 8, ko: '폐렴', en: 'Pneumonia', kcd: ['J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18'], group: '호흡기계질환' },
  { no: 8, ko: '천식', en: 'Asthma', kcd: ['J45', 'J46'], group: '호흡기계질환' },
  { no: 9, ko: '암', en: 'Tumor', kcd: ['C**', 'D00-D48'] },
  { no: 10, ko: '골다공증', en: 'Osteoporosis', kcd: ['M80', 'M81', 'M82'], group: '근골격계질환' },
  { no: 10, ko: '퇴행성 관절염', en: 'Degenerative arthritis', kcd: ['M15', 'M16', 'M17', 'M18', 'M19'], group: '근골격계질환' },
  { no: 11, ko: '치매', en: 'Dementia', kcd: ['F00', 'F01', 'F02', 'F03', 'G30', 'G31'] },
  { no: 12, ko: '골절', en: 'Fracture', kcd: ['S02', 'S12', 'S22', 'S32', 'S42', 'S52', 'S62', 'S72', 'S82', 'S92', 'T02', 'T08', 'T10', 'T12', 'T142'] },
  { no: 13, ko: '우울증', en: 'Depressive disorders', kcd: ['F32', 'F33', 'F38', 'F39', 'F341', 'F348', 'F349', 'F412'] },
];

/** Table 25: comorbidity profile of the 2017 polypharmacy cohort of older adults. Patient counts are
 * in thousands. */
const TABLE25 = {
  cohortSize: 1532000,        // back-computed from 1,036 thousand at 67.6%; agrees with 684,538 at 44.7%
  prevalence: {
    암: 0.058, 고혈압: 0.676, 고지혈증: 0.356, 당뇨: 0.384, 심뇌혈관질환: 0.155,
    위궤양: 0.151, 만성신질환: 0.021, 간부전: 0.089, 호흡기계질환: 0.142,
    근골격계질환: 0.470, 골절: 0.069, 치매: 0.120, 우울증: 0.110,
  },
  comorbidCount: { '0개': 0.020, '1개': 0.126, '2개': 0.295, '3개 이상': 0.559 },
  note: '심평원이 <표 22>의 KCD 코드로 직접 산출한 값이다. 청구 상병코드 기반이므로 '
      + '설문 기반 유병률과 다르다. 예컨대 만성 신질환은 본 표에서 2.1%이나 '
      + '국민건강영양조사의 65세 이상 추정치는 이보다 크게 높다. 진단·코딩된 것만 잡히기 때문이다.',
};

/** Patients in the polypharmacy cohort matched by the drug-only axis of 77 ingredients. Report
 * text, p. 66. */
const DRUG_AXIS_FLAGGED = { n: 684538, share: 0.447 };

/** Those of Table 2's 18 conditions for which Table 22 had already assigned codes. */
const BOUND_BY_TABLE22 = {
  htn: ['I10', 'I11', 'I12', 'I13', 'I14', 'I15'],
  dm: ['E10', 'E11', 'E12', 'E13', 'E14'],
  hf: ['I50', 'I51', 'I52'],
  stroke_secondary: ['I60', 'I61', 'I62', 'I63', 'I64'],
  ulcer: ['K25', 'K26', 'K27', 'K28'],
  ckd: ['N18'],
  copd: ['J43', 'J44'],
  dementia: ['F00', 'F01', 'F02', 'F03', 'G30', 'G31'],
  falls: ['S02', 'S12', 'S22', 'S32', 'S42', 'S52', 'S62', 'S72', 'S82', 'S92'],
};

/** Table 2 conditions absent from Table 22, which this study had to bind itself. */
const NOT_BOUND = ['insomnia', 'parkinson', 'arrhythmia', 'age80_primary',
  'constipation', 'bph', 'hyponatremia', 'bleeding', 'glaucoma'];


/** Tables 35 and 37: adverse health outcomes associated with inappropriate polypharmacy.
 *
 * These tables matter less for their outcome figures than for the covariates in the models. Models 2
 * and 3 adjust for comorbidity (cancer, cardio-cerebrovascular disease, chronic kidney disease,
 * respiratory disease, dementia, depression) as confounders. The KCD bindings of Table 22 are
 * therefore used three times within this report.
 *   (1) describing the cohort's comorbidity profile, Table 25
 *   (2) comparing characteristics across inappropriate-polypharmacy groups
 *   (3) as covariates in the health-outcome models, Table 37
 * They are not used in the criteria themselves. The issue is where the binding was applied, not
 * whether one existed.
 */
const OUTCOMES = {
  rates: {   // Table 35: incidence by inappropriate-polypharmacy status
    inappropriate: { 입원: 0.318, 응급실: 0.184, 사망: 0.025 },
    appropriate: { 입원: 0.235, 응급실: 0.129, 사망: 0.018 },
  },
  aOR: {     // Table 37, Model 3, adjusted for sex, age, insurance type, comorbidity, ECI, outpatient visits
    입원: { est: 1.32, ci: [1.31, 1.34] },
    응급실: { est: 1.34, ci: [1.32, 1.35] },
    사망: { est: 1.35, ci: [1.30, 1.39] },
  },
  adjustedComorbidities: ['암', '심뇌혈관질환', '만성 신질환', '호흡기계질환', '치매', '우울증'],
  note: 'Model3 은 동반질환을 보정변수로 사용한다. 보정에 쓴 6개 중 4개(심뇌혈관질환·만성 신질환·'
      + '호흡기계질환·치매)가 한국형 PIM 2018 표2의 조건과 대응한다. 건강결과 예측에 유의한 변수로 '
      + '인정한 동반질환이, 판정 기준에서는 후보에도 오르지 않았다.',
};

/** Those of the six covariates that correspond to a Table 2 condition. */
const ADJUSTED_MATCHING_TABLE2 = {
  심뇌혈관질환: ['hf', 'stroke_secondary'],
  '만성 신질환': ['ckd'],
  호흡기계질환: ['copd'],
  치매: ['dementia'],
};

module.exports = {
  OUTCOMES, ADJUSTED_MATCHING_TABLE2,
  TABLE22, TABLE25, DRUG_AXIS_FLAGGED, BOUND_BY_TABLE22, NOT_BOUND,
  source: '건강보험심사평가원 G000F8Q-2022-170, <표 22>(59쪽)·<표 25>(63쪽)·본문 66쪽',
  get boundCount() { return Object.keys(BOUND_BY_TABLE22).length; },
};
