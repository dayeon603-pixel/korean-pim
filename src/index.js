/**
 * korean-pim — decision library for the Korean consensus list of potentially inappropriate
 *
 * medications (PIM) for older adults, 2018.
 *
 * Source article:
 *   Kim MY, Etherton-Beer C, Kim CB, Yoon JL, Ga H, Kim HC, Song JS, Kim KI, Won CW.
 *   Development of a Consensus List of Potentially Inappropriate Medications for Korean Older Adults.
 *   Ann Geriatr Med Res 2018;22(3):121-129.  DOI 10.4235/agmr.2018.22.3.121
 *
 * Scope: Table 1, 63 drug-only items, plus Table 2, 18 condition-dependent rules. 102 unique items.
 * Every verdict is deterministic and no inference model is used, so the same input always produces
 * the same output.
 *
 * Read DATA_NOTICE.md before any clinical use. The data was digitised through a secondary summary
 * path and source verification is incomplete. This library does not replace a physician's or
 * pharmacist's judgment.
 */
'use strict';

const RAW = require('../data/pim_kr_2018.json');

const table1 = RAW.table1_regardless_of_condition.map((x) => Object.freeze({
  drug: x.drug,          // as printed in the article
  ingredient: x.ing,     // ingredient key, lowercase Latin
  nameKo: x.kr,          // Korean ingredient name
  classKey: x.cls,       // class key, used to match Table 2's class-level rules
  atc: x.atc || null,    // WHO ATC five-level code; null when no single code applies, with the reason in atcNote
  atcNote: x.atc_note || null,
  classKo: x.cat,        // Korean display name for the class
  group: x.class,        // the article's own drug grouping
  tags: Object.freeze(x.tags || []),
  reason: x.reason,      // rationale, as given in the article
  dose: x.dose || null,  // dose condition, where the item carries one
}));

const table2 = RAW.table2_by_condition.map((c) => Object.freeze({
  id: c.id,
  condition: c.condition,   // condition as printed in the article
  label: c.label,           // short label for input forms
  kind: c.kind,             // diagnosis / history / symptom / state / age
  reason: c.reason,
  targets: Object.freeze(c.match.map((m) => Object.freeze({
    token: m.token,   // as printed in the article
    nameKo: m.kr,
    ingredient: m.ing || null,
    class: m.cls || null,
    tag: m.tag || null,
    all: m.all ? Object.freeze(m.all) : null,  // co-prescription condition; all must be present
    dose: m.dose || null,
    note: m.note || null,
  }))),
}));

const byIngredient = new Map(table1.map((x) => [x.ingredient, x]));
const byCondition = new Map(table2.map((c) => [c.id, c]));

// Ingredient key to Korean name. Covers ingredients that appear only in Table 2, such as warfarin
// and verapamil, so they can still be named.
const nameKoByIngredient = new Map(table1.map((x) => [x.ingredient, x.nameKo]));
table2.forEach((c) => c.targets.forEach((t) => {
  if (t.ingredient && !nameKoByIngredient.has(t.ingredient)) nameKoByIngredient.set(t.ingredient, t.nameKo);
  if (t.all) t.all.forEach((ing) => { if (!nameKoByIngredient.has(ing)) nameKoByIngredient.set(ing, ing); });
}));

/** Korean name for an ingredient key. Known ingredients only; anything else is returned unchanged. */
function nameKo(ingredient) {
  const k = String(ingredient || '').toLowerCase();
  return nameKoByIngredient.get(k) || k;
}

const t1Names = new Set(table1.map((x) => x.drug));
const t2Tokens = new Set(table2.flatMap((c) => c.targets.map((t) => t.token)));
const coverage = Object.freeze({
  table1: table1.length,
  table2Conditions: table2.length,
  table2Only: [...t2Tokens].filter((t) => !t1Names.has(t)).length,
  unique: new Set([...t1Names, ...t2Tokens]).size,
});

const conditions = table2.map((c) => Object.freeze({ id: c.id, label: c.label, kind: c.kind, condition: c.condition }));

const byAtc = new Map(table1.filter((x) => x.atc).map((x) => [x.atc, x]));

/** Look up a Table 1 item by five-level ATC code. The join point for systems on standard codes. */
function checkAtc(code) { return code ? byAtc.get(String(code).toUpperCase()) || null : null; }

/** Ingredient key to Table 1 item. Exact match only, never class inference. null if absent. */
function checkIngredient(ingredient) {
  if (!ingredient) return null;
  return byIngredient.get(String(ingredient).toLowerCase()) || null;
}

/** Whether the ingredient is on Table 1. */
function isTable1(ingredient) { return checkIngredient(ingredient) !== null; }

/** Class and tags for a Table 1 ingredient. null outside Table 1; the caller must classify it. */
function classify(ingredient) {
  const hit = checkIngredient(ingredient);
  return hit ? { class: hit.classKey, classKo: hit.classKo, tags: hit.tags.slice(), group: hit.group } : null;
}

function targetHits(target, drug) {
  if (target.ingredient) return drug.ing === target.ingredient;
  if (target.class) return drug.cls === target.class;
  if (target.tag) return [drug.cls, ...(drug.tags || [])].includes(target.tag);
  return false;
}

/**
 * Combined Table 1 and Table 2 evaluation.
 * @param {object} input
 * @param {Array<string|{ing:string,cls?:string,tags?:string[],name?:string}>} input.drugs
 *        A string is read as an ingredient key. To reach Table 2's class-level rules
 *        (anticholinergics, NSAIDs, and so on), pass cls and tags as well. Table 1 ingredients
 *        are filled in automatically by classify().
 * @param {string[]} [input.conditions] Table 2 condition ids. If empty, Table 2 returns nothing.
 * @returns {{table1: Array, table2: Array, coverage: object}}
 */
function check({ drugs = [], conditions: condIds = [] } = {}) {
  const list = drugs.map((d) => {
    const base = typeof d === 'string' ? { ing: d.toLowerCase() } : { ...d, ing: String(d.ing || '').toLowerCase() };
    const known = checkIngredient(base.ing);
    if (known) {
      base.cls = base.cls || known.classKey;
      base.tags = [...new Set([...(base.tags || []), ...known.tags])];
    }
    base.tags = base.tags || [];
    base.name = base.name || nameKo(base.ing);
    return base;
  });

  // A repeated ingredient yields one Table 1 hit, not several, so warnings are not duplicated.
  const t1 = [];
  const seen = new Set();
  list.forEach((d) => {
    const hit = checkIngredient(d.ing);
    if (!hit || seen.has(hit.ingredient)) return;
    seen.add(hit.ingredient);
    t1.push({ drug: d, item: hit, doseConditional: !!hit.dose });
  });

  const on = new Set(condIds || []);
  const t2 = [];
  table2.forEach((c) => {
    if (!on.has(c.id)) return;
    c.targets.forEach((t) => {
      if (t.all) {
        const groups = t.all.map((ing) => list.filter((d) => d.ing === ing)).filter((a) => a.length);
        if (groups.length === t.all.length) t2.push({ condition: c, target: t, drugs: groups.map((g) => g[0]) });
        return;
      }
      const hits = list.filter((d) => targetHits(t, d));
      if (hits.length) t2.push({ condition: c, target: t, drugs: hits });
    });
  });

  return { table1: t1, table2: t2, coverage };
}

module.exports = {
  table1, table2, conditions, coverage,
  checkIngredient, isTable1, classify, check, nameKo, checkAtc, byAtc,
  atcMapping: RAW.atc_mapping,
  byIngredient, byCondition,
  source: RAW.source, doi: RAW.doi, digitized: RAW.digitized, note: RAW.note,
  verification: RAW.verification,
};
