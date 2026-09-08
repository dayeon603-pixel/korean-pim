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
    id: 'kr-hira', region: '한국', layer: 'payment',
    instrument: '심평원 「노인의 부적절한 다약제 사용 관리 기준」 (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    academicBasis: '한국형 PIM 2018 (Kim MY et al.) 표1 63 + 표2 18조건',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'read',   // checked against the appendix itself (test/compare_ingredient_level.js, 61/63)
    note: '후보 297개 중 77성분·14계열 확정. 후보 출처표의 "Korea PIM 63"은 표1이며 '
        + '표2 18개 조건은 후보 목록에조차 없다. 성분 축은 61/63(96.8%) 검토, 조건 축은 0%.',
  },

  // ── Japan ───────────────────────────────────────────────────────────────
  {
    id: 'jp-mhlw', region: '일본', layer: 'guideline',
    instrument: '厚生労働省「高齢者の医薬品適正使用の指針(総論編)」別表2 (2018-05)',
    source: 'mhlw.go.jp/content/11121000/kourei-tekisei_web.pdf',
    academicBasis: '日本老年医学会「高齢者の安全な薬物療法ガイドライン2015」'
                 + '(별표 말미에 「より改変引用」으로 명기)',
    conditionCount: 0,
    axisRetained: false,
    verifiedBy: 'read',   // 2026-08-27, appendix 2 in full and the whole document read directly
    verified: true,
    note: '학회 기준이 갖고 있던 「対象となる患者群」 전용 열이 국가 지침에서 사라진다. '
        + '별표2의 열 구성은 「分類 / 薬物(クラス又は一般名) / 推奨される使用法 / 主な薬物有害事象・理由」 '
        + '4열이며, **「対象となる患者群」은 문서 전체에서 0회 출현한다**(직접 검색 확인). '
        + '데이터 12행. 다만 조건이 삭제된 것이 아니라 「推奨される使用法」 산문 안으로 옮겨갔다. '
        + '경구 스테로이드 「慢性安定期のCOPD患者には使用すべきでない」, 비선택성 β차단제 '
        + '「気管支喘息やCOPDでは…気管支喘息では禁忌」, α차단제의 고혈압·전립선비대 분기, '
        + '무스카린 수용체 길항제 「前立腺肥大症の場合は…」, 알도스테론 길항제 「K高値、腎機能低下の症例では」 '
        + '등 5행이 질환 조건을 보존한다. **삭제가 아니라 판정 축에서 문장으로의 강등**이다. '
        + '기계가 읽을 수 있는 열에서 빠졌으므로 지표 산출에는 쓸 수 없다.',
  },
  {
    id: 'jp-shinryo', region: '일본', layer: 'payment',
    instrument: '診療報酬 A250 薬剤総合評価調整加算 · B008-2 · 調剤報酬 服用薬剤調整支援料1·2',
    source: '厚生労働省 診療報酬点数表 (令和8年度 개정 반영)',
    academicBasis: '동일 (JGS2015)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: '판정축이 전부 개수다(내복 4주 이상 6종류 이상, 퇴원시 2종류 이상 감소, '
        + '精神病棟 抗精神病薬 4종류 이상). PIM 리스트는 산정요건 본문이 아니라 '
        + '「〜等を参考にすること」 참조문구로만 연결된다. 2026 개정에서도 축은 불변(100点→160点).',
  },

  // ── United States ───────────────────────────────────────────────────────
  {
    id: 'us-hedis-dde', region: '미국', layer: 'measure',
    instrument: 'NCQA HEDIS 「Potentially Harmful Drug-Disease Interactions in Older Adults (DDE)」',
    source: 'wpcdn.ncqa.org — MY2025 사양',
    academicBasis: 'AGS Beers Criteria 2023 (drug-disease 축)',
    conditionCount: 3,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, MY2025 specification read directly; three rates and their numerator and
                          // denominator structure confirmed
    note: '낙상력·치매·만성콩팥병 3개 조건. 질환=적격모집단(분모) / 약물=분자 구조로, '
        + 'Beers Table 3형 판정을 청구데이터 위에서 그대로 구현한다. '
        + '2023 Beers 개정에 맞춰 낙상 rate에 항콜린제를 **추가**(확장)했고 MY2025 확정본에 존속한다. '
        + '폐지된 것은 Total rate 하나뿐이므로 "DDE 폐지"는 사실이 아니다.',
  },
  {
    id: 'us-ncqa-rating', region: '미국', layer: 'rating',
    instrument: 'NCQA Health Plan Ratings 2026 필수 성과지표 목록',
    source: '2026-HPR-List-of-Required-Performance-Measures (2026-03-27 최종본) 및 '
          + 'Overview-Memo_HPR-2026_HPR-2027-Public-Comment (권고·사유)',
    academicBasis: '동일 (Beers 2023)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, both documents read directly; the quotation below was checked word for word
    note: '최종본 개정이력: "Removed the Potentially Harmful Drug-Disease Interactions in Older Adults '
        + '(DDE) and Follow-Up After High-Intensity Care for Substance Use Disorder (FUI) measures from '
        + 'the Medicare measure list." 잔존은 약물 단독 지표 DAE(가중치 1)뿐. '
        + '**제거가 임의 판단이 아니라 명문화된 선정 원칙의 적용이라는 점이 중요하다.** '
        + '같은 메모의 원칙 4는 "Eliminate redundancy. ... For highly correlated measures, choose the '
        + 'measure with the most desirable statistical properties."이고, DDE에 이 원칙을 적용한 사유가 '
        + '"The measure is not used in any external programs and is also highly correlated with the Use of '
        + 'High-Risk Medications in Older Adults (DAE) measure."다. '
        + '뒷부분은 데이터로 참·거짓을 가릴 수 있다 → test/test_ncqa_correlation.js 에서 한국 기준으로 검정한다.',
    testableClaim: 'ncqa-correlation',
  },
  {
    id: 'us-star', region: '미국', layer: 'payment',
    instrument: 'CMS 2026 Part D Star Ratings 약물지표 D08–D12',
    source: 'CMS Part D Star Ratings 기술노트',
    academicBasis: '동일 (Beers 2023)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: '별점 산정 약물지표 5개(D08–D12)에 노인 PIM 지표가 약물 단독 축조차 0개다. '
        + '유일한 조건부 노인 PIM 지표 APD(치매×항정신병약)는 2018년 이래 전 기간 display measure로만 '
        + '존속해 단 한 해도 별점에 반영된 적이 없다.',
  },

  // ── England ─────────────────────────────────────────────────────────────
  {
    id: 'eng-pincer', region: '잉글랜드', layer: 'cds',
    instrument: 'PINCER National Prescribing Safety Indicators (13개)',
    source: 'PRIMIS/Nottingham PINCER progress report (2020-07) · NHS England·AHSN Network 전국 확산',
    academicBasis: 'Beers/STOPP 파생 아님. Avery/Howard 계열 전연령 위험처방 지표',
    conditionCount: 5,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, every indicator in Appendix 1 checked directly
    note: '13개 중 5개가 진단코드를 분모로 요구한다(B2·B3 소화성궤양 Read code + NSAID/항혈소판제, '
        + 'F2 심부전 진단 + 경구 NSAID, G2 만성신부전 + 경구 NSAID, H2 천식 Read code + 비선택성 β차단제). '
        + '부록 표는 14행이지만 J2(FBC)·J3(LFT)이 한 지표의 두 검사라 원문 본문은 "13 evidence-based '
        + 'prescribing safety indicators"로 센다. 검색 규모는 원문이 "a minimum of 23.35 million patient '
        + 'records"라고만 적었으므로 그 이상의 자릿수를 쓰지 않는다(2,430개 진료소 기준). '
        + '단 노인 연령을 분모에 명시한 것은 A2(≥65세)·I2(≥75세) 2개뿐이다.',
  },
  {
    id: 'eng-iif', region: '잉글랜드', layer: 'payment',
    instrument: 'NHS England Network Contract DES — Investment and Impact Fund 2022/23',
    source: 'england.nhs.uk B1963-iii Network Contract IIF Implementation Guidance (2022-09)',
    academicBasis: 'PINCER 지표군',
    conditionCount: 0,
    axisRetained: false,
    verifiedBy: 'read',   // 2026-08-27, the nine SMR-01A denominator items and the SMR-02A to D definitions
                          // checked directly
    verified: true,
    note: '**같은 재정 인센티브 안에서 단계별로 갈린다.** 대상자 식별 지표 SMR-01A의 분모는 9개 항목이고 '
        + '그중 5개가 조건부다(소화성궤양 병력 + NSAID / 소화성궤양 병력 + 항혈소판제 / '
        + '심부전 진단 + 경구 NSAID / eGFR<45 + 경구 NSAID / 천식 진단 + 비선택성 β차단제). '
        + '지불 규칙 본문에 진단명이 그대로 들어간다 — '
        + '"Patients aged 18 or over with an unresolved heart failure diagnosis prescribed an oral NSAID." '
        + '그러나 실제 **지급** 성과지표 SMR-02A~D의 분모는 전부 약물-약물 또는 연령-약물이다 '
        + '(02A NSAID+항응고제, 02B 65세 이상 NSAID, 02C 항응고제+항혈소판제, 02D 아스피린+다른 항혈소판제). '
        + '어느 분모에도 진단이 없다. 조건부 축은 대상자를 고를 때까지만 쓰이고 돈이 걸리는 단계에서 사라진다.',
  },

  // ── Scotland ────────────────────────────────────────────────────────────
  {
    id: 'sct-poly', region: '스코틀랜드', layer: 'cds',
    instrument: 'Scottish Government 「Polypharmacy Guidance 2026–2029」 Appendix D1 Table 40',
    source: 'gov.scot (2026-03-02 발행)',
    academicBasis: '개발 시 Beers와 STOPP/START를 명시적으로 검토했다고 원문에 기재. '
                 + '합의는 modified RAND/UCLA Appropriateness Method',
    conditionCount: 6,
    axisRetained: true,
    verified: true,
    verifiedBy: 'read',   // 2026-08-27, all 19 data rows of Table 40 checked
    note: '**가장 강한 반례.** 데이터 19행 중 질환 진단을 분모 조건으로 요구하는 항목 6행'
        + '(치매+HbA1c<53, 천식 진단+비선택성 β차단제, CKD4/5 또는 eGFR<30+metformin, '
        + 'CKD5 또는 eGFR<10+colchicine, 유방암/에스트로겐의존암 기왕력+에스트로겐, '
        + 'AF+CHADSVASC+항응고제 미사용). 검사치·임상상태 기반 4행 포함 시 10행. '
        + 'Scottish Therapeutics Utility와 Right Decision Service를 통해 전국 GP 처방시스템에 실제 탑재된다. '
        + '(a)정부 발행 (b)학술 노인 PIM 기준을 명시적 근거로 (c)조건부 축을 기계 판정 가능한 형태로 유지 '
        + '(d)전국 임상시스템 탑재 — 네 조건을 모두 만족하는 유일한 확인 사례다.',
  },

  // ── Sweden ──────────────────────────────────────────────────────────────
  {
    id: 'se-indicator', region: '스웨덴', layer: 'rating',
    instrument: 'Socialstyrelsen 국가지표 「Äldre med läkemedel som bör undvikas」',
    source: 'Socialstyrelsen 지표 라이브러리',
    academicBasis: 'Socialstyrelsen 「Indikatorer för god läkemedelsterapi hos äldre」(2017) — '
                 + '문서 자체는 läkemedelsspecifika(약물)와 diagnosspecifika(진단 특이) 두 축을 명시 구분',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    verifiedBy: 'agent',
    note: '국가 문서는 두 축을 유지하는데 **실제 공표된 지표는 약물 단독 축 하나뿐**이다. '
        + '분모 75세 이상 인구, 분자 ATC 엔트리 31개, 진단 조건 전무. '
        + '(2017년판 PDF 원문 미확보로 diagnosspecifika 축의 항목 수는 미확인.)',
  },

  // ── Taiwan ──────────────────────────────────────────────────────────────
  {
    id: 'tw-nhia-pim', region: '대만', layer: 'measure',
    instrument: 'NHIA 「醫院以病人為中心門診整合照護計畫」 監測指標4',
    source: 'nhi.gov.tw',
    academicBasis: 'updated PIM-Taiwan criteria (2018) — 약물 140 엔트리 + 조건 9개',
    conditionCount: null,
    axisRetained: null,
    verified: true,
    verifiedBy: 'agent',
    note: '**미명세.** 13페이지 전문에 「以2015年Beer\'s criteria計算」이라고만 적혀 있고 '
        + '어느 표를 쓰는지, 항목 수, 건보 약품코드 매핑을 전혀 명시하지 않는다. '
        + '채택·배제 판정이 원문으로 불가능하다. 대만은 조건부 축을 "탈락시킨" 사례가 아니라 '
        + '노인 PIM이라는 판정틀 자체를 국가 운영 기준으로 세우지 않은 사례다.',
  },
  {
    id: 'tw-quality', region: '대만', layer: 'rating',
    instrument: 'NHIA 「用藥品質指標」 西醫基層總額',
    source: 'med.nhi.gov.tw/ihqe0000/proW004.html',
    academicBasis: '해당 없음 — 지표 페이지에 Beers/STOPP/PIM-Taiwan 인용 0건, 연령 제한 없음',
    conditionCount: 2,
    axisRetained: true,
    verified: true,
    verifiedBy: 'agent',
    note: '노인 기준과 무관한 개별 질환-금기 지표이므로 "노인 PIM의 조건부 축이 살아남은 사례"가 아니다. '
        + '그러나 **"조건부 판정은 청구데이터로 구현 불가능하다"는 방어논리를 직접 반증한다**: '
        + '病史檔의 2·3도 방실차단 병력(I441/I442/I443, 심박조율기 사용자 제외) 고혈압 환자의 '
        + 'β-Blocker(C07AA/C07AB) 사용률과, 고칼륨혈증 병력+保鉀型利尿劑 사용자의 혈청칼륨검사(09022C) '
        + '시행률이 분기별로 산출·기관별 공개된다.',
  },
];

/** Jurisdictions that could not be adjudicated, or that have no comparable instrument. Recorded
 * separately so the sample is not inflated. */
const NOT_ASSESSABLE = [
  { region: '프랑스', reason: 'AMI-Alzheimer 국가 경보지표와 ROSP 노인 약물지표 양쪽 모두 1차 원문 접근 실패(has-sante.fr stream aborted, ameli.fr 봇 차단). 지불 연동 계층에서 조건부 축을 유지한 사례일 가능성이 남아 있다.' },
  { region: '네덜란드', reason: 'STOP-NL V2(2026-02-16)는 임상 주제별로 재편됐으나 국가 품질지표 세트를 조사하지 않았다.' },
  { region: '독일', reason: 'PRISCUS 2.0은 학술 목록이며 동반질환이 별도 판정 축이 아니라 상세판 주석으로만 부속한다. 국가 운영 지표는 미조사.' },
  { region: '아일랜드', reason: '비교 대상 자체가 없다. HSE MMP 2026 국가계획 KPI 3개가 전부 비용·전환율 지표이고 노인 PIM 국가 KPI가 0개다. 단 HSE-PCRS 전국 청구DB 연구가 "The lack of diagnostic information in the database limited the applicability of all of the STOPP criteria."라고 배제 사유를 명시한 것은 (i) 데이터 조건 가설의 직접 근거다.' },
];

const LAYER_ORDER = ['guideline', 'cds', 'measure', 'rating', 'payment'];
const LAYER_KO = {
  guideline: '국가 지침', cds: '임상의사결정지원', measure: '품질지표 사양',
  rating: '공개 등급평가', payment: '지불·재정 인센티브',
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
  JURISDICTIONS, NOT_ASSESSABLE, LAYER_ORDER, LAYER_KO,
  byLayer, counterExamples,
  /** Number of adjudicable jurisdiction-layers, which is the sample size reported as N. */
  get assessableCount() { return JURISDICTIONS.filter((j) => j.axisRetained !== null).length; },
  get regionCount() { return new Set(JURISDICTIONS.map((j) => j.region)).size; },
};
