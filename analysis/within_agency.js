/* Within-agency contrast — node analysis/within_agency.js
 *
 * Question. Cross-country tabulation cannot separate the effect of a specification's content
 * from the effect of the health system it sits in. This script holds the agency, the coding
 * system, the claims infrastructure and the assessment methodology fixed, and asks what
 * distinguishes the specifications that kept a patient-condition denominator from those that
 * did not.
 *
 * Two documents supply the evidence, both read in full:
 *   - HIRA 2021 indicator-development study (nine candidate indicators, feasibility tiers,
 *     verbatim expert-panel reasons)
 *   - HIRA 2023 assessment results (the fielded indicator set and where each one travels)
 *
 * The script prints counts and quotes. It draws no conclusion that is not visible in the
 * counts, and it prints the competing explanations the documents themselves give.
 */
'use strict';
const dev = require('../src/hira_indicator_dev.js');
const abx = require('../src/hira_antibiotic.js');

const line = (n = 74) => '-'.repeat(n);

console.log('WITHIN-AGENCY CONTRAST: HIRA drug-benefit appropriateness assessment\n');

// ---------------------------------------------------------------- fielded indicator set
console.log('1. FIELDED INDICATORS, 2023 REPORT');
console.log(line());
console.log(
  ['indicator', 'kind', 'cond', 'codes', 'layer'].map((s, i) => s.padEnd([34, 14, 6, 22, 0][i])).join('')
);
abx.INDICATORS.forEach((i) => {
  const codes = (i.codes && i.codes.length ? i.codes : i.excludeCodes ? i.excludeCodes.map((c) => `!${c}`) : ['(none)']).join(',');
  console.log(
    i.nameEn.slice(0, 33).padEnd(34) +
      i.kind.padEnd(11) +
      (i.conditionBound ? 'yes' : 'no').padEnd(6) +
      codes.slice(0, 21).padEnd(22) +
      abx.highestLayer(i)
  );
});

const split = abx.byConditionBinding();
console.log(`\nCondition-bound: ${split.bound.length} of ${abx.INDICATORS.length}`);
console.log(`  reaching public rating or payment: ${split.bound.filter((i) => i.publiclyGraded || i.reachesPayment).length}`);
console.log(`Not condition-bound: ${split.unbound.length}`);
console.log(`  reaching public rating or payment: ${split.unbound.filter((i) => i.publiclyGraded || i.reachesPayment).length}`);

console.log('\nThe one indicator without a condition denominator is the elderly-medication');
console.log('indicator. Its denominator is stated as every diagnosis:');
console.log(`  "${abx.INDICATORS.find((i) => i.id === 'elderly_caution').quote}"`);
console.log('\nThe payment mechanism it is absent from has existed since 2013:');
abx.HISTORY.filter((h) => /가감지급/.test(h.ko)).forEach((h) => console.log(`  ${h.year}  ${h.ko}`));

// ---------------------------------------------- feasibility tier vs condition dependence
console.log(`\n\n2. CANDIDATE INDICATORS, 2021 DEVELOPMENT STUDY`);
console.log(line());
console.log('Feasibility tier assigned by the agency, against what the specification must');
console.log('identify. "context" means a clinical state established by something other than');
console.log('the drug list itself.\n');

const tab = dev.tierByDependence();
console.log(['tier', 'none', 'combo', 'context', 'indicators'].map((s, i) => s.padEnd([10, 8, 8, 10, 0][i])).join(''));
['단기', '중기', '장기'].forEach((t) => {
  const r = tab[t];
  if (!r) return;
  console.log(
    t.padEnd(8) + String(r.none).padEnd(8) + String(r.combo).padEnd(8) + String(r.context).padEnd(10) + r.ids.join(', ')
  );
});

const ctx = dev.contextDependent();
const ctxOut = dev.contextTieredOut();
console.log(`\nContext-dependent candidates: ${ctx.length} of ${dev.CANDIDATES.length} (nos. ${ctx.map((c) => c.no).join(', ')})`);
console.log(`  not placed in the short-term tier: ${ctxOut.length} of ${ctx.length}`);
console.log(`Short-term tier: ${dev.CANDIDATES.filter((c) => c.tier === '단기').map((c) => c.no).join(', ')} — all condition-free`);
console.log(`Fielded in 2023: no. ${dev.CANDIDATES.filter((c) => c.fielded).map((c) => c.no).join(', ')}`);

// ------------------------------------------------------ the proposal that was not adopted
const d2 = dev.CANDIDATES.find((c) => c.no === 2);
console.log(`\n\n3. A DIAGNOSIS BINDING WAS PROPOSED AND NOT ADOPTED`);
console.log(line());
console.log(`Candidate ${d2.no} used anti-dementia drug prescription as a stand-in for dementia.`);
console.log(`The panel recorded the misclassification this causes (${d2.bindingProposalDate}):`);
console.log(`  "${d2.statedReason}"`);
console.log('and proposed binding the denominator to a diagnosis instead:');
console.log(`  "${d2.bindingProposal}"`);
console.log(`Adopted: ${d2.bindingProposalAdopted ? 'yes' : 'no'}. Tier: ${d2.tier}. Fielded: ${d2.fielded ? 'yes' : 'no'}.`);

// --------------------------------------------------------- competing explanations, verbatim
console.log(`\n\n4. REASONS THE DOCUMENTS THEMSELVES GIVE`);
console.log(line());
console.log('These are the agency\'s stated reasons. Not all of them concern coding, and the');
console.log('two strongest ones concern the unit of analysis rather than code availability.\n');
dev.CANDIDATES.filter((c) => c.tier === '장기').forEach((c) => {
  console.log(`  [${c.no}] ${c.nameEn}`);
  console.log(`      "${c.statedReason}"`);
  if (c.statedReason2) console.log(`      "${c.statedReason2}"`);
});
const d9 = dev.CANDIDATES.find((c) => c.no === 9);
console.log(`  [${d9.no}] ${d9.nameEn}`);
console.log(`      "${d9.statedReason}"`);

console.log('\nNotes and limits');
console.log('  - Tier assignment is the agency\'s own judgement, recorded once. It is not an');
console.log('    experiment and nothing here randomised which indicators were context-dependent.');
console.log('  - Nine candidates is a small set; the tier-by-dependence table is descriptive.');
console.log('  - Candidates 4 and 6 are drug-pair rules, not condition rules, and their stated');
console.log('    exclusion reasons are about domestic prevalence and scope, not about coding.');
console.log('  - The elderly indicator excludes analgesic and anti-inflammatory ingredients.');
console.log('    Whether that class appears in the underlying MFDS notice is not established here.');
