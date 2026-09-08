/* Bitmask engine equivalence — node test/test_bitmask.js
 * An optimisation must not change the result. Random combinations are run through index.js and
 * bitmask.js and the two outputs are compared. */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');

let pass = 0, fail = 0; const failed = [];
const check = (n, c) => { if (c) pass++; else { fail++; failed.push(n); console.log(`  ✗ ${n}`); } };

// Reproducible pseudo-random numbers (LCG), fixed seed.
let seed = 20260902;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr, n) => { const c = [...arr]; const out = []; for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };

const ALL_ING = pim.table1.map((x) => x.ingredient)
  .concat(['verapamil', 'diltiazem', 'pioglitazone', 'theophylline', 'caffeine', 'methylphenidate',
           'phenylephrine', 'pseudoephedrine', 'carbamazepine', 'warfarin', 'clopidogrel',
           'apixaban', 'amlodipine', 'metformin', 'simvastatin']);
const ALL_COND = pim.conditions.map((c) => c.id);

const key = (h) => `${h.condition.id}|${h.target.token}|${h.drugs.map((d) => d.ing).sort().join(',')}`;
const norm = (arr) => arr.map(key).sort().join('||');

console.log('Bitmask engine equivalence\n');
check('the 18 conditions occupy 18 distinct bits', new Set(pim.conditions.map((c) => bm.bitOf(c.id))).size === 18);
check('bit positions fall in 0..17', pim.conditions.every((c) => bm.bitOf(c.id) >= 0 && bm.bitOf(c.id) < 18));
check('no conditions gives mask 0', bm.conditionMask([]) === 0);
check('all conditions sets all 18 bits', bm.conditionMask(ALL_COND) === (1 << 18) - 1);
check('an unknown condition id is ignored', bm.conditionMask(['no-such-condition']) === 0);
check('the mask is computed once per drug and cached', (() => {
  bm.clearCache();
  const d = { ing: 'zolpidem', cls: 'zdrug', tags: ['zolpidem'] };
  bm.drugMask(d); bm.drugMask(d); bm.drugMask(d);
  return bm.cacheSize() === 1;
})());

// ── 500 random comparisons ──
let mismatch = 0;
for (let i = 0; i < 500; i++) {
  const drugs = pick(ALL_ING, 1 + Math.floor(rnd() * 12));
  const conds = pick(ALL_COND, Math.floor(rnd() * 6));
  const a = pim.check({ drugs, conditions: conds });
  const b = bm.check({ drugs, conditions: conds });
  if (norm(a.table2) !== norm(bm.mergeByTarget(b.table2))) { mismatch++;
    if (mismatch <= 3) console.log('  mismatch:', JSON.stringify({ drugs, conds })); }
  if (a.table1.length !== b.table1.length) { mismatch++; }
}
check(`500 random combinations match the original engine (${mismatch} mismatches)`, mismatch === 0);

// ── edge cases ──
check('empty input behaves the same', bm.check({ drugs: [], conditions: [] }).table2.length === 0);
check('no conditions yields no Table 2 finding', bm.check({ drugs: ALL_ING, conditions: [] }).table2.length === 0);
check('the co-prescription rule (aspirin + clopidogrel) fires',
  bm.check({ drugs: ['aspirin', 'clopidogrel'], conditions: ['stroke_secondary'] }).table2.some((h) => h.target.all));
check('aspirin alone does not fire the co-prescription rule',
  !bm.check({ drugs: ['aspirin'], conditions: ['stroke_secondary'] }).table2.some((h) => h.target.all));
check('a Table 1 finding is reported once per ingredient', bm.check({ drugs: ['diazepam', 'diazepam'] }).table1.length === 1);

console.log(`\nbitmask equivalence: ${pass} passed / ${fail} failed (${pass + fail} checks)`);
if (fail) { console.log('failed:\n - ' + failed.join('\n - ')); process.exit(1); }
