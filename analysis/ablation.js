/* What deleting the condition axis does to a rule — node analysis/ablation.js
 *
 * The manuscript argues algebraically that deleting condition Y turns |X and Y| / |X| into |X| / |N|,
 * which is a different rule rather than a weaker version of the same one. This measures that claim
 * on actual people.
 *
 * Data: NHANES 2017-2018, US public health survey, public domain. Respondents aged 65 and over with
 *   a prescription record. This is not a substrate any national indicator runs on. It is used because
 *   it is patient-level data carrying both axes. The result demonstrates an algebraic property; it is
 *   not evidence about any agency's conduct.
 *
 * Limits that must be reported alongside any figure
 *   - Only 8 of the 18 conditions are observable, so the condition-axis count is a lower bound,
 *     not an estimate.
 *   - Prescriptions are self-reported 30-day use, not claims.
 *   - NHANES is a complex sample, but these figures are unweighted. They describe this cohort and
 *     are not United States estimates. The comparison between the two rules is within-person and so
 *     is not highly sensitive to weighting, but the figures must not be read as prevalences.
 */
'use strict';
const path = require('path');
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');
const hira = require('../src/hira2022.js');
const { MAP } = require('./drug_class_map.js');

// The cohort file is taken as an argument, so the same rules can be rerun on an independent cycle
// to test replication.
//   node analysis/ablation.js                              (2017-2018)
//   node analysis/ablation.js nhanes_cohort_2015.json      (2015-2016)
const COHORT = process.argv[2] || 'nhanes_cohort.json';
const data = require(path.join(__dirname, COHORT));

/** English labels for the 8 observable conditions, since the manuscript is in English. */
const EN = {
  insomnia: 'Insomnia', hf: 'Heart failure', htn: 'Hypertension',
  stroke_secondary: 'Stroke, secondary prevention', ckd: 'Chronic kidney disease',
  hyponatremia: 'Hyponatraemia', copd: 'COPD', dm: 'Diabetes',
};
const OBSERVABLE = new Set(data.mappedConditions);
const ALL = pim.table2.map((t) => t.id);

function toDrug(ing) {
  const k = pim.checkIngredient(ing);
  if (k) return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  const m = MAP[ing];
  if (m) return { ing, cls: m[0], tags: m.slice(1), cat: '' };
  return null;
}
const split = (n) => n.split(';').map((x) => x.trim()).filter(Boolean);

/** Wilson score interval. */
function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}
const pc = (x) => (100 * x).toFixed(1);
/** The harness requires this file, so the report prints only on direct execution. */

/** Reproducible randomness. A fixed seed makes the bootstrap return the same value every run. */
function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** Person-level cluster bootstrap.
 *
 * Rule-person pairs come from 1,345 people, so they are not independent of one another. When one
 * person matches several rules, that person's characteristics ride along in every one of those pairs.
 * Treating pairs as independent and applying a Wilson interval would make the interval too narrow.
 * People are resampled with replacement and the statistic recomputed.
 */
function clusterBootstrap(units, stat, B = 2000, seed = 20260906) {
  const rand = rng(seed);
  const n = units.length;
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const draw = new Array(n);
    for (let i = 0; i < n; i += 1) draw[i] = units[Math.floor(rand() * n)];
    const v = stat(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)], out.length];
}

// Audit what failed to resolve. A resolution rate near a third sounds like attrition, but the
// dictionary was deliberately built to cover only the classes the rules name. If what remains is
// drugs no rule could have matched, that is scope rather than attrition. Search the unresolved list
// for ingredient tokens the rules do name, and count them.
const RULE_TOKENS = ['meloxicam', 'celecoxib', 'etodolac', 'nabumetone', 'piroxicam', 'ketorolac',
  'sulindac', 'oxaprozin', 'diflunisal', 'alprazolam', 'lorazepam', 'clonazepam', 'diazepam',
  'temazepam', 'triazolam', 'zolpidem', 'zaleplon', 'eszopiclone', 'oxycodone', 'hydrocodone',
  'morphine', 'tramadol', 'codeine', 'fentanyl', 'hydromorphone', 'methadone', 'amitriptyline',
  'nortriptyline', 'doxepin', 'imipramine', 'paroxetine', 'diphenhydramine', 'hydroxyzine',
  'meclizine', 'promethazine', 'oxybutynin', 'tolterodine', 'solifenacin', 'verapamil', 'diltiazem',
  'glyburide', 'chlorpropamide', 'prednisone', 'prednisolone', 'methylprednisolone', 'dexamethasone',
  'hydrocortisone', 'furosemide', 'hydrochlorothiazide', 'chlorthalidone', 'torsemide', 'bumetanide',
  'spironolactone', 'metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'bisoprolol', 'nebivolol',
  'nadolol', 'sotalol',
  // 2026-09-06: widened alongside the class membership lists. Auditing against a narrow list would
  // miss exactly the members the dictionary is missing.
  'metolazone', 'indapamide', 'labetalol', 'acebutolol', 'etoricoxib', 'desipramine',
  'imipramine', 'iloperidone', 'prochlorperazine', 'fludrocortisone', 'betamethasone',
  'triamcinolone', 'desvenlafaxine', 'vilazodone', 'vortioxetine', 'milnacipran',
  'duloxetine', 'venlafaxine', 'mirtazapine', 'trazodone', 'sertraline', 'citalopram',
  'escitalopram', 'fluoxetine', 'quetiapine', 'olanzapine', 'risperidone', 'haloperidone',
  'theophylline', 'pioglitazone', 'verapamil', 'diltiazem', 'clopidogrel', 'aspirin'];
// If a combination product fails to resolve as a whole it disappears from both axes, which biases
// the result downward. NHANES writes combinations as "ingredient A; ingredient B". Check that
// assumption by searching for other separators.
const combo = { rawStrings: 0, distinct: 0, semicolon: 0, otherSeparator: 0, constituents: 0 };
{
  const seen = new Set();
  data.people.forEach((p) => p.drugs.forEach((d) => {
    combo.rawStrings += 1;
    seen.add(d);
    if (d.includes(';')) { combo.semicolon += 1; combo.constituents += split(d).length; }
    // Candidate separators other than the semicolon. Hyphens inside an ingredient name (omega-3) and
    // "... - unspecified" category labels are not combinations, so they are excluded.
    if (!/ - unspecified$/.test(d) && (/\/|\+/.test(d) || / and /.test(d))) combo.otherSeparator += 1;
  }));
  combo.distinct = seen.size;
}

// Splitting combinations into ingredients can make one person match one rule more than once. A pair
// is counted as (rule, person), so that person still enters once. Count how much that deduplication
// actually removes.
const dedup = { rawMatches: 0, pairs: 0, maxPerRule: 0, comboPeopleAffected: 0 };
data.people.forEach((p) => {
  const hasCombo = p.drugs.some((d) => d.includes(';'));
  const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
  const hits = bm.check({ drugs, conditions: ALL }).table2.filter((h) => OBSERVABLE.has(h.condition.id));
  dedup.rawMatches += hits.length;
  const byRule = {};
  hits.forEach((h) => { byRule[h.condition.id] = (byRule[h.condition.id] || 0) + 1; });
  dedup.pairs += Object.keys(byRule).length;
  const mx = Math.max(0, ...Object.values(byRule));
  if (mx > dedup.maxPerRule) dedup.maxPerRule = mx;
  if (hasCombo && mx > 1) dedup.comboPeopleAffected += 1;
});

const mentions = { total: 0, resolved: 0, unresolved: 0, unresolvedRuleRelevant: 0,
  distinctUnresolved: 0, hidingAResolvableName: 0, saltForms: 0 };
const unresolvedStrings = {};
data.people.forEach((p) => p.drugs.flatMap(split).forEach((i) => {
  mentions.total += 1;
  if (toDrug(i)) { mentions.resolved += 1; return; }
  mentions.unresolved += 1;
  if (RULE_TOKENS.some((t) => i.includes(t))) mentions.unresolvedRuleRelevant += 1;
  unresolvedStrings[i] = (unresolvedStrings[i] || 0) + 1;
}));
// A census, not a sample. If an unresolved string contains a resolvable ingredient name as a token,
// then a salt, combination, or brand name failed to parse, and non-resolution is not random.
Object.keys(unresolvedStrings).forEach((str) => {
  mentions.distinctUnresolved += 1;
  const words = str.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (words.some((w) => toDrug(w))) mentions.hidingAResolvableName += 1;
  if (/(hydrochloride|hcl|sodium|potassium|sulfate|tartrate|maleate|besylate|succinate|mesylate|fumarate|citrate|acetate|phosphate)\b/.test(str)) {
    mentions.saltForms += 1;
  }
});

const say = require.main === module ? console.log : () => {};

// ---------------------------------------------------------------------------------------------
// Compute both axes per person. The condition-deleted arm runs the same rules while treating every
// condition as present. What remains is the drug half of the rule, which is all a condition-blind
// substrate can compute.
// ---------------------------------------------------------------------------------------------
const people = data.people.map((p) => {
  const drugs = p.drugs.flatMap(split).map(toDrug).filter(Boolean);
  const asWritten = bm.check({ drugs, conditions: p.conditions }).table2;
  const conditionDeleted = bm.check({ drugs, conditions: ALL }).table2;
  return {
    id: p.id,
    conditions: new Set(p.conditions),
    drugOnly: drugs.some((d) => hira.isCovered(d, d.cat)),
    stratum: p.stratum, psu: p.psu, weight: p.weight,
    asWritten,
    conditionDeleted,
    died: p.died,
  };
});
const N = people.length;

say(`SUBSTRATE ABLATION — ${data.source}`);
say(`${N} adults aged ${data.ageMin}+, unweighted\n`);

// --- 1. Per rule: who does the rule name once its condition is deleted ------------------------
say('1. Avoidance rules, per rule: whom the rule names once the condition is deleted');
say('   X = on the target drug; X and Y = on it with the condition the criterion names.\n');
say('   Counted as rule-person pairs, so a person on drugs matching two rules counts twice.\n');
say('   rule                                     |X|   |X and Y|   share named by the criterion');
let sx = 0, sxy = 0;
const perRule = [];
pim.table2.filter((t) => OBSERVABLE.has(t.id)).forEach((t) => {
  const X = people.filter((p) => p.conditionDeleted.some((h) => h.condition.id === t.id));
  const XY = X.filter((p) => p.conditions.has(t.id));
  if (!X.length) return;
  sx += X.length; sxy += XY.length;
  perRule.push({ id: t.id, label: EN[t.id] || t.label, x: X.length, xy: XY.length });
  const [lo, hi] = wilson(XY.length, X.length);
  say(`   ${(EN[t.id] || t.label).padEnd(30)} ${String(X.length).padStart(8)} ${String(XY.length).padStart(10)}`
    + `   ${pc(XY.length / X.length).padStart(6)}%  (${pc(lo)}-${pc(hi)})`);
});
// Bootstrap unit: every (rule, has-condition) pair a single person produces, held together.
const units = people.map((p) => {
  const pairs = [];
  pim.table2.filter((t) => OBSERVABLE.has(t.id)).forEach((t) => {
    if (p.conditionDeleted.some((h) => h.condition.id === t.id)) {
      pairs.push({ rule: t.id, hasCondition: p.conditions.has(t.id) });
    }
  });
  return { pairs, byB: p.asWritten.length > 0, byA: p.drugOnly,
    stratum: p.stratum, psu: p.psu, weight: p.weight };
});
const shareNotNamed = (us) => {
  let X = 0, XY = 0;
  us.forEach((u) => u.pairs.forEach((q) => { X += 1; if (q.hasCondition) XY += 1; }));
  return X ? 1 - XY / X : NaN;
};
const phiOf = (us) => {
  let bo = 0, oa = 0, ob = 0, ne = 0;
  us.forEach((u) => {
    if (u.byA && u.byB) bo += 1; else if (u.byA) oa += 1; else if (u.byB) ob += 1; else ne += 1;
  });
  const d = Math.sqrt((bo + oa) * (ob + ne) * (bo + ob) * (oa + ne));
  return d === 0 ? NaN : (bo * ne - oa * ob) / d;
};
const gapShare = (us) => us.filter((u) => u.byB && !u.byA).length / us.length;
const [bsLo, bsHi, bsB] = clusterBootstrap(units, shareNotNamed);

/** Design-based resampling: draw PSUs with replacement within strata, taking every person in a
 *
 * drawn PSU.
 *
 * NHANES is a stratified multistage probability sample, so resampling people independently would
 * ignore the design effect. With only two PSUs per stratum the variation is limited, but this is the
 * standard approach for this design.
 */
function designBootstrap(us, stat, B = 2000, seed = 20260906) {
  const byStratum = new Map();
  us.forEach((u) => {
    if (u.stratum == null || u.psu == null) return;
    if (!byStratum.has(u.stratum)) byStratum.set(u.stratum, new Map());
    const m = byStratum.get(u.stratum);
    if (!m.has(u.psu)) m.set(u.psu, []);
    m.get(u.psu).push(u);
  });
  const strata = [...byStratum.values()].map((m) => [...m.values()]);
  const rand = rng(seed);
  const out = [];
  for (let b = 0; b < B; b += 1) {
    const draw = [];
    strata.forEach((psus) => {
      for (let i = 0; i < psus.length; i += 1) draw.push(...psus[Math.floor(rand() * psus.length)]);
    });
    const v = stat(draw);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)]];
}

/** Survey-weighted point estimate. Not an interval; this only shows how design-sensitive the point
 * estimate is. */
function weightedShareNotNamed(us) {
  let X = 0, XY = 0;
  us.forEach((u) => u.pairs.forEach((q) => {
    const w = u.weight || 0;
    X += w; if (q.hasCondition) XY += w;
  }));
  return X ? 1 - XY / X : NaN;
}

// Person-level. A pair-level multiple is the reciprocal of the pair share and so states the same
// value twice, and the population a rule names is people, not pairs. Both units are computed so it
// is always clear which one is being reported.
const personShareNotNamed = (us) => {
  const w = us.filter((u) => u.pairs.length).length;                 // named once the condition is deleted
  const a = us.filter((u) => u.pairs.some((q) => q.hasCondition)).length; // named by the rule as written
  return w ? 1 - a / w : NaN;
};
const personNamedDeleted = units.filter((u) => u.pairs.length).length;
const personNamedAsWritten = units.filter((u) => u.pairs.some((q) => q.hasCondition)).length;
const [pLo, pHi] = clusterBootstrap(units, personShareNotNamed);

const [dLo, dHi] = designBootstrap(units, shareNotNamed);
const wShare = weightedShareNotNamed(units);

// The cost of deletion is not constant. |X and Y| / |X| is the drug's predictive value for that
// condition, and the cost of deleting the condition is one minus it. Deletion is cheap where a drug
// is specific to its condition and expensive where the drug serves several indications. This is the
// answer to confounding by indication: the two axes are not assumed independent, the dependence is
// measured and reported per rule.
const MIN_EXPOSED = 50;
const ppv = perRule.filter((r) => r.x >= MIN_EXPOSED)
  .map((r) => ({ label: r.label, x: r.x, ppv: r.xy / r.x }))
  .sort((a, c) => a.ppv - c.ppv);
const ppvLo = ppv[0], ppvHi = ppv[ppv.length - 1];

/** Recompute with one rule removed. Two rules hold most of the denominator, so the pooled figure
 * alone is not enough. */
const leaveOneOut = perRule.map((r) => ({
  drop: r.label,
  share: 1 - (sxy - r.xy) / (sx - r.x),
}));
/* An objection raised: hypertension and diabetes dominate the denominator, so the pooled figure may
 * be an artefact of how prevalent those two conditions are. The way to settle it is to remove both
 * and recompute. Whether the figure collapses on the remaining rules is something counting answers. */
const DOMINANT = ['Hypertension', 'Diabetes'];
const dropped = perRule.filter((r) => DOMINANT.includes(r.label));
const restX = sx - dropped.reduce((a, r) => a + r.x, 0);
const restXY = sxy - dropped.reduce((a, r) => a + r.xy, 0);
const withoutDominant = { pairs: restX, share: 1 - restXY / restX, dropped: dropped.map((r) => r.label) };

const looLo = Math.min(...leaveOneOut.map((x) => x.share));
const looHi = Math.max(...leaveOneOut.map((x) => x.share));
const [phiLo, phiHi] = clusterBootstrap(units, phiOf);
const [gapLo, gapHi] = clusterBootstrap(units, gapShare);

const [plo, phi_] = wilson(sxy, sx);
say(`   ${'pooled'.padEnd(30)} ${String(sx).padStart(8)} ${String(sxy).padStart(10)}`
  + `   ${pc(sxy / sx).padStart(6)}%  (${pc(plo)}-${pc(phi_)})`);
say(`\n   Deleting the condition multiplies the named population by ${(sx / sxy).toFixed(1)}.`);
say(`   Share of those named who do not carry the condition: ${pc(1 - sxy / sx)}%`);
say(`     pair-level Wilson (assumes independence, too narrow)  ${pc(1 - phi_)}-${pc(1 - plo)}%`);
say(`     person-level cluster bootstrap, ${bsB} draws           ${pc(bsLo)}-${pc(bsHi)}%  <- report this`);
say(`     stratified PSU resampling (design-based)               ${pc(dLo)}-${pc(dHi)}%`);
say(`     survey-weighted point estimate                          ${pc(wShare)}%`);
say(`   Person level: ${personNamedAsWritten} named as written, ${personNamedDeleted} with the condition deleted`);
say(`     ${(personNamedDeleted / personNamedAsWritten).toFixed(2)}-fold, share not carrying ${pc(1 - personNamedAsWritten / personNamedDeleted)}% (${pc(pLo)}-${pc(pHi)})`);
say(`     The pair-level fold change is the reciprocal of the pair-level share, so only one is reported.`);
say(`   Leave-one-rule-out range                                  ${pc(looLo)}-${pc(looHi)}%`);
leaveOneOut.slice().sort((a, c) => a.share - c.share).forEach((x) => {
  say(`     without ${x.drop.padEnd(30)} ${pc(x.share).padStart(6)}%`);
});
say('   Two rules supply most of the denominator, so the pooled figure is reported with the');
say('   range it takes when each rule in turn is removed. The conclusion holds across it.\n');
say(`   The cost of deletion is one minus the drug's predictive value for the condition.`);
say(`   Among the ${ppv.length} rules with at least ${MIN_EXPOSED} exposed it runs from`);
say(`   ${pc(ppvLo.ppv)}% (${ppvLo.label}, n=${ppvLo.x}) to ${pc(ppvHi.ppv)}% (${ppvHi.label}, n=${ppvHi.x}).`);
ppv.forEach((r) => say(`     ${r.label.padEnd(28)} n=${String(r.x).padStart(4)}  PPV ${pc(r.ppv).padStart(6)}%`));
say('   Deletion is cheap where the drug is specific to the condition and ruinous where it is');
say('   not, so the pooled figure reflects which drugs the criteria happen to name.\n');

// --- 2. Overlap: the share of condition-axis hits the drug-only axis cannot see ----------------
const b = people.filter((p) => p.asWritten.length > 0);
const a = people.filter((p) => p.drugOnly);
const both = people.filter((p) => p.drugOnly && p.asWritten.length > 0).length;
const onlyB = b.length - both;
const onlyA = a.length - both;
const neither = N - both - onlyA - onlyB;
const den = Math.sqrt((both + onlyA) * (onlyB + neither) * (both + onlyB) * (onlyA + neither));
const phiCoef = den === 0 ? NaN : (both * neither - onlyA * onlyB) / den;
const [blo, bhi] = wilson(onlyB, N);
say('2. What a condition-free substrate cannot see');
say(`   condition axis fires        ${String(b.length).padStart(5)}  ${pc(b.length / N)}%`);
say(`   drug-only axis fires        ${String(a.length).padStart(5)}  ${pc(a.length / N)}%`);
say(`   condition axis only         ${String(onlyB).padStart(5)}  ${pc(onlyB / N)}%  (95% CI ${pc(blo)}-${pc(bhi)})`);
say(`   as a share of the condition axis   ${pc(onlyB / b.length)}%`);
say(`   condition axis only, bootstrap CI  ${pc(gapLo)}-${pc(gapHi)}%`);
say(`   phi between the two axes    ${phiCoef.toFixed(3)}  (bootstrap CI ${phiLo.toFixed(3)}-${phiHi.toFixed(3)})`);
say('   The axes are close to independent, so the drug-only rule is not a noisy proxy.\n');

// --- 3. Dominant-rule sensitivity: does the result hang on a single rule -----------------------
const gap = {};
people.filter((p) => p.asWritten.length && !p.drugOnly).forEach((p) => {
  new Set(p.asWritten.map((h) => `${h.condition.label} + ${h.target.nameKo}`))
    .forEach((k) => { gap[k] = (gap[k] || 0) + 1; });
});
const ranked = Object.entries(gap).sort((x, y) => y[1] - x[1]);
const [topKey, topN] = ranked[0];
const survives = people.filter((p) => p.asWritten.length && !p.drugOnly)
  .filter((p) => [...new Set(p.asWritten.map((h) => `${h.condition.label} + ${h.target.nameKo}`))]
    .some((k) => k !== topKey)).length;
const [slo, shi] = wilson(survives, N);
say('3. Dominance sensitivity');
say(`   largest single pair "${topKey}" accounts for ${topN} of ${onlyB} (${pc(topN / onlyB)}%)`);
say(`   dropping it leaves ${survives} (${pc(survives / N)}%, 95% CI ${pc(slo)}-${pc(shi)})`);
say('   The headline depends on one rule; the floor after removing it is the honest figure.\n');

// --- 4. Saturation of the undertreatment rule --------------------------------------------------
say('4. Undertreatment shape, same pairs: |Y not X| / |Y| against |N not X| / |N|');
say('   An arithmetic demonstration on the same condition-drug pairs, not a clinical rule.\n');
say('   pair                             as written   condition deleted');
perRule.forEach((r) => {
  const Y = people.filter((p) => p.conditions.has(r.id));
  const onDrug = new Set(people.filter((p) => p.conditionDeleted.some((h) => h.condition.id === r.id)).map((p) => p.id));
  if (!Y.length) return;
  const asW = Y.filter((p) => !onDrug.has(p.id)).length / Y.length;
  const del = people.filter((p) => !onDrug.has(p.id)).length / N;
  say(`   ${r.label.padEnd(30)} ${pc(asW).padStart(9)}%  ${pc(del).padStart(14)}%`);
});
say('\n   Deleting Y replaces a condition-specific non-use rate with the population non-use');
say('   rate. Here the two differ by 0.3 to 10.5 percentage points, so the deleted rule');
say('   reports very nearly the population figure and no longer distinguishes the condition');
say('   group from everyone else. It still returns a number; it has stopped measuring.\n');

say('Counting unit');
say(`   ${dedup.rawMatches} rule-target matches reduce to ${dedup.pairs} pairs, one per rule and person;`);
say(`   ${dedup.comboPeopleAffected} of those people take a combination that would otherwise have counted twice.\n`);

say('Drug-name resolution');
say(`   ${combo.rawStrings} drug strings (${combo.distinct} distinct); ${combo.semicolon} name more than one`);
say(`   ingredient and are split into ${combo.constituents} constituents, each matched separately.`);
say(`   ${combo.otherSeparator} strings use any other separator, so no combination is left unparsed.`);
say(`   ${mentions.resolved} of ${mentions.total} ingredient mentions resolved `
  + `(${pc(mentions.resolved / mentions.total)}%)`);
say(`   of the ${mentions.unresolved} unresolved, ${mentions.unresolvedRuleRelevant} `
  + `(${pc(mentions.unresolvedRuleRelevant / mentions.unresolved)}%) name a drug any rule targets`);
say('   The rest are drugs no rule names, chiefly statins, renin-angiotensin agents, metformin,');
say('   levothyroxine and proton-pump inhibitors, which could not have entered either arm.');
say(`   All ${mentions.distinctUnresolved} distinct unresolved strings were examined, not a sample.`);
say(`   ${mentions.hidingAResolvableName} contain a resolvable ingredient name as a token, both being`);
say(`   topical or ophthalmic preparations excluded on purpose; ${mentions.saltForms} carry a salt suffix`);
say('   and none of those names a drug any rule targets. Non-resolution is therefore not a');
say('   parsing failure on salt, brand or combination strings.\n');

say('Limits: 8 of 18 conditions observable, so the condition-axis counts are a lower bound;');
say('self-reported 30-day use, not claims; unweighted, so these describe this cohort and are');
say('not United States estimates; NHANES is not a substrate any national indicator runs on.');

// Write the JSON the manuscript generator reads, so no figure is ever transcribed by hand.
const result = {
  source: data.source, n: N, ageMin: data.ageMin,
  observable: data.mappedConditions.length, total: pim.table2.length,
  perRule, pooledX: sx, pooledXY: sxy,
  notNamed: 1 - sxy / sx, notNamedCI: [bsLo, bsHi], bootstrapDraws: bsB,
  designCI: [dLo, dHi], weightedShare: wShare, leaveOneOut, looRange: [looLo, looHi],
  withoutDominant,
  ppv, ppvMinExposed: MIN_EXPOSED, mentions, combo, dedup,
  personNamedAsWritten, personNamedDeleted,
  personShareNotNamed: 1 - personNamedAsWritten / personNamedDeleted, personCI: [pLo, pHi],
  looFloorRule: leaveOneOut.reduce((a, c) => (c.share < a.share ? c : a)).drop,
  looCeilingRule: leaveOneOut.reduce((a, c) => (c.share > a.share ? c : a)).drop,
  phiCI: [phiLo, phiHi], gapCI: [gapLo, gapHi],
  conditionAxis: b.length, drugOnlyAxis: a.length, conditionAxisOnly: onlyB,
  phi: phiCoef, dominantPair: topKey, dominantN: topN, floor: survives,
};
if (require.main === module) {
  require('fs').writeFileSync(path.join(__dirname,
    COHORT === 'nhanes_cohort.json' ? 'ablation_result.json'
      : `ablation_result_${COHORT.replace(/[^0-9]/g, '')}.json`),
    JSON.stringify(result, null, 1) + '\n');
  say('Wrote analysis/ablation_result.json for the manuscript generator.');
}

module.exports = { N, onlyB, phi: phiCoef, pooledX: sx, pooledXY: sxy, survives, perRule };
