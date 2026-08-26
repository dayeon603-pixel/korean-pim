/* 국가 기준 공백 측정 (대규모) — node test/measure_gap.js [건수] [반복]
 *
 * 심평원 2022 국가 기준은 약물 단독 기준이라 기저질환 조건부 판정을 할 수 없다.
 * 같은 처방을 두 기준으로 판정해 "국가 기준으로는 판정되지 않고 표2로만 판정되는" 비율을 센다.
 * 벤치마크·동치검증을 빼고 이 측정만 돌려 대규모로 반복한다.
 * 시드를 바꿔 여러 번 돌려 추정치가 안정적인지 함께 본다.
 */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');

const N = parseInt(process.argv[2] || '1000000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

const POOL = {
  혈압: ['amlodipine','losartan','valsartan','lisinopril','telmisartan','bisoprolol','carvedilol','verapamil','diltiazem','doxazosin','terazosin','prazosin'],
  이뇨: ['furosemide','hydrochlorothiazide','spironolactone'],
  당뇨: ['metformin','glimepiride','glibenclamide','sitagliptin','linagliptin','pioglitazone','dapagliflozin'],
  고지혈: ['simvastatin','atorvastatin','rosuvastatin'],
  진통: ['acetaminophen','ibuprofen','naproxen','diclofenac','aceclofenac','meloxicam','celecoxib','piroxicam','mefenamic','indomethacin','tramadol','codeine','pethidine','pentazocine'],
  위장: ['omeprazole','esomeprazole','rabeprazole','pantoprazole','cimetidine','metoclopramide'],
  수면진정: ['zolpidem','diazepam','lorazepam','alprazolam','clonazepam','triazolam','bromazepam'],
  정신: ['escitalopram','paroxetine','amitriptyline','nortriptyline','imipramine','haloperidol','risperidone','quetiapine','olanzapine'],
  항히스타민: ['chlorpheniramine','diphenhydramine','hydroxyzine','dimenhydrinate','cetirizine','levocetirizine','loratadine'],
  근이완: ['eperisone','baclofen','methocarbamol','orphenadrine'],
  항혈전: ['aspirin','clopidogrel','warfarin','apixaban','rivaroxaban','edoxaban','cilostazol','ticlopidine'],
  심장: ['digoxin','amiodarone','dronedarone','flecainide'],
  비뇨: ['oxybutynin','tamsulosin','desmopressin'],
  호흡: ['theophylline','pseudoephedrine','phenylephrine'],
  신경: ['donepezil','rivastigmine','gabapentin','pregabalin','carbamazepine','oxcarbazepine','cholinealfoscerate'],
  기타: ['levothyroxine','alendronate','prednisolone','methylphenidate','caffeine'],
};
const EXTRA = { losartan:'arb', valsartan:'arb', telmisartan:'arb', lisinopril:'acei', amlodipine:'bp', bisoprolol:'bb',
  carvedilol:'bb', verapamil:'ccbnd', diltiazem:'ccbnd', furosemide:['diuretic','diuretic'], hydrochlorothiazide:['diuretic','diuretic'],
  spironolactone:['kdiuretic','diuretic'], metformin:'dm', glimepiride:'su', sitagliptin:'dm2', linagliptin:'dm2', pioglitazone:'tzd',
  dapagliflozin:'dm2', simvastatin:'statin', atorvastatin:'statin', rosuvastatin:'statin', acetaminophen:'apap', celecoxib:'cox2',
  aceclofenac:['nsaid','nsaid'], meloxicam:['nsaid','nsaid'], tramadol:'opioid', codeine:'opioid', omeprazole:'ppi', esomeprazole:'ppi',
  rabeprazole:'ppi', pantoprazole:'ppi', escitalopram:['ssri','antidepressant'], paroxetine:['ssri','antidepressant'],
  cetirizine:'antihist2', levocetirizine:'antihist2', loratadine:'antihist2', eperisone:'musclerelax', baclofen:'musclerelax',
  clopidogrel:'antiplatelet', warfarin:'anticoag', apixaban:'noac', rivaroxaban:'noac', edoxaban:'noac', cilostazol:'antiplatelet',
  tamsulosin:'alpha1a', donepezil:'chei', rivastigmine:'chei', gabapentin:['anticonv','anticonvulsant'], pregabalin:['anticonv','anticonvulsant'],
  carbamazepine:'anticonv', oxcarbazepine:'anticonv', cholinealfoscerate:'nootropic', levothyroxine:'thyroid', alendronate:'bisphos',
  prednisolone:['cortico','corticosteroid'], theophylline:'xanthine', pseudoephedrine:'decongest', phenylephrine:'decongest',
  methylphenidate:'stimulant', caffeine:'stimulant' };
const AREAS = Object.keys(POOL);
const COND_BASE = { htn:0.55, dementia:0.12, stroke_secondary:0.07, dm:0.28, hf:0.10, ckd:0.12, arrhythmia:0.08,
  falls:0.18, insomnia:0.22, ulcer:0.09, constipation:0.20, bph:0.16, glaucoma:0.05, copd:0.07, parkinson:0.03,
  hyponatremia:0.04, bleeding:0.06, age80_primary:0.20 };
const LIFT = { dm:{htn:1.6}, ckd:{htn:1.8,dm:2.0}, hf:{htn:1.7}, arrhythmia:{hf:2.2}, falls:{dementia:1.9},
  insomnia:{dementia:1.5}, bleeding:{stroke_secondary:1.8}, hyponatremia:{ckd:1.8,hf:1.5} };
const BUCKETS = [[1,2],[3,4],[5,6],[7,9],[10,14]], BW = [14,22,28,24,12];

function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const e = EXTRA[ing];
  return Array.isArray(e) ? { ing, cls: e[0], tags: [e[1]], cat: '' } : { ing, cls: e || 'other', tags: [], cat: '' };
}
const W = {}; Object.values(POOL).flat().forEach((i) => {
  const d = toDrug(i); const c = hira.classify(d, d.cat);
  W[i] = c ? Math.max(0.3, c.prevalence / 5) : 1;
});

// mulberry32 — 시드를 충분히 섞는다.
// 앞서 쓰던 LCG는 시드를 조금 바꿔도 같은 궤적으로 붕괴해 서로 다른 시드가 같은 결과를 냈다.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(seedInit) {
  const rnd = mulberry32(seedInit);
  const pickW = (a, w) => { const t = w.reduce((x,y)=>x+y,0); let r = rnd()*t; for (let i=0;i<a.length;i++){ r-=w[i]; if(r<=0) return a[i]; } return a[a.length-1]; };
  let hiraFlag=0, t2Flag=0, onlyT2=0, both=0, neither=0, onlyHira=0;
  for (let n = 0; n < N; n++) {
    const [lo, hi] = pickW(BUCKETS, BW);
    const cnt = lo + Math.floor(rnd() * (hi - lo + 1));
    const chosen = new Set(); let g = 0;
    while (chosen.size < cnt && g++ < 300) {
      const pool = POOL[AREAS[Math.floor(rnd() * AREAS.length)]];
      chosen.add(pickW(pool, pool.map((i) => W[i])));
    }
    const conds = [];
    for (const [id, base] of Object.entries(COND_BASE)) {
      let p = base; const lf = LIFT[id];
      if (lf) for (const [pre, m] of Object.entries(lf)) if (conds.includes(pre)) p = Math.min(0.95, p * m);
      if (rnd() < p) conds.push(id);
    }
    let drugs = [...chosen].map(toDrug);
    // simulate.js와 동일 조건을 위해 노이즈를 같은 비율로 주입한다.
    if (rnd() < 0.15) {
      const k = Math.floor(rnd() * 4);
      if (k === 0) drugs.push({ ing: 'not_a_real_' + Math.floor(rnd() * 999), cls: 'other', tags: [], cat: '' });
      else if (k === 1) drugs.push({ ing: '', cls: '', tags: [], cat: '' });
      else if (k === 2 && drugs.length) drugs.push({ ...drugs[0] });
      else conds.push('존재하지_않는_조건');
    }
    const byHira = drugs.some((d) => hira.isCovered(d, d.cat));
    const byT2 = bm.check({ drugs, conditions: conds }).table2.length > 0;
    if (byHira) hiraFlag++;
    if (byT2) t2Flag++;
    if (byHira && byT2) both++;
    else if (byHira) onlyHira++;
    else if (byT2) onlyT2++;
    else neither++;
  }
  return { hiraFlag, t2Flag, both, onlyHira, onlyT2, neither };
}

console.log(`국가 기준 공백 측정 — ${N.toLocaleString()}건 × 시드 ${REPS}개\n`);
console.log('시드        국가기준     표2      둘다   국가만   표2만(공백)   표2 중 놓친 비율');
const gaps = [], shares = [];
for (let r = 0; r < REPS; r++) {
  const seed = 20260902 + r * 7919;
  const t0 = Date.now();
  const x = run(seed);
  const gap = x.onlyT2 / N * 100, share = x.onlyT2 / x.t2Flag * 100;
  gaps.push(gap); shares.push(share);
  console.log(`${String(seed).padEnd(10)} ${String(x.hiraFlag).padStart(8)} ${String(x.t2Flag).padStart(8)} ${String(x.both).padStart(8)} ${String(x.onlyHira).padStart(7)} ${(String(x.onlyT2)+'  ('+gap.toFixed(2)+'%)').padStart(16)} ${(share.toFixed(2)+'%').padStart(10)}   [${((Date.now()-t0)/1000).toFixed(1)}s]`);
}
const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); };
console.log(`\n공백 비율        평균 ${mean(gaps).toFixed(3)}%  표준편차 ${sd(gaps).toFixed(4)}  범위 ${Math.min(...gaps).toFixed(2)}~${Math.max(...gaps).toFixed(2)}`);
console.log(`표2 중 놓친 비율 평균 ${mean(shares).toFixed(3)}%  표준편차 ${sd(shares).toFixed(4)}  범위 ${Math.min(...shares).toFixed(2)}~${Math.max(...shares).toFixed(2)}`);
console.log(`\n총 ${(N * REPS).toLocaleString()}건 판정. 합성 데이터이며 실제 처방 분포가 아니다.`);
