# Why the condition axis is expressible for some criteria and not others

Written 2026-09-01. Everything asserted here is either quoted from a primary document read in
full or computed by a script in this repository. Claims that are ours rather than a source's are
marked as such.

## The observation that forced this note

The earlier reading of this repository was a single gradient: the condition-dependent axis of
medication criteria is lost as a specification moves toward payment. That statement is false, and
the case that refutes it is inside the same agency the original claim was built on.

Korea's Health Insurance Review and Assessment Service assesses acute upper respiratory infection
antibiotic prescribing on a denominator it defines by diagnosis code:

> 가. 급성상기도감염(J00-J06) 항생제
> — 건강보험심사평가원, 「2023년 약제급여 적정성 평가 결과」, 2024.7

That indicator is publicly graded on five bands and has been inside the clinic-level differential
payment programme since 2013, with the adjustment widened in 2017 from one percent to a maximum of
five percent. A condition denominator therefore reaches the payment layer intact. Payment
proximity does not force the loss.

## The structural difference

Compare what the two kinds of criteria ask.

An antibiotic appropriateness criterion asks whether the drug was right **for the condition being
treated**. The condition is the indication. It appears as the principal diagnosis on the claim that
carries the prescription because that is why the prescription exists. A single claim record
contains everything the rule needs, and the institution that generated the claim holds it.

A drug-disease criterion asks whether the drug is unsafe **because of a condition other than the
one being treated**. This is not incidental; it is what the category means. The American Geriatrics
Society titles its table "drugs to avoid in older adults due to drug-disease or drug-syndrome
interactions that may exacerbate the disease or syndrome" — the disease that may be exacerbated is
by construction not the disease being treated. The defining condition is therefore recorded on some
other encounter, often in another specialty and another institution.

**Our claim, not a source's:** this is why the two kinds of criteria behave differently when
converted into national indicators, and it is a property of the criteria, not of any country. Where
the scored entity holds only its own encounters, indication-coupled conditions remain expressible
and contraindication-coupled ones do not. Where the scored entity holds the patient's longitudinal
record — a registered primary-care list, an enrolled health-plan population, a single-payer history
file — both remain expressible.

## What the model predicts, and what the data say

| Scored entity holds | Criterion type | Prediction | Observed |
|---|---|---|---|
| own encounters only | indication-coupled | expressible | Korea antibiotic indicators, condition denominator at payment |
| own encounters only | contraindication-coupled | not expressible | Korea PIM criteria and Japan's fee schedule, condition axis absent at every layer |
| patient's longitudinal record | contraindication-coupled | expressible | England PINCER, Scotland polypharmacy guidance, US HEDIS DDE, Taiwan 用藥品質指標 |

Run `node analysis/two_stage.js` for the counts. On 11 observations after collapsing the antibiotic
programme to one row per layer, no observation lacking linkage retains the axis, and among those
that have it retention still falls toward payment: 2/2 decision support, 2/2 measure specification,
2/4 public rating, 1/3 payment.

Taiwan is the row that separates the two explanations most cleanly. Its beta-blocker rule conditions
on a history of second- or third-degree atrioventricular block, which is contraindication-coupled and
could never be read off the prescribing encounter. It survives at the public-rating layer because
the single-payer history file supplies the linkage. A country-level or a payment-level explanation
does not predict that row; a linkage explanation does.

## Expressibility is necessary and not sufficient

England shows the second stage inside one financial instrument, with the data source held fixed. The
case-finding denominator of the 2022/23 Investment and Impact Fund names five diagnosis conditions in
the text of a payment rule. The denominators that money is actually paid on carry none. The same
practice records support both.

The United States shows it across a measure set. HEDIS keeps three condition-conditioned rates; the
2026 plan-rating list removes them and keeps the drug-only measure, on a stated ground of redundancy
with that drug-only measure. That ground is checkable and this repository checks it: across 22
parameter combinations the association between the two axes never reaches a conventional
strong-correlation threshold, and the marginal yield of the condition axis never falls below 2.31
percent.

Korea shows it inside a development study. An expert panel recorded that using anti-dementia drug
prescription as a stand-in for dementia misclassifies patients, and proposed binding the denominator
to a diagnosis instead:

> 대상 환자는 치매치료제를 처방받은 환자가 아닌, 치매 상병으로 진단받고 치매치료제를 처방받은
> 환자(진성 치매환자)로 분모를 제한하는 방안의 타당성 및 내부 심사위원 등의 자문이 필요하다.
> — 「환자안전 중심 약제평가 지표 개발 연구」, 2021, 전문가 자문회의 2021-07-24

The proposal was not adopted. The candidate was placed in the long-term tier and left out of the
final set. The indicator fielded in 2023 has every diagnosis as its denominator.

## The competing explanation, stated by the agency more plainly than by us

The same study excluded a gastroprotection criterion for a reason that is not about coding:

> 임상적으로 논란의 여지가 없는 좋은 지표이나 환자단위 지표이며 개별 의료기관 평가는 불가능함
> 국가단위 지표로는 산출 가능하지만, 병원 평가로는 적절하지 않음

Read plainly: the rule is clinically sound and computable nationally, but an individual institution
cannot be held to it. That is an attribution argument. It is consistent with the model above — an
institution cannot be held to a rule whose inputs it does not hold — but it is stated in terms of
accountability rather than data, and a reader is entitled to treat it as a separate explanation.

A third statement in the same study is closer to a coding argument and should be reported as such.
On the polypharmacy count indicator: 만성질환 약제 처방개수를 고려해야 하나, 이를 제외하는 방법이
쉽지 않음. The chronic-disease-driven subset was wanted and was not readily definable.

## What this does not establish

- Nothing here was randomised and no counterfactual is available. The tier assignments are one
  agency's judgement, recorded once.
- The classification of an observation's linkage is ours. Each row in `analysis/two_stage.js`
  carries the fact it rests on so that a reader can dispute one row without discarding the table.
- Observations are not independent; several share a country and six share one HIRA programme.
- Both surviving payment-layer and rating-layer cases carry exactly one condition per indicator.
  Whether specification simplicity rather than linkage is doing the work is a prediction this
  repository has not tested.
