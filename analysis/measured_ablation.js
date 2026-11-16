/* The ablation again, with the condition measured instead of self-reported — node analysis/measured_ablation.js
 *
 * The manuscript reports that 68.0% of the people a condition-deleted rule flags lack the condition,
 * and states that self-report biases that share upward, because a respondent can have a condition
 * no one told them about. This script replaces the sign of that bias with its size.
 *
 * Three ascertainments of the same eight rules, over the same people and the same drugs:
 *
 *   self       as submitted: the survey question (hyponatraemia was already a laboratory value)
 *   measured   self-report OR examination/laboratory, for the three conditions NHANES measures:
 *                hypertension  mean SBP >= 140 or DBP >= 90 mmHg, or on prescribed BP medicine
 *                diabetes      HbA1c >= 6.5%
 *                kidney        eGFR < 60 (CKD-EPI 2021) or urine ACR >= 30 mg/g
 *              A union can only add people to Y, so this is the most generous reading of the
 *              condition available here and gives the conservative (lowest) share.
 *   criterion  as "measured", but the kidney rule uses the criterion's own definition,
 *              creatinine clearance < 30 mL/min (Cockcroft-Gault), complete cases only.
 *
 * Intervals: Wilson for a single rule; the pooled shares resample people (2,000 draws, fixed seed),
 * because one person can contribute pairs to several rules.
 *
 * Usage: node analysis/measured_ablation.js [2017|2015]
 *        writes analysis/measured_ablation_<cycle>.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const { MAP } = require('./drug_class_map.js');

const CYCLE = process.argv[2] === '2015' ? '2015' : '2017';
const cohort = require(path.join(__dirname, CYCLE === '2015' ? 'nhanes_cohort_2015.json' : 'nhanes_cohort.json'));
const measured = require(path.join(__dirname, `nhanes_measured_${CYCLE}.json`)).people;

const THRESH = { sbp: 140, dbp: 90, hba1c: 6.5, egfr: 60, acr: 30, crcl: 30 };
const EN = {
  insomnia: 'Insomnia', hf: 'Heart failure', htn: 'Hypertension',
  stroke_secondary: 'Stroke, 2nd prevention', ckd: 'Chronic kidney disease',
  hyponatremia: 'Hyponatraemia', copd: 'COPD', dm: 'Diabetes',
};
const OBSERVABLE = new Set(cohort.mappedConditions);
const ALL = pim.table2.map((t) => t.id);
const RULES = pim.table2.filter((t) => OBSERVABLE.has(t.id)).map((t) => t.id);

function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const m = MAP[ing];
  if (m) return { ing, cls: m[0], tags: m.slice(1), cat: '' };
  return null;
}
const split = (n) => n.split(';').map((x) => x.trim()).filter(Boolean);

function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}
function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
function bootstrap(units, stat, B = 2000, seed = 20260906) {
  const rand = rng(seed);
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const draw = units.map(() => units[Math.floor(rand() * units.length)]);
    const v = stat(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)]];
}

/** Measured status of one condition for one person: true, false, or null when not measured. */
function measuredHas(m, id, def) {
  if (!m) return null;
  if (id === 'htn') {
    if (m.sbp == null && m.dbp == null && m.bpMed == null) return null;
    return (m.sbp ?? 0) >= THRESH.sbp || (m.dbp ?? 0) >= THRESH.dbp || m.bpMed === true;
  }
  if (id === 'dm') return m.hba1c == null ? null : m.hba1c >= THRESH.hba1c;
  if (id === 'ckd') {
    if (def === 'criterion') return m.crcl == null ? null : m.crcl < THRESH.crcl;
    if (m.egfr == null && m.acr == null) return null;
    return (m.egfr ?? Infinity) < THRESH.egfr || (m.acr ?? 0) >= THRESH.acr;
  }
  return undefined; // not measured in NHANES: self-report stands
}

/** Condition status under one definition: true, false, or null (excluded from that rule). */
function has(person, id, def) {
  const self = person.conditions.has(id);
  if (def === 'self') return self;
  const m = measuredHas(person.m, id, def);
  if (m === undefined) return self;
  if (def === 'criterion' && id === 'ckd') return m; // the criterion's own definition, no union
  return m === null ? self : self || m;
}

const people = cohort.people.map((p) => {
  const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
  const deleted = new Set(bm.check({ drugs, conditions: ALL }).table2.map((h) => h.condition.id));
  return { id: p.id, conditions: new Set(p.conditions), m: measured[p.id] ?? null, x: RULES.filter((r) => deleted.has(r)) };
});

function analyse(def) {
  const perRule = RULES.map((id) => {
    const X = people.filter((p) => p.x.includes(id) && has(p, id, def) !== null);
    const xy = X.filter((p) => has(p, id, def)).length;
    const [lo, hi] = wilson(xy, X.length);
    return { id, label: EN[id], x: X.length, xy, ppv: X.length ? xy / X.length : null, lo, hi };
  });
  // One unit per person: their (rule, has-condition) pairs, for the clustered bootstrap.
  const units = people.map((p) => p.x.map((id) => has(p, id, def)).filter((v) => v !== null));
  const pairShare = (us) => { let n = 0, k = 0; us.forEach((u) => u.forEach((v) => { n += 1; if (v) k += 1; })); return n ? 1 - k / n : NaN; };
  const personShare = (us) => {
    const flagged = us.filter((u) => u.length);
    return flagged.length ? flagged.filter((u) => !u.some(Boolean)).length / flagged.length : NaN;
  };
  const flagged = units.filter((u) => u.length);
  return {
    def,
    perRule,
    pairs: units.reduce((s, u) => s + u.length, 0),
    pairsWithCondition: units.reduce((s, u) => s + u.filter(Boolean).length, 0),
    pairShare: pairShare(units),
    pairCI: bootstrap(units, pairShare),
    flagged: flagged.length,
    namedAsWritten: flagged.filter((u) => u.some(Boolean)).length,
    personShare: personShare(units),
    personCI: bootstrap(units, personShare),
  };
}

/** How much self-report misses, among those flagged by the deleted rule: measured-positive people
 * whose survey answer was no. */
function underAscertainment(id) {
  const X = people.filter((p) => p.x.includes(id));
  const m = X.filter((p) => measuredHas(p.m, id, 'measured') === true);
  const missed = m.filter((p) => !p.conditions.has(id));
  return { id, exposed: X.length, measuredPositive: m.length, selfReportMissed: missed.length };
}

const result = {
  cycle: CYCLE, n: people.length, thresholds: THRESH,
  self: analyse('self'), measured: analyse('measured'), criterion: analyse('criterion'),
  underAscertainment: ['htn', 'dm', 'ckd'].map(underAscertainment),
};
fs.writeFileSync(path.join(__dirname, `measured_ablation_${CYCLE}.json`), JSON.stringify(result, null, 1));

if (require.main === module) {
  const pc = (x) => (100 * x).toFixed(1);
  console.log(`MEASURED ABLATION, NHANES ${CYCLE} cycle, n = ${people.length}\n`);
  for (const r of [result.self, result.measured, result.criterion]) {
    console.log(`[${r.def}]  people flagged ${r.flagged}, named as written ${r.namedAsWritten}: `
      + `${pc(r.personShare)}% lack the condition (${pc(r.personCI[0])}-${pc(r.personCI[1])}); `
      + `pairs ${r.pairs}, ${pc(r.pairShare)}% (${pc(r.pairCI[0])}-${pc(r.pairCI[1])})`);
    r.perRule.forEach((q) => console.log(`    ${q.label.padEnd(24)} ${String(q.xy).padStart(4)}/${String(q.x).padEnd(4)} ${q.ppv == null ? '   -' : pc(q.ppv).padStart(5) + '%'}  (${pc(q.lo)}-${pc(q.hi)})`));
  }
  console.log('\nSelf-report misses, among those on the rule drug:');
  result.underAscertainment.forEach((u) => console.log(`    ${EN[u.id].padEnd(24)} exposed ${u.exposed}, measured positive ${u.measuredPositive}, of whom self-report said no: ${u.selfReportMissed}`));
}
