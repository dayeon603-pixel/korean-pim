/* Within-system comparisons: one body, two artefacts, two outcomes.
 *
 * Why these matter more than a cross-country tabulation. Comparing countries confounds the coding
 * system, the claims infrastructure, the assessment methodology and the operating body all at once.
 * A comparison inside one body holds all of that fixed, so whatever differs between its two
 * artefacts is a short list. Every row here was read in a primary document.
 *
 * `feed` is the property the paper argues from. Where two artefacts of one body differ only in the
 * feed they are computed over, the feed is doing the work.
 */
'use strict';

/**
 * @typedef {object} Artefact
 * @property {string} name
 * @property {string} feed          What the artefact is computed over.
 * @property {boolean} conditionAxis
 * @property {string} evidence      What was read, and what it says.
 */

const SYSTEMS = [
  {
    id: 'kr-hira',
    body: '건강보험심사평가원 (Health Insurance Review and Assessment Service)',
    country: 'Korea',
    // Seven fielded indicators in one programme, six of them diagnosis-bound.
    artefacts: [
      {
        name: 'Antibiotic indicators in the drug-benefit appropriateness assessment',
        feed: 'health-insurance claims, which carry a mandatory KCD diagnosis on every line',
        conditionAxis: true,
        evidence: 'The acute upper respiratory infection indicator is defined on the agency\'s own '
                + 'indicator page as antibiotic prescribing for J00-J06 over total visits. It is '
                + 'graded on five bands, entered the clinic-level differential payment programme in '
                + '2013, and the adjustment was widened in 2017 from one per cent to a maximum of five.',
      },
      {
        name: '노인주의 의약품 처방률 (elderly-medication indicator)',
        feed: 'the same claims',
        conditionAxis: false,
        evidence: 'Denominator stated as 전체상병, every diagnosis. Introduced 2023 as a monitoring '
                + 'indicator, a decade after the payment programme began. The development study '
                + 'records a panel proposing a dementia diagnosis denominator in July 2021; it was '
                + 'not adopted.',
      },
    ],
    differsIn: 'not the feed — both run on the same claims. Severability and attribution.',
  },
  {
    id: 'eng-iif',
    body: 'NHS England',
    country: 'England',
    // The split happens inside a single financial instrument.
    artefacts: [
      {
        name: 'Investment and Impact Fund 2022/23, case-finding denominator SMR-01A',
        feed: 'primary-care practice records',
        conditionAxis: true,
        evidence: 'Five of its nine denominator items name a diagnosis, written into the text of a '
                + 'payment rule: "Patients aged 18 or over with an unresolved heart failure '
                + 'diagnosis prescribed an oral NSAID."',
      },
      {
        name: 'Investment and Impact Fund 2022/23, paid indicators SMR-02A to SMR-02D',
        feed: 'the same practice records',
        conditionAxis: false,
        evidence: 'All four denominators are drug with drug or age with drug. No diagnosis appears '
                + 'in any of them.',
      },
    ],
    differsIn: 'not the feed — both run on the same records. What changes is that money attaches.',
  },
  {
    id: 'us-ncqa',
    body: 'National Committee for Quality Assurance',
    country: 'United States',
    artefacts: [
      {
        name: 'HEDIS potentially harmful drug-disease interactions in older adults',
        feed: 'health-plan claims',
        conditionAxis: true,
        evidence: 'Three condition-conditioned rates for falls history, dementia and chronic kidney '
                + 'disease. One was extended at the 2023 criteria update and survives in the MY2025 '
                + 'specification.',
      },
      {
        name: 'Health Plan Ratings 2026 required performance measures',
        feed: 'the same claims',
        conditionAxis: false,
        evidence: 'The final list removes that measure and keeps the drug-only one. The reason is '
                + 'stated: "The measure is not used in any external programs and is also highly '
                + 'correlated with the Use of High-Risk Medications in Older Adults (DAE) measure."',
      },
    ],
    differsIn: 'not the feed — both run on the same claims. A stated selection principle.',
  },
  {
    id: 'au-pbs',
    body: 'Australian Government Department of Health',
    country: 'Australia',
    artefacts: [
      {
        name: 'Authority Required listings',
        feed: 'the approval transaction, where the prescriber asserts an indication',
        conditionAxis: true,
        evidence: 'Restriction text names the indication, for example acute bacterial enterocolitis '
                + 'or complicated urinary tract infection. Reimbursement does not exist outside it.',
      },
      {
        name: 'PBS item report',
        feed: 'the published statistical extract',
        conditionAxis: false,
        evidence: 'Eight columns: Year, Item_number, State, Scheme, Month, Patient_Category, '
                + 'Services, Benefits. No indication and no patient identifier.',
      },
    ],
    differsIn: 'the feed. One scheme, two artefacts, two feeds, two outcomes.',
  },
  {
    id: 'sct-eptd',
    body: 'Scottish Government, Effective Prescribing and Therapeutics division',
    country: 'Scotland',
    // The cleanest case: the two artefacts differ in nothing but the feed.
    artefacts: [
      {
        name: 'Polypharmacy case-finding indicators in the Scottish Therapeutics Utility',
        feed: 'the GP practice clinical record',
        conditionAxis: true,
        evidence: 'Six of the guidance\'s case-finding rules require a diagnosis, among them dementia '
                + 'with an HbA1c threshold, asthma with a non-selective beta-blocker, and chronic '
                + 'kidney disease stage 4 or 5 with metformin. The division\'s own site records a '
                + 'suite of 69 case-finding indicators built into the Utility for practices to run.',
      },
      {
        name: 'National Therapeutic Indicators',
        feed: 'the national prescribing dataset, ten columns, no diagnosis',
        conditionAxis: false,
        evidence: 'Published by Public Health Scotland as official statistics and commissioned by '
                + 'the same division. The published example indicator is people prescribed strong '
                + 'opioids for more than two years as a proportion of all people prescribed strong '
                + 'opioids: drug and duration only.',
      },
    ],
    differsIn: 'the feed, and nothing else that is visible. One division, two artefacts.',
  },
];

/** Systems where the two artefacts run on different feeds; the feed is then the operative difference. */
function feedDifference() {
  return SYSTEMS.filter((s) => s.artefacts[0].feed !== s.artefacts[1].feed
    && !/the same/.test(s.artefacts[1].feed));
}

/** Systems where both artefacts share a feed, so something other than data decides. */
function sameFeed() {
  return SYSTEMS.filter((s) => /the same/.test(s.artefacts[1].feed));
}

module.exports = { SYSTEMS, feedDifference, sameFeed };
