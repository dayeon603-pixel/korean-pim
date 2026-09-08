# Source agreement record

## Date and source

- **Date:** 2026-08-26
- **Source:** Article text at e-agmr.org (Ann Geriatr Med Res 2018;22(3):121-129, DOI 10.4235/agmr.2018.22.3.121)
- **Method:** Table 1 and Table 2 were retrieved separately from the article and transcribed into a
  reference copy. The repository data was then compared against it item by item. The reference copy is
  fixed in code in `test/verify_against_paper.js`, so the comparison is **rerunnable**.

```bash
npm run verify   # 197 checks
```

## Result

| Checked | Result |
|---|---|
| Table 1 item count | **63 = 63** |
| Table 1 item set and order | **Exact match.** Nothing present that the article lacks, nothing missing |
| Table 2 condition count | **18 = 18** |
| Table 2 condition set and order | **Exact match** |
| Table 2 drug groups | Every group named in the article is present |
| Table 2 additions | None beyond the two mapping-layer expansions recorded below |

## Mapping-layer expansions

In two places the article names a drug group without enumerating its ingredients. To make the rule
executable we had to name them. **This is our interpretation, not the article's content.**

| Condition | As printed in the article | Ingredients we enumerated |
|---|---|---|
| SIADH / hyponatremia | Diuretics, antipsychotics, antidepressants **and other drugs** | carbamazepine, oxcarbazepine, carboplatin, cyclophosphamide, cisplatin, vincristine |
| Bleeding risk | Aspirin, clopidogrel, ticlopidine, NSAIDs, warfarin, **direct oral anticoagulants (DOACs)** | dabigatran, rivaroxaban, apixaban, edoxaban |

In both cases we narrowed a deliberately open phrase, so ingredients the article would have counted as
"other drugs" may be missing. The error runs toward under-detection, not over-detection.

## ATC code mapping (2026-08-26)

The article carries no ATC codes. This layer is ours, added so the list can join systems that use
standard codes.

| Checked | Result |
|---|---|
| Five-level ATC codes assigned | **59 of 63** |
| No single code possible | 4 (one combination product, one salt-form split, one drug group, one dosing regimen) — reasons recorded |
| Dual-classification notes | 3 (aspirin, ketorolac, orphenadrine) |
| Sample check against the WHO ATC index | **9 items** — R06AA02, R06AA11, R06AB04, R06AX07, N04AC01, M01AE01, M01AE02, M01AE14, and the orphenadrine dual classification |
| Errors found in the sample | **One.** Dimenhydrinate had been assigned R06AA52 (diphenhydramine, combinations) → **corrected to R06AA11** |
| Automated checks | Format (five-level pattern), digit count, duplicates |

One error in a nine-item sample means **the remaining 50 items may also contain errors.** Until a
full check is done, treat them that way.

## Not yet checked

- **Word-for-word comparison of the rationale text.** The per-item rationale is a faithful Korean
  summary; it has not been matched one to one against the article's English wording.
- **The context behind the dose thresholds.** `Aspirin >325 mg/day`, `Doxepin >6 mg/day`, and
  `Insulin sliding scale` carry only the condition embedded in the drug name. We did not verify the
  reasoning the article gives for those thresholds.
- **The article's own drug grouping for Table 1.** The article groups by organ system (central
  nervous, cardiovascular, and so on); we group pharmacologically. These are different axes, and
  neither is wrong.
- **Full ATC verification.** Only 9 items were sample-checked. The other 50 passed format checks only.
- **Clinical review.** No pharmacist or clinician has reviewed this.

## Conclusion

**Agreement at the level of item composition is complete.** The 63 items and 18 conditions match the
article, and automated checks now fix that agreement so items cannot silently appear or disappear.

Because the gaps above remain, **do not use this for clinical decisions.** Use it for research,
prototyping, and teaching, and obtain pharmacist or clinician review before applying it to a patient.
