# korean-pim

**A decision library for the Korean consensus list of potentially inappropriate medications (PIM) for older adults, 2018.**
Table 1, 63 drug-only items, plus Table 2, 18 condition-dependent rules. 102 unique items in total.
No dependencies. Deterministic rule evaluation. No generative model.

> **Verification status.** Item-level agreement with the source article was confirmed on 2026-08-26,
> and WHO ATC codes were mapped. The 63 items of Table 1 and the 18 conditions of Table 2 match the
> article as sets and in order, and 59 of the 63 items carry a five-level ATC code. `npm test` reruns
> 401 checks. What is *not* done: word-for-word comparison of the rationale text, and review by a
> pharmacist or clinician. **Do not use this for clinical decisions.** It is for research,
> prototyping, and teaching.
> → [VERIFICATION.md](VERIFICATION.md) · [DATA_NOTICE.md](DATA_NOTICE.md)

---

## Why this exists

The Korean PIM 2018 list is the national consensus standard for medication safety in older adults,
but **no machine-readable version of it has been published.** Using it means transcribing tables out
of a PDF by hand, and two things go wrong every time.

1. **Table 2, the 18 condition-dependent rules, gets dropped.** It is harder to implement than a flat
   drug list, and it is also where much of the actual harm lives.
2. **Class-level matching produces false positives.** The article names glibenclamide; an
   implementation that flags every sulfonylurea is warning about drugs the consensus panel never named.

This package structures all 102 items with ingredient keys, drug classes, and tags, implements Table 2
as a condition-by-drug matcher, and **refuses to infer drug class** for anything it was not given.

## Install

```bash
npm install korean-pim
# or copy the repository and require it directly. There are no dependencies.
```

## Usage

```js
const pim = require('korean-pim');

pim.coverage;
// { table1: 63, table2Conditions: 18, table2Only: 39, unique: 102 }

// 1) Is a single ingredient on the drug-only list?
pim.isTable1('zolpidem');        // true
pim.isTable1('glimepiride');     // false — not in the article, so no verdict is given
pim.checkIngredient('zolpidem').reason;
// Rationale text, in Korean, as published in the source article.

// 2) Evaluate a medication list together with the patient's conditions
const r = pim.check({
  drugs: ['warfarin', 'chlorpheniramine', 'zolpidem', 'amlodipine'],
  conditions: ['dementia', 'falls', 'bleeding'],
});

r.table1.map(h => h.item.nameKo);
// ['클로르페니라민', '졸피뎀']   (chlorpheniramine, zolpidem)
// amlodipine and warfarin are absent from Table 1 and are not flagged by it

r.table2.map(h => `${h.condition.label} + ${h.target.nameKo}`);
// dementia + anticholinergics, dementia + zolpidem,
// history of falls + anticholinergics, history of falls + zolpidem,
// bleeding risk + warfarin

// 3) The condition list, for a form or intake screen
pim.conditions;
// [{ id:'dementia', label:'치매·인지장애', kind:'진단', condition:'섬망·치매·인지장애' }, ... 18 total]
```

Item names, condition labels, and rationale strings are returned **in Korean**, exactly as the source
article publishes them. They are source text, not translations.

If you do not pass `conditions`, **Table 2 returns nothing.** Not knowing the patient's state is
treated as a reason to stay silent, not a reason to guess.

## Evaluating a drug that is not in Table 1

Table 2 is written at the level of drug classes: anticholinergics, NSAIDs, opioids, diuretics,
beta-blockers, corticosteroids, and others. The 63 ingredients in Table 1 already carry a class, so
they match automatically. For anything else, **the caller must supply the class.**

```js
pim.check({
  drugs: [{ ing: 'prednisolone', cls: 'cortico', name: '프레드니솔론' }],
  conditions: ['dm'],
});
// → diabetes + systemic corticosteroid
```

This is deliberate. The library does not guess the class of a drug it does not know.

## API

| Function | Returns |
|---|---|
| `coverage` | `{ table1, table2Conditions, table2Only, unique }` |
| `table1` | 63 items (`drug`, `ingredient`, `nameKo`, `classKey`, `classKo`, `tags`, `reason`, `dose`) |
| `table2` | 18 conditions (`id`, `condition`, `label`, `kind`, `reason`, `targets`) |
| `conditions` | Condition list for input forms |
| `isTable1(ing)` | Whether the ingredient is on Table 1 |
| `checkIngredient(ing)` | The Table 1 item, or `null` |
| `classify(ing)` | Class and tags for a Table 1 ingredient, `null` outside Table 1 |
| `nameKo(ing)` | Korean name for an ingredient key |
| `checkAtc(code)` | **Reverse lookup by five-level ATC code** |
| `atcMapping` | Mapping metadata: counts, reasons for omission, sample-check record |
| `check({ drugs, conditions })` | Combined Table 1 and Table 2 evaluation |

## Standard terminology (ATC)

**59 of the 63 Table 1 items carry a WHO ATC five-level code**, so the list can be joined to
prescribing systems and CDSS that use standard codes.

```js
pim.checkAtc('N05CF02').nameKo;        // 졸피뎀 (zolpidem)
pim.checkIngredient('zolpidem').atc;   // 'N05CF02'
```

**Four items have no single code.** They are left empty with a stated reason rather than forced.

| Item | Reason |
|---|---|
| Clidinium-chlordiazepoxide | Combination product; no single ingredient code applies |
| Scopolamine | Splits between A04AD01 and A03BB01 depending on salt form |
| Estrogens ± progestins | A drug group; disperses across G03C and G03F by preparation |
| Insulin, sliding scale | A dosing regimen, not an ingredient |

Three items with dual classification (aspirin, ketorolac, orphenadrine) record which code was chosen
in `atcNote`.

The ATC layer is **ours, not the article's.** Nine items were sample-checked against the WHO ATC index,
which **found and corrected one error** (dimenhydrinate); the rest received only automated format and
duplicate checks. A full item-by-item check has not been done.

## Design principles

- **Exact ingredient match.** Table 1 does not infer class. False positives lead to unnecessary
  discontinuation, which is a real harm.
- **No condition, no verdict.** Table 2 evaluates only the conditions it was given.
- **Deterministic.** The same input always produces the same output, and every verdict traces to data.
- **Dose conditions stay visible.** Items such as `Aspirin >325 mg/day` expose `dose` and
  `doseConditional`. Confirming the dose is a human step.

## Tests

```bash
npm test        # 401 checks: 192 library and ATC, 197 source agreement, 12 bitmask equivalence
npm run verify  # source agreement only: Table 1's 63 items and Table 2's 18 conditions against the article
```

A separate section tests **false positives**: that drugs which resemble listed ones but are absent from
the article, such as glimepiride, eperisone, tramadol, and celecoxib, are not flagged.

## Reproducing the figures in the accompanying manuscript

Every count and interval reported in the manuscript is regenerated from the coded records.

```bash
node analysis/ablation.js       # condition-ablation analysis, writes analysis/ablation_result.json
node analysis/prescreen.js      # the four screening questions run on the 18 unfielded rules
node test/paper_numbers.js      # regenerates and checks every number quoted in the manuscript
```

`test/paper_numbers.js` fails if any figure in the manuscript no longer matches the data.

## Citation

If you use this package in research, **cite the original article.**

> Kim MY, Etherton-Beer C, Kim CB, Yoon JL, Ga H, Kim HC, Song JS, Kim KI, Won CW.
> Development of a Consensus List of Potentially Inappropriate Medications for Korean Older Adults.
> *Ann Geriatr Med Res* 2018;22(3):121-129. DOI: 10.4235/agmr.2018.22.3.121

## Contributing

Where the article names a drug class without enumerating its ingredients, the decision about which
ingredients fall inside that class is **ours**. If you disagree, open an issue. With a source, it gets
changed.

## License

Code and the mapping layer are MIT. **Copyright in the article text and tables belongs to the original
authors and the journal.** See [DATA_NOTICE.md](DATA_NOTICE.md).

This software does not provide medical advice, diagnosis, or treatment.
