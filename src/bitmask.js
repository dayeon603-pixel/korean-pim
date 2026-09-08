/**
 * Bitmask condition matching — a constant-time implementation of Table 2 evaluation.
 *
 * Problem: Table 2 holds 18 conditions, each with several targets. Walking conditions and targets
 *       for every drug costs drugs x conditions x targets comparisons.
 *
 * Approach: fix the 18 conditions at bit positions 0 to 17 and precompute, per drug, an 18-bit mask
 *       of the conditions it matches. Evaluation is then a single AND against the patient's mask.
 *
 *   drugMask & patientMask  ->  non-zero means a hit, and each set bit is a matching condition
 *
 * A mask is computed once per drug and cached, so screening large prescription sets, where the same
 * drug recurs, no longer walks the conditions at all. Co-prescription rules such as aspirin with
 * clopidogrel are not decided by a single drug, so they stay out of the mask and are handled apart.
 *
 * The result must always agree with check() in src/index.js. test/test_bitmask.js enforces that.
 */
'use strict';
const pim = require('./index.js');

// condition id to bit position; 18 of them, order fixed
const BIT = new Map(pim.table2.map((c, i) => [c.id, i]));
const CONDITION_COUNT = pim.table2.length;
if (CONDITION_COUNT > 30) throw new Error('a 32-bit integer mask cannot hold more than 30 conditions');

// Keep only targets a single drug can decide. Co-prescription rules are excluded.
const SINGLE_TARGETS = [];
pim.table2.forEach((c) => c.targets.forEach((t) => {
  if (!t.all) SINGLE_TARGETS.push({ bit: BIT.get(c.id), cond: c, target: t });
}));
const COMBO_TARGETS = [];
pim.table2.forEach((c) => c.targets.forEach((t) => { if (t.all) COMBO_TARGETS.push({ cond: c, target: t }); }));

// Targets indexed by bit position. Only set bits are expanded, so all 59 targets are never walked.
const TARGETS_BY_BIT = Array.from({ length: CONDITION_COUNT }, () => []);
SINGLE_TARGETS.forEach((s) => TARGETS_BY_BIT[s.bit].push(s));

function targetHits(target, drug) {
  if (target.ingredient) return drug.ing === target.ingredient;
  if (target.class) return drug.cls === target.class;
  if (target.tag) return [drug.cls, ...(drug.tags || [])].includes(target.tag);
  return false;
}

/** Compute the 18-bit mask of conditions a single drug matches. */
function computeDrugMask(drug) {
  let mask = 0;
  for (let i = 0; i < SINGLE_TARGETS.length; i++) {
    const s = SINGLE_TARGETS[i];
    if (targetHits(s.target, drug)) mask |= (1 << s.bit);
  }
  return mask;
}

// Drug cache, keyed on ingredient plus class plus tags, since a caller may classify differently.
const maskCache = new Map();
function drugMask(drug) {
  const key = `${drug.ing}|${drug.cls || ''}|${(drug.tags || []).join(',')}`;
  let m = maskCache.get(key);
  if (m === undefined) { m = computeDrugMask(drug); maskCache.set(key, m); }
  return m;
}

/** Patient condition ids to an 18-bit mask. */
function conditionMask(conditionIds) {
  let mask = 0;
  (conditionIds || []).forEach((id) => { const b = BIT.get(id); if (b !== undefined) mask |= (1 << b); });
  return mask;
}

/** Normalise: read a string as an ingredient key, and fill in class and tags for Table 1 items. */
function normalize(d) {
  const base = typeof d === 'string' ? { ing: d.toLowerCase() } : { ...d, ing: String(d.ing || '').toLowerCase() };
  const known = pim.checkIngredient(base.ing);
  if (known) {
    base.cls = base.cls || known.classKey;
    base.tags = [...new Set([...(base.tags || []), ...known.tags])];
  }
  base.tags = base.tags || [];
  base.name = base.name || pim.nameKo(base.ing);
  return base;
}

/**
 * Bitmask-based combined evaluation. Produces the same result as check() in src/index.js.
 * @returns {{table1: Array, table2: Array}}
 */
function check({ drugs = [], conditions = [] } = {}) {
  const list = drugs.map(normalize);
  const pMask = conditionMask(conditions);

  const t1 = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const hit = pim.checkIngredient(list[i].ing);
    if (!hit || seen.has(hit.ingredient)) continue;
    seen.add(hit.ingredient);
    t1.push({ drug: list[i], item: hit, doseConditional: !!hit.dose });
  }

  const t2 = [];
  if (pMask !== 0) {
    // One AND per drug answers whether any condition matches.
    const active = [];
    for (let i = 0; i < list.length; i++) {
      const m = drugMask(list[i]) & pMask;
      if (m !== 0) active.push({ drug: list[i], mask: m });
    }
    // Expand only the set bits, clearing one at a time with m &= m-1 and checking that bit's targets.
    for (let i = 0; i < active.length; i++) {
      let m = active[i].mask;
      const drug = active[i].drug;
      while (m !== 0) {
        const bit = 31 - Math.clz32(m & -m);          // position of the lowest set bit
        const targets = TARGETS_BY_BIT[bit];
        for (let j = 0; j < targets.length; j++) {
          if (targetHits(targets[j].target, drug)) {
            t2.push({ condition: targets[j].cond, target: targets[j].target, drugs: [drug] });
          }
        }
        m &= m - 1;                                    // clear the bit just handled
      }
    }
    // Co-prescription rules are not decided by a single drug, so they are checked separately.
    const onIds = new Set(conditions || []);
    COMBO_TARGETS.forEach((c) => {
      if (!onIds.has(c.cond.id)) return;
      const groups = c.target.all.map((ing) => list.filter((d) => d.ing === ing)).filter((a) => a.length);
      if (groups.length === c.target.all.length) t2.push({ condition: c.cond, target: c.target, drugs: groups.map((g) => g[0]) });
    });
  }
  return { table1: t1, table2: t2 };
}

/** Collapse repeated condition-drug hits so the result can be compared against the index.js form. */
function mergeByTarget(t2) {
  const out = new Map();
  t2.forEach((h) => {
    const k = `${h.condition.id}|${h.target.token}`;
    if (!out.has(k)) out.set(k, { condition: h.condition, target: h.target, drugs: [] });
    out.get(k).drugs.push(...h.drugs);
  });
  return [...out.values()];
}

module.exports = {
  check, drugMask, conditionMask, mergeByTarget,
  CONDITION_COUNT, bitOf: (id) => BIT.get(id),
  cacheSize: () => maskCache.size,
  clearCache: () => maskCache.clear(),
};
