/* Data feeds that national medication indicators are computed over.
 *
 * Why this file exists. The multi-domain scan classified each instrument by the feed it runs on,
 * and an audit found that classification largely circular: an agent that already knows the
 * indicator kept a condition denominator can read "the substrate carries conditions" straight off
 * the indicator. The one direction that escapes the objection is the claim that a named national
 * dataset contains no diagnosis, because that is a property of the dataset's own published schema
 * and is established without looking at any indicator.
 *
 * So this file records only feeds whose field list was obtained from the issuing body and read
 * directly, and it records the field list rather than a summary of it. Every entry here is grade
 * `read`. Feeds that could not be checked are in UNVERIFIED and must not be used in a claim.
 *
 * Checked 2026-09-01.
 */
'use strict';

/**
 * @typedef {object} Feed
 * @property {string} id
 * @property {string} name
 * @property {string} operator
 * @property {string[]} fields      Field list exactly as published, or the published contents list.
 * @property {boolean} carriesCondition   Does any field hold a patient diagnosis or indication.
 * @property {boolean} patientLevel       Is a row a patient, or an aggregate.
 * @property {string} howChecked
 * @property {string} source
 */

/** @type {Feed[]} */
const VERIFIED = [
  {
    id: 'scot-pis',
    name: 'Prescriptions in the Community (Prescribing Information System)',
    operator: 'Public Health Scotland',
    fields: [
      'HBT', 'DispLocationCode', 'DMDCode', 'BNFItemCode', 'BNFItemDescription',
      'PrescribedType', 'NumberOfPaidItems', 'PaidQuantity', 'GrossIngredientCost', 'PaidDateMonth',
    ],
    carriesCondition: false,
    patientLevel: false,
    howChecked:
      'Column schema read from the open-data datastore itself, not from a description of it: '
      + 'GET /api/3/action/datastore_search on the current monthly resource returns the field list '
      + 'above and nothing else. There is no patient identifier, no age, no sex and no diagnosis.',
    source: 'https://www.opendata.nhs.scot/dataset/prescriptions-in-the-community',
  },
  {
    id: 'eng-epd',
    name: 'English Prescribing Dataset',
    operator: 'NHS Business Services Authority',
    fields: [
      'BNF chapter / chemical substance / presentation', 'Items', 'Quantity', 'Total Quantity',
      'Net Ingredient Cost', 'Actual Cost', 'ADQ Usage', 'Practice Name', 'Practice Address',
      'Unidentified flag', 'SNOMED code for the BNF presentation',
    ],
    carriesCondition: false,
    patientLevel: false,
    howChecked:
      'Contents list read from the issuing body\'s own release guidance, English Prescribing '
      + 'Dataset Release Guidance v004, 30 April 2025, section "Contents of the dataset". The list '
      + 'is enumerated per GP practice or cost centre and contains no patient identifier and no '
      + 'clinical field. The unit is the practice, not the patient.',
    source: 'https://github.com/NHSBSA-Open-Data/ODP/raw/a3a50d3/EPD_SNOMED_release_guidance_v004.odt',
  },
  {
    id: 'ecdc-esacnet',
    name: 'ESAC-Net antimicrobial consumption surveillance',
    operator: 'European Centre for Disease Prevention and Control',
    fields: ['ATC classification to the fourth level', 'DDD per 1 000 inhabitants per day', 'tonnes per year'],
    carriesCondition: false,
    patientLevel: false,
    howChecked:
      'Read from ECDC\'s surveillance database description. Consumption is reported as an '
      + 'aggregate rate over a population; no patient-level record and no indication is collected.',
    source: 'https://www.ecdc.europa.eu/en/antimicrobial-consumption/surveillance-and-disease-data/database',
  },
];

/**
 * Feeds a claim would need but which could not be checked in this session. Listed so that nothing
 * silently rests on them. The session's web-search budget was exhausted before these were reached.
 */
const UNVERIFIED = [
  {
    id: 'kr-dur',
    name: '의약품안전사용서비스 (DUR) real-time prescribing and dispensing check',
    operator: '건강보험심사평가원',
    question:
      'Does the DUR request message carry 주상병코드 and 임부여부, and if so are they used in any '
      + 'check? This matters because it is the case that would most damage the feed account: a '
      + 'condition present in the message and still absent from the rule.',
    whatIsVerified:
      'The categories DUR checks are known and were read in full from 「환자안전 중심 약제평가 지표 '
      + '개발 연구」 (2021), p.38: within-prescription checks are 병용·연령·임부금기, 안전성 관련 '
      + '사용중지·사용주의, 용량·투여기간·분할주의, 노인주의 의약품, 비용효과적 함량 대상, 약제 '
      + '허가사항 관련 주의; between-prescription checks are 병용금기, 안전성 관련 사용중지, '
      + '동일성분 중복, 효능군 중복. None of these ten categories is defined by a patient diagnosis. '
      + 'The same page fixes the 노인주의 list at 61 ingredients per 식품의약품안전처 공고 제2020-423호.',
    whatIsNot: 'The field list of the DUR message itself.',
  },
];

/** Feeds that are established to contain no patient condition. */
function conditionFreeFeeds() {
  return VERIFIED.filter((f) => !f.carriesCondition);
}

module.exports = { VERIFIED, UNVERIFIED, conditionFreeFeeds };
