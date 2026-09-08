# Prior implementation search

The background claim in the abstract, that no machine-readable public implementation could be found,
needs evidence. This document records **when the search was run, what was searched, how, and what
turned up.**

## Date
2026-08-27

## Queries

Queries are recorded verbatim, including the Korean ones, since they are part of the method.

| # | Query | Scope |
|---|---|---|
| 1 | `Korean PIM 2018 potentially inappropriate medication open source implementation machine-readable` | Web and scholarly |
| 2 | `한국형 노인 부적절 약물 목록 2022 PIM Korea updated criteria list` | Web, Korean |
| 3 | `github open source Korean PIM criteria implementation JSON deprescribing tool 한국형 노인부적절약물 오픈소스` | GitHub and web |
| 4 | `심평원 2022 노인 부적절 다약제 사용 관리 기준 297개 약물 목록` | Korean agency reports |

## What was found

### Domestic work exists. This is not an empty field.

- **Kim MY et al. (2018)** — the Korean consensus list of potentially inappropriate medications, and
  the subject of this work. Ann Geriatr Med Res 2018;22(3):121-129.
- **Ah YM et al. (2020)** — a review of domestic potentially inappropriate medication lists, cited as
  a candidate source (138 items) by the 2022 HIRA report.
- **Jun K, Lee S, Lee AY, Ah YM, Lee JY (2022)** — a medication review tool for residents of Korean
  long-term care facilities, built on Delphi consensus. Ther Adv Chronic Dis. DOI 10.1177/20406223221128444
- **Health Insurance Review and Assessment Service (2022)** — draft management criteria for
  inappropriate polypharmacy in older adults. A national operating standard.
- **Kim MY et al. (2015)** — an earlier edition, cited as "Korean PIMs" by the HIRA report.

So **several domestic criteria exist.** The gap this work claims is not that criteria are missing but
that **no machine-readable public implementation of them exists.** The two must not be conflated.

### Machine-readable public implementations

The searches above **did not surface any public repository or package that structures the Korean PIM
criteria.** International criteria are a different case: Beers and STOPP/START have commercial CDSS
implementations and some research code.

## Limits of this search

- It is a web search, **not a systematic review.** No PRISMA protocol was followed.
- Implementations inside commercial CDSS products are proprietary and cannot be inspected. The
  accurate statement is **"none was found in public sources"**, not "none exists".
- The Korean query set was limited. Conference materials and theses are poorly indexed and may have
  been missed.

## Wording for the abstract

Not: `no public implementation exists`
Instead: `no machine-readable public implementation was identified in a search of the literature and code repositories`

The claim is not made absolutely. State the scope of the search, and claim only that nothing was found
within it.
