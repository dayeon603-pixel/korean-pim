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
check('HIRA 미포괄 항목 존재(디곡신)', !hira.isCovered({ ing: 'digoxin', cls: 'digoxin', tags: [] }, '강심제'));

console.log(`\nkorean-pim: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail}건)`);
if (fail) { console.log('실패:\n - ' + failed.join('\n - ')); process.exit(1); }
