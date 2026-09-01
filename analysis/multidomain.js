/* Does the payment gradient replicate outside potentially-inappropriate medication?
 * node analysis/multidomain.js
 *
 * Design. The claim this repository previously made was built inside one criteria family. A
 * pattern found in one family and then described as general is the ordinary way a small study
 * goes wrong, so the pattern was taken to seven other families of medication-safety criteria:
 * antimicrobial stewardship, anticoagulation in atrial fibrillation, opioid safety, renal dose
 * adjustment, diabetes and hypoglycaemia, antipsychotics in dementia, general polypharmacy and
 * medication review, and paediatric and pregnancy safety. Each family was searched by an
 * independent agent instructed to read primary specifications, to report negative findings, and
 * to hunt for counterexamples; each was then adversarially verified by a second agent instructed
 * to refute.
 *
 * Evidence grade. This is the weakest evidence in the repository and it is labelled as such in
 * data/multidomain_scan.json. Nothing here was read by a person. It is used for one purpose only:
 * to ask whether a pattern replicates. A pattern that fails to replicate under a broad search is
 * evidence of absence, and that inference tolerates weak per-row evidence in a way that asserting
 * any single row would not.
 *
 * Result. It does not replicate. Retention of the condition axis is close to three in five at
 * every operational layer including payment, and the ordering by layer is not monotone.
 */
'use strict';
const path = require('path');
const scan = require(path.join('..', 'data', 'multidomain_scan.json'));

const LAYERS = ['guideline', 'decision-support', 'measure-specification', 'public-rating', 'payment'];
const line = (n = 74) => '-'.repeat(n);

/** Every adjudicable instrument, flattened. Rows with an unknown verdict are dropped. */
function instruments(filter = () => true) {
  const out = [];
  scan.domains.forEach((d) =>
    d.instruments.forEach((i) => {
      if (i.conditionAxisRetained === null || i.conditionAxisRetained === undefined) return;
      if (!filter(i)) return;
      out.push({ ...i, domain: d.domain.split('(')[0].trim() });
    })
  );
  return out;
}

/** Retention by layer, with a Wilson interval so small cells are not read as precise. */
function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

/**
 * Cochran-Armitage trend test across ordered layers. Reported so that the absence of a gradient
 * is a number rather than an impression. Normal approximation; the cells here are small.
 */
function trend(rows) {
  const scores = {};
  LAYERS.forEach((L, i) => { scores[L] = i; });
  const used = rows.filter((r) => scores[r.layer] !== undefined);
  const N = used.length;
  if (!N) return null;
  const R = used.filter((r) => r.conditionAxisRetained).length;
  const pbar = R / N;
  let num = 0, sxx = 0, sx = 0;
  used.forEach((r) => { const x = scores[r.layer]; sx += x; sxx += x * x; });
  const xbar = sx / N;
  used.forEach((r) => { num += (scores[r.layer] - xbar) * ((r.conditionAxisRetained ? 1 : 0) - pbar); });
  const varT = pbar * (1 - pbar) * (sxx - N * xbar * xbar);
  if (varT <= 0) return null;
  const z = num / Math.sqrt(varT);
  // two-sided normal tail
  const p = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
  return { z, p, n: N };
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return y;
}

function layerTable(rows, title) {
  console.log(`\n${title}`);
  console.log('  ' + 'layer'.padEnd(24) + 'kept'.padStart(5) + 'lost'.padStart(6) + 'n'.padStart(5) + '%'.padStart(8) + '   95% CI');
  let K = 0, N = 0;
  LAYERS.forEach((L) => {
    const g = rows.filter((r) => r.layer === L);
    if (!g.length) return;
    const k = g.filter((r) => r.conditionAxisRetained).length;
    K += k; N += g.length;
    const [lo, hi] = wilson(k, g.length);
    console.log(
      '  ' + L.padEnd(24) + String(k).padStart(5) + String(g.length - k).padStart(6) + String(g.length).padStart(5) +
      (100 * k / g.length).toFixed(1).padStart(8) + `   ${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}`
    );
  });
  const [lo, hi] = wilson(K, N);
  console.log('  ' + 'TOTAL'.padEnd(24) + String(K).padStart(5) + String(N - K).padStart(6) + String(N).padStart(5) +
    (100 * K / N).toFixed(1).padStart(8) + `   ${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}`);
  const t = trend(rows);
  if (t) console.log(`  trend across ordered layers: z = ${t.z.toFixed(2)}, p = ${t.p.toFixed(3)} (n = ${t.n})`);
  return { K, N };
}

console.log('DOES THE PAYMENT GRADIENT REPLICATE OUTSIDE PIM');
console.log(line());
console.log(`Domains searched: ${scan.domains.length}`);
console.log(`Instruments returned: ${scan.domains.reduce((a, d) => a + d.instruments.length, 0)}`);
console.log(`Evidence grade: ${scan.provenance.grade}. See data/multidomain_scan.json for the warning.`);

const all = instruments();
const read = instruments((i) => i.verified === 'primary-document-read');
layerTable(all, 'All adjudicable instruments');
layerTable(read, 'Restricted to rows the collecting agent called primary-document-read');

console.log('\n\nPER-DOMAIN VERDICTS ON THE THREE CLAIMS');
console.log(line());
console.log('  ' + 'domain'.padEnd(34) + 'asymmetry'.padEnd(14) + 'binding'.padEnd(14) + 'gradient');
const tally = { claim1Asymmetry: {}, claim2Binding: {}, claim3Gradient: {} };
scan.domains.forEach((d) => {
  const v = d.verdict;
  Object.keys(tally).forEach((k) => { tally[k][v[k]] = (tally[k][v[k]] || 0) + 1; });
  console.log('  ' + d.domain.split('(')[0].trim().slice(0, 32).padEnd(34) +
    v.claim1Asymmetry.padEnd(14) + v.claim2Binding.padEnd(14) + v.claim3Gradient);
});
console.log('');
Object.entries(tally).forEach(([k, t]) => {
  console.log('  ' + k.replace(/claim\d/, '').padEnd(12) + JSON.stringify(t));
});

console.log('\n\nWHAT REPLICATED AND WHAT DID NOT');
console.log(line());
console.log('  Gradient toward payment  did not replicate. Contradicted in five domains of eight,');
console.log('                           and the pooled layer ordering is not monotone.');
console.log('  Drug-vs-condition        did not replicate cleanly. Three domains supported it, three');
console.log('    asymmetry              were mixed, two contradicted it. Two verifiers pointed out');
console.log('                           that in indication-coupled families there is no drug-only');
console.log('                           residue to lose, so the asymmetry cannot be tested there.');
console.log('  Binding association      supported or mixed in every domain, contradicted in none.');
console.log('                           This is the weakest result of the three despite the best');
console.log('                           tally, because binding and retention are frequently one');
console.log('                           event named twice: an instrument that keeps a condition');
console.log('                           denominator must state the codes, so of course it has them.');

console.log('\n\nWHAT THIS MEANS FOR THE ANCHOR CASE');
console.log(line());
console.log('  Condition denominators are ordinary. They survive into national instruments at every');
console.log('  layer at roughly three in five, payment included. Korea adopting none of eighteen');
console.log('  condition-dependent PIM criteria is therefore not an instance of a general rule about');
console.log('  operationalisation. It is a deviation from the ordinary rate and it is the thing that');
console.log('  needs explaining.');
