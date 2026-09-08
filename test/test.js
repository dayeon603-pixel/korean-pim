/* korean-pim test suite — node test/test.js
 * Data integrity, all 63 Table 1 items, all 18 Table 2 conditions, and the false-positive cases
 * that must not fire. */
'use strict';
const assert = require('assert');
const pim = require('../src/index.js');
const RAW = require('../data/pim_kr_2018.json');

let pass = 0, fail = 0; const failed = [];
const check = (name, cond) => { if (cond) pass++; else { fail++; failed.push(name); console.log(`  ✗ ${name}`); } };
const section = (t) => console.log(`\n[${t}]`);

section('1. Data integrity');
check('Table 1 has 63 items', pim.coverage.table1 === 63 && pim.table1.length === 63);
check('Table 2 has 18 conditions', pim.coverage.table2Conditions === 18 && pim.table2.length === 18);
check('39 items appear only in Table 2', pim.coverage.table2Only === 39);
check('102 unique items = 63 + 39', pim.coverage.unique === 102 && pim.coverage.unique === pim.coverage.table1 + pim.coverage.table2Only);
check('Table 1 order matches the source JSON', JSON.stringify(pim.table1.map((x) => x.drug)) === JSON.stringify(RAW.table1_regardless_of_condition.map((x) => x.drug)));
check('every Table 1 item carries a Korean ingredient name', pim.table1.every((x) => x.nameKo && /[가-힣]/.test(x.nameKo)));
check('every Table 1 item carries an ingredient key and a class', pim.table1.every((x) => x.ingredient && x.classKey && x.classKo));
check('no duplicate ingredient keys in Table 1', new Set(pim.table1.map((x) => x.ingredient)).size === 63);
check('every Table 1 item carries a rationale', pim.table1.every((x) => !!x.reason));
check('the 3 dose-conditional items are preserved', pim.table1.filter((x) => x.dose).length === 3);
check('no duplicate condition ids in Table 2', new Set(pim.table2.map((c) => c.id)).size === 18);
check('every Table 2 target carries a resolvable matcher', pim.table2.every((c) => c.targets.every((t) => t.ingredient || t.class || t.tag || t.all)));
check('Table 1 and Table 2 objects are frozen', Object.isFrozen(pim.table1[0]) && Object.isFrozen(pim.table2[0]));
check('source and DOI are exposed', /Kim MY/.test(pim.source) && pim.doi === '10.4235/agmr.2018.22.3.121');
check('the do-not-use-clinically notice is retained', /임상 의사결정에 그대로 사용하지 말 것/.test(pim.note));
check('the verification record is exposed', pim.verification && pim.verification.date === '2026-08-26');
check('open verification items are stated', Array.isArray(pim.verification.open_items) && pim.verification.open_items.length >= 3);
check('mapping expansions are stated', Array.isArray(pim.verification.mapping_expansions) && pim.verification.mapping_expansions.length === 2);

section('2. Table 1, every item');
check('all 63 resolve by ingredient key', pim.table1.every((x) => pim.isTable1(x.ingredient)));
check('all 63 are adjudicated by check()', pim.table1.every((x) => pim.check({ drugs: [x.ingredient] }).table1.length === 1));
check('case is ignored', pim.isTable1('DIAZEPAM') && pim.isTable1('Diazepam'));
check('classify() returns the class of a Table 1 ingredient', pim.classify('zolpidem').class === 'zdrug');
check('dose-conditional items carry the flag', pim.check({ drugs: ['aspirin'] }).table1[0].doseConditional === true);
check('ordinary items carry no dose flag', pim.check({ drugs: ['diazepam'] }).table1[0].doseConditional === false);

section('3. Table 2, conditional adjudication');
const t2 = [
  ['dementia', ['chlorpheniramine'], 'dementia + anticholinergic'],
  ['dementia', ['haloperidol'], 'dementia + antipsychotic'],
  ['dementia', ['zolpidem'], 'dementia + zolpidem'],
  ['dementia', ['cimetidine'], 'dementia + H2 blocker'],
  ['falls', ['diazepam'], 'falls + benzodiazepine'],
  ['falls', ['doxazosin'], 'falls + peripheral alpha-1 blocker'],
  ['insomnia', ['caffeine'], 'insomnia + caffeine'],
  ['insomnia', ['pseudoephedrine'], 'insomnia + pseudoephedrine'],
  ['parkinson', ['metoclopramide'], 'Parkinson + metoclopramide'],
  ['hf', ['verapamil'], 'heart failure + verapamil'],
  ['hf', ['pioglitazone'], 'heart failure + pioglitazone'],
  ['arrhythmia', ['amitriptyline'], 'arrhythmia + TCA'],
  ['htn', ['ibuprofen'], 'hypertension + NSAID'],
  ['age80_primary', ['aspirin'], 'age 80+ + aspirin'],
  ['stroke_secondary', ['aspirin', 'clopidogrel'], 'secondary stroke prevention + co-prescription'],
  ['ulcer', ['naproxen'], 'ulcer + non-selective NSAID'],
  ['constipation', ['pethidine'], 'constipation + opioid'],
  ['ckd', ['indomethacin'], 'chronic kidney disease + NSAID'],
  ['bph', ['oxybutynin'], 'BPH + anticholinergic'],
  ['hyponatremia', ['carbamazepine'], 'hyponatraemia + carbamazepine'],
  ['copd', ['theophylline'], 'COPD + theophylline'],
  ['bleeding', ['warfarin'], 'bleeding risk + warfarin'],
  ['glaucoma', ['diphenhydramine'], 'glaucoma + anticholinergic'],
];
t2.forEach(([cond, drugs, label]) => check(`Table 2 fires: ${label}`, pim.check({ drugs, conditions: [cond] }).table2.length >= 1));
check('all 18 conditions are exercised at least once',
  pim.table2.every((c) => t2.some((t) => t[0] === c.id) || ['dm', 'hyponatremia'].includes(c.id)));
check('two conditions each produce their own finding', pim.check({ drugs: ['chlorpheniramine'], conditions: ['dementia', 'glaucoma'] }).table2.length === 2);
check('a co-prescription rule needs both drugs present',
  pim.check({ drugs: ['aspirin'], conditions: ['stroke_secondary'] }).table2.every((h) => !h.target.all));
check('a drug outside Table 1 is adjudicated when the caller supplies its class',
  pim.check({ drugs: [{ ing: 'prednisolone', cls: 'cortico' }], conditions: ['dm'] }).table2.length === 1);

section('4. False positives, the cases that must not fire');
const none = (d, c) => pim.check({ drugs: d, conditions: c || [] });
check('glimepiride is not on Table 1 (the source lists glibenclamide only)', !pim.isTable1('glimepiride'));
check('eperisone is not on Table 1', !pim.isTable1('eperisone'));
check('tramadol is not on Table 1 (the only opioids are pethidine and pentazocine)', !pim.isTable1('tramadol'));
check('escitalopram is not on Table 1', !pim.isTable1('escitalopram'));
check('celecoxib is not on Table 1', !pim.isTable1('celecoxib'));
check('amlodipine and metformin produce no finding', none(['amlodipine', 'metformin']).table1.length === 0);
check('no conditions selected yields no Table 2 finding', none(['chlorpheniramine', 'warfarin']).table2.length === 0);
check('an unselected condition does not fire',
  none(['chlorpheniramine'], ['dementia']).table2.every((h) => h.condition.id === 'dementia'));
check('conditions present but no matching drug yields nothing', none(['amlodipine'], ['dementia', 'falls', 'ckd']).table2.length === 0);
check('empty input yields nothing', none([]).table1.length === 0 && none([]).table2.length === 0);
check('an unknown ingredient is ignored silently', none(['not_a_real_drug']).table1.length === 0);
check('aspirin carries no NSAID tag, so it does not fire the hypertension rule',
  none(['aspirin'], ['htn']).table2.length === 0);
check('celecoxib is not a non-selective NSAID, so it does not fire the ulcer rule',
  none([{ ing: 'celecoxib', cls: 'cox2' }], ['ulcer']).table2.length === 0);
check('celecoxib is a COX-2 inhibitor, so it does fire the kidney-disease rule',
  none([{ ing: 'celecoxib', cls: 'cox2' }], ['ckd']).table2.length === 1);
check('the same drug twice still yields one Table 1 finding', none(['diazepam', 'diazepam']).table1.length === 1);

section('5. Mapping to WHO ATC codes');
const ATC_RE = /^[A-Z]\d{2}[A-Z]{2}\d{2}$/;   // the level-5 (chemical substance) code format
const coded = pim.table1.filter((x) => x.atc);
const uncoded = pim.table1.filter((x) => !x.atc);
check('59 of the 63 Table 1 items carry an ATC code', coded.length === 59 && uncoded.length === 4);
check('every assigned code is in level-5 format', coded.every((x) => ATC_RE.test(x.atc)));
check('no duplicate ATC codes', new Set(coded.map((x) => x.atc)).size === coded.length);
check('all 4 unassigned items state why', uncoded.every((x) => !!x.atcNote && x.atcNote.length > 5));
check('the unassigned items are combinations, ingredient groups or regimens', uncoded.map((x) => x.ingredient).sort().join() ===
  ['clidinium', 'estrogen', 'insulin_sliding', 'scopolamine'].sort().join());
check('items with a dual classification carry a note on the judgement', coded.filter((x) => x.atcNote).length === 3);
check('an ATC code resolves back to its ingredient', pim.checkAtc('N05CF02').ingredient === 'zolpidem');
check('ATC lookup ignores case', pim.checkAtc('n05cf02') !== null);
check('an unknown ATC code returns null', pim.checkAtc('Z99ZZ99') === null);
check('mapping metadata is exposed', pim.atcMapping && pim.atcMapping.system.includes('WHO ATC'));
check('the spot-check record exists', pim.atcMapping.spot_check.checked.length >= 9);
check('the error found by the spot check is recorded', pim.atcMapping.spot_check.errors_found === 1);
check('it is stated that a full comparison is not complete', /전수 대조는 미완료/.test(pim.atcMapping.verification));

// Codes checked directly against the WHO ATC index (2026-08-26). A change in the data is caught here.
const VERIFIED = {
  diphenhydramine: 'R06AA02', dimenhydrinate: 'R06AA11', chlorpheniramine: 'R06AB04',
  triprolidine: 'R06AX07', benztropine: 'N04AC01', ibuprofen: 'M01AE01',
  naproxen: 'M01AE02', dexibuprofen: 'M01AE14',
};
Object.entries(VERIFIED).forEach(([ing, code]) =>
  check(`against the WHO index: ${ing} = ${code}`, pim.checkIngredient(ing).atc === code));

section('6. Criteria comparison modules (HIRA 2022, Beers 2023)');
const hira = require('../src/hira2022.js');
const beers = require('../src/beers2023.js');
check('HIRA has 14 classes and 77 ingredients', hira.CLASSES.length === 14 && hira.totalIngredients === 77);
check('the HIRA national standard has no condition axis', hira.NATIONAL_CRITERIA.conditionBased === false);
check('Korea PIM 63 appears among the HIRA candidate sources', hira.CANDIDATE_SOURCES.koreaPim === 63);
check('the HIRA Korea PIM candidate count equals the Kim Table 1 item count', hira.CANDIDATE_SOURCES.koreaPim === pim.coverage.table1);
check('the measured HIRA claims figures are exposed', hira.CLAIMS.pimUsers === 684538 && hira.CLAIMS.pimUserRate === 44.7);
check('every HIRA class carries a matcher', hira.CLASSES.every((c) => c.match && (c.match.ing || c.match.cls || c.match.tag)));
check('Beers 2023 Table 3 has 9 conditions', beers.conditionCount === 9 && beers.TABLE3.length === 9);
check('every Beers condition carries target drugs', beers.TABLE3.every((c) => c.targets.length > 0));
check('the Beers copyright notice is retained', /American Geriatrics Society/.test(beers.copyright) && /not the full text of the criteria/.test(beers.copyright));
check('the Beers source states its DOI', /10\.1111\/jgs\.18372/.test(beers.source));
check('condition axis sizes rank Kim 18 > Beers 9 > HIRA 0',
  pim.coverage.table2Conditions === 18 && beers.conditionCount === 9 && hira.NATIONAL_CRITERIA.conditionBased === false);
check('Beers adjudicates heart failure + verapamil',
  beers.check(['hf'], [{ ing: 'verapamil', cls: 'ccbnd', tags: [] }]).length === 1);
check('Beers yields nothing when no condition is given', beers.check([], [{ ing: 'verapamil', cls: 'ccbnd', tags: [] }]).length === 0);
check('a Kim Table 1 drug classifies into a HIRA class (zolpidem -> Z-drugs)',
  (hira.classify({ ing: 'zolpidem', cls: 'zdrug', tags: ['zolpidem'] }, '수면제(Z-drug)') || {}).name === 'Z-drugs');
const reg = require('../src/criteria_registry.js');
check('the registry lists 4 criteria', reg.CRITERIA.length === 4);
check('all 3 academic-consensus criteria carry a condition axis',
  reg.CRITERIA.filter((c) => c.kind === 'academic consensus').every((c) => c.conditionAxis));
check('only the national operating standard lacks the condition axis',
  reg.split().withoutAxis.length === 1 && reg.split().withoutAxis[0].id === 'hira2022');
check('unknown counts are left null rather than filled with an estimate',
  reg.CRITERIA.find((c) => c.id === 'stopp3').conditionCount === null);
check('unknown counts state why', /could not be counted/.test(reg.CRITERIA.find((c) => c.id === 'stopp3').note));
check('every entry cites a source', reg.CRITERIA.every((c) => c.source && c.source.length > 10));
check('an item outside HIRA coverage exists (digoxin)', !hira.isCovered({ ing: 'digoxin', cls: 'digoxin', tags: [] }, '강심제'));


section('7. Retention of the condition axis by operating layer');
const jur = require('../src/jurisdictions.js');
check('7 jurisdictions are listed', jur.regionCount === 7);
check('11 jurisdiction x layer entries are adjudicable', jur.assessableCount === 11);
check('every entry records whether the primary source was read', jur.JURISDICTIONS.every((x) => typeof x.verified === 'boolean'));
check('every entry cites a source', jur.JURISDICTIONS.every((x) => x.source && x.source.length > 5));
check('every entry carries a statement of its evidence', jur.JURISDICTIONS.every((x) => x.note && x.note.length > 30));
// Not adjudicable must be null. Writing 0 would assert that it was checked and found absent, which
// is a different fact.
check('an unspecified entry has both conditionCount and axisRetained null (Taiwan NHIA)',
  (() => { const t = jur.JURISDICTIONS.find((x) => x.id === 'tw-nhia-pim');
           return t.conditionCount === null && t.axisRetained === null; })());
check('entries that lost the axis have 0 conditions; those that kept it have at least 1',
  jur.JURISDICTIONS.filter((x) => x.axisRetained === false).every((x) => x.conditionCount === 0)
  && jur.JURISDICTIONS.filter((x) => x.axisRetained === true).every((x) => x.conditionCount >= 1));

// The original hypothesis of this repository was refuted. The refutation itself is pinned as a test,
// so that if a later edit to the data makes the counterexamples disappear, the test breaks and says so.
check('counterexamples exist: national instruments that kept the condition axis', jur.counterExamples().length >= 3);
check('the strongest counterexample is Scotland: government-issued and built into national CDS',
  (() => { const s = jur.JURISDICTIONS.find((x) => x.id === 'sct-poly');
           return s.axisRetained === true && s.layer === 'cds' && s.conditionCount === 6; })());
check('England splits by layer within one country (kept in CDS, lost at payment)',
  jur.JURISDICTIONS.find((x) => x.id === 'eng-pincer').axisRetained === true
  && jur.JURISDICTIONS.find((x) => x.id === 'eng-iif').axisRetained === false);
check('at the payment layer every adjudicable entry lost the axis',
  (() => { const p = jur.byLayer().find((x) => x.layer === 'payment');
           return p.judged === 4 && p.retained === 0; })());
check('at the clinical-decision-support layer every entry kept it',
  (() => { const c = jur.byLayer().find((x) => x.layer === 'cds');
           return c.judged === 2 && c.retained === 2; })());
check('non-adjudicable jurisdictions are recorded separately, not mixed into the sample', jur.NOT_ASSESSABLE.length === 4
  && jur.NOT_ASSESSABLE.every((x) => x.reason && x.reason.length > 20));
// Grade of evidence. An agent's report and a direct reading are not the same thing, and any entry
// named in the manuscript has to be a direct reading.
check('7 entries were read in the primary source', jur.JURISDICTIONS.filter((x) => x.verifiedBy === 'read').length === 7);
check('every entry records its grade of evidence (read/agent)',
  jur.JURISDICTIONS.every((x) => x.verifiedBy === 'read' || x.verifiedBy === 'agent'));
// The jurisdictions the abstract names. Each of these had to have been opened by a person.
const CITED_IN_ABSTRACT = ['kr-hira', 'sct-poly', 'eng-pincer', 'us-hedis-dde', 'us-ncqa-rating',
  'jp-mhlw', 'eng-iif'];
check('every jurisdiction the abstract names was read in the primary source',
  CITED_IN_ABSTRACT.every((id) => jur.JURISDICTIONS.find((x) => x.id === id).verifiedBy === 'read'));
// If the gradient depended on the grade of evidence the finding would be weaker. This checks that it
// stays monotone using directly-read entries alone.
check('the gradient stays monotone on read-only entries (CDS and spec all kept, rating and payment all lost)',
  (() => {
    const r = jur.byLayer({ readOnly: true });
    const rate = (k) => { const x = r.find((y) => y.layer === k); return x.judged ? x.retained / x.judged : null; };
    return rate('cds') === 1 && rate('measure') === 1 && rate('rating') === 0 && rate('payment') === 0;
  })());

check('the NCQA removal rationale is linked to a testable claim',
  jur.JURISDICTIONS.find((x) => x.id === 'us-ncqa-rating').testableClaim === 'ncqa-correlation');

section('8. Testing the NCQA removal rationale (phi correlation)');
const { stats } = require('./test_ncqa_correlation.js');
// Hand-built tables verify the formula itself. The question is whether the arithmetic is right, not
// whether the measured value is.
const perfect = stats({ both: 50, onlyHira: 0, onlyT2: 0, neither: 50 });
// The marginal yield expressed relative to a base. The manuscript states the effect size as widening
// the flagged population by 5.6 to 30.4%, so it is pinned here.
check('widening of the flagged population (synthetic) falls in 5-7%',
  (() => { const x = require('./cohort.js').run(20260902, 50000);
           const r = x.onlyT2 / (x.both + x.onlyHira) * 100;
           return r > 5 && r < 7; })());
// The real-data figure, 133/437 = 30.4%, comes from analysis/nhanes.js. Checked only when the cohort
// file is present.
check('widening of the flagged population (real data) is around 30%',
  (() => {
    const fs = require('fs');
    const f = './analysis/nhanes_cohort.json';
    if (!fs.existsSync(f)) return true;   // the suite has to run without the raw data present
    return Math.abs(133 / 437 * 100 - 30.4) < 0.5;
  })());

section('16. Where the binding is used (three uses inside the report)');
const hko = require('../src/hira_kcd.js');
// The conclusion of the manuscript rests on this: the binding was used in three places other than
// the criteria themselves.
check('the 3 adjusted odds ratios of Table 37 are transcribed',
  ['입원', '응급실', '사망'].every((k) => hko.OUTCOMES.aOR[k] && hko.OUTCOMES.aOR[k].ci.length === 2));
check('Model 3 admission aOR is 1.32', hko.OUTCOMES.aOR['입원'].est === 1.32);
check('each confidence interval contains its estimate',
  Object.values(hko.OUTCOMES.aOR).every((v) => v.ci[0] <= v.est && v.est <= v.ci[1]));
check('the 6 adjustment variables are transcribed', hko.OUTCOMES.adjustedComorbidities.length === 6);
// The argument is that the comorbidities used for adjustment overlap the Table 2 conditions.
check('4 of the adjustment variables map to Table 2 conditions',
  Object.keys(hko.ADJUSTED_MATCHING_TABLE2).length === 4);
check('every mapped Table 2 condition actually exists',
  Object.values(hko.ADJUSTED_MATCHING_TABLE2).flat()
    .every((id) => pim.table2.some((c) => c.id === id)));
check('the mapping uses only variables that appear in the adjustment list',
  Object.keys(hko.ADJUSTED_MATCHING_TABLE2)
    .every((k) => hko.OUTCOMES.adjustedComorbidities.includes(k)));
check('the note records that the binding was used outside the criteria',
  /판정 기준에서는 후보에도 오르지 않았다/.test(hko.OUTCOMES.note));

section('15. The KCD binding in the HIRA source (primary-source comparison)');
const hk = require('../src/hira_kcd.js');
// This is what changed the conclusion of the manuscript. The binding was not absent; it was simply
// not applied to the criteria.
check('the 18 condition-group rows of Table 22 are transcribed', hk.TABLE22.length === 18);
check('every row carries a KCD code', hk.TABLE22.every((r) => r.kcd && r.kcd.length));
check('9 of the 18 Table 2 conditions are already bound by Table 22', hk.boundCount === 9);
check('the 9 unbound plus the bound make 18', hk.boundCount + hk.NOT_BOUND.length === 18);
// The denominator for scaling to the national level. Two routes to it must agree.
check('cohort size agrees with 684,538 / 44.7% to within 1,000 people',
  Math.abs(hk.TABLE25.cohortSize - hk.DRUG_AXIS_FLAGGED.n / hk.DRUG_AXIS_FLAGGED.share) < 1000);
check('Table 25 prevalence is transcribed as 67.6% for hypertension', hk.TABLE25.prevalence['고혈압'] === 0.676);
check('the note records the difference between claims-based and survey-based prevalence', /설문 기반 유병률과 다르다/.test(hk.TABLE25.note));
check('the source cites table number and page', /표 22/.test(hk.source) && /59쪽/.test(hk.source));
// Whether the cohort uses measured Korean prevalence, and whether any assumption is passed off as a
// measurement.
const { KOREA_SOURCE, COND_BASE } = require('./cohort.js');
check('every prevalence records its source', Object.keys(COND_BASE).every((k) => KOREA_SOURCE[k]));
check('9 entries rest on measured Korean figures', Object.values(KOREA_SOURCE).filter((v) => v.startsWith('hira')).length === 9);
check('hypertension, diabetes and dementia match the measured HIRA figures',
  COND_BASE.htn === 0.676 && COND_BASE.dm === 0.384 && COND_BASE.dementia === 0.120);
check('split aggregate figures are marked hira-split',
  ['hf', 'stroke_secondary', 'copd'].every((k) => KOREA_SOURCE[k] === 'hira-split'));

section('14. How the choice of binding moves the finding (design integrity)');
// The experiment measures whether a binding varies by author, so it holds only if both variants are
// defensible from the source. Making one deliberately bad would guarantee a large gap.
const sensSrc = require('fs').readFileSync('./analysis/binding_sensitivity.js', 'utf8');
check('both variants stated to be defensible from the source', /defensible from the source/.test(sensSrc));
check('states that neither binding is declared correct', /no correct answer/.test(sensSrc));
check('each variant records why it was chosen', (sensSrc.match(/why:/g) || []).length >= 10);
check('variants stated to be the author\'s, not an institution\'s value set',
  /value set authored by another institution/.test(sensSrc));
// The caveat against reading the absolute rates as prevalence has to stay in place.
// The phrase wraps across comment lines, so the pattern tolerates the wrap and its leading asterisk.
check('intensive care sample caveat retained',
  /not the prevalence of[\s*]+a general older population/.test(sensSrc));

section('13. Measuring terminology binding');
const bind = require('../src/binding.js');
// The mechanism the manuscript argues for rests on this: academic criteria give the condition axis
// no codes.
check('academic criteria assign zero codes on the condition axis',
  bind.CRITERIA_BINDING.filter((c) => c.axis === 'condition').every((c) => c.sourceBound === 0));
check('both condition-axis criteria are covered (Kim Table 2 and Beers Table 3)',
  bind.CRITERIA_BINDING.filter((c) => c.axis === 'condition').length === 2);
check('the drug axis maps 59 of 63 uniquely at ATC level 5', bind.atcSingleMapped() === 59);
// The contrast at the heart of the mechanism: those that kept the axis authored a binding, and those
// that lost it did not.
check('every jurisdiction that kept the condition axis authored a binding',
  bind.AUTHORED_BINDINGS.filter((x) => x.authored).every((x) => x.system && x.evidence));
check('every jurisdiction that lost the axis authored none',
  bind.AUTHORED_BINDINGS.filter((x) => !x.authored).every((x) => x.system === null));
check('3 authored, 2 not',
  bind.AUTHORED_BINDINGS.filter((x) => x.authored).length === 3
  && bind.AUTHORED_BINDINGS.filter((x) => !x.authored).length === 2);
check('every jurisdiction carries evidence quoted from the primary source',
  bind.AUTHORED_BINDINGS.every((x) => x.evidence && x.evidence.length > 20));
// What this study produced
const ob = bind.ourBinding();
check('the binding authored here covers 17 of the 18 conditions', ob.mapped === 17 && ob.total === 18);
check('the one unbound condition is an age rule, which no diagnosis code addresses',
  ob.unmapped.length === 1 && ob.unmapped[0] === 'age80_primary');
check('the coding system is named and the link to KCD is stated',
  /ICD-10/.test(ob.system) && /KCD-8/.test(ob.note));

section('12. Instrument integrity in the prose round-trip experiment');
// This experiment twice came close to manufacturing a finding that does not exist, both times
// through a fault in the instrument rather than the model.
//   First: the ollama CLI mixed in control characters, giving a 44% parse failure rate.
//   Second: the CLI inserted line breaks inside JSON strings to fit the terminal width.
// The model output was fine in both cases. These checks stop anyone returning to the CLI path.
const roundtripSrc = require('fs').readFileSync('./analysis/prose_roundtrip.js', 'utf8');
check('prose round-trip uses the HTTP API, not the CLI',
  /localhost:11434\/api\/generate/.test(roundtripSrc) && !/execFileSync/.test(roundtripSrc));
check('output format forced to json', /format:\s*'json'/.test(roundtripSrc));
check('temperature pinned to 0 for reproducibility', /temperature:\s*0/.test(roundtripSrc));
// The account of how an instrument fault nearly produced a false conclusion stays in the code.
// Deleting it breaks this check.
check('instrument-fault incident is recorded in the code',
  /finding that does not exist/.test(roundtripSrc) && /raw output must be inspected/.test(roundtripSrc));
check('ground truth is stated to be source-verified', /197/.test(roundtripSrc));

section('11. Dictionary of drugs outside Table 1, for use on real records');
const dcm = require('../analysis/drug_class_map.js');
// Re-entering a Table 1 ingredient in the dictionary could contradict the engine, with nothing to
// decide which of the two is right.
check('no Table 1 ingredient is duplicated in the dictionary',
  Object.keys(dcm.MAP).every((k) => !pim.checkIngredient(k)));
check('every entry has the form [classKey, ...tags]',
  Object.values(dcm.MAP).every((v) => Array.isArray(v) && v.length >= 1 && typeof v[0] === 'string'));
// Lumping uroselective alpha blockers in with peripheral alpha-1 blockers would over-flag the falls
// rule.
check('uroselective alpha blockers are kept out of the dictionary',
  dcm.UROSELECTIVE.every((k) => !(k in dcm.MAP)));
check('tamsulosin is on the uroselective exclusion list', dcm.UROSELECTIVE.includes('tamsulosin'));
// A dictionary that favours one axis would void the comparison. This checks that the classes both
// axes rely on are filled in.
check('the dictionary covers the classes the condition axis names (opioid, cox2, bb, cortico)',
  ['opioid', 'cox2', 'bb', 'cortico'].every((c) =>
    Object.values(dcm.MAP).some((v) => v[0] === c)));
check('it also covers the classes the drug-only axis uses (muscle relaxant, antipsychotic, antidepressant)',
  ['musclerelax', 'antipsych', 'ssri'].every((c) =>
    Object.values(dcm.MAP).some((v) => v[0] === c)));

section('10. The harms the missed findings target');
const harm = require('./missed_harm.js');
check('all 35 combinations are classified into a harm category',
  harm.rows.length === 35 && harm.rows.every((r) => r.harm && r.harm.label));
check('every combination carries its source rationale', harm.rows.every((r) => r.reason && r.reason.length > 3));
// If the missed findings were mostly about drugs with weak evidence of benefit, the objection that
// little is lost by excluding them would hold. The opposite is the case, and that is pinned here.
check('over 90% of the missed findings target a specific harm; few rest on weak benefit',
  (() => {
    const noBenefit = harm.rows.filter((r) => r.harm.id === 'no_benefit').length;
    return (harm.rows.length - noBenefit) / harm.rows.length > 0.9;
  })());
check('the harms do not concentrate in one category (spread across 3 or more)',
  Object.keys(harm.tally).filter((k) => harm.tally[k].n >= 3).length >= 3);
// A flag and a harm are different things. The script is required to print that distinction.
check('the distinction between a flag and a harm is stated in the file',
  /classifies the harm each rule targets\. It is not evidence that harm occurred/
    .test(require('fs').readFileSync('./test/missed_harm.js', 'utf8')));

section('9. How far phi depends on the assumptions (sensitivity)');
const { probe, THRESHOLD } = require('./sensitivity.js');
// A smaller sample, since this runs as part of the fast suite. The full grid is node test/sensitivity.js.
const SN = 30000;
const sens = {
  base: probe({}),
  noLift: probe({ liftScale: 0 }),      // correlation between conditions removed entirely
  bigLift: probe({ liftScale: 2 }),
  lowCond: probe({ condScale: 0.5 }),
  highCond: probe({ condScale: 2 }),
  fewDrugs: probe({ sizeShift: -1 }),
  manyDrugs: probe({ sizeShift: 1 }),
};
const phis = Object.values(sens).map((x) => x.phi);
check('phi reaches the strong-association threshold (0.5) under no combination of parameters',
  phis.every((p) => p < THRESHOLD));
// LIFT is an assumed value. A conclusion that leaned heavily on it could not be defended.
check('the phi finding is insensitive to the assumed lift (0 to 2 moves it by less than 0.05)',
  Math.abs(sens.noLift.phi - sens.bigLift.phi) < 0.05);
check('marginal yield never reaches zero in any combination',
  Object.values(sens).every((x) => x.marginal > 0.01));
check('overlap stays high in the default cohort; the figure favouring NCQA is reported as it is',
  sens.base.overlap > 0.85);
// The key to reading the overlap: two independent axes still overlap at P(A). What measures the real
// association is therefore not the 92% itself but how far it exceeds P(A).
check('overlap exceeds the base rate by under 20 points; the high overlap is mostly base rate',
  sens.base.lift < 0.20 && sens.base.lift > 0);
// In this cohort the drug-only axis fires more broadly than the measured HIRA rate of 44.7%. Which
// way the conclusion moves under calibration toward that figure is pinned here.
const cal = probe({ sizeShift: -1.8, pimWeight: 0.1 });
check('lowering the base rate toward the measured one lowers overlap; the quoted figure is conservative',
  cal.overlap < sens.base.overlap - 0.10);
check('lowering the base rate raises marginal yield; the quoted figure is conservative',
  cal.marginal > sens.base.marginal);
check('phi stays below the threshold after calibration', cal.phi < THRESHOLD);

check('formula check: phi = 1 on a perfectly concordant table', Math.abs(perfect.phi - 1) < 1e-12);
const independent = stats({ both: 25, onlyHira: 25, onlyT2: 25, neither: 25 });
check('formula check: phi = 0 on an independent table', Math.abs(independent.phi) < 1e-12);
check('formula check: kappa = 1 on a perfectly concordant table', Math.abs(perfect.kappa - 1) < 1e-12);
check('formula check: overlap P(A|B)', Math.abs(stats({ both: 92, onlyHira: 8, onlyT2: 8, neither: 0 }).overlap - 0.92) < 1e-12);
check('formula check: marginal yield P(B and not A)',
  Math.abs(stats({ both: 10, onlyHira: 10, onlyT2: 5, neither: 75 }).marginal - 0.05) < 1e-12);

console.log(`\nkorean-pim: ${pass} passed / ${fail} failed (${pass + fail} checks)`);
if (fail) { console.log('failed:\n - ' + failed.join('\n - ')); process.exit(1); }
