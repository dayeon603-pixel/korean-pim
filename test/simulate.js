/* 합성 처방 스트레스 테스트 — node test/simulate.js [건수]
 *
 * 목적: 대량 처방에서 (1) 판정이 동일하게 나오는지 (2) 처리 속도가 어떤지
 *       (3) 계열 추정 대비 경고가 얼마나 줄어드는지를 측정한다.
 *
 * 순환논증 회피: 처방 생성기는 PIM 규칙을 참조하지 않는다. 약물 풀은 치료 영역별로
 *   구성했고, 어떤 약이 PIM 목록에 있는지는 생성 과정에서 쓰이지 않는다. 생성기가
 *   규칙을 알면 "내가 낸 문제를 내가 푸는" 구조가 되므로 의도적으로 분리했다.
 *
 * 가중치의 출처: 복용 약물 수 분포는 공개 통계를 참고했고, 그 밖의 동반질환 유병률은
 *   가정치다. 아래 WEIGHTS에 항목별로 [출처] 또는 [가정]으로 표기했다.
 *   실제 청구데이터를 쓰지 않았으므로 이 분포는 현실을 근사한 것이 아니라 부하 시험용이다.
 */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');

const N = parseInt(process.argv[2] || '10000', 10);
// mulberry32 — 시드 고정으로 재현 가능하되 시드를 충분히 섞는다.
// 초기 구현의 LCG는 시드를 조금 바꾸면 같은 궤적으로 붕괴해 서로 다른 시드가 같은 결과를 냈다.
// test/measure_gap.js에서 그 문제를 발견해 두 파일 모두 교체했다.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 20260902;
const rnd = mulberry32(SEED);
const pickW = (items, weights) => {
  const t = weights.reduce((a, b) => a + b, 0); let r = rnd() * t;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

const WEIGHTS = {
  // 복용 약물 수. 75세 이상 5종 이상 동시복용 64.2%(심평원 2021), 10종 이상 상당수 존재(건보공단 2022).
  // 이 두 지점에 맞춰 구간 비중을 잡았다. [출처 참고 + 구간 배분은 가정]
  drugCount: { buckets: [[1, 2], [3, 4], [5, 6], [7, 9], [10, 14]], w: [14, 22, 28, 24, 12] },
  // 동반질환 유병률. [전부 가정] 실제 유병률 통계를 쓰지 않았다.
  // 순서 중요: 선행 질환(고혈압·당뇨·치매·뇌졸중)을 앞에 두어야 조건부 상승이 적용된다.
  conditions: {
    htn: 0.55, dementia: 0.12, stroke_secondary: 0.07,
    dm: 0.28, hf: 0.10, ckd: 0.12, arrhythmia: 0.08,
    falls: 0.18, insomnia: 0.22, ulcer: 0.09, constipation: 0.20, bph: 0.16,
    glaucoma: 0.05, copd: 0.07, parkinson: 0.03, hyponatremia: 0.04,
    bleeding: 0.06, age80_primary: 0.20,
  },
};

// 동반질환 조건부 상승률. key가 먼저 뽑히면 대상 질환 확률에 곱한다. [전부 가정]
// WEIGHTS.conditions 순서대로 평가되므로 선행 질환이 앞에 오도록 배치돼 있어야 한다.
const COMORBID_LIFT = {
  dm: { htn: 1.6 },            // 고혈압이 있으면 당뇨 동반 확률 상승
  ckd: { htn: 1.8, dm: 2.0 },  // 고혈압·당뇨는 만성콩팥병의 대표 선행 요인
  hf: { htn: 1.7 },
  arrhythmia: { hf: 2.2 },
  falls: { dementia: 1.9 },    // 인지장애가 있으면 낙상 병력 확률 상승
  insomnia: { dementia: 1.5 },
  bleeding: { stroke_secondary: 1.8 },
  hyponatremia: { ckd: 1.8, hf: 1.5 },
};

// PIM 계열 처방 빈도는 국가 청구 실측치를 쓴다(심평원 2022 표 28, 2017년 코호트).
// 부적절 약물을 1종 이상 처방받은 노인 684,538명 중 해당 계열 비율(%)이다.
// 이 값은 [출처]가 있는 수치이며, 앞의 동반질환 가중치와 달리 가정이 아니다.
const HIRA_PREVALENCE = {};
hira.CLASSES.forEach((c) => { HIRA_PREVALENCE[c.name] = c.prevalence; });

/** 약물이 HIRA 14계열에 속하면 그 계열의 실측 처방 비율을 가중치로 돌려준다.
 *  속하지 않으면 기준 가중치 1을 준다(비-PIM 약물은 상대적으로 흔하게 처방되므로). */
function hiraWeight(ing) {
  const item = pim.checkIngredient(ing);
  const drug = item
    ? { ing, cls: item.classKey, tags: item.tags }
    : { ing, cls: (EXTRA_CLASS[ing] && (Array.isArray(EXTRA_CLASS[ing]) ? EXTRA_CLASS[ing][0] : EXTRA_CLASS[ing])) || 'other', tags: [] };
  const c = hira.classify(drug, item ? item.classKo : '');
  // 실측 비율(0~43.3)을 가중치로 쓰되, 0%인 계열도 완전히 배제하지 않도록 하한을 둔다.
  return c ? Math.max(0.3, c.prevalence / 5) : 1;
}

// 치료 영역별 약물 풀. PIM 등재 여부와 무관하게 구성했다.
const POOL = {
  혈압: ['amlodipine', 'losartan', 'valsartan', 'lisinopril', 'telmisartan', 'bisoprolol', 'carvedilol', 'verapamil', 'diltiazem', 'doxazosin', 'terazosin', 'prazosin'],
  이뇨: ['furosemide', 'hydrochlorothiazide', 'spironolactone'],
  당뇨: ['metformin', 'glimepiride', 'glibenclamide', 'sitagliptin', 'linagliptin', 'pioglitazone', 'dapagliflozin'],
  고지혈: ['simvastatin', 'atorvastatin', 'rosuvastatin'],
  진통: ['acetaminophen', 'ibuprofen', 'naproxen', 'diclofenac', 'aceclofenac', 'meloxicam', 'celecoxib', 'piroxicam', 'mefenamic', 'indomethacin', 'tramadol', 'codeine', 'pethidine', 'pentazocine'],
  위장: ['omeprazole', 'esomeprazole', 'rabeprazole', 'pantoprazole', 'cimetidine', 'metoclopramide'],
  수면진정: ['zolpidem', 'diazepam', 'lorazepam', 'alprazolam', 'clonazepam', 'triazolam', 'bromazepam'],
  정신: ['escitalopram', 'paroxetine', 'amitriptyline', 'nortriptyline', 'imipramine', 'haloperidol', 'risperidone', 'quetiapine', 'olanzapine'],
  항히스타민: ['chlorpheniramine', 'diphenhydramine', 'hydroxyzine', 'dimenhydrinate', 'cetirizine', 'levocetirizine', 'loratadine'],
  근이완: ['eperisone', 'baclofen', 'methocarbamol', 'orphenadrine'],
  항혈전: ['aspirin', 'clopidogrel', 'warfarin', 'apixaban', 'rivaroxaban', 'edoxaban', 'cilostazol', 'ticlopidine'],
  심장: ['digoxin', 'amiodarone', 'dronedarone', 'flecainide'],
  비뇨: ['oxybutynin', 'tamsulosin', 'desmopressin'],
  호흡: ['theophylline', 'pseudoephedrine', 'phenylephrine'],
  신경: ['donepezil', 'rivastigmine', 'gabapentin', 'pregabalin', 'carbamazepine', 'oxcarbazepine', 'cholinealfoscerate'],
  기타: ['levothyroxine', 'alendronate', 'prednisolone', 'methylphenidate', 'caffeine'],
};
const AREAS = Object.keys(POOL);

// 표1 등재 성분의 효능군(엔진이 아는 분류). 표1 밖 약물은 최소 분류만 부여한다.
// hiraWeight()가 이 표를 참조하므로 호이스팅되는 const 선언 순서에 주의한다.
const EXTRA_CLASS = {
  losartan: 'arb', valsartan: 'arb', telmisartan: 'arb', lisinopril: 'acei', amlodipine: 'bp',
  bisoprolol: 'bb', carvedilol: 'bb', verapamil: 'ccbnd', diltiazem: 'ccbnd',
  furosemide: ['diuretic', 'diuretic'], hydrochlorothiazide: ['diuretic', 'diuretic'], spironolactone: ['kdiuretic', 'diuretic'],
  metformin: 'dm', glimepiride: 'su', sitagliptin: 'dm2', linagliptin: 'dm2', pioglitazone: 'tzd', dapagliflozin: 'dm2',
  simvastatin: 'statin', atorvastatin: 'statin', rosuvastatin: 'statin',
  acetaminophen: 'apap', celecoxib: 'cox2', aceclofenac: ['nsaid', 'nsaid'], meloxicam: ['nsaid', 'nsaid'],
  tramadol: 'opioid', codeine: 'opioid',
  omeprazole: 'ppi', esomeprazole: 'ppi', rabeprazole: 'ppi', pantoprazole: 'ppi',
  escitalopram: ['ssri', 'antidepressant'], paroxetine: ['ssri', 'antidepressant'],
  cetirizine: 'antihist2', levocetirizine: 'antihist2', loratadine: 'antihist2',
  eperisone: 'musclerelax', baclofen: 'musclerelax',
  clopidogrel: 'antiplatelet', warfarin: 'anticoag', apixaban: 'noac', rivaroxaban: 'noac',
  edoxaban: 'noac', cilostazol: 'antiplatelet',
  tamsulosin: 'alpha1a', donepezil: 'chei', rivastigmine: 'chei',
  gabapentin: ['anticonv', 'anticonvulsant'], pregabalin: ['anticonv', 'anticonvulsant'],
  carbamazepine: 'anticonv', oxcarbazepine: 'anticonv', cholinealfoscerate: 'nootropic',
  levothyroxine: 'thyroid', alendronate: 'bisphos', prednisolone: ['cortico', 'corticosteroid'],
  theophylline: 'xanthine', pseudoephedrine: 'decongest', phenylephrine: 'decongest',
  methylphenidate: 'stimulant', caffeine: 'stimulant',
};
function toDrug(ing) {
  const known = pim.checkIngredient(ing);
  if (known) return { ing, cls: known.classKey, tags: known.tags.slice() };
  const e = EXTRA_CLASS[ing];
  if (Array.isArray(e)) return { ing, cls: e[0], tags: [e[1]] };
  return { ing, cls: e || 'other', tags: [] };
}

// 노이즈 주입: 실제 입력은 깨끗하지 않다. 존재하지 않는 성분, 빈 값, 잘못된 조건 id,
// 대소문자 뒤섞임, 중복 등을 섞어 엔진이 죽지 않고 정상 판정을 유지하는지 본다.
const NOISE_RATE = 0.15;
function injectNoise(p) {
  const kind = Math.floor(rnd() * 6);
  const d = [...p.drugs];
  const c = [...p.conditions];
  if (kind === 0) d.push({ ing: 'not_a_real_ingredient_' + Math.floor(rnd() * 999), cls: 'other', tags: [] });
  if (kind === 1) d.push({ ing: '', cls: '', tags: [] });
  if (kind === 2) c.push('존재하지_않는_조건');
  if (kind === 3 && d.length) d.push({ ...d[0], ing: String(d[0].ing).toUpperCase() });
  if (kind === 4 && d.length) d.push(d[0]);
  if (kind === 5) return { drugs: d, conditions: [] };
  return { drugs: d, conditions: c };
}

function makePrescription() {
  const [lo, hi] = pickW(WEIGHTS.drugCount.buckets, WEIGHTS.drugCount.w);
  const n = lo + Math.floor(rnd() * (hi - lo + 1));
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < n && guard++ < 300) {
    const area = AREAS[Math.floor(rnd() * AREAS.length)];
    const pool = POOL[area];
    // 계열 내 선택은 국가 청구 실측 비율로 가중한다(장기작용 벤조 43.3%, Z-drug 24.3% 등).
    chosen.add(pickW(pool, pool.map(hiraWeight)));
  }
  // 동반질환은 독립이 아니다. 선행 질환이 있으면 관련 질환 확률을 조건부로 올린다.
  // 상승폭은 [가정]이며 실제 유병률 통계가 아니다. 독립 추출보다 현실에 가깝게 만들려는 장치일 뿐이다.
  const conds = [];
  const has = (id) => conds.includes(id);
  Object.entries(WEIGHTS.conditions).forEach(([id, base]) => {
    let p = base;
    const lift = COMORBID_LIFT[id];
    if (lift) Object.entries(lift).forEach(([pre, mult]) => { if (has(pre)) p = Math.min(0.95, p * mult); });
    if (rnd() < p) conds.push(id);
  });
  return { drugs: [...chosen].map(toDrug), conditions: conds };
}

console.log(`합성 처방 스트레스 테스트 — ${N.toLocaleString()}건 (시드 ${SEED}, mulberry32)\n`);
const cases = [];
let noisy = 0;
for (let i = 0; i < N; i++) {
  let c = makePrescription();
  if (rnd() < NOISE_RATE) { c = injectNoise(c); noisy++; }
  cases.push(c);
}
console.log(`노이즈 주입      ${noisy.toLocaleString()}건 (${(noisy / N * 100).toFixed(1)}%) — 없는 성분·빈 값·잘못된 조건 id·중복·대소문자 혼입\n`);

const drugCounts = cases.map((c) => c.drugs.length);
const condCounts = cases.map((c) => c.conditions.length);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
console.log(`처방당 약물 수  평균 ${avg(drugCounts)} (최소 ${Math.min(...drugCounts)}, 최대 ${Math.max(...drugCounts)})`);
console.log(`5종 이상 비율   ${(drugCounts.filter((n) => n >= 5).length / N * 100).toFixed(1)}%`);
console.log(`처방당 기저질환 평균 ${avg(condCounts)}개\n`);

// ── 1) 두 엔진 결과 동일성 ──
const key = (h) => `${h.condition.id}|${h.target.token}|${h.drugs.map((d) => d.ing).sort().join(',')}`;
const norm = (a) => a.map(key).sort().join('||');
let mismatch = 0;
for (let i = 0; i < N; i++) {
  const a = pim.check(cases[i]);
  const b = bm.check(cases[i]);
  if (norm(a.table2) !== norm(bm.mergeByTarget(b.table2)) || a.table1.length !== b.table1.length) mismatch++;
}
console.log(`엔진 동일성      불일치 ${mismatch}건 / ${N.toLocaleString()}건`);

// 노이즈 포함 전체에서 예외 없이 완주하는지
let crashed = 0;
for (let i = 0; i < N; i++) {
  try { pim.check(cases[i]); bm.check(cases[i]); } catch (e) { crashed++; }
}
console.log(`예외 발생        ${crashed}건 / ${N.toLocaleString()}건 (노이즈 포함)`);

// ── 2) 속도 ── JIT 워밍업 후 여러 번 재고 중앙값으로 본다. 단발 측정은 편차가 커서 못 믿는다.
function bench(fn, label, reps = 7, warmup = 3) {
  for (let w = 0; w < warmup; w++) for (let i = 0; i < N; i++) fn(cases[i]);
  const runs = [];
  for (let r = 0; r < reps; r++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) fn(cases[i]);
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  runs.sort((a, b) => a - b);
  const med = runs[Math.floor(reps / 2)];
  console.log(`${label.padEnd(14)} 중앙값 ${med.toFixed(1).padStart(6)} ms  (${runs[0].toFixed(1)}~${runs[reps - 1].toFixed(1)})  ·  처방당 ${(med / N * 1000).toFixed(2)} µs  ·  ${Math.round(N / (med / 1000)).toLocaleString()} 건/초`);
  return med;
}
// ── 속도 비교는 "같은 일"을 시켜야 한다 ──────────────────────────────
// 앞선 측정에서 소박한 구현이 더 빨라 보였는데, 그건 정규화와 표1 판정을 건너뛰었기 때문이다.
// 비교 대상을 표2 조건 매칭 하나로 좁히고, 입력도 미리 정규화해 동일 조건에서 잰다.

const PRE = cases.map((c) => ({
  drugs: c.drugs.map((d) => {
    const known = pim.checkIngredient(d.ing);
    return known
      ? { ing: d.ing, cls: known.classKey, tags: known.tags.slice() }
      : { ing: String(d.ing || '').toLowerCase(), cls: d.cls || 'other', tags: d.tags || [] };
  }),
  conditions: c.conditions,
}));

const SINGLE = [];
pim.table2.forEach((c) => c.targets.forEach((t) => { if (!t.all) SINGLE.push({ cond: c, target: t }); }));
function hits(t, d) {
  if (t.ingredient) return d.ing === t.ingredient;
  if (t.class) return d.cls === t.class;
  if (t.tag) { const k = [d.cls, ...(d.tags || [])]; for (let i = 0; i < k.length; i++) if (k[i] === t.tag) return true; return false; }
  return false;
}
// (0) 소박: 약물마다 조건 18개를 훑고, 켜진 조건마다 대상 전체를 훑는다. 색인 없음.
function m0({ drugs, conditions }) {
  let n = 0;
  for (let i = 0; i < drugs.length; i++)
    for (let c = 0; c < pim.table2.length; c++) {
      let on = false;
      for (let k = 0; k < conditions.length; k++) if (conditions[k] === pim.table2[c].id) { on = true; break; }
      if (!on) continue;
      const tg = pim.table2[c].targets;
      for (let t = 0; t < tg.length; t++) if (!tg[t].all && hits(tg[t], drugs[i])) n++;
    }
  return n;
}
// (1) 색인: 조건 집합을 Set으로 만들고 단일 대상 목록을 한 번만 훑는다.
function m1({ drugs, conditions }) {
  const on = new Set(conditions);
  let n = 0;
  for (let i = 0; i < drugs.length; i++)
    for (let j = 0; j < SINGLE.length; j++)
      if (on.has(SINGLE[j].cond.id) && hits(SINGLE[j].target, drugs[i])) n++;
  return n;
}
// (2) 비트 연산: 약물 마스크와 환자 마스크를 AND 하고 켜진 비트만 펼친다.
function m2({ drugs, conditions }) {
  const pMask = bm.conditionMask(conditions);
  if (pMask === 0) return 0;
  let n = 0;
  for (let i = 0; i < drugs.length; i++) {
    const r = bm.check({ drugs: [drugs[i]], conditions });
    n += r.table2.length;
  }
  return n;
}

console.log(`\n속도 — 표2 조건 매칭만 분리, 입력 사전 정규화 (워밍업 3회 후 7회 측정)`);
// 세 구현이 같은 건수를 세는지 먼저 확인한다. 다르면 비교 자체가 무의미하다.
let same = true;
for (let i = 0; i < 300; i++) { if (m0(PRE[i]) !== m1(PRE[i])) { same = false; break; } }
console.log(`소박 vs 색인 판정 건수 일치: ${same ? '예' : '아니오 — 비교 무효'}`);

function bench2(fn, label, reps = 7, warmup = 3) {
  for (let w = 0; w < warmup; w++) for (let i = 0; i < N; i++) fn(PRE[i]);
  const runs = [];
  for (let r = 0; r < reps; r++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) fn(PRE[i]);
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  runs.sort((a, b) => a - b);
  const med = runs[Math.floor(reps / 2)];
  console.log(`${label.padEnd(12)} 중앙값 ${med.toFixed(1).padStart(6)} ms  (${runs[0].toFixed(1)}~${runs[reps - 1].toFixed(1)})  ·  ${Math.round(N / (med / 1000)).toLocaleString()} 건/초`);
  return med;
}
const t0m = bench2(m0, '소박한 순회');
const t1m = bench2(m1, '색인 순회');
console.log(`색인 / 소박   ${(t0m / t1m).toFixed(2)}배`);

// 전체 파이프라인(정규화+표1+표2) 비교는 따로 표시한다.
console.log(`\n속도 — 전체 판정 파이프라인`);
const msLinear = bench((c) => pim.check(c), '순회 구현');
const msBit = bench((c) => bm.check(c), '비트 연산');
const ratio = msLinear / msBit;
console.log(`비트 연산 / 순회 구현   ${ratio.toFixed(2)}배  ${ratio > 1.1 ? '(비트 연산 우세)' : ratio < 0.9 ? '(순회 우세)' : '(유의한 차이 없음)'}  · 마스크 캐시 ${bm.cacheSize()}종`);

// ── 3) 계열 추정 대비 경고 감소 ──
const pimClasses = new Set(pim.table1.map((x) => x.classKey));
let warnClass = 0, warnExact = 0;
cases.forEach((c) => {
  const seenC = new Set(), seenE = new Set();
  c.drugs.forEach((d) => {
    if (pimClasses.has(d.cls)) seenC.add(d.ing);
    if (pim.isTable1(d.ing)) seenE.add(d.ing);
  });
  warnClass += seenC.size; warnExact += seenE.size;
});
console.log(`\n표1 경고 건수     계열 추정 ${warnClass.toLocaleString()}건 → 완전일치 ${warnExact.toLocaleString()}건`);
console.log(`과경고 감소       ${(warnClass - warnExact).toLocaleString()}건 (${((warnClass - warnExact) / warnClass * 100).toFixed(1)}%)`);

let t2total = 0, withCond = 0;
cases.forEach((c) => { const r = bm.check(c); const m = bm.mergeByTarget(r.table2); t2total += m.length; if (m.length) withCond++; });
console.log(`표2 조건부 판정   총 ${t2total.toLocaleString()}건 · 판정이 나온 처방 ${(withCond / N * 100).toFixed(1)}%`);
// ── 4) 핵심: 국가 기준이 놓치고 표2만 잡는 사례 ──────────────────────
// 국가 기준(심평원 2022)은 약물 단독 기준이다. 기저질환 조건부 축이 없다.
// 같은 처방을 두 기준으로 판정해 "국가 기준으로는 아무 문제 없으나 표2로는 걸리는" 처방을 센다.
let hiraFlag = 0, t2Flag = 0, onlyT2 = 0, both = 0, neither = 0;
const onlyT2Examples = [];
cases.forEach((c) => {
  const drugs = c.drugs.map((d) => {
    const k = pim.checkIngredient(d.ing);
    return k ? { ing: d.ing, cls: k.classKey, tags: k.tags, cat: k.classKo } : { ...d, cat: '' };
  });
  const byHira = drugs.some((d) => hira.isCovered(d, d.cat));
  const t2 = bm.mergeByTarget(bm.check(c).table2);
  const byT2 = t2.length > 0;
  if (byHira) hiraFlag++;
  if (byT2) t2Flag++;
  if (byHira && byT2) both++;
  else if (!byHira && byT2) {
    onlyT2++;
    if (onlyT2Examples.length < 5) onlyT2Examples.push({
      drugs: drugs.map((d) => pim.nameKo(d.ing)).slice(0, 6),
      // 실제로 판정을 발화시킨 조건만 보여준다(전체 조건을 잘라 보여주면 앞뒤가 안 맞는다).
      conds: [...new Set(t2.map((h) => h.condition.label))],
      hit: t2.slice(0, 2).map((h) => `${h.condition.label} + ${h.target.nameKo}`),
    });
  } else if (!byHira && !byT2) neither++;
});
console.log(`\n국가 기준(약물 단독) 판정      ${hiraFlag.toLocaleString()}건 (${(hiraFlag / N * 100).toFixed(1)}%)`);
console.log(`Kim 2018 표2(조건부) 판정      ${t2Flag.toLocaleString()}건 (${(t2Flag / N * 100).toFixed(1)}%)`);
console.log(`둘 다 판정                     ${both.toLocaleString()}건`);
console.log(`**국가 기준은 놓치고 표2만 판정  ${onlyT2.toLocaleString()}건 (${(onlyT2 / N * 100).toFixed(1)}%)**`);
console.log(`둘 다 판정 없음                ${neither.toLocaleString()}건`);
if (t2Flag) console.log(`표2 판정 중 국가 기준이 놓친 비율 ${(onlyT2 / t2Flag * 100).toFixed(1)}%`);
console.log('\n국가 기준이 놓친 사례 예시:');
onlyT2Examples.forEach((e, i) => {
  console.log(`  ${i + 1}. 약: ${e.drugs.join(', ')}`);
  console.log(`     기저질환: ${e.conds.filter(Boolean).join(', ')}`);
  console.log(`     표2 판정: ${e.hit.join(' / ')}`);
});

console.log('\n※ 합성 데이터다. 실제 처방 분포가 아니므로 위 비율을 임상 알람 감소율로 읽으면 안 된다.');
