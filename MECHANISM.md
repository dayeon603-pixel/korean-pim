# What determines whether a condition survives into a national indicator

Written 2026-09-01, rewritten the same day after the multi-domain results arrived. An earlier
version of this file proposed that conditions survive when they are coded to justify reimbursement.
The data refute that and it has been removed rather than softened; the correction is recorded at the
end.

Everything here is either quoted from a primary document read in full, computed by a script in this
repository, or explicitly labelled as agent-grade evidence.

## Two claims were withdrawn

**The payment gradient.** The repository previously held that the condition-dependent axis of
medication criteria is lost as a specification moves toward payment. Eight criteria families were
searched. Across 103 adjudicable national instruments the retention rate is 61.2 percent, and by
layer it is guideline 7/9, decision support 6/10, measure specification 17/31, public rating 13/18,
payment 20/35. Cochran-Armitage trend across ordered layers z = -0.58, p = 0.559. Five of the eight
families contradicted the gradient outright. It does not exist outside the family it was found in.

The clearest single refutation is inside the agency the original claim was built on. Korea's acute
upper respiratory infection antibiotic indicator is defined on a diagnosis-code denominator:

> 가. 급성상기도감염(J00-J06) 항생제
> — 건강보험심사평가원, 「2023년 약제급여 적정성 평가 결과」, 2024.7

It is publicly graded on five bands and has been in the clinic-level differential payment programme
since 2013, widened in 2017 from one percent to a maximum of five percent. A condition denominator
reaches money intact.

**Reimbursement coupling.** The earlier version of this file argued that a condition survives when
it is coded because a payer required it, and that drug-disease criteria fail because a patient's
dementia does not have to be coded for an unrelated prescription to be paid. Tested across the same
instruments, conditions recorded for clinical reasons only are retained at 79.2 percent and
conditions recorded to justify reimbursement at 73.1 percent. There is no difference. English and
Scottish general practice records carry coded diagnoses under no reimbursement pressure at all and
retain the axis at the same rate as claims systems do. The proposed mechanism predicted a gap that
is not there.

## What replaced them

Six of the eight domain analysts independently proposed the same thing under different names. The
condition axis survives where the data feed the instrument is actually computed over contains the
condition, and fails where it does not.

The reportable form of this is the negative direction, because only the negative direction can be
established without circularity.

| feed the instrument runs on | condition axis retained | 95% CI |
|---|---|---|
| prescription dispensing or drug sales | 2 / 27 — 7.4% | 2–23 |
| every other feed | 61 / 76 — 80.3% | 70–88 |
| all instruments | 63 / 103 — 61.2% | 52–70 |

The intervals do not overlap. Both apparent exceptions in the first row draw their condition from
enrolment or medical-claims data rather than from the dispensing transaction, so the classification
is probably wrong for them and the true contrast is wider.

### Why only the negative direction

The classifiers knew the outcome. One that reasons "this indicator binds SNOMED refsets, therefore
its substrate carries conditions" has restated the outcome and explained nothing. A second agent
audited every domain for exactly this and reported downgrade fractions between 0.53 and 1.00, mean
about 0.74. The objection is correct and cannot be repaired by dropping rows, because it attaches to
the reasoning rather than to identifiable rows.

Classifying a feed as dispensing-only is different in kind. The NHS Business Services Authority
prescribing extract, Scotland's Prescribing Information System, ECDC's ATC/DDD consumption returns
and NCPDP pharmacy transactions carry a drug, a quantity, a prescriber and a patient identifier and
no diagnosis. That is a documented property of each dataset, established without reference to any
indicator built on it. So the sentence this repository may assert is: **instruments computed over a
feed that contains no diagnosis do not keep a condition denominator, in 25 of 27 observed cases.**
The converse — that a feed containing diagnoses causes retention — is an association of φ = 0.60
that cannot be separated from its own definition, and is reported rather than claimed.

## Substrate does not explain the anchor case, and that is the interesting part

Korea's polypharmacy criteria run on the same 명세서 claims that carry a mandatory KCD 상병 on every
line, and the agency demonstrably could use them: the 2022 report authored KCD code sets for
thirteen comorbidity groups and applied them to describe the cohort and to adjust an outcome model.
The substrate was there. The condition axis was still dropped in full, 0 of 18.

So substrate is a constraint, not an explanation, and where it is satisfied something else decides.
Two candidates are visible in the data and one of them is documented in Korean.

**Severability.** An avoidance rule keeps producing a number when its condition is deleted: strike
the dementia from "anticholinergics in dementia" and "anticholinergic prescribing rate in older
adults" remains, and that is exactly the indicator HIRA fielded in 2023, on a denominator it states
as 전체상병. An undertreatment rule does not survive the same deletion, because its numerator event
is the absence of a drug and an absence has no population. Across the instruments, conditions in a
load-bearing role are retained at 80.8 percent and conditions in a severable role at 47.3 percent.

**Attribution.** HIRA's own indicator-development study gives this reason in plain language,
excluding a gastroprotection criterion that it calls clinically uncontroversial:

> 임상적으로 논란의 여지가 없는 좋은 지표이나 환자단위 지표이며 개별 의료기관 평가는 불가능함
> 국가단위 지표로는 산출 가능하지만, 병원 평가로는 적절하지 않음
> — 「환자안전 중심 약제평가 지표 개발 연구」, G000F8Q-2021-15, 2021

The rule is computable nationally and no single institution can be held to it. That is not a data
problem, it is an accountability problem, and it is stated by the agency rather than inferred by us.

The same study records that a diagnosis binding was proposed for the dementia indicator and not
adopted:

> 대상 환자는 치매치료제를 처방받은 환자가 아닌, 치매 상병으로 진단받고 치매치료제를 처방받은
> 환자(진성 치매환자)로 분모를 제한하는 방안의 타당성 및 내부 심사위원 등의 자문이 필요하다.
> — same report, 전문가 자문회의 2021-07-24

The panel had noticed that using anti-dementia drugs as a stand-in for dementia misclassifies
patients, because ginkgo appears in that ingredient list. The candidate was placed in the long-term
tier and left out of the final set.

## The case that would most damage the substrate account

Korea's national DUR was reported by one analyst to transmit 주상병코드 and 임부여부 in the same
message it screens prescriptions with, and to apply neither to its pregnancy-contraindication
grading, returning that judgement to the prescriber. If that is right, the condition is in the feed
and the rule drops it anyway.

**This is not verified.** It rests on an agent report, and the session's web-search budget was
exhausted before the DUR message specification could be checked. It must be confirmed against the
specification or removed before it is used in anything.

## Correction log

- The reimbursement-coupling mechanism asserted in the first version of this file is withdrawn. It
  predicted that clinically-recorded conditions would be retained less often than
  reimbursement-justifying ones; the observed rates are 79.2 and 73.1 percent.
- The indication-coupled versus contraindication-coupled framing built on it is withdrawn for the
  same reason. The distinction is real in the antibiotic case but does not generalise, and the
  variable that does is whether the condition is in the feed at all.
- The payment gradient is withdrawn. See `analysis/multidomain.js`.
