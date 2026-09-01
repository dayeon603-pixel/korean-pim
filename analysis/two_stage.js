/* Two-stage model — node analysis/two_stage.js
 *
 * What changed. The earlier reading of this repository was a single gradient: the
 * condition-dependent axis is lost as a specification moves toward payment. The HIRA
 * antibiotic indicators refute that as stated. 급성상기도감염 항생제처방률 carries a KCD
 * denominator (J00-J06) into a differential-payment adjustment of up to five percent.
 * Payment proximity therefore does not force the loss.
 *
 * The replacement is two conditions rather than one gradient.
 *
 *   Stage 1, expressibility. A condition denominator can appear only where the entity being
 *     scored can link the patient's diagnoses to the prescription being counted. Two routes
 *     satisfy this: the diagnosis sits on the same claim as the drug ('same-claim'), or the
 *     scored entity holds the patient's longitudinal record ('entity-longitudinal').
 *
 *   Stage 2, adoption. Among specifications that satisfy stage 1, retention still falls as
 *     the layer approaches payment. Stage 2 has counterexamples and is a tendency, not a law.
 *
 * The point of separating them is that they have different remedies. Stage 1 is an
 * infrastructure property and cannot be fixed by drafting. Stage 2 is a drafting decision and
 * the documents that record it give reasons that can be checked.
 *
 * Assignment of `linkage` and `targetHoldsRecord` is ours, not quoted from sources. Each is
 * annotated with the fact it rests on so a reader can disagree with a specific row.
 */
'use strict';
const { JURISDICTIONS } = require('../src/jurisdictions.js');
const abx = require('../src/hira_antibiotic.js');

/**
 * Per-observation linkage classification.
 *   attributionTarget - the entity whose score is published or paid on.
 *   targetHoldsRecord - can that entity establish the patient's condition at all.
 *   linkage           - how, if it can.
 * Keys are jurisdiction ids from src/jurisdictions.js.
 */
const LINKAGE = {
  'kr-hira': {
    attributionTarget: 'institution', targetHoldsRecord: false, linkage: 'none',
    basis: 'Fee-for-service claims. The payer can link a patient across institutions and did so '
         + 'to produce comorbidity prevalence for the cohort, but the scored unit is the '
         + 'institution, which sees only its own encounters.',
  },
  'jp-mhlw': {
    attributionTarget: null, targetHoldsRecord: null, linkage: 'n/a',
    basis: 'A guideline. Nothing is scored, so the question does not arise.',
  },
  'jp-shinryo': {
    attributionTarget: 'institution', targetHoldsRecord: false, linkage: 'none',
    basis: 'Fee-for-service add-on claimed by the treating institution.',
  },
  'us-hedis-dde': {
    attributionTarget: 'health-plan', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'The plan holds all claims for an enrolled member, so diagnoses recorded at one '
         + 'provider are available when judging a prescription written at another.',
  },
  'us-ncqa-rating': {
    attributionTarget: 'health-plan', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Same data as the HEDIS measure; the rating draws on the same specification set.',
  },
  'us-star': {
    attributionTarget: 'health-plan', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Part D plan-level measurement over enrolled members.',
  },
  'eng-pincer': {
    attributionTarget: 'gp-practice', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Registered-list primary care. The practice record carries the patient\'s coded '
         + 'diagnoses and their prescriptions together.',
  },
  'eng-iif': {
    attributionTarget: 'primary-care-network', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Same practice records aggregated to the network.',
  },
  'sct-poly': {
    attributionTarget: 'gp-practice', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Registered-list primary care, indicators fielded through the national prescribing system.',
  },
  'se-indicator': {
    attributionTarget: 'region', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'National registers linked by personal identity number. Marked lower confidence: the '
         + 'source for this row is agent-grade, not directly read.',
    confidence: 'low',
  },
  'tw-nhia-pim': {
    attributionTarget: 'hospital', targetHoldsRecord: null, linkage: 'unassessable',
    basis: 'The specification does not state what it computes, so nothing can be assigned.',
  },
  'tw-quality': {
    attributionTarget: 'clinic', targetHoldsRecord: true, linkage: 'entity-longitudinal',
    basis: 'Single-payer claims history file (病史檔) is used as the denominator condition, so '
         + 'prior diagnoses recorded elsewhere are available to the indicator.',
  },
};

const LAYER_ORDER = ['guideline', 'cds', 'measure', 'rating', 'payment'];

/** Build the observation set: existing jurisdictions plus the HIRA antibiotic indicators. */
function observations() {
  const rows = JURISDICTIONS.map((j) => ({
    id: j.id,
    region: j.region,
    layer: j.layer,
    retained: j.axisRetained,
    verifiedBy: j.verifiedBy,
    ...LINKAGE[j.id],
  }));

  // The HIRA antibiotic programme adds observations inside the jurisdiction that anchored the
  // original claim, which is why they carry the most weight against it.
  abx.INDICATORS.filter((i) => i.conditionBound).forEach((i) => {
    const layer = i.reachesPayment ? 'payment' : i.publiclyGraded ? 'rating' : 'measure';
    rows.push({
      id: `kr-abx-${i.id}`,
      region: '한국',
      layer,
      retained: true,
      verifiedBy: 'read',
      attributionTarget: 'institution',
      targetHoldsRecord: true,
      linkage: 'same-claim',
      basis: 'The defining diagnosis is the principal diagnosis on the same claim that carries '
           + 'the prescription, so the scoring institution holds everything the rule needs.',
    });
  });
  return rows;
}

const rows = observations();
const line = (n = 74) => '-'.repeat(n);
const adjudicable = rows.filter((r) => r.retained !== null && r.linkage !== 'n/a' && r.linkage !== 'unassessable');

console.log('TWO-STAGE MODEL OF CONDITION-AXIS SURVIVAL\n');
console.log(`Observations: ${rows.length}   adjudicable: ${adjudicable.length}`);
console.log(`Excluded: ${rows.length - adjudicable.length} (guideline with nothing scored, or specification not stated)\n`);

// ------------------------------------------------------------------- stage 1
console.log('STAGE 1 — can the scored entity establish the condition at all');
console.log(line());
console.log('linkage'.padEnd(22) + 'n'.padEnd(5) + 'retained'.padEnd(11) + 'observations');
['none', 'same-claim', 'entity-longitudinal'].forEach((L) => {
  const g = adjudicable.filter((r) => r.linkage === L);
  if (!g.length) return;
  const kept = g.filter((r) => r.retained);
  console.log(
    L.padEnd(22) + String(g.length).padEnd(5) + `${kept.length}/${g.length}`.padEnd(11) +
      g.map((r) => r.id).join(', ').slice(0, 60)
  );
});
const noLink = adjudicable.filter((r) => r.linkage === 'none');
console.log(`\nNo observation without linkage retains the axis (${noLink.filter((r) => r.retained).length} of ${noLink.length}).`);
console.log(`This is a necessary condition on ${noLink.length} observations, which is few. It is not`);
console.log('established as sufficient: see stage 2.');

// ------------------------------------------------------------------- stage 2
console.log('\n\nSTAGE 2 — among those that can, does the layer still matter');
console.log(line());
const expressible = adjudicable.filter((r) => r.linkage !== 'none');
console.log('layer'.padEnd(14) + 'retained'.padEnd(11) + 'observations');
LAYER_ORDER.forEach((L) => {
  const g = expressible.filter((r) => r.layer === L);
  if (!g.length) return;
  const kept = g.filter((r) => r.retained);
  console.log(L.padEnd(14) + `${kept.length}/${g.length}`.padEnd(11) + g.map((r) => r.id).join(', '));
});

console.log('\nThe gradient survives only in this conditional form. Stated without the condition');
console.log('it is false, and the counterexamples are in the payment row above.');

// The six antibiotic rows come from one programme and would otherwise carry the table.
// Collapse them to one observation per layer and read the gradient again.
console.log('\nSame table with the HIRA antibiotic programme collapsed to one row per layer,');
console.log('so that a single programme cannot supply most of a cell:');
const collapsed = [];
const seenAbx = new Set();
expressible.forEach((r) => {
  if (r.id.startsWith('kr-abx-')) {
    if (seenAbx.has(r.layer)) return;
    seenAbx.add(r.layer);
    collapsed.push({ ...r, id: `kr-abx (${r.layer})` });
  } else collapsed.push(r);
});
console.log('\n' + 'layer'.padEnd(14) + 'retained'.padEnd(11) + 'observations');
LAYER_ORDER.forEach((L) => {
  const g = collapsed.filter((r) => r.layer === L);
  if (!g.length) return;
  console.log(L.padEnd(14) + `${g.filter((r) => r.retained).length}/${g.length}`.padEnd(11) + g.map((r) => r.id).join(', '));
});
console.log(`\nAdjudicable after collapsing: ${collapsed.length}. The direction is unchanged and the`);
console.log('counts are small enough that no test of trend is reported.');

// -------------------------------------------------------------- counterexamples
console.log('\n\nCOUNTEREXAMPLES TO A PLAIN PAYMENT GRADIENT');
console.log(line());
expressible.filter((r) => r.retained && (r.layer === 'payment' || r.layer === 'rating')).forEach((r) => {
  console.log(`  ${r.id}  [${r.layer}]  ${r.basis.split('.')[0]}.`);
});

// ------------------------------------------------------- within-instrument transitions
console.log('\n\nWITHIN-INSTRUMENT TRANSITIONS');
console.log(line());
console.log('These hold the data source fixed and are the only observations where nothing but');
console.log('the drafting decision changes.\n');
console.log('  England IIF   case-finding denominator (SMR-01A) keeps five diagnosis conditions;');
console.log('                the paid denominators (SMR-02A-D) carry none.');
console.log('  United States HEDIS DDE keeps three condition rates; the 2026 plan-rating list');
console.log('                removes DDE and keeps the drug-only DAE measure.');
console.log('  Korea HIRA    the 2021 development study records a proposal to bind the dementia');
console.log('                denominator to a diagnosis; the fielded 2023 indicator uses every');
console.log('                diagnosis as its denominator.');

console.log('\n\nWHAT THIS DOES NOT SHOW');
console.log(line());
console.log('  - Observations are not independent. Several share a country, and three of the new');
console.log('    rows share one HIRA programme.');
console.log('  - linkage and targetHoldsRecord are our classifications, not quoted from sources.');
console.log('    Every row carries the fact it rests on and can be disputed individually.');
console.log('  - se-indicator rests on agent-grade evidence and is marked low confidence.');
console.log('  - Retention at the payment layer is observed for one condition per indicator in');
console.log('    both surviving cases. Whether that is the operative difference is a prediction,');
console.log('    not a result.');
