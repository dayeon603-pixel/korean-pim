/**
 * Terminology binding — whether a rule can execute without human interpretation.
 *
 * ── Why measure this ──────────────────────────────────────────────────────
 * The study observed that the condition axis disappears at layers close to payment. Observation
 * alone does not say why. This module measures the mechanism.
 *
 * For a rule to be computed as an indicator, two things must be given as codes.
 *   The drug axis: which drug. ATC, main ingredient code, product code.
 *   The condition axis: which patient state. ICD or KCD, Read codes, a value set.
 *
 * The point is that binding the two axes costs different amounts.
 *   A drug arrives already coded by dispensing and billing. The binding is a by-product.
 *   A patient state does not. When an academic criterion states its condition in clinical prose,
 *   whoever wants to use that axis has to author the value set themselves.
 *
 * ── What is counted ───────────────────────────────────────────────────────
 * sourceBound: items for which the source document itself gives a standard code. Codes we added
 *              later are not counted.
 * authoredBy : whether the jurisdiction operating that axis authored the binding itself, and in
 *              which terminology.
 *
 * ── Limits ────────────────────────────────────────────────────────────────
 *  - Binding was counted as a binary. Partial binding, where only some conditions carry codes, was
 *    not observed.
 *  - The cost of authoring was not measured in money. Only whether it happened is recorded.
 *  - Beers Tables 2, 4, and 6 are not structured here, so only the condition axis, Table 3, is in
 *    scope.
 */
'use strict';
const pim = require('./index.js');
const beers = require('./beers2023.js');
const hira = require('./hira2022.js');

/** Table 1 items with a single five-level ATC code. Combination products, salt-form splits, drug
 * groups, and dosing regimens are excluded. */
function atcSingleMapped() {
  return pim.table1.filter((x) => x.atc && typeof x.atc === 'string').length;
}

const CRITERIA_BINDING = [
  {
    id: 'kim2018-t1', name: 'Korean PIM 2018, Table 1', axis: 'drug',
    total: pim.coverage.table1,
    sourceBound: null,          // the source names ingredients; it does not carry ATC codes
    codeSystem: 'ingredient names, not codes',
    mappable: atcSingleMapped(),
    note: 'The source carries no codes, but an ingredient name is itself the clue to a binding. '
        + `Carried onto WHO ATC level 5, ${atcSingleMapped()}/${pim.coverage.table1} map uniquely; the remaining 4 `
        + 'are combinations, salt-form branches, ingredient groups or regimens, for which no single '
        + 'code exists. The drug axis is therefore bindable mechanically.',
  },
  {
    id: 'kim2018-t2', name: 'Korean PIM 2018, Table 2', axis: 'condition',
    total: pim.coverage.table2Conditions,
    sourceBound: 0,
    codeSystem: null,
    mappable: null,
    note: 'The source states its conditions in clinical language only, for example a history of '
        + 'falls, fracture, syncope or orthostatic hypotension. It specifies no range of diagnosis '
        + 'codes, so anyone turning this axis into an indicator has to author the value set. What '
        + 'they author can differ from author to author, and the counts move with it.',
  },
  {
    id: 'beers2023-t3', name: 'AGS Beers 2023 Table 3', axis: 'condition',
    total: beers.conditionCount,
    sourceBound: 0,
    codeSystem: null,
    mappable: null,
    note: 'The same. Conditions are stated in clinical language and no codes are carried. That NCQA, '
        + 'which turned this axis into a measure in the United States, had to author its own value '
        + 'sets is the evidence for it.',
  },
  {
    id: 'hira2022', name: 'HIRA 2022 national standard', axis: 'drug',
    total: hira.totalIngredients,
    sourceBound: null,
    codeSystem: 'ingredient names, final list unpublished',
    mappable: null,
    note: 'Only the drug axis exists. With no condition axis there is nothing to bind.',
  },
];

/** How each jurisdiction operating a condition axis obtained its binding. Every entry cited by name
 *  in the manuscript was confirmed against the primary document. */
const AUTHORED_BINDINGS = [
  {
    region: 'England', instrument: 'PINCER prescribing safety indicators', authored: true,
    system: 'Read code',
    evidence: '"Patients aged ≥18 years with a Read code for peptic ulcer or ...", '
            + '"... with a Read code for asthma at least ..."',
  },
  {
    region: 'USA', instrument: 'NCQA HEDIS DDE', authored: true,
    system: 'value set',
    evidence: 'A separate value set is defined for each condition: Fractures Value Set, Dementia '
            + 'Value Set and so on.',
  },
  {
    region: 'Scotland', instrument: 'Polypharmacy Guidance 2026-2029', authored: true,
    system: 'operational definition',
    evidence: '"Documented dementia (or on donepezil, rivastigmine, galantamine or memantine) '
            + 'and HbA1c less than 53 mmol/mol": diagnosis, medication and laboratory value '
            + 'combined into one definition.',
  },
  {
    region: 'Japan', instrument: '厚生労働省 guideline, Appendix Table 2', authored: false,
    system: null,
    evidence: 'The condition stays inside the prose of 「推奨される使用法」 and is never given a code. '
            + 'A 「対象となる患者群」 column appears nowhere in the document.',
  },
  {
    region: 'Korea', instrument: 'HIRA 2022 national standard', authored: false,
    system: null,
    evidence: 'There is no condition axis, so there is nothing to bind.',
  },
];

/** Bindings authored by this study. This is the manuscript's own output. */
function ourBinding() {
  const icd = require('../analysis/icd_map.js');
  const mapped = pim.table2.filter((c) => icd.MAP[c.id]).length;
  return {
    total: pim.coverage.table2Conditions,
    mapped,
    unmapped: pim.table2.filter((c) => !icd.MAP[c.id]).map((c) => c.id),
    system: 'ICD-10-CM / ICD-9-CM prefix match',
    note: 'KCD-8 is the Korean standard edition of ICD-10, so this carries over to the Korean '
        + 'diagnosis-code axis. The age rule is not a diagnosis and is excluded from binding.',
  };
}

module.exports = {
  CRITERIA_BINDING, AUTHORED_BINDINGS, atcSingleMapped, ourBinding,
  /** Share of axis-retaining jurisdictions that authored the binding themselves. */
  get authoredAmongRetained() {
    const r = AUTHORED_BINDINGS.filter((x) => x.authored);
    const lost = AUTHORED_BINDINGS.filter((x) => !x.authored);
    return { retained: r.length, retainedAuthored: r.filter((x) => x.system).length, lost: lost.length };
  },
};
