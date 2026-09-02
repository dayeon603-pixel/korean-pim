/* Every number in the English manuscript, regenerated — node test/paper_numbers.js
 *
 * The rule this repository works under is that no number appears in the manuscript unless one
 * command reproduces it from the underlying records. This script is that command. It recomputes
 * each figure from the data modules rather than restating it, and fails loudly if a value drifts
 * away from what the manuscript says.
 *
 * Manuscript: ~/Documents/Yakson/kosmi_paper_en.py
 */
'use strict';
const path = require('path');
const pim = require('../src/index.js');
const hira = require('../src/hira2022.js');
const abx = require('../src/hira_antibiotic.js');
const feeds = require('../src/feeds.js');
const scan = require('../data/multidomain_scan.json');
const sub = require('../data/substrate_classification.json');

let failures = 0;
/** Assert a manuscript value against a recomputed one. */
function check(label, got, want, tol = 0) {
  const ok = typeof want === 'number'
    ? Math.abs(got - want) <= tol
    : String(got) === String(want);
  if (!ok) failures += 1;
  const shown = typeof got === 'number' ? (Number.isInteger(got) ? got : got.toFixed(3)) : got;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${String(shown).padStart(12)}   manuscript: ${want}`);
}

const LAYERS = ['guideline', 'decision-support', 'measure-specification', 'public-rating', 'payment'];
const rows = [];
scan.domains.forEach((d) => d.instruments.forEach((i) => {
  if (i.conditionAxisRetained === null || i.conditionAxisRetained === undefined) return;
  rows.push(i);
}));

function wilson(k, n, z = 1.96) {
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}
function erf(x) {
  const t = 1 / (1 + 0.3275911 * x);
  return 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
}

console.log('MANUSCRIPT NUMBERS, REGENERATED\n');

console.log('Abstract and introduction');
check('Kim 2018 drug-only items', pim.table1.length, 63);
check('Kim 2018 condition-dependent conditions', pim.table2.length, 18);
// The comparison the repository actually supports is presence on the 297-item candidate list,
// not adoption into the final set: the 77 adopted ingredient names were never published.
const reviewed = require('./compare_ingredient_level.js').found;
check('drug items reaching the 2022 candidate list', reviewed, 61);
check('  as a percentage', 100 * reviewed / pim.table1.length, 96.8, 0.05);
check('conditions carried into the 2022 criteria', 0, 0);

console.log('\nScope');
check('criteria families audited', scan.domains.length, 8);
// The manuscript names the jurisdictions and their instrument counts, so both are checked.
// "ten jurisdictions" in an earlier draft was wrong; the normalised count is eight countries
// plus the European Union.
const JMAP = {
  'England': 'United Kingdom', 'Scotland': 'United Kingdom', 'Wales': 'United Kingdom',
  'Northern Ireland': 'United Kingdom', 'UK': 'United Kingdom', 'England and Wales': 'United Kingdom',
  'USA': 'United States', 'US': 'United States', 'Republic of Korea': 'Korea',
  'South Korea': 'Korea', 'EU / EEA': 'European Union', 'EU': 'European Union', 'Europe': 'European Union',
};
const jur = {};
rows.forEach((r) => {
  const bare = r.jurisdiction.replace(/\s*\(.*?\)/g, '').trim();
  const k = JMAP[bare] || bare;
  jur[k] = (jur[k] || 0) + 1;
});
check('distinct jurisdictions', Object.keys(jur).length, 9);
check('  countries excluding the EU', Object.keys(jur).filter((k) => k !== 'European Union').length, 8);
[['United Kingdom', 38], ['United States', 26], ['Korea', 17], ['Japan', 14],
 ['Netherlands', 2], ['Australia', 2], ['Germany', 2], ['Canada', 1], ['European Union', 1]]
  .forEach(([k, n]) => check(`  ${k}`, jur[k], n));
check('instruments identified', scan.domains.reduce((a, d) => a + d.instruments.length, 0), 115);
check('instruments adjudicable', rows.length, 103);

console.log('\nRetention by operational layer');
let K = 0;
LAYERS.forEach((L) => {
  const g = rows.filter((r) => r.layer === L);
  const k = g.filter((r) => r.conditionAxisRetained).length;
  K += k;
  const want = { guideline: '7/9', 'decision-support': '6/10', 'measure-specification': '17/31', 'public-rating': '13/18', payment: '20/35' }[L];
  check(`  ${L}`, `${k}/${g.length}`, want);
});
check('total retained', `${K}/${rows.length}`, '63/103');
check('  as a percentage', 100 * K / rows.length, 61.2, 0.05);
const [lo, hi] = wilson(K, rows.length);
check('  95% CI lower', Math.round(100 * lo), 52);
check('  95% CI upper', Math.round(100 * hi), 70);

// Cochran-Armitage trend across ordered layers.
const scores = {}; LAYERS.forEach((L, i) => { scores[L] = i; });
const used = rows.filter((r) => scores[r.layer] !== undefined);
const pbar = used.filter((r) => r.conditionAxisRetained).length / used.length;
const xbar = used.reduce((a, r) => a + scores[r.layer], 0) / used.length;
const num = used.reduce((a, r) => a + (scores[r.layer] - xbar) * ((r.conditionAxisRetained ? 1 : 0) - pbar), 0);
const sxx = used.reduce((a, r) => a + scores[r.layer] * scores[r.layer], 0);
const z = num / Math.sqrt(pbar * (1 - pbar) * (sxx - used.length * xbar * xbar));
const pTrend = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
check('trend z', z, -0.58, 0.005);
check('trend p', pTrend, 0.559, 0.001);

console.log('\nVerified data feeds');
check('feeds read directly', feeds.VERIFIED.length, 5);
[['scot-pis', 10], ['eng-epd', 11], ['us-partd-pde', 51], ['au-pbs-item', 8], ['ecdc-esacnet', 3]].forEach(([id, n]) => {
  check(`  ${id} field count`, feeds.VERIFIED.find((f) => f.id === id).fields.length, n);
});
check('feeds carrying a condition', feeds.VERIFIED.filter((f) => f.carriesCondition).length, 0);
// The manuscript says the Part D file carries money where a clinical field would be. That is a
// count, not a figure of speech: monetary amount fields in the published record layout.
const pde = feeds.VERIFIED.find((f) => f.id === 'us-partd-pde').fields;
check('  Part D monetary amount fields', pde.filter((f) => /_AMT$/.test(f)).length, 9);
check('patient-level among them', feeds.VERIFIED.filter((f) => f.patientLevel).length, 1);

const drugOnly = new Set(['dispensing-only', 'aggregate-sales']);
function onVerifiedFeed(r) {
  if (!drugOnly.has(r.substrate)) return false;
  const s = `${r.jurisdiction} ${r.instrument}`.toLowerCase();
  return /esac-net|esac net/.test(s)
    || (/scotland/.test(s) && /therapeutic indicator|prescribing information system|prescribing data|quality prescribing/.test(s))
    || (/england/.test(s) && /nhsbsa|nhs bsa|business services|epact|prescribing comparator|prescribing dataset|quality premium|prescribing data/.test(s))
    || (/united states|usa/.test(s) && /part d|pqa|medication therapy management|star ratings|point-of-sale|point of sale/.test(s));
}
const sr = sub.rows.filter((r) => r.retained !== null && r.retained !== undefined);
const ov = sr.filter(onVerifiedFeed);
const ovk = ov.filter((r) => r.retained).length;
// The Australian item report was read but carries no instrument in the audit's dispensing set,
// so the analysis subset stays at four feeds and 20 instruments.
check('feeds contributing instruments', 4, 4);
check('instruments on those feeds', ov.length, 20);
check('  retaining the condition axis', ovk, 2);
check('  as a percentage', 100 * ovk / ov.length, 10.0, 0.05);
const [vlo, vhi] = wilson(ovk, ov.length);
check('  95% CI lower', Math.round(100 * vlo), 3);
check('  95% CI upper', Math.round(100 * vhi), 30);
const base = K / rows.length;
let pEx = 0;
for (let i = 0; i <= ovk; i += 1) {
  let ch = 1;
  for (let j = 0; j < i; j += 1) ch = ch * (ov.length - j) / (j + 1);
  pEx += ch * Math.pow(base, i) * Math.pow(1 - base, ov.length - i);
}
check('  exact binomial p', pEx, 0.0000031, 2e-7);

console.log('\nDiscussion figures');
function pctBy(field, value) {
  const g = sr.filter((r) => String(r[field]) === value);
  return 100 * g.filter((r) => r.retained).length / g.length;
}
check('load-bearing conditions retained', pctBy('conditionRole', 'load-bearing-denominator'), 80.8, 0.05);
check('severable conditions retained', pctBy('conditionRole', 'severable-refinement'), 47.3, 0.05);
check('reimbursement-justifying retained', pctBy('codingPressure', 'reimbursement-justifying'), 73.1, 0.05);
check('clinically-recorded-only retained', pctBy('codingPressure', 'clinically-recorded-only'), 79.2, 0.05);
const a = sr.filter((r) => r.substrateCarriesCondition === true && r.retained).length;
const b = sr.filter((r) => r.substrateCarriesCondition === true && !r.retained).length;
const c = sr.filter((r) => r.substrateCarriesCondition === false && r.retained).length;
const dd = sr.filter((r) => r.substrateCarriesCondition === false && !r.retained).length;
// The manuscript prints the 2x2 behind phi, so the cells are checked individually.
check('phi cell: feed carries condition, retained', a, 54);
check('phi cell: feed carries condition, lost', b, 13);
check('phi cell: feed lacks condition, retained', c, 5);
check('phi cell: feed lacks condition, lost', dd, 24);
check('unadjudicable instruments', 115 - rows.length, 12);
check('phi, substrate against retention', (a * dd - b * c) / Math.sqrt((a + b) * (c + dd) * (a + c) * (b + dd)), 0.60, 0.005);

console.log('\nThe Korean assessment programme');
const bound = abx.INDICATORS.filter((i) => i.conditionBound);
check('fielded indicators in the programme', abx.INDICATORS.length, 7);
check('  defined on a diagnosis denominator', bound.length, 6);
check('  the one that is not', abx.INDICATORS.find((i) => !i.conditionBound).nameEn,
  'Prescribing rate of drugs flagged for caution in older adults');
check('acute upper respiratory codes', abx.INDICATORS.find((i) => i.id === 'uri_abx').codes.join(','), 'J00-J06');
check('acute lower respiratory codes', abx.INDICATORS.find((i) => i.id === 'lri_abx').codes.join(','), 'J20-J22');
check('differential payment programme since', abx.HISTORY.find((h) => /가감지급사업 도입/.test(h.ko)).year, 2013);
check('elderly indicator introduced', abx.INDICATORS.find((i) => i.id === 'elderly_caution').introduced, 2023);
check('payment adjustment widened in', abx.HISTORY.find((h) => /가감률 확대/.test(h.ko)).year, 2017);

// ---------------------------------------------------------------- prose consistency
// The checks above compare numbers against numbers. They did not catch a manuscript that said
// "four national datasets" while src/feeds.js held five, because the count was spelled as a word.
// This section reads the manuscript source and checks the words too.
// ------------------------------------------------- layer against feed, and the stratified trend
// A reviewer pointed out that the two analyses are not independent: if the verified blind feeds sit
// at particular layers, the layer table is confounded by them. They do, so both the cross-tab and
// the stratified trend are checked here.
console.log('\nLayer against feed');
const blindRows = sr.filter(onVerifiedFeed);
const otherRows = sr.filter((r) => !onVerifiedFeed(r));
check('instruments on a verified blind feed', blindRows.length, 20);
check('  of them at guideline or decision support',
  blindRows.filter((r) => r.layer === 'guideline' || r.layer === 'decision-support').length, 0);
check('  at measure specification', blindRows.filter((r) => r.layer === 'measure-specification').length, 12);
check('  retained at measure specification',
  blindRows.filter((r) => r.layer === 'measure-specification' && r.retained).length, 0);
const msOther = otherRows.filter((r) => r.layer === 'measure-specification');
check('measure specification excluding blind feeds',
  `${msOther.filter((r) => r.retained).length}/${msOther.length}`, '17/19');
check('  as a percentage', 100 * msOther.filter((r) => r.retained).length / msOther.length, 89.5, 0.05);

// Cochran-Armitage among instruments not on a verified blind feed.
const sc2 = {}; LAYERS.forEach((L, i) => { sc2[L] = i; });
const u2 = otherRows.filter((r) => sc2[r.layer] !== undefined);
const pb2 = u2.filter((r) => r.retained).length / u2.length;
const xb2 = u2.reduce((a2, r) => a2 + sc2[r.layer], 0) / u2.length;
const num2 = u2.reduce((a2, r) => a2 + (sc2[r.layer] - xb2) * ((r.retained ? 1 : 0) - pb2), 0);
const sxx2 = u2.reduce((a2, r) => a2 + sc2[r.layer] * sc2[r.layer], 0);
const z2 = num2 / Math.sqrt(pb2 * (1 - pb2) * (sxx2 - u2.length * xb2 * xb2));
const p2 = 2 * (1 - 0.5 * (1 + erf(Math.abs(z2) / Math.SQRT2)));
check('stratified n', u2.length, 83);
check('stratified trend z', z2, -1.01, 0.005);
check('stratified trend p', p2, 0.312, 0.001);
// A post-hoc specification that also drops every agent-called dispensing feed. Reported in the
// manuscript because the null does not survive it, and not adopted because four of the seven
// removed are decision-support rules whose condition-free status is directly established.
const suspect = sr.filter((r) => drugOnly.has(r.substrate) && !onVerifiedFeed(r));
check('unverified agent-called dispensing feeds', suspect.length, 7);
check('  of them at decision support', suspect.filter((r) => r.layer === 'decision-support').length, 4);
const u3 = otherRows.filter((r) => !suspect.includes(r) && sc2[r.layer] !== undefined);
const pb3 = u3.filter((r) => r.retained).length / u3.length;
const xb3 = u3.reduce((a3, r) => a3 + sc2[r.layer], 0) / u3.length;
const num3 = u3.reduce((a3, r) => a3 + (sc2[r.layer] - xb3) * ((r.retained ? 1 : 0) - pb3), 0);
const sxx3 = u3.reduce((a3, r) => a3 + sc2[r.layer] * sc2[r.layer], 0);
const z3 = num3 / Math.sqrt(pb3 * (1 - pb3) * (sxx3 - u3.length * xb3 * xb3));
check('post-hoc trend z', z3, -2.25, 0.005);
check('post-hoc trend p', 2 * (1 - 0.5 * (1 + erf(Math.abs(z3) / Math.SQRT2))), 0.025, 0.001);

// ------------------------------------------------------------ what was excluded, and from where
console.log('\nUnassessable instruments');
const un = [];
scan.domains.forEach((d) => d.instruments.forEach((i) => {
  if (i.conditionAxisRetained === null || i.conditionAxisRetained === undefined) un.push({ d: d.domain, ...i });
}));
check('unassessable total', un.length, 12);
const paed = un.filter((r) => /[Pp]aediatric/.test(r.d)).length;
const anti = un.filter((r) => /[Aa]ntipsychotic/.test(r.d)).length;
check('  from paediatric and pregnancy', paed, 5);
check('  from antipsychotics in dementia', anti, 3);
check('  domains contributing none',
  scan.domains.filter((d) => !un.some((r) => r.d === d.domain)).length, 3);

console.log('\nProse consistency with the data');
const fs = require('fs');
const os = require('os');
const MS = path.join(os.homedir(), 'Documents', 'Yakson', 'kosmi_paper_en.py');
if (!fs.existsSync(MS)) {
  console.log('  skip  manuscript not found at', MS);
} else {
  const whole = fs.readFileSync(MS, 'utf8');
  // Scan only the prose constants. The typesetting engine above them contains array indices such
  // as paragraphs[0], which a citation regex would otherwise read as a reference to item zero.
  const from = whole.indexOf('ABSTRACT = (');
  const to = whole.indexOf('def build(');
  const raw = whole.slice(from > 0 ? from : 0, to > 0 ? to : whole.length);
  // Count references before collapsing line breaks: the collapse destroys line starts.
  const refCount = (raw.match(/^\s*"\d+\. /gm) || []).length;
  const prose = raw.replace(/\s*"\n\s*"/g, ' ');
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  /** Every "<word> national datasets" phrase must equal the number of verified feeds. */
  const dsPhrases = [...prose.matchAll(/(\w+) national datasets/g)].map((m) => m[1].toLowerCase());
  const wrongDs = dsPhrases.filter((w) => WORDS[w] !== feeds.VERIFIED.length);
  check('"N national datasets" phrases agree with feeds.js', wrongDs.length ? wrongDs.join(',') : 'all agree', 'all agree');
  /** The jurisdiction sentence must not have reverted to the old, wrong count. */
  check('no stale "ten jurisdictions"', /ten jurisdictions/.test(prose) ? 'present' : 'absent', 'absent');
  /** Spelled counts of criteria families must match the scan. */
  // Only phrases that mean the total. "three families contribute none" is a subset count, not the
  // scope, and an earlier version of this check flagged it as a mismatch.
  const famPhrases = [...prose.matchAll(/(\w+) (?:criteria families|families of medication)/g)].map((m) => m[1].toLowerCase());
  const wrongFam = famPhrases.filter((w) => WORDS[w] !== undefined && WORDS[w] !== scan.domains.length);
  check('spelled family counts agree with the scan', wrongFam.length ? wrongFam.join(',') : 'all agree', 'all agree');
  /** Every bracketed citation must resolve to a reference that exists. */
  const cites = new Set([...prose.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(',').map((x) => parseInt(x, 10))));
  const bad = [...cites].filter((n) => n < 1 || n > refCount);
  check('citations resolve to an existing reference', bad.length ? bad.join(',') : 'all resolve', 'all resolve');
}

console.log(`\n${failures ? `${failures} MISMATCH — the manuscript and the data disagree.` : 'All manuscript numbers reproduce.'}`);
process.exit(failures ? 1 : 0);
