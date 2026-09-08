# Data notice

## 1. The original work

The lists in this package are a structured form of Table 1 and Table 2 of the following article.

> Kim MY, Etherton-Beer C, Kim CB, Yoon JL, Ga H, Kim HC, Song JS, Kim KI, Won CW.
> **Development of a Consensus List of Potentially Inappropriate Medications for Korean Older Adults.**
> *Annals of Geriatric Medicine and Research* 2018;22(3):121-129.
> DOI: [10.4235/agmr.2018.22.3.121](https://doi.org/10.4235/agmr.2018.22.3.121)

**Copyright in the article text and tables belongs to the original authors and the journal.** Follow
the article's own licence for permitted use. The MIT licence on this repository covers **the code and
the mapping layer only**, not the content of the article.

## 2. What we added: the mapping layer

Fields that are not in the article and were created for this package.

| Field | Contents |
|---|---|
| `kr` | Korean ingredient name |
| `ing` | Ingredient key, lowercase Latin |
| `cls` · `cat` | Drug-class key used by the engine, and its Korean display name |
| `tags` | Classification used to match Table 2's class-level rules (anticholinergics, benzodiazepines, and so on) |
| `match` | Each Table 2 target token resolved into an ingredient, class, or tag matcher |
| `id` · `label` · `kind` | Condition identifier and form label |
| `atc` · `atc_note` | WHO ATC five-level code and the reasoning behind the mapping |

This layer is **an interpretation made for implementation**, not a clinical consensus. Deciding which
ingredients count as "anticholinergics", for instance, was our judgment in places where the article
names a class without enumerating it. Reasonable people may disagree; open an issue and it gets changed.

## 3. Verification status

**Agreement with the article at the level of item composition was completed on 2026-08-26.** Details in
[VERIFICATION.md](VERIFICATION.md).

- Table 1, 63 items: exact match with the article in set and order. Nothing added, nothing missing.
- Table 2, 18 conditions: exact match in composition and order, with every drug group present.
- Two mapping-layer expansions (the "other drugs" of SIADH, the DOACs of bleeding risk) turn a group
  the article named openly into specific ingredients. The error runs toward under-detection.
- **The ATC codes are our layer, absent from the article.** 59 of 63 items carry one; the other 4
  record why no single code applies. Nine items were sample-checked against the WHO ATC index, which
  found and corrected one error. **A full check has not been done.**
- Not done: word-for-word comparison of the rationale text, the context behind the dose thresholds,
  and review by a pharmacist or clinician.

The comparison reruns at any time with `npm run verify` (197 checks). Because changing the data means
also changing the reference copy, items cannot quietly appear or disappear.

**Do not use this for clinical decisions.** It is for research, prototyping, and teaching.

## 4. How the engine decides

- **No class inference.** Table 1 matches on exact ingredient keys only. If the article names
  glibenclamide, glimepiride is not flagged. Warning on a drug because it resembles a listed one
  accumulates false positives, and false positives cause unnecessary discontinuation, which is a
  real harm.
- **Table 2 evaluates only what it is given.** Without the patient's conditions, it infers nothing.
- **Every verdict is deterministic.** No generative model is involved, so the same input always
  produces the same output.

## 5. Citation

If you use this package in research, **cite the original article.** This package is an implementation
of it.
