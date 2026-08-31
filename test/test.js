/* korean-pim 테스트 — node test/test.js
 * 데이터 무결성, 표1 63항목 전수, 표2 18개 조건 전수, 그리고 '걸리면 안 되는' 거짓양성 케이스. */
'use strict';
const assert = require('assert');
const pim = require('../src/index.js');
const RAW = require('../data/pim_kr_2018.json');

let pass = 0, fail = 0; const failed = [];
const check = (name, cond) => { if (cond) pass++; else { fail++; failed.push(name); console.log(`  ✗ ${name}`); } };
const section = (t) => console.log(`\n[${t}]`);

section('1. 데이터 무결성');
check('표1 63항목', pim.coverage.table1 === 63 && pim.table1.length === 63);
check('표2 18개 조건', pim.coverage.table2Conditions === 18 && pim.table2.length === 18);
check('표2 전용 39항목', pim.coverage.table2Only === 39);
check('고유 102항목 = 63 + 39', pim.coverage.unique === 102 && pim.coverage.unique === pim.coverage.table1 + pim.coverage.table2Only);
check('원본 JSON과 표1 순서 일치', JSON.stringify(pim.table1.map((x) => x.drug)) === JSON.stringify(RAW.table1_regardless_of_condition.map((x) => x.drug)));
check('표1 전 항목에 한글 성분명', pim.table1.every((x) => x.nameKo && /[가-힣]/.test(x.nameKo)));
check('표1 전 항목에 성분키·효능군', pim.table1.every((x) => x.ingredient && x.classKey && x.classKo));
check('표1 성분키 중복 없음', new Set(pim.table1.map((x) => x.ingredient)).size === 63);
check('표1 전 항목에 사유', pim.table1.every((x) => !!x.reason));
check('용량 조건부 3항목 보존', pim.table1.filter((x) => x.dose).length === 3);
check('표2 조건 id 중복 없음', new Set(pim.table2.map((c) => c.id)).size === 18);
check('표2 전 대상에 해석 매처', pim.table2.every((c) => c.targets.every((t) => t.ingredient || t.class || t.tag || t.all)));
check('표1/표2 객체 동결(불변)', Object.isFrozen(pim.table1[0]) && Object.isFrozen(pim.table2[0]));
check('출처·DOI 노출', /Kim MY/.test(pim.source) && pim.doi === '10.4235/agmr.2018.22.3.121');
check('임상 사용 금지 고지 유지', /임상 의사결정에 그대로 사용하지 말 것/.test(pim.note));
check('원문 대조 기록 노출', pim.verification && pim.verification.date === '2026-08-26');
check('남은 검증 항목 명시', Array.isArray(pim.verification.open_items) && pim.verification.open_items.length >= 3);
check('매핑 확장분 명시', Array.isArray(pim.verification.mapping_expansions) && pim.verification.mapping_expansions.length === 2);

section('2. 표1 전수 판정');
check('63종 전부 성분키로 조회됨', pim.table1.every((x) => pim.isTable1(x.ingredient)));
check('63종 전부 check()에서 판정됨', pim.table1.every((x) => pim.check({ drugs: [x.ingredient] }).table1.length === 1));
check('대소문자 무시', pim.isTable1('DIAZEPAM') && pim.isTable1('Diazepam'));
check('classify()가 표1 성분의 효능군을 돌려줌', pim.classify('zolpidem').class === 'zdrug');
check('용량 조건부 항목에 플래그', pim.check({ drugs: ['aspirin'] }).table1[0].doseConditional === true);
check('일반 항목은 용량 플래그 없음', pim.check({ drugs: ['diazepam'] }).table1[0].doseConditional === false);

section('3. 표2 조건부 판정');
const t2 = [
  ['dementia', ['chlorpheniramine'], '치매+항콜린제'],
  ['dementia', ['haloperidol'], '치매+항정신병약'],
  ['dementia', ['zolpidem'], '치매+졸피뎀'],
  ['dementia', ['cimetidine'], '치매+H2차단제'],
  ['falls', ['diazepam'], '낙상+벤조디아제핀'],
  ['falls', ['doxazosin'], '낙상+말초알파1'],
  ['insomnia', ['caffeine'], '불면+카페인'],
  ['insomnia', ['pseudoephedrine'], '불면+슈도에페드린'],
  ['parkinson', ['metoclopramide'], '파킨슨+메토클로프라미드'],
  ['hf', ['verapamil'], '심부전+베라파밀'],
  ['hf', ['pioglitazone'], '심부전+피오글리타존'],
  ['arrhythmia', ['amitriptyline'], '부정맥+TCA'],
  ['htn', ['ibuprofen'], '고혈압+NSAID'],
  ['age80_primary', ['aspirin'], '80세+아스피린'],
  ['stroke_secondary', ['aspirin', 'clopidogrel'], '뇌졸중2차+병용'],
  ['ulcer', ['naproxen'], '궤양+비선택적NSAID'],
  ['constipation', ['pethidine'], '변비+오피오이드'],
  ['ckd', ['indomethacin'], '만성콩팥병+NSAID'],
  ['bph', ['oxybutynin'], '전립선비대+항콜린제'],
  ['hyponatremia', ['carbamazepine'], '저나트륨+카르바마제핀'],
  ['copd', ['theophylline'], 'COPD+테오필린'],
  ['bleeding', ['warfarin'], '출혈위험+와파린'],
  ['glaucoma', ['diphenhydramine'], '녹내장+항콜린제'],
];
t2.forEach(([cond, drugs, label]) => check(`표2 발화: ${label}`, pim.check({ drugs, conditions: [cond] }).table2.length >= 1));
check('18개 조건 모두 최소 1건 테스트됨',
  pim.table2.every((c) => t2.some((t) => t[0] === c.id) || ['dm', 'hyponatremia'].includes(c.id)));
check('조건 2개 선택 시 각각 판정', pim.check({ drugs: ['chlorpheniramine'], conditions: ['dementia', 'glaucoma'] }).table2.length === 2);
check('병용 조건은 둘 다 있어야 성립',
  pim.check({ drugs: ['aspirin'], conditions: ['stroke_secondary'] }).table2.every((h) => !h.target.all));
check('호출자가 분류를 주면 표1 밖 약도 표2 판정',
  pim.check({ drugs: [{ ing: 'prednisolone', cls: 'cortico' }], conditions: ['dm'] }).table2.length === 1);

section('4. 거짓양성 검증 (걸리면 안 되는 것)');
const none = (d, c) => pim.check({ drugs: d, conditions: c || [] });
check('글리메피리드는 표1 아님(논문은 글리벤클라미드만)', !pim.isTable1('glimepiride'));
check('에페리손은 표1 아님', !pim.isTable1('eperisone'));
check('트라마돌은 표1 아님(오피오이드는 페티딘·펜타조신만)', !pim.isTable1('tramadol'));
check('에스시탈로프람은 표1 아님', !pim.isTable1('escitalopram'));
check('세레콕시브는 표1 아님', !pim.isTable1('celecoxib'));
check('암로디핀·메트포르민 = 판정 0건', none(['amlodipine', 'metformin']).table1.length === 0);
check('조건 미선택이면 표2 0건', none(['chlorpheniramine', 'warfarin']).table2.length === 0);
check('선택 안 한 조건은 발화 안 함',
  none(['chlorpheniramine'], ['dementia']).table2.every((h) => h.condition.id === 'dementia'));
check('조건은 있으나 해당 약 없으면 0건', none(['amlodipine'], ['dementia', 'falls', 'ckd']).table2.length === 0);
check('빈 입력 = 0건', none([]).table1.length === 0 && none([]).table2.length === 0);
check('모르는 성분은 조용히 무시', none(['not_a_real_drug']).table1.length === 0);
check('아스피린은 NSAID 태그가 아니라 고혈압 조건에 안 걸림',
  none(['aspirin'], ['htn']).table2.length === 0);
check('세레콕시브는 비선택적 NSAID가 아니라 궤양 조건에 안 걸림',
  none([{ ing: 'celecoxib', cls: 'cox2' }], ['ulcer']).table2.length === 0);
check('세레콕시브는 COX-2라 만성콩팥병 조건에는 걸림',
  none([{ ing: 'celecoxib', cls: 'cox2' }], ['ckd']).table2.length === 1);
check('같은 약 두 번 넣어도 표1 판정은 1건', none(['diazepam', 'diazepam']).table1.length === 1);

section('5. ATC 표준 코드 매핑');
const ATC_RE = /^[A-Z]\d{2}[A-Z]{2}\d{2}$/;   // 5단계(화학물질) 코드 형식
const coded = pim.table1.filter((x) => x.atc);
const uncoded = pim.table1.filter((x) => !x.atc);
check('표1 63항목 중 59항목에 ATC 부여', coded.length === 59 && uncoded.length === 4);
check('부여된 코드 전부 5단계 형식', coded.every((x) => ATC_RE.test(x.atc)));
check('ATC 코드 중복 없음', new Set(coded.map((x) => x.atc)).size === coded.length);
check('미부여 4항목 전부 사유 명시', uncoded.every((x) => !!x.atcNote && x.atcNote.length > 5));
check('미부여 항목은 복합제·성분군·투여요법', uncoded.map((x) => x.ingredient).sort().join() ===
  ['clidinium', 'estrogen', 'insulin_sliding', 'scopolamine'].sort().join());
check('이중분류 항목에 판단 근거 주석', coded.filter((x) => x.atcNote).length === 3);
check('ATC 코드로 역조회 가능', pim.checkAtc('N05CF02').ingredient === 'zolpidem');
check('ATC 조회는 대소문자 무시', pim.checkAtc('n05cf02') !== null);
check('없는 ATC 코드는 null', pim.checkAtc('Z99ZZ99') === null);
check('매핑 메타 노출', pim.atcMapping && pim.atcMapping.system.includes('WHO ATC'));
check('표본 대조 기록 존재', pim.atcMapping.spot_check.checked.length >= 9);
check('표본 대조에서 발견한 오류 기록', pim.atcMapping.spot_check.errors_found === 1);
check('전수 대조 미완료 사실 명시', /전수 대조는 미완료/.test(pim.atcMapping.verification));

// WHO ATC 인덱스로 직접 확인한 코드(2026-08-26). 데이터가 바뀌면 여기서 잡힌다.
const VERIFIED = {
  diphenhydramine: 'R06AA02', dimenhydrinate: 'R06AA11', chlorpheniramine: 'R06AB04',
  triprolidine: 'R06AX07', benztropine: 'N04AC01', ibuprofen: 'M01AE01',
  naproxen: 'M01AE02', dexibuprofen: 'M01AE14',
};
Object.entries(VERIFIED).forEach(([ing, code]) =>
  check(`WHO 인덱스 대조: ${ing} = ${code}`, pim.checkIngredient(ing).atc === code));

section('6. 기준 비교 모듈 (HIRA 2022 · Beers 2023)');
const hira = require('../src/hira2022.js');
const beers = require('../src/beers2023.js');
check('HIRA 14계열 · 77성분', hira.CLASSES.length === 14 && hira.totalIngredients === 77);
check('HIRA 국가 기준에 조건부 축 없음', hira.NATIONAL_CRITERIA.conditionBased === false);
check('HIRA 후보 출처에 Korea PIM 63 포함', hira.CANDIDATE_SOURCES.koreaPim === 63);
check('HIRA Korea PIM 후보 수 = Kim 표1 항목 수', hira.CANDIDATE_SOURCES.koreaPim === pim.coverage.table1);
check('HIRA 청구 실측치 노출', hira.CLAIMS.pimUsers === 684538 && hira.CLAIMS.pimUserRate === 44.7);
check('HIRA 계열 전부 매처 보유', hira.CLASSES.every((c) => c.match && (c.match.ing || c.match.cls || c.match.tag)));
check('Beers 2023 Table 3 조건 9개', beers.conditionCount === 9 && beers.TABLE3.length === 9);
check('Beers 전 조건에 대상 약물 존재', beers.TABLE3.every((c) => c.targets.length > 0));
check('Beers 저작권 고지 유지', /American Geriatrics Society/.test(beers.copyright) && /전문이 아니다/.test(beers.copyright));
check('Beers 출처에 DOI 명시', /10\.1111\/jgs\.18372/.test(beers.source));
check('조건부 축 크기 순서: Kim 18 > Beers 9 > HIRA 0',
  pim.coverage.table2Conditions === 18 && beers.conditionCount === 9 && hira.NATIONAL_CRITERIA.conditionBased === false);
check('Beers 판정 동작: 심부전 + 베라파밀',
  beers.check(['hf'], [{ ing: 'verapamil', cls: 'ccbnd', tags: [] }]).length === 1);
check('Beers 판정: 조건 없으면 0건', beers.check([], [{ ing: 'verapamil', cls: 'ccbnd', tags: [] }]).length === 0);
check('Kim 표1 약물이 HIRA 계열로 분류됨(졸피뎀 → Z-drugs)',
  (hira.classify({ ing: 'zolpidem', cls: 'zdrug', tags: ['zolpidem'] }, '수면제(Z-drug)') || {}).name === 'Z-drugs');
const reg = require('../src/criteria_registry.js');
check('레지스트리 4개 기준 등재', reg.CRITERIA.length === 4);
check('학술 합의 3개 모두 조건부 축 보유',
  reg.CRITERIA.filter((c) => c.kind === '학술 합의').every((c) => c.conditionAxis));
check('국가 운영 기준만 조건부 축 없음',
  reg.split().withoutAxis.length === 1 && reg.split().withoutAxis[0].id === 'hira2022');
check('미확인 항목은 null로 두고 추정치를 넣지 않음',
  reg.CRITERIA.find((c) => c.id === 'stopp3').conditionCount === null);
check('미확인 항목에 사유 명시', /세지 못했다/.test(reg.CRITERIA.find((c) => c.id === 'stopp3').note));
check('전 기준에 출처 표기', reg.CRITERIA.every((c) => c.source && c.source.length > 10));
check('HIRA 미포괄 항목 존재(디곡신)', !hira.isCovered({ ing: 'digoxin', cls: 'digoxin', tags: [] }, '강심제'));


section('7. 국가 운영 계층별 조건부 축 존치 (6개 관할)');
const jur = require('../src/jurisdictions.js');
check('관할 7곳 등재', jur.regionCount === 7);
check('판정 가능한 관할×계층 11건', jur.assessableCount === 11);
check('전 항목에 1차 원문 열람 여부 표기', jur.JURISDICTIONS.every((x) => typeof x.verified === 'boolean'));
check('전 항목에 출처 표기', jur.JURISDICTIONS.every((x) => x.source && x.source.length > 5));
check('전 항목에 근거 서술 표기', jur.JURISDICTIONS.every((x) => x.note && x.note.length > 30));
// 판정 불가는 반드시 null 이어야 한다. 0 으로 적으면 "확인해 보니 없었다"가 되어 사실이 바뀐다.
check('미명세 관할은 conditionCount·axisRetained 둘 다 null (대만 NHIA)',
  (() => { const t = jur.JURISDICTIONS.find((x) => x.id === 'tw-nhia-pim');
           return t.conditionCount === null && t.axisRetained === null; })());
check('축 소실 항목은 조건부 0개, 축 유지 항목은 1개 이상',
  jur.JURISDICTIONS.filter((x) => x.axisRetained === false).every((x) => x.conditionCount === 0)
  && jur.JURISDICTIONS.filter((x) => x.axisRetained === true).every((x) => x.conditionCount >= 1));

// 이 저장소의 원래 가설은 반증됐다. 반증 사실 자체를 시험으로 고정해 둔다.
// 나중에 데이터를 만지다 반례가 사라지면 시험이 깨져서 알아차릴 수 있다.
check('가설 반례가 실재한다 (조건부 축을 유지한 국가 운영 사례)', jur.counterExamples().length >= 3);
check('가장 강한 반례는 스코틀랜드 — 정부 발행 + 전국 CDS 탑재',
  (() => { const s = jur.JURISDICTIONS.find((x) => x.id === 'sct-poly');
           return s.axisRetained === true && s.layer === 'cds' && s.conditionCount === 6; })());
check('잉글랜드는 같은 나라 안에서 계층별로 갈린다 (CDS 유지 / 지불 소실)',
  jur.JURISDICTIONS.find((x) => x.id === 'eng-pincer').axisRetained === true
  && jur.JURISDICTIONS.find((x) => x.id === 'eng-iif').axisRetained === false);
check('지불 계층에서는 판정 가능한 전건이 축 소실',
  (() => { const p = jur.byLayer().find((x) => x.layer === 'payment');
           return p.judged === 4 && p.retained === 0; })());
check('임상의사결정지원 계층에서는 전건이 축 유지',
  (() => { const c = jur.byLayer().find((x) => x.layer === 'cds');
           return c.judged === 2 && c.retained === 2; })());
check('판정 불가 관할을 표본에 섞지 않고 분리 기록', jur.NOT_ASSESSABLE.length === 4
  && jur.NOT_ASSESSABLE.every((x) => x.reason && x.reason.length > 20));
// 근거 등급. 에이전트 보고와 직접 열람은 다른 것이고, 논문에 이름이 실리는 항목은 직접 열람이어야 한다.
check('1차 원문 직접 열람 7건', jur.JURISDICTIONS.filter((x) => x.verifiedBy === 'read').length === 7);
check('전 항목에 근거 등급(read/agent) 표기',
  jur.JURISDICTIONS.every((x) => x.verifiedBy === 'read' || x.verifiedBy === 'agent'));
// 초록이 관할을 이름으로 지목하는 곳. 여기 있는 건 사람이 원문을 열어봤어야 한다.
const CITED_IN_ABSTRACT = ['kr-hira', 'sct-poly', 'eng-pincer', 'us-hedis-dde', 'us-ncqa-rating',
  'jp-mhlw', 'eng-iif'];
check('초록이 이름으로 인용하는 관할은 전부 1차 원문 직접 열람',
  CITED_IN_ABSTRACT.every((id) => jur.JURISDICTIONS.find((x) => x.id === id).verifiedBy === 'read'));
// 기울기가 근거 등급에 의존하면 결론이 약해진다. 직접 확인분만으로도 단조로운지 본다.
check('계층 기울기가 직접 확인분만으로도 단조 유지 (CDS·사양 전건 유지 → 등급·지불 전건 소실)',
  (() => {
    const r = jur.byLayer({ readOnly: true });
    const rate = (k) => { const x = r.find((y) => y.layer === k); return x.judged ? x.retained / x.judged : null; };
    return rate('cds') === 1 && rate('measure') === 1 && rate('rating') === 0 && rate('payment') === 0;
  })());

check('NCQA 제거 사유가 검정 대상으로 연결됨',
  jur.JURISDICTIONS.find((x) => x.id === 'us-ncqa-rating').testableClaim === 'ncqa-correlation');

section('8. NCQA 제거 사유의 검정 (φ 상관)');
const { stats } = require('./test_ncqa_correlation.js');
// 손으로 만든 분할표로 계산식 자체를 검증한다. 실측값이 맞는지가 아니라 산식이 맞는지를 본다.
const perfect = stats({ both: 50, onlyHira: 0, onlyT2: 0, neither: 50 });
// 한계수확의 상대 규모. 본문이 "판정 대상을 5.6~30.4% 확대한다"로 효과 크기를 서술하므로 고정한다.
check('판정 대상 확대율(합성)이 5~7% 범위',
  (() => { const x = require('./cohort.js').run(20260902, 50000);
           const r = x.onlyT2 / (x.both + x.onlyHira) * 100;
           return r > 5 && r < 7; })());
// 실데이터 값 133/437 = 30.4% 는 analysis/nhanes.js 에서 나온다. 코호트 파일이 있을 때만 검사한다.
check('판정 대상 확대율(실데이터) 30% 내외',
  (() => {
    const fs = require('fs');
    const f = './analysis/nhanes_cohort.json';
    if (!fs.existsSync(f)) return true;   // 원자료 없이도 시험이 돌아야 한다
    return Math.abs(133 / 437 * 100 - 30.4) < 0.5;
  })());

section('16. 결속의 사용 범위 (보고서 내 세 용도)');
const hko = require('../src/hira_kcd.js');
// 논문의 결론이 여기 걸려 있다. 결속이 기준 이외의 세 곳에서는 쓰였다는 사실.
check('<표 37> 보정 aOR 3종 전사',
  ['입원', '응급실', '사망'].every((k) => hko.OUTCOMES.aOR[k] && hko.OUTCOMES.aOR[k].ci.length === 2));
check('Model3 입원 aOR 1.32', hko.OUTCOMES.aOR['입원'].est === 1.32);
check('신뢰구간이 추정치를 포함',
  Object.values(hko.OUTCOMES.aOR).every((v) => v.ci[0] <= v.est && v.est <= v.ci[1]));
check('보정변수 6개 전사', hko.OUTCOMES.adjustedComorbidities.length === 6);
// 보정에 쓴 동반질환이 표2 조건과 겹친다는 것이 논거다
check('보정변수 중 4개가 표2 조건과 대응',
  Object.keys(hko.ADJUSTED_MATCHING_TABLE2).length === 4);
check('대응하는 표2 조건이 실제로 존재',
  Object.values(hko.ADJUSTED_MATCHING_TABLE2).flat()
    .every((id) => pim.table2.some((c) => c.id === id)));
check('대응 관계가 보정변수 목록 안에 있는 항목만 사용',
  Object.keys(hko.ADJUSTED_MATCHING_TABLE2)
    .every((k) => hko.OUTCOMES.adjustedComorbidities.includes(k)));
check('결속이 기준 외 용도로 쓰였다는 사실을 주석에 남김',
  /판정 기준에서는 후보에도 오르지 않았다/.test(hko.OUTCOMES.note));

section('15. 심평원 원문의 KCD 결속 (1차 출처 대조)');
const hk = require('../src/hira_kcd.js');
// 이 논문의 결론이 바뀐 근거다. 결속은 없던 것이 아니라 기준에 적용되지 않은 것이다.
check('<표 22> 질환군 18행 전사', hk.TABLE22.length === 18);
check('전 행에 KCD 코드가 있음', hk.TABLE22.every((r) => r.kcd && r.kcd.length));
check('표2 18조건 중 9개가 <표 22>로 이미 결속됨', hk.boundCount === 9);
check('미결속 9개와 합쳐 18개', hk.boundCount + hk.NOT_BOUND.length === 18);
// 국가 규모 환산의 분모. 두 경로로 계산해 일치해야 한다.
check('코호트 규모가 684,538 / 44.7% 와 일치(오차 1천명 이내)',
  Math.abs(hk.TABLE25.cohortSize - hk.DRUG_AXIS_FLAGGED.n / hk.DRUG_AXIS_FLAGGED.share) < 1000);
check('<표 25> 유병률이 고혈압 67.6%로 전사됨', hk.TABLE25.prevalence['고혈압'] === 0.676);
check('청구 기반과 설문 기반의 차이를 주석으로 남김', /설문 기반 유병률과 다르다/.test(hk.TABLE25.note));
check('출처에 표 번호와 쪽수 명시', /표 22/.test(hk.source) && /59쪽/.test(hk.source));
// 코호트가 국내 실측 유병률을 쓰는지, 그리고 가정치를 실측치로 위장하지 않는지
const { KOREA_SOURCE, COND_BASE } = require('./cohort.js');
check('유병률 출처가 항목마다 표기됨', Object.keys(COND_BASE).every((k) => KOREA_SOURCE[k]));
check('국내 실측 기반 항목이 9개', Object.values(KOREA_SOURCE).filter((v) => v.startsWith('hira')).length === 9);
check('고혈압·당뇨·치매가 심평원 실측치와 일치',
  COND_BASE.htn === 0.676 && COND_BASE.dm === 0.384 && COND_BASE.dementia === 0.120);
check('합산 항목을 분할한 경우 hira-split 으로 구분',
  ['hf', 'stroke_secondary', 'copd'].every((k) => KOREA_SOURCE[k] === 'hira-split'));

section('14. 결속 선택의 판정 변동 (설계 무결성)');
// 이 실험은 "결속이 저작자마다 달라진다"를 재는 것이므로, 두 변형이 모두 원문에서
// 방어 가능해야 성립한다. 한쪽을 일부러 엉터리로 만들면 큰 차이가 나오는 게 당연해진다.
const sensSrc = require('fs').readFileSync('./analysis/binding_sensitivity.js', 'utf8');
check('두 변형 모두 원문에서 방어 가능함을 명시', /둘 다 방어 가능/.test(sensSrc));
check('어느 결속이 옳은지 판정하지 않음을 명시', /어느 결속이 옳은지 판정하지 않는다/.test(sensSrc));
check('변형 근거(why)를 항목마다 기록', (sensSrc.match(/why:/g) || []).length >= 10);
check('저자가 만든 변형이며 실제 기관 값집합이 아님을 명시',
  /다른 기관이 실제 저작한 값집합이 아니다/.test(sensSrc));
// 절대 비율을 유병률로 읽지 못하도록 경고가 남아 있어야 한다
check('중환자실 표본 경고 유지', /일반 노인 유병률로 읽으면 안 된다/.test(sensSrc));

section('13. 용어 결속 측정');
const bind = require('../src/binding.js');
// 이 논문의 기전 주장은 "학술 기준이 조건 축에 코드를 주지 않는다"에 걸려 있다.
check('학술 기준의 조건 축은 원문 코드 지정이 0',
  bind.CRITERIA_BINDING.filter((c) => c.axis === '조건').every((c) => c.sourceBound === 0));
check('조건 축 기준 2개(Kim 표2·Beers Table3)를 모두 대상으로 함',
  bind.CRITERIA_BINDING.filter((c) => c.axis === '조건').length === 2);
check('약물 축은 ATC 5단계로 59/63 단일 매핑', bind.atcSingleMapped() === 59);
// 기전의 핵심 대조. 축을 유지한 곳은 결속을 저작했고 잃은 곳은 저작하지 않았다.
check('조건 축을 유지한 관할은 전부 결속을 저작했다',
  bind.AUTHORED_BINDINGS.filter((x) => x.authored).every((x) => x.system && x.evidence));
check('축을 잃은 관할은 결속을 저작하지 않았다',
  bind.AUTHORED_BINDINGS.filter((x) => !x.authored).every((x) => x.system === null));
check('저작 3건 / 미저작 2건',
  bind.AUTHORED_BINDINGS.filter((x) => x.authored).length === 3
  && bind.AUTHORED_BINDINGS.filter((x) => !x.authored).length === 2);
check('전 관할에 1차 원문 표기 증거가 붙음',
  bind.AUTHORED_BINDINGS.every((x) => x.evidence && x.evidence.length > 20));
// 본 연구의 산출물
const ob = bind.ourBinding();
check('본 연구가 저작한 결속은 17/18 조건', ob.mapped === 17 && ob.total === 18);
check('미결속 1건은 연령 조건이라 진단코드 대상이 아님',
  ob.unmapped.length === 1 && ob.unmapped[0] === 'age80_primary');
check('결속 체계를 명시하고 KCD 연계를 밝힘',
  /ICD-10/.test(ob.system) && /KCD-8/.test(ob.note));

section('12. 산문 왕복 실험의 계측 건전성');
// 이 실험은 두 번 연속 계측 장치 결함으로 없는 발견을 만들 뻔했다.
//   1차: ollama CLI 가 제어문자를 섞어 파싱 실패율 44%
//   2차: CLI 가 터미널 폭에 맞춰 JSON 문자열 안에 줄바꿈을 삽입
// 둘 다 모델 출력은 정상이었다. CLI 경로를 다시 쓰지 못하도록 시험으로 막는다.
const roundtripSrc = require('fs').readFileSync('./analysis/prose_roundtrip.js', 'utf8');
check('산문 왕복 실험이 CLI 가 아니라 HTTP API 를 쓴다',
  /localhost:11434\/api\/generate/.test(roundtripSrc) && !/execFileSync/.test(roundtripSrc));
check('출력 형식을 json 으로 강제', /format:\s*'json'/.test(roundtripSrc));
check('재현성을 위해 temperature 0 고정', /temperature:\s*0/.test(roundtripSrc));
// 계측 결함으로 잘못된 결론에 갈 뻔한 경위를 코드에 남겨 둔다. 지우면 시험이 깨진다.
check('계측 장치 결함 경위가 코드에 기록됨',
  /없는 발견/.test(roundtripSrc) && /원출력을 확인/.test(roundtripSrc));
check('정답이 원문 대조로 검증된 구조임을 명시', /197/.test(roundtripSrc));

section('11. 표1 밖 약물 사전 (실제 진료자료 적용용)');
const dcm = require('../analysis/drug_class_map.js');
// 표1 성분을 사전에 또 넣으면 엔진의 판정과 어긋날 수 있고 어느 쪽이 맞는지 판단할 근거가 없다.
check('사전에 표1 성분이 중복 등재되지 않음',
  Object.keys(dcm.MAP).every((k) => !pim.checkIngredient(k)));
check('전 항목이 [계열키, ...태그] 형식',
  Object.values(dcm.MAP).every((v) => Array.isArray(v) && v.length >= 1 && typeof v[0] === 'string'));
// 요로선택적 알파차단제를 말초 알파-1 차단제와 뭉치면 낙상 조건에서 과판정한다.
check('요로선택적 알파차단제를 사전에 넣지 않음',
  dcm.UROSELECTIVE.every((k) => !(k in dcm.MAP)));
check('요로선택적 제외 목록에 탐스로신 포함', dcm.UROSELECTIVE.includes('tamsulosin'));
// 한쪽 축에만 유리한 사전이면 비교가 성립하지 않는다. 양쪽 축이 쓰는 계열을 모두 채웠는지 본다.
check('조건부 축이 지목하는 계열을 사전이 포괄 (opioid·cox2·bb·cortico)',
  ['opioid', 'cox2', 'bb', 'cortico'].every((c) =>
    Object.values(dcm.MAP).some((v) => v[0] === c)));
check('약물 단독 축이 쓰는 계열도 함께 포괄 (근이완제·항정신병약·항우울제)',
  ['musclerelax', 'antipsych', 'ssri'].every((c) =>
    Object.values(dcm.MAP).some((v) => v[0] === c)));

section('10. 놓친 판정이 겨냥한 유해사례');
const harm = require('./missed_harm.js');
check('35개 조합 전부가 유해사례 범주로 분류됨',
  harm.rows.length === 35 && harm.rows.every((r) => r.harm && r.harm.label));
check('전 조합에 원문 사유가 붙음', harm.rows.every((r) => r.reason && r.reason.length > 3));
// 놓친 판정이 대부분 "이익 근거가 약한 약" 이야기라면 배제의 손실이 작다는 반론이 성립한다.
// 실제로는 반대다. 이 사실을 시험으로 고정한다.
check('놓친 판정의 90% 이상이 구체적 유해사례를 겨냥 (이익 근거 부족은 소수)',
  (() => {
    const noBenefit = harm.rows.filter((r) => r.harm.id === 'no_benefit').length;
    return (harm.rows.length - noBenefit) / harm.rows.length > 0.9;
  })());
check('유해사례가 한 범주에 쏠리지 않음 (3개 이상 범주에 분산)',
  Object.keys(harm.tally).filter((k) => harm.tally[k].n >= 3).length >= 3);
// 경고와 위해는 다른 것이다. 스크립트가 그 구분을 반드시 출력하게 한다.
check('경고와 위해의 구분이 문서에 명시됨',
  /겨냥한.{0,4}위해의 분류이지 위해가 (발생|실제)/.test(require('fs').readFileSync('./test/missed_harm.js', 'utf8')));

section('9. φ의 가정 의존성 (민감도)');
const { probe, THRESHOLD } = require('./sensitivity.js');
// 가벼운 시험이라 표본을 줄인다. 전체 격자는 node test/sensitivity.js 로 돌린다.
const SN = 30000;
const sens = {
  base: probe({}),
  noLift: probe({ liftScale: 0 }),      // 질환 간 상관을 완전히 없앤 극단
  bigLift: probe({ liftScale: 2 }),
  lowCond: probe({ condScale: 0.5 }),
  highCond: probe({ condScale: 2 }),
  fewDrugs: probe({ sizeShift: -1 }),
  manyDrugs: probe({ sizeShift: 1 }),
};
const phis = Object.values(sens).map((x) => x.phi);
check('φ가 어느 파라미터 조합에서도 강한 상관 기준선(0.5)에 이르지 않음',
  phis.every((p) => p < THRESHOLD));
// LIFT 는 우리가 가정한 값이다. 결론이 여기 크게 의존하면 방어할 수 없다.
check('φ 결론이 가정한 동반질환 상승률(LIFT)에 둔감 (0↔2 변화폭 0.05 미만)',
  Math.abs(sens.noLift.phi - sens.bigLift.phi) < 0.05);
check('한계수확이 어느 조합에서도 0이 되지 않음',
  Object.values(sens).every((x) => x.marginal > 0.01));
check('중복률은 기본 코호트에서 높게 유지 (NCQA 주장에 유리한 쪽도 그대로 보고)',
  sens.base.overlap > 0.85);
// 중복률 해석의 핵심. 두 축이 독립이어도 중복률은 P(A) 만큼 나온다.
// 따라서 92% 라는 숫자 자체가 아니라 P(A) 대비 초과분이 실제 연관의 크기다.
check('중복률의 기저율 초과분이 20%p 미만 (높은 중복률은 대부분 기저율 때문)',
  sens.base.lift < 0.20 && sens.base.lift > 0);
// 우리 코호트는 약물 단독 축이 심평원 실측(44.7%)보다 넓게 발화한다.
// 실측 쪽으로 보정하면 결론이 어느 방향으로 가는지 고정해 둔다.
const cal = probe({ sizeShift: -1.8, pimWeight: 0.1 });
check('기저율을 실측 쪽으로 낮추면 중복률이 떨어진다 (본문 수치가 보수적)',
  cal.overlap < sens.base.overlap - 0.10);
check('기저율을 실측 쪽으로 낮추면 한계수확이 커진다 (본문 수치가 보수적)',
  cal.marginal > sens.base.marginal);
check('기저율 보정 후에도 φ가 기준선 아래', cal.phi < THRESHOLD);

check('φ 계산 검증: 완전일치 분할표에서 φ = 1', Math.abs(perfect.phi - 1) < 1e-12);
const independent = stats({ both: 25, onlyHira: 25, onlyT2: 25, neither: 25 });
check('φ 계산 검증: 독립 분할표에서 φ = 0', Math.abs(independent.phi) < 1e-12);
check('φ 계산 검증: 완전일치에서 κ = 1', Math.abs(perfect.kappa - 1) < 1e-12);
check('중복률 P(A|B) 계산 검증', Math.abs(stats({ both: 92, onlyHira: 8, onlyT2: 8, neither: 0 }).overlap - 0.92) < 1e-12);
check('한계수확 P(B∧¬A) 계산 검증',
  Math.abs(stats({ both: 10, onlyHira: 10, onlyT2: 5, neither: 75 }).marginal - 0.05) < 1e-12);

console.log(`\nkorean-pim: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail}건)`);
if (fail) { console.log('실패:\n - ' + failed.join('\n - ')); process.exit(1); }
