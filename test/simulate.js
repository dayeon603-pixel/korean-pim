/* Synthetic prescribing stress test — node test/simulate.js [n]
 *
 * Purpose: over a large volume of prescriptions, measure (1) whether the two engines adjudicate
 *       identically, (2) how fast they run, and (3) how far exact matching cuts the alert count
 *       against inferring from the drug class.
 *
 * Avoiding circularity: the generator never consults the PIM rules. The drug pools are organised by
 *   therapeutic area, and whether a drug is on the PIM list plays no part in generation. A generator
 *   that knew the rules would be setting the question it then answers, so the two are kept apart
 *   deliberately.
 *
 * Where the weights come from: the distribution of drug counts follows published statistics; the
 *   comorbidity prevalences are assumptions. Each entry in WEIGHTS below is marked [source] or
 *   [assumed]. No real claims data was used, so this distribution is a load test rather than an
 *   approximation of reality.
 */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');

const N = parseInt(process.argv[2] || '10000', 10);
// mulberry32: reproducible under a fixed seed, and it mixes the seed properly. The LCG used at
// first collapsed onto the same trajectory under a small change of seed, so different seeds gave
// identical results. The problem surfaced in test/measure_gap.js and both files were replaced.
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
  // Number of drugs taken. 64.2% of people aged 75+ take 5 or more concurrently (HIRA 2021), and a
  // substantial group takes 10 or more (NHIS 2022). The bands were set to hit those two points.
  // [source-informed, band split assumed]
  drugCount: { buckets: [[1, 2], [3, 4], [5, 6], [7, 9], [10, 14]], w: [14, 22, 28, 24, 12] },
  // Comorbidity prevalence. [all assumed] No real prevalence statistics were used.
  // Order matters: the antecedent conditions (hypertension, diabetes, dementia, stroke) must come
  // first for the conditional lift to apply.
  conditions: {
    htn: 0.55, dementia: 0.12, stroke_secondary: 0.07,
    dm: 0.28, hf: 0.10, ckd: 0.12, arrhythmia: 0.08,
    falls: 0.18, insomnia: 0.22, ulcer: 0.09, constipation: 0.20, bph: 0.16,
    glaucoma: 0.05, copd: 0.07, parkinson: 0.03, hyponatremia: 0.04,
    bleeding: 0.06, age80_primary: 0.20,
  },
};

// Conditional lift between comorbidities. When the key condition is drawn first, it multiplies the
// probability of the target condition. [all assumed] Evaluation follows the order of
// WEIGHTS.conditions, so the antecedent conditions have to sit earlier in that list.
const COMORBID_LIFT = {
  dm: { htn: 1.6 },            // hypertension raises the chance of co-occurring diabetes
  ckd: { htn: 1.8, dm: 2.0 },  // hypertension and diabetes are the principal antecedents of CKD
  hf: { htn: 1.7 },
  arrhythmia: { hf: 2.2 },
  falls: { dementia: 1.9 },    // cognitive impairment raises the chance of a fall history
  insomnia: { dementia: 1.5 },
  bleeding: { stroke_secondary: 1.8 },
  hyponatremia: { ckd: 1.8, hf: 1.5 },
};

// Prescribing frequency by PIM class comes from measured national claims (HIRA 2022 Table 28, 2017
// cohort): the percentage of the 684,538 older adults on at least one inappropriate drug who were
// on that class. These figures have a [source]; unlike the comorbidity weights above they are not
// assumptions.
const HIRA_PREVALENCE = {};
hira.CLASSES.forEach((c) => { HIRA_PREVALENCE[c.name] = c.prevalence; });

/** For a drug in one of the 14 HIRA classes, returns that class's measured prescribing rate as its
 *  weight. Anything else gets the baseline weight of 1, since non-PIM drugs are prescribed
 *  comparatively often. */
function hiraWeight(ing) {
  const item = pim.checkIngredient(ing);
  const drug = item
    ? { ing, cls: item.classKey, tags: item.tags }
    : { ing, cls: (EXTRA_CLASS[ing] && (Array.isArray(EXTRA_CLASS[ing]) ? EXTRA_CLASS[ing][0] : EXTRA_CLASS[ing])) || 'other', tags: [] };
  const c = hira.classify(drug, item ? item.classKo : '');
  // The measured rate (0 to 43.3) is used as the weight, with a floor so that a class measured at
  // 0% is not excluded outright.
  return c ? Math.max(0.3, c.prevalence / 5) : 1;
}

// Drug pools by therapeutic area, built without reference to what is on the PIM list.
const POOL = {
  bp: ['amlodipine', 'losartan', 'valsartan', 'lisinopril', 'telmisartan', 'bisoprolol', 'carvedilol', 'verapamil', 'diltiazem', 'doxazosin', 'terazosin', 'prazosin'],
  diuretic: ['furosemide', 'hydrochlorothiazide', 'spironolactone'],
  diabetes: ['metformin', 'glimepiride', 'glibenclamide', 'sitagliptin', 'linagliptin', 'pioglitazone', 'dapagliflozin'],
  lipid: ['simvastatin', 'atorvastatin', 'rosuvastatin'],
  analgesic: ['acetaminophen', 'ibuprofen', 'naproxen', 'diclofenac', 'aceclofenac', 'meloxicam', 'celecoxib', 'piroxicam', 'mefenamic', 'indomethacin', 'tramadol', 'codeine', 'pethidine', 'pentazocine'],
  gi: ['omeprazole', 'esomeprazole', 'rabeprazole', 'pantoprazole', 'cimetidine', 'metoclopramide'],
  sedative: ['zolpidem', 'diazepam', 'lorazepam', 'alprazolam', 'clonazepam', 'triazolam', 'bromazepam'],
  psych: ['escitalopram', 'paroxetine', 'amitriptyline', 'nortriptyline', 'imipramine', 'haloperidol', 'risperidone', 'quetiapine', 'olanzapine'],
  antihistamine: ['chlorpheniramine', 'diphenhydramine', 'hydroxyzine', 'dimenhydrinate', 'cetirizine', 'levocetirizine', 'loratadine'],
  muscle_relaxant: ['eperisone', 'baclofen', 'methocarbamol', 'orphenadrine'],
  antithrombotic: ['aspirin', 'clopidogrel', 'warfarin', 'apixaban', 'rivaroxaban', 'edoxaban', 'cilostazol', 'ticlopidine'],
  cardiac: ['digoxin', 'amiodarone', 'dronedarone', 'flecainide'],
  urologic: ['oxybutynin', 'tamsulosin', 'desmopressin'],
  respiratory: ['theophylline', 'pseudoephedrine', 'phenylephrine'],
  neuro: ['donepezil', 'rivastigmine', 'gabapentin', 'pregabalin', 'carbamazepine', 'oxcarbazepine', 'cholinealfoscerate'],
  other: ['levothyroxine', 'alendronate', 'prednisolone', 'methylphenidate', 'caffeine'],
};
const AREAS = Object.keys(POOL);

// Therapeutic class of the ingredients on Table 1, as the engine knows them. Drugs outside Table 1
// get a minimal classification. hiraWeight() reads this table, so the order of the const
// declarations matters for hoisting.
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

// Noise injection: real input is not clean. Non-existent ingredients, empty values, bad condition
// ids, mixed case and duplicates are mixed in to see whether the engine survives them and still
// adjudicates correctly.
const NOISE_RATE = 0.15;
function injectNoise(p) {
  const kind = Math.floor(rnd() * 6);
  const d = [...p.drugs];
  const c = [...p.conditions];
  if (kind === 0) d.push({ ing: 'not_a_real_ingredient_' + Math.floor(rnd() * 999), cls: 'other', tags: [] });
  if (kind === 1) d.push({ ing: '', cls: '', tags: [] });
  if (kind === 2) c.push('nonexistent_condition');
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
    // Selection within a class is weighted by the measured national rate (long-acting
    // benzodiazepines 43.3%, Z-drugs 24.3%, and so on).
    chosen.add(pickW(pool, pool.map(hiraWeight)));
  }
  // Comorbidities are not independent. An antecedent condition raises the probability of the
  // conditions related to it. The size of the lift is [assumed], not a prevalence statistic. It
  // exists only to make the draw less unrealistic than independent sampling would be.
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

console.log(`Synthetic prescribing stress test — ${N.toLocaleString()} prescriptions (seed ${SEED}, mulberry32)\n`);
const cases = [];
let noisy = 0;
for (let i = 0; i < N; i++) {
  let c = makePrescription();
  if (rnd() < NOISE_RATE) { c = injectNoise(c); noisy++; }
  cases.push(c);
}
console.log(`noise injected    ${noisy.toLocaleString()} (${(noisy / N * 100).toFixed(1)}%) — missing ingredients, empty values, bad condition ids, duplicates, mixed case\n`);

const drugCounts = cases.map((c) => c.drugs.length);
const condCounts = cases.map((c) => c.conditions.length);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
console.log(`drugs per prescription   mean ${avg(drugCounts)} (min ${Math.min(...drugCounts)}, max ${Math.max(...drugCounts)})`);
console.log(`share on 5 or more       ${(drugCounts.filter((n) => n >= 5).length / N * 100).toFixed(1)}%`);
console.log(`comorbidities per prescription, mean ${avg(condCounts)}\n`);

// ── 1) do the two engines agree ──
const key = (h) => `${h.condition.id}|${h.target.token}|${h.drugs.map((d) => d.ing).sort().join(',')}`;
const norm = (a) => a.map(key).sort().join('||');
let mismatch = 0;
for (let i = 0; i < N; i++) {
  const a = pim.check(cases[i]);
  const b = bm.check(cases[i]);
  if (norm(a.table2) !== norm(bm.mergeByTarget(b.table2)) || a.table1.length !== b.table1.length) mismatch++;
}
console.log(`engine agreement  ${mismatch} mismatches / ${N.toLocaleString()}`);

// Whether the whole run, noise included, completes without throwing
let crashed = 0;
for (let i = 0; i < N; i++) {
  try { pim.check(cases[i]); bm.check(cases[i]); } catch (e) { crashed++; }
}
console.log(`exceptions        ${crashed} / ${N.toLocaleString()} (noise included)`);

// ── 2) speed ── measured several times after a JIT warm-up and reported as the median. A single
// measurement varies too much to trust.
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
  console.log(`${label.padEnd(18)} median ${med.toFixed(1).padStart(6)} ms  (${runs[0].toFixed(1)}-${runs[reps - 1].toFixed(1)})  ·  ${(med / N * 1000).toFixed(2)} µs per prescription  ·  ${Math.round(N / (med / 1000)).toLocaleString()}/s`);
  return med;
}
// ── a speed comparison has to give both sides the same work ───────────────
// An earlier measurement made the naive implementation look faster, but only because it skipped
// normalisation and Table 1 adjudication. The comparison is narrowed to Table 2 condition matching
// alone, and the input is normalised up front so both run under identical conditions.

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
// (0) naive: for each drug, walk all 18 conditions, and for each active condition walk every
//     target. No index.
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
// (1) indexed: build a Set of the conditions and walk a single target list once.
function m1({ drugs, conditions }) {
  const on = new Set(conditions);
  let n = 0;
  for (let i = 0; i < drugs.length; i++)
    for (let j = 0; j < SINGLE.length; j++)
      if (on.has(SINGLE[j].cond.id) && hits(SINGLE[j].target, drugs[i])) n++;
  return n;
}
// (2) bitwise: AND the drug mask with the patient mask and expand only the bits left set.
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

console.log(`\nSpeed — Table 2 condition matching in isolation, input pre-normalised (3 warm-up runs, then 7 measured)`);
// First confirm the three implementations count the same. If they do not, the comparison is void.
let same = true;
for (let i = 0; i < 300; i++) { if (m0(PRE[i]) !== m1(PRE[i])) { same = false; break; } }
console.log(`naive and indexed agree on the count: ${same ? 'yes' : 'no — comparison void'}`);

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
  console.log(`${label.padEnd(16)} median ${med.toFixed(1).padStart(6)} ms  (${runs[0].toFixed(1)}-${runs[reps - 1].toFixed(1)})  ·  ${Math.round(N / (med / 1000)).toLocaleString()}/s`);
  return med;
}
const t0m = bench2(m0, 'naive walk');
const t1m = bench2(m1, 'indexed walk');
console.log(`indexed vs naive   ${(t0m / t1m).toFixed(2)}x`);

// The full pipeline (normalisation + Table 1 + Table 2) is reported separately.
console.log(`\nSpeed — full adjudication pipeline`);
const msLinear = bench((c) => pim.check(c), 'linear walk');
const msBit = bench((c) => bm.check(c), 'bitwise');
const ratio = msLinear / msBit;
console.log(`bitwise vs linear   ${ratio.toFixed(2)}x  ${ratio > 1.1 ? '(bitwise ahead)' : ratio < 0.9 ? '(linear ahead)' : '(no meaningful difference)'}  · mask cache ${bm.cacheSize()} entries`);

// ── 3) alert reduction against inferring from the class ──
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
console.log(`\nTable 1 alerts    class inference ${warnClass.toLocaleString()} -> exact match ${warnExact.toLocaleString()}`);
console.log(`over-alerting cut ${(warnClass - warnExact).toLocaleString()} (${((warnClass - warnExact) / warnClass * 100).toFixed(1)}%)`);

let t2total = 0, withCond = 0;
cases.forEach((c) => { const r = bm.check(c); const m = bm.mergeByTarget(r.table2); t2total += m.length; if (m.length) withCond++; });
console.log(`Table 2 findings  ${t2total.toLocaleString()} in total · ${(withCond / N * 100).toFixed(1)}% of prescriptions carry one`);
// ── 4) the central case: caught by Table 2, missed by the national standard ──
// The national standard (HIRA 2022) is drug-only. It has no condition axis. The same prescriptions
// are run through both, counting those the national standard finds unremarkable and Table 2 flags.
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
      // Show only the conditions that actually fired the finding. Truncating the full condition
      // list would print something that does not match the finding beside it.
      conds: [...new Set(t2.map((h) => h.condition.label))],
      hit: t2.slice(0, 2).map((h) => `${h.condition.label} + ${h.target.nameKo}`),
    });
  } else if (!byHira && !byT2) neither++;
});
console.log(`\nflagged by the national standard (drug only)  ${hiraFlag.toLocaleString()} (${(hiraFlag / N * 100).toFixed(1)}%)`);
console.log(`flagged by Kim 2018 Table 2 (conditional)    ${t2Flag.toLocaleString()} (${(t2Flag / N * 100).toFixed(1)}%)`);
console.log(`flagged by both                              ${both.toLocaleString()}`);
console.log(`missed by the national standard, caught by T2 ${onlyT2.toLocaleString()} (${(onlyT2 / N * 100).toFixed(1)}%)`);
console.log(`flagged by neither                           ${neither.toLocaleString()}`);
if (t2Flag) console.log(`share of T2 findings the national standard misses ${(onlyT2 / t2Flag * 100).toFixed(1)}%`);
console.log('\nExamples the national standard misses:');
onlyT2Examples.forEach((e, i) => {
  console.log(`  ${i + 1}. drugs: ${e.drugs.join(', ')}`);
  console.log(`     conditions: ${e.conds.filter(Boolean).join(', ')}`);
  console.log(`     Table 2 finding: ${e.hit.join(' / ')}`);
});

console.log('\nNote: this is synthetic data. It is not a real prescribing distribution, so none of the');
console.log('      rates above may be read as a reduction in clinical alerts.');
