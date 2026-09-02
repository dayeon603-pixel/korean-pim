/* Prior work located after five proposed claims were rejected as unevidenced.
 *
 * Why this file exists. A review pass proposed five additions to the manuscript. Each was
 * declined because the specific assertion was false or unsupported. Declining is not the end of
 * the matter: in every case the underlying question was a real one, and the right response is to
 * go and find out. This file records what was found, with bibliographic details taken from
 * PubMed rather than from memory, so that a citation can be checked without a second lookup.
 *
 * Located 2026-09-02 via the PubMed E-utilities API.
 */
'use strict';

/**
 * Each entry states the rejected claim, the real question behind it, and what the evidence says.
 * `verdict` records whether the honest version of the claim survives.
 */
const REJECTED_CLAIMS = [
  {
    id: 'four-continents',
    rejected: 'The four verified datasets represent Asia, Europe, Oceania and North America.',
    whyRejected:
      'False as stated. The four were Scotland, England, the United States and ECDC: two are the '
      + 'same country, and neither Asia nor Oceania appeared.',
    realQuestion: 'Can the verified set be widened so that a breadth claim becomes true?',
    whatWasDone:
      'A fifth national dataset was located and its field list read: the Australian Pharmaceutical '
      + 'Benefits Scheme Item Report, eight columns, header row read from the published CSV. The '
      + 'verified set now spans Europe, North America and Oceania. Asia is still absent, so the '
      + 'four-continent claim remains false and is not made.',
    verdict: 'partially recoverable',
    // The Australian case turned out to carry something better than breadth.
    incidentalFinding:
      'The same scheme yields two artefacts on two feeds. PBS Authority Required listings state an '
      + 'indication the prescriber must assert at approval, and the audit recorded that restriction '
      + 'as retaining the condition axis; the published Item Report used for statistics carries no '
      + 'indication at all. This is the Korean contrast repeated in another country and another '
      + 'programme, and it is stronger evidence than the geographic breadth would have been.',
  },
  {
    id: 'unified-patient-token',
    rejected:
      'The two exceptions cross-reference prescription data with a separate hospital discharge '
      + 'database or diagnostic registry through a unified patient token.',
    whyRejected: 'No evidence for any such mechanism was found in any source.',
    realQuestion: 'Where do the two Part D exceptions actually obtain their conditions?',
    whatWasDone:
      'What is documented is narrower and duller: the point-of-sale safety edits take hospice and '
      + 'cancer status from enrolment and coverage data, and the medication therapy management '
      + 'rule delegates its ten chronic diseases to the plan sponsor rather than computing them. '
      + 'Neither is a record-linkage mechanism.',
    verdict: 'not recoverable',
  },
  {
    id: 'misclassification-aversion',
    rejected:
      'Agencies drop the condition axis because they are more comfortable being structurally blind '
      + 'than computationally imprecise: diagnosis codes carry classification variance, drug codes '
      + 'do not.',
    whyRejected:
      'Contradicted by the primary source. Korea\'s expert panel asked for the diagnosis to be '
      + 'ADDED, on the ground that the drug-based proxy misclassifies. The panel treated the '
      + 'diagnosis as the more accurate identifier, not the less.',
    realQuestion:
      'Independently of that panel, are Korean claims diagnoses accurate enough for an indicator?',
    whatWasDone:
      'They have been validated repeatedly and they perform well. Sensitivity and specificity above '
      + '90 per cent and kappa 0.83 to 0.84 for ischaemic stroke and subarachnoid haemorrhage in '
      + 'national claims [park2016]. Operational definitions built on the same claims are '
      + 'standard practice for other conditions [baek2023, cho2013]. Imprecision of the coded '
      + 'diagnosis is therefore not available as an explanation in this jurisdiction.',
    verdict: 'reversed by the evidence',
  },
  {
    id: 'prior-circularity',
    rejected: 'Previous tracking studies assumed a system captured diagnoses because an indicator required it.',
    whyRejected: 'A criticism of unnamed prior work with nothing behind it.',
    realQuestion: 'What has prior work actually established about diagnosis-linked prescribing indicators?',
    whatWasDone:
      'More than the manuscript credited. Diagnosis-linked antibiotic prescribing indicators have '
      + 'been computed at national scale from routine primary-care records in 278 of 299 Dutch '
      + 'practices, with reliability and validity assessed [eijnde2024]. Feasibility of building '
      + 'quality indicators on routinely collected administrative data, and the limits coding '
      + 'practice imposes on them, have been examined directly [palmer2014]. The manuscript should '
      + 'position against this work rather than against an invented failure in it.',
    verdict: 'replaced by real prior work',
  },
  {
    id: 'domain-grouping',
    rejected:
      'Group the eight criteria families into inpatient/acute, chronic disease management, and '
      + 'high-risk patient safety.',
    whyRejected:
      'A taxonomy the data do not carry, and inaccurate: renal dose adjustment is not an '
      + 'inpatient or acute category.',
    realQuestion: 'Is there an established taxonomy that the instruments could be grouped by?',
    whatWasDone:
      'There is, and it comes from the material itself rather than from outside it. Korea\'s '
      + 'national prescribing-check service classifies its rules into ten categories, read in full '
      + 'from the 2021 development study: within a prescription, 병용금기, 연령금기, 임부금기, '
      + '안전성 관련 사용중지·사용주의, 용량·투여기간·분할주의, 노인주의, 비용효과적 함량, and '
      + '허가사항 관련 주의; between prescriptions, 병용금기, 안전성 관련 사용중지, 동일성분 중복, '
      + 'and 효능군 중복. Not one is defined by a patient diagnosis. That is a grouping with a '
      + 'source and a finding attached, unlike the proposed one.',
    verdict: 'replaced by a sourced taxonomy',
  },
];

/** Bibliographic records, taken from PubMed rather than from memory. */
const REFERENCES = {
  eijnde2024: {
    pmid: '38334365',
    cite: 'van den Eijnde SEJD, et al. Diagnosis-linked antibiotic prescribing quality indicators: '
        + 'demonstrating feasibility using practice-based routine primary care data, reliability, '
        + 'validity and their potential in antimicrobial stewardship. J Antimicrob Chemother '
        + '2024;79(4):767-773.',
    why: 'Direct prior work on the same question, on the substrate this study predicts should keep '
       + 'the condition axis. 299 Dutch general practices, outcomes obtained for 278.',
  },
  palmer2014: {
    pmid: '23584363',
    cite: 'Palmer WL, et al. Meeting the ambition of measuring the quality of hospitals\' stroke '
        + 'care using routinely collected administrative data: a feasibility study. Int J Qual '
        + 'Health Care 2014;25(4):429-436.',
    why: 'Prior feasibility work on administrative data, and it names coding practice as the limit '
       + 'rather than data absence.',
  },
  park2016: {
    pmid: '26365022',
    cite: 'Park TH, et al. Validation of stroke and thrombolytic therapy in Korean National Health '
        + 'Insurance claim data. J Clin Neurol 2016;12(1):42-48.',
    why: 'Korean claims diagnoses validated at kappa 0.83 to 0.84 with sensitivity and specificity '
       + 'above 90 per cent, which removes coded-diagnosis imprecision as an explanation here.',
  },
  cho2013: {
    pmid: '23918169',
    cite: 'Cho SK, et al. Development of an algorithm for identifying rheumatoid arthritis in the '
        + 'Korean National Health Insurance claims database. Rheumatol Int 2013.',
    why: 'Operational definitions on Korean claims are routine practice.',
  },
  baek2023: {
    pmid: '36750233',
    cite: 'Baek JH, et al. Comparison of operational definition of type 2 diabetes mellitus based '
        + 'on data from Korean National Health Insurance Service. Diabetes Metab J 2023.',
    why: 'As above, and recent.',
  },
};

/** Claims whose honest version survived and can therefore be written into the manuscript. */
function usable() {
  return REJECTED_CLAIMS.filter((c) => c.verdict !== 'not recoverable');
}

module.exports = { REJECTED_CLAIMS, REFERENCES, usable };
