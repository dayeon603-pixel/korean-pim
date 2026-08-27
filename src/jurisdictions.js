/**
 * 국가 운영 계층별 조건부 판정 축 존치표 — 6개 관할.
 *
 * 배경: 이 저장소는 처음에 "학술 기준의 조건부 축은 국가 운영 기준으로 갈 때 탈락한다"를
 *   한국 사례(표2 18개 조건 → 심평원 0개)로 관찰했다. 그러나 N=1은 국가 특수성과 구별되지 않는다.
 *   그래서 1차 원문으로 판정 가능한 관할을 모아 같은 질문을 던졌다.
 *
 * 결과: **가설은 반증됐다.** 조건부 축을 판정 가능한 형태로 유지한 국가 운영 사례가 실재한다
 *   (스코틀랜드·잉글랜드). 대신 두 개의 규칙성이 관찰됐고, 이쪽이 설명력이 더 높다.
 *
 *   (i) 데이터 조건 — 지표가 얹히는 데이터에 진단정보가 있는가.
 *   (ii) 계층 기울기 — 지표가 지불에 얼마나 가까운가. 지불에 가까울수록 조건부 축이 사라진다.
 *
 * 계층(layer)의 정의. 같은 나라 안에서도 계층에 따라 답이 갈리므로 나라가 아니라 계층이 단위다.
 *   guideline  : 국가 발행 지침. 지불과 직결되지 않는다.
 *   cds        : 전국 임상시스템에 탑재된 판정 로직.
 *   measure    : 품질지표 기술사양. 산출은 되지만 그 자체로 돈이 움직이지는 않는다.
 *   rating     : 공개 등급평가. 결과가 공표된다.
 *   payment    : 진료비 지불·재정 인센티브 규칙.
 *
 * 표기 원칙
 *   conditionCount : 1차 원문에서 **실제로 센** 조건부 항목 수. 세지 못했으면 null.
 *   axisRetained   : 그 계층의 판정 로직에 약물-질환 축이 있는가. 판정 불가면 null.
 *   verified       : 1차 원문(정부·발행기관 문서)을 직접 열람했는가.
 *
 * 절대 하지 않는 것: 관할 간 항목 수의 직접 비교. 세는 단위가 나라마다 다르다
 *   (성분/성분군/약효군/조건 statement/지표 rate). 비교 가능한 것은 축의 존재 여부와
 *   그것이 사라지는 계층뿐이다.
 */
'use strict';

/** @typedef {'guideline'|'cds'|'measure'|'rating'|'payment'} Layer */

const JURISDICTIONS = [
  // ── 한국 ────────────────────────────────────────────────────────────────
  {
    id: 'kr-hira', region: '한국', layer: 'payment',
    instrument: '심평원 「노인의 부적절한 다약제 사용 관리 기준」 (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    academicBasis: '한국형 PIM 2018 (Kim MY et al.) 표1 63 + 표2 18조건',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '후보 297개 중 77성분·14계열 확정. 후보 출처표의 "Korea PIM 63"은 표1이며 '
        + '표2 18개 조건은 후보 목록에조차 없다. 성분 축은 61/63(96.8%) 검토, 조건 축은 0%.',
  },

  // ── 일본 ────────────────────────────────────────────────────────────────
  {
    id: 'jp-mhlw', region: '일본', layer: 'guideline',
    instrument: '厚生労働省「高齢者の医薬品適正使用の指針(総論編)」別添 別表2 (2018-05)',
    source: 'mhlw.go.jp',
    academicBasis: '日本老年医学会「高齢者の安全な薬物療法ガイドライン2015」(원문에 改変引用 명기)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '학회 기준의 「対象となる患者群」 전용 열(29행 중 8행 기재)이 국가 지침에서 '
        + '통째로 소멸한다(문서 전체 출현 0회). 다만 12행 중 최소 5행이 조건을 '
        + '「推奨される使用法」 산문 안에 보존한다. **삭제가 아니라 판정 축에서 문장으로의 강등**이다.',
  },
  {
    id: 'jp-shinryo', region: '일본', layer: 'payment',
    instrument: '診療報酬 A250 薬剤総合評価調整加算 · B008-2 · 調剤報酬 服用薬剤調整支援料1·2',
    source: '厚生労働省 診療報酬点数表 (令和8年度 개정 반영)',
    academicBasis: '동일 (JGS2015)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '판정축이 전부 개수다(내복 4주 이상 6종류 이상, 퇴원시 2종류 이상 감소, '
        + '精神病棟 抗精神病薬 4종류 이상). PIM 리스트는 산정요건 본문이 아니라 '
        + '「〜等を参考にすること」 참조문구로만 연결된다. 2026 개정에서도 축은 불변(100点→160点).',
  },

  // ── 미국 ────────────────────────────────────────────────────────────────
  {
    id: 'us-hedis-dde', region: '미국', layer: 'measure',
    instrument: 'NCQA HEDIS 「Potentially Harmful Drug-Disease Interactions in Older Adults (DDE)」',
    source: 'wpcdn.ncqa.org — MY2025 사양',
    academicBasis: 'AGS Beers Criteria 2023 (drug-disease 축)',
    conditionCount: 3,
    axisRetained: true,
    verified: true,
    note: '낙상력·치매·만성콩팥병 3개 조건. 질환=적격모집단(분모) / 약물=분자 구조로, '
        + 'Beers Table 3형 판정을 청구데이터 위에서 그대로 구현한다. '
        + '2023 Beers 개정에 맞춰 낙상 rate에 항콜린제를 **추가**(확장)했고 MY2025 확정본에 존속한다. '
        + '폐지된 것은 Total rate 하나뿐이므로 "DDE 폐지"는 사실이 아니다.',
  },
  {
    id: 'us-ncqa-rating', region: '미국', layer: 'rating',
    instrument: 'NCQA Health Plan Ratings 2026 필수 성과지표 목록',
    source: '2026-HPR-List-of-Required-Performance-Measures (2026-03-27 최종본)',
    academicBasis: '동일 (Beers 2023)',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '최종본 개정이력 원문: "Removed the Potentially Harmful Drug-Disease Interactions '
        + 'in Older Adults (DDE) ... from the Medicare measure list." 잔존은 약물 단독 지표 DAE(가중치 1)뿐. '
        + '**제거 사유가 원문에 명시돼 있다**: "not used in any external programs and is also '
        + 'highly correlated with the ... (DAE) measure." 이 사유는 검증 가능한 실증 명제다. '
        + '→ test/test_ncqa_correlation.js 에서 한국 기준으로 직접 검정한다.',
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
    note: '별점 산정 약물지표 5개(D08–D12)에 노인 PIM 지표가 약물 단독 축조차 0개다. '
        + '유일한 조건부 노인 PIM 지표 APD(치매×항정신병약)는 2018년 이래 전 기간 display measure로만 '
        + '존속해 단 한 해도 별점에 반영된 적이 없다.',
  },

  // ── 잉글랜드 ────────────────────────────────────────────────────────────
  {
    id: 'eng-pincer', region: '잉글랜드', layer: 'cds',
    instrument: 'PINCER National Prescribing Safety Indicators (13개)',
    source: 'PRIMIS/Nottingham · NHS England·AHSN Network 전국 확산',
    academicBasis: 'Beers/STOPP 파생 아님. Avery/Howard 계열 전연령 위험처방 지표',
    conditionCount: 5,
    axisRetained: true,
    verified: true,
    note: '13개 중 5개가 진단코드·검사치를 분모로 요구한다(B2·B3 소화성궤양 Read code + NSAID/항혈소판제, '
        + 'F2 심부전 진단 + 경구 NSAID, G2 eGFR<45 + 경구 NSAID, H2 천식 Read code + 비선택성 β차단제). '
        + '최소 23,350,696건의 환자기록에서 검색됐다. 단 노인 연령을 분모에 명시한 것은 A2(≥65세)·I2(≥75세) 2개뿐.',
  },
  {
    id: 'eng-iif', region: '잉글랜드', layer: 'payment',
    instrument: 'NHS England Network Contract DES — Investment and Impact Fund 2022/23',
    source: 'B1963-iii Network contract IIF Implementation Guidance',
    academicBasis: 'PINCER 지표군',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '**같은 계층 안에서 축이 갈린다.** 대상자 식별 지표 SMR-01A의 분모 9개 항목 중 5개는 '
        + '조건부가 그대로 편입돼 지불 규칙 본문에 진단명이 들어간다("Patients aged 18 or over with an '
        + 'unresolved heart failure diagnosis prescribed an oral NSAID."). 그러나 실제 **지급** 성과지표 '
        + 'SMR-02A~D는 전부 약물-약물/연령-약물이며 분모에 진단을 요구하지 않는다.',
  },

  // ── 스코틀랜드 ──────────────────────────────────────────────────────────
  {
    id: 'sct-poly', region: '스코틀랜드', layer: 'cds',
    instrument: 'Scottish Government 「Polypharmacy Guidance 2026–2029」 Appendix D1 Table 40',
    source: 'gov.scot (2026-03-02 발행)',
    academicBasis: '개발 시 Beers와 STOPP/START를 명시적으로 검토했다고 원문에 기재. '
                 + '합의는 modified RAND/UCLA Appropriateness Method',
    conditionCount: 6,
    axisRetained: true,
    verified: true,
    note: '**가장 강한 반례.** 데이터 19행 중 질환 진단을 분모 조건으로 요구하는 항목 6행'
        + '(치매+HbA1c<53, 천식 진단+비선택성 β차단제, CKD4/5 또는 eGFR<30+metformin, '
        + 'CKD5 또는 eGFR<10+colchicine, 유방암/에스트로겐의존암 기왕력+에스트로겐, '
        + 'AF+CHADSVASC+항응고제 미사용). 검사치·임상상태 기반 4행 포함 시 10행. '
        + 'Scottish Therapeutics Utility와 Right Decision Service를 통해 전국 GP 처방시스템에 실제 탑재된다. '
        + '(a)정부 발행 (b)학술 노인 PIM 기준을 명시적 근거로 (c)조건부 축을 기계 판정 가능한 형태로 유지 '
        + '(d)전국 임상시스템 탑재 — 네 조건을 모두 만족하는 유일한 확인 사례다.',
  },

  // ── 스웨덴 ──────────────────────────────────────────────────────────────
  {
    id: 'se-indicator', region: '스웨덴', layer: 'rating',
    instrument: 'Socialstyrelsen 국가지표 「Äldre med läkemedel som bör undvikas」',
    source: 'Socialstyrelsen 지표 라이브러리',
    academicBasis: 'Socialstyrelsen 「Indikatorer för god läkemedelsterapi hos äldre」(2017) — '
                 + '문서 자체는 läkemedelsspecifika(약물)와 diagnosspecifika(진단 특이) 두 축을 명시 구분',
    conditionCount: 0,
    axisRetained: false,
    verified: true,
    note: '국가 문서는 두 축을 유지하는데 **실제 공표된 지표는 약물 단독 축 하나뿐**이다. '
        + '분모 75세 이상 인구, 분자 ATC 엔트리 31개, 진단 조건 전무. '
        + '(2017년판 PDF 원문 미확보로 diagnosspecifika 축의 항목 수는 미확인.)',
  },

  // ── 대만 ────────────────────────────────────────────────────────────────
  {
    id: 'tw-nhia-pim', region: '대만', layer: 'measure',
    instrument: 'NHIA 「醫院以病人為中心門診整合照護計畫」 監測指標4',
    source: 'nhi.gov.tw',
    academicBasis: 'updated PIM-Taiwan criteria (2018) — 약물 140 엔트리 + 조건 9개',
    conditionCount: null,
    axisRetained: null,
    verified: true,
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
    note: '노인 기준과 무관한 개별 질환-금기 지표이므로 "노인 PIM의 조건부 축이 살아남은 사례"가 아니다. '
        + '그러나 **"조건부 판정은 청구데이터로 구현 불가능하다"는 방어논리를 직접 반증한다**: '
        + '病史檔의 2·3도 방실차단 병력(I441/I442/I443, 심박조율기 사용자 제외) 고혈압 환자의 '
        + 'β-Blocker(C07AA/C07AB) 사용률과, 고칼륨혈증 병력+保鉀型利尿劑 사용자의 혈청칼륨검사(09022C) '
        + '시행률이 분기별로 산출·기관별 공개된다.',
  },
];

/** 판정 불가·비교 대상 부재 관할. 표본을 부풀리지 않기 위해 분리해 기록한다. */
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

/** 계층별 조건부 축 존치 집계. 판정 불가(null)는 분모에서 뺀다. */
function byLayer() {
  return LAYER_ORDER.map((layer) => {
    const rows = JURISDICTIONS.filter((j) => j.layer === layer);
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

/** 가설("조건부 축은 국가 운영화에서 반드시 탈락한다")의 반례. */
function counterExamples() {
  return JURISDICTIONS.filter((j) => j.axisRetained === true);
}

module.exports = {
  JURISDICTIONS, NOT_ASSESSABLE, LAYER_ORDER, LAYER_KO,
  byLayer, counterExamples,
  /** 판정 가능한 관할 계층 수 = 표본 크기. 논문에 N으로 쓰는 값. */
  get assessableCount() { return JURISDICTIONS.filter((j) => j.axisRetained !== null).length; },
  get regionCount() { return new Set(JURISDICTIONS.map((j) => j.region)).size; },
};
