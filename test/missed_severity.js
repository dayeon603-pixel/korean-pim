/* Clinical importance of the missed findings — node test/missed_severity.js
 *
 * The question: are the condition findings the national standard misses clinically important, or
 * are they trivial?
 *
 * The method: enumerate every (condition x target) combination that the national drug list does not
 *   catch and Kim 2018 Table 2 does, then check each against Beers 2023 Table 3. Beers is an
 *   international standard built by a separate expert panel reviewing the evidence independently.
 *   Where two academic bodies arrived at the same condition on their own, there is a basis for
 *   treating that finding as clinically important.
 *
 * Limits
 *  - Presence in Beers is used as a proxy for clinical importance. It is not harm data.
 *  - Only Table 3 of Beers (9 condition rules) was structured here. Tables 2, 4 and 6 are not in
 *    the comparison.
 *  - The final 77 ingredient names of the national standard are unpublished, so whether a drug is
 *    caught could only be judged at class level.
 */
'use strict';
const pim = require('../src/index.js');
const beers = require('../src/beers2023.js');
const hira = require('../src/hira2022.js');

// Kim Table 2 condition id -> Beers Table 3 condition id. An empty array means no counterpart.
// Kim groups delirium, dementia and cognitive impairment into one item while Beers splits Delirium
// from Dementia, so that entry maps one to two.
const KIM_TO_BEERS = {
  dementia: ['dementia', 'delirium'],
  // Kim's falls condition reads, in the source, as a history of falls, fracture, syncope or
  // orthostatic hypotension. Beers separates Syncope into its own condition, so both are mapped.
  falls: ['falls', 'syncope'],
  parkinson: ['parkinson'],
  hf: ['hf'],
  ulcer: ['ulcer'],
  bph: ['bph'],
  insomnia: [], arrhythmia: [], htn: [], age80_primary: [], stroke_secondary: [],
  constipation: [], ckd: [], hyponatremia: [], copd: [], bleeding: [], dm: [], glaucoma: [],
};

/** Whether the drug a Table 2 target names is also caught by the 14 national classes.
 *  true = the national standard already catches it on the drug alone, false = it does not,
 *  null = the drug lies outside Table 1, so no judgement is possible. */
function targetCoveredByNational(target) {
  const probes = [];
  pim.table1.forEach((x) => {
    const d = { ing: x.ingredient, cls: x.classKey, tags: x.tags };
    // Targets in pim.table2 use ingredient/class/tag; beers2023 uses ing/cls/tag instead.
    const hit = target.ingredient ? d.ing === target.ingredient
      : target.class ? d.cls === target.class
      : target.tag ? [d.cls, ...d.tags].includes(target.tag)
      : false;
    if (hit) probes.push({ d, cat: x.classKo });
  });
  if (!probes.length) return null;
  return probes.some((p) => hira.isCovered(p.d, p.cat));
}

// The common drug set the two criteria are compared over. Alongside the 63 drugs of Table 1 it has
// to include ingredients that only Table 2 mentions, such as verapamil and theophylline, or the
// mapping does not line up.
const UNIVERSE = pim.table1.map((x) => ({ ing: x.ingredient, cls: x.classKey, tags: x.tags.slice() }));
const EXTRA_CLASS = {
  verapamil: 'ccbnd', diltiazem: 'ccbnd', pioglitazone: 'tzd', theophylline: 'xanthine',
  caffeine: 'stimulant', methylphenidate: 'stimulant', phenylephrine: 'decongest',
  pseudoephedrine: 'decongest', carbamazepine: 'anticonv', oxcarbazepine: 'anticonv',
  carboplatin: 'onco', cisplatin: 'onco', cyclophosphamide: 'onco', vincristine: 'onco',
  clopidogrel: 'antiplatelet', warfarin: 'anticoag', dabigatran: 'noac', rivaroxaban: 'noac',
  apixaban: 'noac', edoxaban: 'noac', celecoxib: 'cox2', cilostazol: 'antiplatelet',
  donepezil: 'chei', galantamine: 'chei', rivastigmine: 'chei',
};
const seenIng = new Set(UNIVERSE.map((d) => d.ing));
Object.entries(EXTRA_CLASS).forEach(([ing, cls]) => {
  if (!seenIng.has(ing)) UNIVERSE.push({ ing, cls, tags: [] });
});
// Tag fill-in, for tag-based targets such as nsaid and diuretic that a class alone does not catch.
UNIVERSE.forEach((d) => {
  if (d.cls === 'diuretic' || d.cls === 'kdiuretic') d.tags.push('diuretic');
  if (d.cls === 'nsaid') d.tags.push('nsaid', 'nsaid_ns');
  if (d.cls === 'cox2') d.tags.push('cox2');
  if (d.cls === 'bb') d.tags.push('betablocker');
  if (d.cls === 'cortico') d.tags.push('corticosteroid');
  if (d.cls === 'anticonv') d.tags.push('anticonvulsant');
  if (d.cls === 'ssri' || d.cls === 'anticholinergic') d.tags.push('antidepressant');
  d.tags = [...new Set(d.tags)];
});

/** Resolves one target to a set of drugs. kim uses ingredient/class/tag, beers uses ing/cls/tag. */
function resolveTarget(t, kind) {
  const ing = kind === 'kim' ? t.ingredient : t.ing;
  const cls = kind === 'kim' ? t.class : t.cls;
  const tag = t.tag;
  const out = new Set();
  UNIVERSE.forEach((d) => {
    if (ing && d.ing === ing) out.add(d.ing);
    else if (cls && d.cls === cls) out.add(d.ing);
    else if (tag && [d.cls, ...d.tags].includes(tag)) out.add(d.ing);
  });
  return out;
}

const rows = [];
pim.table2.forEach((c) => {
  c.targets.forEach((t) => {
    if (t.all) return;                                  // co-prescription rules are a different kind
    const covered = targetCoveredByNational(t);
    if (covered === true) return;                       // already caught on the drug alone
    const beersIds = KIM_TO_BEERS[c.id] || [];
    // The two criteria name the same target at different levels. For heart failure, Kim writes an
    // ingredient (verapamil) where Beers writes a class (non-dihydropyridine CCB). Comparing the
    // fields directly would miss the match, so both sides are resolved to drug sets and intersected.
    const kimSet = resolveTarget(t, 'kim');
    const inBeers = beersIds.some((bid) => {
      const bc = beers.TABLE3.find((b) => b.id === bid);
      if (!bc) return false;
      return bc.targets.some((bt) => {
        const bSet = resolveTarget(bt, 'beers');
        return [...kimSet].some((x) => bSet.has(x));
      });
    });
    rows.push({ cond: c.label, condId: c.id, target: t.nameKo, inBeers, judgable: covered !== null });
  });
});

const inB = rows.filter((r) => r.inBeers);
const notB = rows.filter((r) => !r.inBeers);
const pct = (n) => (n / rows.length * 100).toFixed(1);

/** Prints the report. Must not run when another script imports the figures only. */
function report() {
  console.log('Clinical importance of the condition findings the national standard misses\n');
  console.log(`(condition x target) combinations the national drug list does not catch: ${rows.length}`);
  console.log(`  also listed in Beers 2023 Table 3   ${inB.length} (${pct(inB.length)}%)`);
  console.log(`  present in Kim 2018 only           ${notB.length} (${pct(notB.length)}%)`);

  console.log('\n-- combinations both academic standards arrived at independently --');
  inB.forEach((r) => console.log(`  ${r.cond} + ${r.target}`));

  console.log('\n-- combinations unique to Kim 2018 --');
  const byCond = {};
  notB.forEach((r) => { (byCond[r.cond] = byCond[r.cond] || []).push(r.target); });
  Object.entries(byCond).forEach(([c, ts]) => console.log(`  ${c.padEnd(24)} ${ts.join(', ')}`));

  console.log('\nNote: presence in Beers is a proxy for clinical importance, not harm data.');
  console.log('Note: only Table 3 of Beers was structured. Tables 2, 4 and 6 are not in the comparison.');
  console.log('Note: the final ingredient names of the national standard are unpublished, so the');
  console.log('      judgement could only be made at class level.');
}

if (require.main === module) report();

module.exports = { total: rows.length, inBeers: inB.length, kimOnly: notB.length, rows };
