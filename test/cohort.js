/* 합성 고령 처방 코호트 생성기 — 판정 축 비교 실험의 공용 입력.
 *
 * measure_gap.js 에 있던 생성기를 그대로 떼어냈다. 여러 실험이 **같은 코호트**를 봐야
 * 결과를 서로 비교할 수 있기 때문이다. 분리 후 기존 측정치(4.54%)가 그대로 재현되는지로
 * 리팩터의 안전성을 확인했다.
 *
 * run(seed, N) 은 처방 N건을 만들어 두 판정 축의 2x2 분할표를 돌려준다.
 *   hiraFlag  국가 기준(약물 단독 축)이 판정한 건수
 *   t2Flag    Kim 2018 표2(조건부 축)가 판정한 건수
 *   both / onlyHira / onlyT2 / neither
 *
 * 중요: 생성기는 판정 규칙을 참조하지 않는다. 규칙으로 만든 데이터를 그 규칙으로 재판정하면
 *   순환논증이 된다. 약물 선택 가중치는 국가 청구 실측 유병률에서, 동반질환은 공개 통계와
 *   **가정한** 조건부 상승률(LIFT)에서 온다. LIFT 는 측정치가 아니라 가정이다.
 *
 * 한계: 합성 데이터다. 실제 처방 분포가 아니므로 여기서 나온 비율을 임상 알람 감소율로 읽으면 안 된다.
 */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');

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
/** 국가 기준 14계열에 포괄되는 약물인지. pimWeight 보정 대상을 고르는 데 쓴다. */
const COVERED = {};
const W = {}; Object.values(POOL).flat().forEach((i) => {
  const d = toDrug(i); const c = hira.classify(d, d.cat);
  W[i] = c ? Math.max(0.3, c.prevalence / 5) : 1;
  COVERED[i] = !!hira.isCovered({ ing: d.ing, cls: d.cls, tags: d.tags }, d.cat);
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

/** 코호트를 만들고 두 판정 축의 2x2 분할표를 돌려준다.
 *
 * @param {number} seedInit 난수 시드
 * @param {number} N 처방 건수
 * @param {{liftScale?:number, condScale?:number, sizeShift?:number}} [opt]
 *   민감도 분석용 파라미터. 기본값(1,1,0)이 본 측정에 쓴 설정이다.
 *   liftScale 동반질환 조건부 상승률(LIFT)의 배율. **LIFT 는 측정치가 아니라 가정이므로**
 *     결론이 이 값에 얼마나 의존하는지 반드시 확인해야 한다. 0 이면 질환 간 상관을 없앤다.
 *   condScale 전체 기저질환 유병률의 배율.
 *   sizeShift 처방 약물 수 분포를 큰 쪽/작은 쪽으로 미는 정도(-1~+1).
 *   pimWeight 국가 기준에 포괄되는 약물의 선택 가중치 배율. 1 미만이면 PIM 약물이 덜 뽑힌다.
 *     **이게 분할표를 가장 크게 움직이는 손잡이다.** 기본 코호트는 약물 단독 축 발화율이 81.8%인데
 *     심평원 보고서의 실측(다약제 노인의 44.7%가 목록 약물 1종 이상)보다 1.83배 높다.
 *     외부 실측에 맞춰 보정했을 때 결론이 유지되는지 반드시 확인해야 한다.
 */
function run(seedInit, N, opt) {
  const o = opt || {};
  const liftScale = o.liftScale === undefined ? 1 : o.liftScale;
  const condScale = o.condScale === undefined ? 1 : o.condScale;
  const sizeShift = o.sizeShift === undefined ? 0 : o.sizeShift;
  const pimWeight = o.pimWeight === undefined ? 1 : o.pimWeight;
  const rnd = mulberry32(seedInit);
  const pickW = (a, w) => { const t = w.reduce((x,y)=>x+y,0); let r = rnd()*t; for (let i=0;i<a.length;i++){ r-=w[i]; if(r<=0) return a[i]; } return a[a.length-1]; };
  let hiraFlag=0, t2Flag=0, onlyT2=0, both=0, neither=0, onlyHira=0;
  for (let n = 0; n < N; n++) {
    // sizeShift>0 이면 다제약물 쪽으로, <0 이면 소수 처방 쪽으로 가중치를 기울인다.
    const bw = BW.map((w, i) => Math.max(0.01, w * (1 + sizeShift * (i - (BW.length - 1) / 2) / 2)));
    const [lo, hi] = pickW(BUCKETS, bw);
    const cnt = lo + Math.floor(rnd() * (hi - lo + 1));
    const chosen = new Set(); let g = 0;
    while (chosen.size < cnt && g++ < 300) {
      const pool = POOL[AREAS[Math.floor(rnd() * AREAS.length)]];
      chosen.add(pickW(pool, pool.map((i) => W[i] * (COVERED[i] ? pimWeight : 1))));
    }
    const conds = [];
    for (const [id, base] of Object.entries(COND_BASE)) {
      let p = Math.min(0.95, base * condScale); const lf = LIFT[id];
      // 상승률을 1 쪽으로 당기거나(liftScale<1) 밀어서(>1) 질환 간 상관의 세기를 조절한다.
      if (lf) for (const [pre, m] of Object.entries(lf)) {
        if (conds.includes(pre)) p = Math.min(0.95, p * (1 + (m - 1) * liftScale));
      }
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

module.exports = { run, POOL, COND_BASE, LIFT, COVERED, toDrug, mulberry32 };
