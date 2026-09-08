/* Measuring the gap left by the national standard, at scale — node test/measure_gap.js [n] [reps]
 *
 * The 2022 HIRA national standard is drug-only, so it cannot make a condition-conditioned finding.
 * The same prescriptions are run through both standards to count the share that the national
 * standard does not flag and only Table 2 does. Several seeds are run to show whether the estimate
 * is stable.
 *
 * The cohort generator lives in test/cohort.js because test_ncqa_correlation.js must draw from the
 * same cohort.
 */
'use strict';
const { run } = require('./cohort.js');

const N = parseInt(process.argv[2] || '1000000', 10);
const REPS = parseInt(process.argv[3] || '5', 10);

console.log(`Gap left by the national standard — ${N.toLocaleString()} prescriptions x ${REPS} seeds\n`);
console.log('seed        national   Table 2     both   nat only   T2 only (gap)   share of T2 missed');
const gaps = [], shares = [];
for (let r = 0; r < REPS; r++) {
  const seed = 20260902 + r * 7919;
  const t0 = Date.now();
  const x = run(seed, N);
  const gap = x.onlyT2 / N * 100, share = x.onlyT2 / x.t2Flag * 100;
  gaps.push(gap); shares.push(share);
  console.log(`${String(seed).padEnd(10)} ${String(x.hiraFlag).padStart(8)} ${String(x.t2Flag).padStart(8)} ${String(x.both).padStart(8)} ${String(x.onlyHira).padStart(7)} ${(String(x.onlyT2)+'  ('+gap.toFixed(2)+'%)').padStart(16)} ${(share.toFixed(2)+'%').padStart(10)}   [${((Date.now()-t0)/1000).toFixed(1)}s]`);
}
const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); };
console.log(`\ngap rate            mean ${mean(gaps).toFixed(3)}%  sd ${sd(gaps).toFixed(4)}  range ${Math.min(...gaps).toFixed(2)}-${Math.max(...gaps).toFixed(2)}`);
console.log(`share of T2 missed  mean ${mean(shares).toFixed(3)}%  sd ${sd(shares).toFixed(4)}  range ${Math.min(...shares).toFixed(2)}-${Math.max(...shares).toFixed(2)}`);
console.log(`\n${(N * REPS).toLocaleString()} prescriptions adjudicated. Synthetic data, not a real prescribing distribution.`);
