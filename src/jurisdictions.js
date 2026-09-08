/**
 * Retention of the condition-dependent axis by operating layer, across six jurisdictions.
 *
 * Background: this repository first observed, from the Korean case alone, that the condition axis of
 *   an academic criterion is dropped on the way to a national operating standard (18 conditions in
 *   Table 2, none at HIRA). But N=1 cannot be distinguished from a national peculiarity, so the same
 *   question was put to every jurisdiction that could be adjudicated from primary documents.
 *
 * Result: the hypothesis was refuted. National operating instruments that keep the condition axis in
 *   computable form do exist (Scotland, England). Two regularities were observed instead, and they
 *   explain more.
 *
 *   (i) The data condition: does the data the indicator runs on carry a diagnosis?
 *   (ii) A layer gradient: the closer an indicator sits to payment, the more often the condition
 *        axis disappears.
 *
 * Layer definitions. Within one country the answer varies by layer, so the unit of analysis is the
 * layer, not the country.
 *   guideline  : nationally issued guidance, not tied to payment.
 *   cds        : decision logic embedded in a national clinical system.
 *   measure    : a quality-indicator specification. It is computed, but no money moves by itself.
 *   rating     : public rating. The result is published.
 *   payment    : reimbursement and financial-incentive rules.
 *
 * Recording conventions
 *   conditionCount : the number of condition-dependent items actually counted in the primary
 *                    document. null where it could not be counted.
 *   axisRetained   : whether the drug-disease axis is present in that layer's logic. null where it
 *                    cannot be adjudicated.
 *   verified       : whether the entry rests on a primary document from the government or issuing
 *                    body.
 *   verifiedBy     : the grade of that evidence. The two are different in kind and recorded apart.
 *                    'read'  = on 2026-08-27 the document was opened and the sentence or row read
 *                              directly.
 *                    'agent' = a primary-document URL and a direct quotation were obtained during
 *                              research, but no person opened the document. The quotation is not
 *                              guaranteed accurate.
 *                    Anything a sentence in the manuscript rests on must be 'read'.
 *
 * Never done here: comparing item counts across jurisdictions. The counting unit differs by country
 *   (ingredient, ingredient group, drug class, condition statement, indicator rate). What can be
 *   compared is whether the axis is present, and at which layer it disappears.
 */
'use strict';

/** @typedef {'guideline'|'cds'|'measure'|'rating'|'payment'} Layer */

const JURISDICTIONS = [
  // ── Korea ───────────────────────────────────────────────────────────────
  {
    id: 'kr-hira', region: 'Korea', layer: 'payment',
    instrument: 'HIRA 「노인의 부적절한 다약제 사용 관리 기준」, standard for managing inappropriate polypharmacy in older adults (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    academicBasis: 'Korean PIM 2018 (Kim MY et al.): 63 Table 1 items + 18 Table 2 conditions',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'read',   // checked against the appendix itself (test/compare_ingredient_level.js, 61/63)
    note: '77 ingredients in 14 classes settled from 297 candidates. The "Korea PIM 63" of the '
        + 'candidate-source table is Table 1; the 18 conditions of Table 2 do not appear in the '
        + 'candidate list at all. 61 of 63 (96.8%) of the drug axis was reviewed, and 0% of the '
        + 'condition axis.',
  },

  // ── Japan ───────────────────────────────────────────────────────────────
  {
    id: 'jp-mhlw', region: 'Japan', layer: 'guideline',
    instrument: '厚生労働省「高齢者の医薬品適正使用の指針(総論編)」別表2 (2018-05)',
    source: 'mhlw.go.jp/content/11121000/kourei-tekisei_web.pdf',
    academicBasis: '日本老年医学会「高齢者の安全な薬物療法ガイドライン2015」'
                 + '(stated at the foot of the appendix table as 「より改変引用」, adapted and cited)',
    conditionCount: 0,
    axisRetained: false,
    verifiedBy: 'read',   // 2026-08-27, appendix 2 in full and the whole document read directly
    verified: true,
    note: 'The dedicated 「対象となる患者群」 (target patient group) column that the academic criteria '
        + 'carried disappears in the national guideline. Appendix Table 2 has four columns, '
        + '「分類 / 薬物(クラス又は一般名) / 推奨される使用法 / 主な薬物有害事象・理由」, and '
        + '「対象となる患者群」 appears zero times in the whole document (confirmed by direct search). '
        + 'Twelve data rows. The condition was not deleted, though: it moved into the prose of '
        + '「推奨される使用法」. Five rows preserve a disease condition there — oral corticosteroids '
        + '「慢性安定期のCOPD患者には使用すべきでない」, non-selective beta blockers '
        + '「気管支喘息やCOPDでは…気管支喘息では禁忌」, the hypertension and prostatic hyperplasia '
        + 'branch for alpha blockers, muscarinic antagonists 「前立腺肥大症の場合は…」, and '
        + 'aldosterone antagonists 「K高値、腎機能低下の症例では」. This is a demotion from an axis of '
        + 'adjudication to a sentence, not a deletion. Having left the machine-readable column, it '
        + 'cannot be used to compute an indicator.',
  },
  {
    id: 'jp-shinryo', region: 'Japan', layer: 'payment',
    instrument: '診療報酬 A250 薬剤総合評価調整加算 · B008-2 · 調剤報酬 服用薬剤調整支援料1·2',
    source: '厚生労働省 診療報酬点数表, the fee schedule, reflecting the 令和8年度 revision',
    academicBasis: 'the same (JGS2015)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: 'Every axis is a count: six or more oral drugs for four weeks or more, a reduction of two '
        + 'or more at discharge, four or more antipsychotics on a 精神病棟 psychiatric ward. The PIM '
        + 'list is not in the body of the eligibility criteria; it is reached only through the '
        + 'reference phrase 「〜等を参考にすること」. The 2026 revision leaves the axis unchanged '
        + '(100点 to 160点).',
  },

  // ── United States ───────────────────────────────────────────────────────
  {
    id: 'us-hedis-dde', region: 'USA', layer: 'measure',
    instrument: 'NCQA HEDIS 「Potentially Harmful Drug-Disease Interactions in Older Adults (DDE)」',
    source: 'wpcdn.ncqa.org — MY2025 specification',
    academicBasis: 'AGS Beers Criteria 2023 (the drug-disease axis)',
    conditionCount: 3,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, MY2025 specification read directly; three rates and their numerator and
                          // denominator structure confirmed
    note: 'Three conditions: history of falls, dementia, chronic kidney disease. The disease is the '
        + 'eligible population (denominator) and the drug is the numerator, which implements '
        + 'Beers Table 3 adjudication directly on claims data. Following the 2023 Beers revision, '
        + 'anticholinergics were added to the falls rate, an extension, and it survives in the '
        + 'final MY2025 specification. Only the Total rate was retired, so "DDE was retired" is '
        + 'not accurate.',
  },
  {
    id: 'us-ncqa-rating', region: 'USA', layer: 'rating',
    instrument: 'NCQA Health Plan Ratings 2026, list of required performance measures',
    source: '2026-HPR-List-of-Required-Performance-Measures (final, 2026-03-27) and '
          + 'Overview-Memo_HPR-2026_HPR-2027-Public-Comment (recommendation and rationale)',
    academicBasis: 'the same (Beers 2023)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, both documents read directly; the quotation below was checked word for word
    note: 'Revision history of the final list: "Removed the Potentially Harmful Drug-Disease Interactions in Older Adults '
        + '(DDE) and Follow-Up After High-Intensity Care for Substance Use Disorder (FUI) measures from '
        + 'the Medicare measure list." What remains is the drug-only measure DAE, at weight 1. '
        + 'What matters is that the removal was not an arbitrary judgement but the application of '
        + 'a written selection principle. Principle 4 of the same memo reads "Eliminate '
        + 'redundancy. ... For highly correlated measures, choose the measure with the most '
        + 'desirable statistical properties.", and the reason given for applying it to DDE is '
        + '"The measure is not used in any external programs and is also highly correlated with the Use of '
        + 'High-Risk Medications in Older Adults (DAE) measure." The second half of that is a claim '
        + 'data can settle, and test/test_ncqa_correlation.js tests it against the Korean criteria.',
    testableClaim: 'ncqa-correlation',
  },
  {
    id: 'us-star', region: 'USA', layer: 'payment',
    instrument: 'CMS 2026 Part D Star Ratings, drug measures D08-D12',
    source: 'CMS Part D Star Ratings technical notes',
    academicBasis: 'the same (Beers 2023)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: 'Among the five drug measures that carry star weight (D08-D12) there is no older-adult PIM '
        + 'measure at all, not even on the drug-only axis. The one conditional older-adult PIM '
        + 'measure, APD (dementia with an antipsychotic), has existed solely as a display measure '
        + 'since 2018 and has never counted toward a star rating in any year.',
  },

  // ── England ─────────────────────────────────────────────────────────────
  {
    id: 'eng-pincer', region: 'England', layer: 'cds',
    instrument: 'PINCER National Prescribing Safety Indicators (13 indicators)',
    source: 'PRIMIS/Nottingham PINCER progress report (2020-07) · national rollout by NHS England and the AHSN Network',
    academicBasis: 'not derived from Beers or STOPP. An all-ages hazardous-prescribing indicator set in the Avery/Howard line',
    conditionCount: 5,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, every indicator in Appendix 1 checked directly
    note: 'Five of the thirteen require a diagnosis code in the denominator: B2 and B3, a Read code '
        + 'for peptic ulcer with an NSAID or antiplatelet; F2, a heart failure diagnosis with an '
        + 'oral NSAID; G2, chronic renal failure with an oral NSAID; H2, a Read code for asthma '
        + 'with a non-selective beta blocker. The appendix table has 14 rows, but J2 (FBC) and J3 '
        + '(LFT) are two tests within one indicator, so the body of the source counts "13 evidence-based '
        + 'prescribing safety indicators". On scale, the source says only "a minimum of 23.35 '
        + 'million patient records" across 2,430 practices, so no more precise figure is used '
        + 'here. Only two indicators name an older age in the denominator, A2 (65 and over) and '
        + 'I2 (75 and over).',
  },
  {
    id: 'eng-iif', region: 'England', layer: 'payment',
    instrument: 'NHS England Network Contract DES — Investment and Impact Fund 2022/23',
    source: 'england.nhs.uk B1963-iii Network Contract IIF Implementation Guidance (2022-09)',
    academicBasis: 'the PINCER indicator set',
    conditionCount: 0,
    axisRetained: false,
    verifiedBy: 'read',   // 2026-08-27, the nine SMR-01A denominator items and the SMR-02A to D definitions
                          // checked directly
    verified: true,
    note: 'The split happens between stages inside one financial incentive. The denominator of the '
        + 'case-finding indicator SMR-01A has nine items, five of them conditional: a history of '
        + 'peptic ulcer with an NSAID; a history of peptic ulcer with an antiplatelet; a heart '
        + 'failure diagnosis with an oral NSAID; eGFR below 45 with an oral NSAID; an asthma '
        + 'diagnosis with a non-selective beta blocker. The diagnosis appears in the text of the '
        + 'payment rule itself — '
        + '"Patients aged 18 or over with an unresolved heart failure diagnosis prescribed an oral NSAID." '
        + 'The denominators of the indicators that actually pay, SMR-02A to SMR-02D, are all drug '
        + 'with drug or age with drug: 02A NSAID plus anticoagulant, 02B NSAID at 65 and over, '
        + '02C anticoagulant plus antiplatelet, 02D aspirin plus another antiplatelet. No '
        + 'diagnosis appears in any of them. The condition axis is used to find the cases and '
        + 'disappears at the stage where money attaches.',
  },

  // ── Scotland ────────────────────────────────────────────────────────────
  {
    id: 'sct-poly', region: 'Scotland', layer: 'cds',
    instrument: 'Scottish Government 「Polypharmacy Guidance 2026–2029」 Appendix D1 Table 40',
    source: 'gov.scot (published 2026-03-02)',
    academicBasis: 'the source records that Beers and STOPP/START were explicitly reviewed during '
                 + 'development. Consensus by the modified RAND/UCLA Appropriateness Method',
    conditionCount: 6,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, all 19 data rows of Table 40 checked
    note: 'The strongest counterexample. Six of the 19 data rows require a disease diagnosis in the '
        + 'denominator: dementia with HbA1c below 53; an asthma diagnosis with a non-selective '
        + 'beta blocker; CKD stage 4 or 5, or eGFR below 30, with metformin; CKD stage 5, or eGFR '
        + 'below 10, with colchicine; a history of breast or oestrogen-dependent cancer with '
        + 'oestrogen; atrial fibrillation with a CHA2DS2-VASc score and no anticoagulant. Counting '
        + 'the four rows based on a laboratory value or clinical state brings it to ten. It is '
        + 'actually built into GP prescribing systems nationally through the Scottish Therapeutics '
        + 'Utility and the Right Decision Service. Government-issued, resting explicitly on '
        + 'academic older-adult PIM criteria, keeping the condition axis in a machine-adjudicable '
        + 'form, and deployed in a national clinical system: it is the only confirmed case that '
        + 'meets all four.',
  },

  // ── Sweden ──────────────────────────────────────────────────────────────
  {
    id: 'se-indicator', region: 'Sweden', layer: 'rating',
    instrument: 'Socialstyrelsen national indicator 「Äldre med läkemedel som bör undvikas」',
    source: 'Socialstyrelsen indicator library',
    academicBasis: 'Socialstyrelsen 「Indikatorer för god läkemedelsterapi hos äldre」(2017) — '
                 + 'the document itself distinguishes two axes explicitly, läkemedelsspecifika '
                 + '(drug-specific) and diagnosspecifika (diagnosis-specific)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: 'The national document keeps both axes, yet the indicator actually published is the '
        + 'drug-only one. Denominator the population aged 75 and over, numerator 31 ATC entries, '
        + 'no diagnosis condition at all. The number of items on the diagnosspecifika axis is '
        + 'unverified: the 2017 PDF itself could not be obtained.',
  },

  // ── Taiwan ──────────────────────────────────────────────────────────────
  {
    id: 'tw-nhia-pim', region: 'Taiwan', layer: 'measure',
    instrument: 'NHIA 「醫院以病人為中心門診整合照護計畫」 監測指標4',
    source: 'nhi.gov.tw',
    academicBasis: 'updated PIM-Taiwan criteria (2018): 140 drug entries + 9 conditions',
    conditionCount: null,
    axisRetained: null,
    verified: true,
    verifiedBy: 'agent',
    note: 'Unspecified. Across all 13 pages the document says only 「以2015年Beer\'s criteria計算」, '
        + 'computed using the 2015 Beers criteria. It never states which table, how many items, or '
        + 'how they map to insurance drug codes, so adoption or exclusion cannot be adjudicated '
        + 'from the source. Taiwan is not a case of dropping the condition axis. It is a case of '
        + 'never establishing older-adult PIM as a national operating standard in the first place.',
  },
  {
    id: 'tw-quality', region: 'Taiwan', layer: 'rating',
    instrument: 'NHIA 「用藥品質指標」 西醫基層總額',
    source: 'med.nhi.gov.tw/ihqe0000/proW004.html',
    academicBasis: 'none. The indicator page cites Beers, STOPP and PIM-Taiwan zero times, and sets no age limit',
    conditionCount: 2,
    axisRetained: true,
    verified: true,
    verifiedBy: 'agent',
    note: 'These are individual disease-contraindication indicators unrelated to older-adult '
        + 'criteria, so this is not a case of the older-adult PIM condition axis surviving. It '
        + 'does, however, directly refute the defence that conditional adjudication cannot be '
        + 'implemented on claims data. Drawing on the 病史檔 history file, two rates are computed '
        + 'quarterly and published by institution: beta blocker use (C07AA/C07AB) in hypertensive '
        + 'patients with a history of second- or third-degree AV block (I441/I442/I443, pacemaker '
        + 'users excluded), and serum potassium testing (09022C) in patients with a history of '
        + 'hyperkalaemia who are on a 保鉀型利尿劑 potassium-sparing diuretic.',
  },
];

/** Jurisdictions that could not be adjudicated, or that have no comparable instrument. Recorded
 * separately so the sample is not inflated. */
const NOT_ASSESSABLE = [
  { region: 'France', reason: 'Neither primary source could be reached: the AMI-Alzheimer national '
    + 'alert indicator and the ROSP older-adult drug indicators (has-sante.fr stream aborted, '
    + 'ameli.fr blocked as a bot). It remains possible that this is a case of the condition axis '
    + 'surviving at a payment-linked layer.' },
  { region: 'Netherlands', reason: 'STOP-NL V2 (2026-02-16) was reorganised by clinical topic, but the '
    + 'national quality indicator set was not examined.' },
  { region: 'Germany', reason: 'PRISCUS 2.0 is an academic list, and comorbidity attaches to it only as '
    + 'an annotation in the detailed edition rather than as a separate axis of adjudication. '
    + 'National operating indicators were not examined.' },
  { region: 'Ireland', reason: 'There is no comparator at all. All three KPIs of the HSE MMP 2026 '
    + 'national plan are cost or switching-rate measures, and there are zero national KPIs for '
    + 'older-adult PIM. One thing is direct evidence for hypothesis (i), the data-condition '
    + 'hypothesis: a study on the HSE-PCRS national claims database states its exclusion reason '
    + 'as "The lack of diagnostic information in the database limited the applicability of all of '
    + 'the STOPP criteria."' },
];

// The records carry English region labels. These are the Korean renderings, kept because the
// accompanying manuscript is written in Korean and names the jurisdictions in Korean.
const REGION_KO = {
  Korea: '한국', Japan: '일본', USA: '미국', England: '잉글랜드', Scotland: '스코틀랜드',
  Sweden: '스웨덴', Taiwan: '대만', France: '프랑스', Netherlands: '네덜란드',
  Germany: '독일', Ireland: '아일랜드',
};

const LAYER_ORDER = ['guideline', 'cds', 'measure', 'rating', 'payment'];
const LAYER_KO = {
  guideline: '국가 지침', cds: '임상의사결정지원', measure: '품질지표 사양',
  rating: '공개 등급평가', payment: '지불·재정 인센티브',
};
// The Korean labels above are kept because the accompanying manuscript is written in Korean and
// quotes them. These are the same five layers for English-language output.
const LAYER_EN = {
  guideline: 'national guideline', cds: 'clinical decision support', measure: 'quality measure spec',
  rating: 'public rating', payment: 'payment incentive',
};

/** Retention of the condition axis tallied by layer. Entries that could not be adjudicated (null)
 * are excluded from the denominator.
 *
 * @param {{readOnly?: boolean}} [opt] With readOnly=true, only entries a person read directly are
 *   counted. The full tally includes agent-reported entries, so comparing the two is how to check
 *   that the gradient does not depend on the grade of evidence. If they disagree, the manuscript must
 *   say so.
 */
function byLayer(opt) {
  const pool = opt && opt.readOnly ? JURISDICTIONS.filter((j) => j.verifiedBy === 'read') : JURISDICTIONS;
  return LAYER_ORDER.map((layer) => {
    const rows = pool.filter((j) => j.layer === layer);
    const judged = rows.filter((j) => j.axisRetained !== null);
    return {
      layer,
      layerKo: LAYER_KO[layer],
      layerEn: LAYER_EN[layer],
      total: rows.length,
      judged: judged.length,
      retained: judged.filter((j) => j.axisRetained).length,
      lost: judged.filter((j) => !j.axisRetained).length,
    };
  });
}

/** Counterexamples to the hypothesis that the condition axis is always dropped on the way to a
 * national operating standard. */
function counterExamples() {
  return JURISDICTIONS.filter((j) => j.axisRetained === true);
}

module.exports = {
  JURISDICTIONS, NOT_ASSESSABLE, LAYER_ORDER, LAYER_KO, LAYER_EN, REGION_KO,
  byLayer, counterExamples,
  /** Number of adjudicable jurisdiction-layers, which is the sample size reported as N. */
  get assessableCount() { return JURISDICTIONS.filter((j) => j.axisRetained !== null).length; },
  get regionCount() { return new Set(JURISDICTIONS.map((j) => j.region)).size; },
};
