/* Check the condition bindings we authored against real coded data.
 *   node analysis/binding_validate.js <MIMIC demo hosp directory>
 *
 * ── What is checked ───────────────────────────────────────────────────────
 * The icd_map in this repository turns conditions the academic criteria state in clinical prose into
 * diagnosis-code ranges. That binding is absent from the source, so it is our operational definition
 * and carries no authority on its own. Two things can at least be checked.
 *   (1) Resolvability: whether the specified ranges actually match coded records. A range that
 *       matches nothing is either a typo or a code unused in practice.
 *   (2) Relative frequency: whether the ranking of matched conditions is clinically plausible.
 *
 * ── What cannot be checked ────────────────────────────────────────────────
 * Accuracy, meaning sensitivity and specificity, cannot be checked. There are no ground-truth labels.
 * The MIMIC-IV demo is 100 US intensive care patients, so these frequencies must not be read as the
 * prevalence of a general older population. An ICU cohort over-represents acute diagnoses and
 * under-represents mild chronic conditions.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');
const icd = require('./icd_map.js');

const dir = process.argv[2];
if (!dir) { console.error('사용법: node analysis/binding_validate.js <hosp 디렉터리>'); process.exit(1); }

/** Read a gzipped CSV and return an array of objects keyed by the header row. */
function readCsv(name) {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
  const rows = raw.trim().split('\n');
  const head = rows[0].replace(/\r/g, '').split(',');
  return rows.slice(1).map((r) => {
    const v = r.replace(/\r/g, '').split(',');
    return Object.fromEntries(head.map((h, i) => [h, v[i]]));
  });
}

const dx = readCsv('diagnoses_icd.csv.gz');
const pts = readCsv('patients.csv.gz');
const age = Object.fromEntries(pts.map((p) => [p.subject_id, parseInt(p.anchor_age, 10)]));

// Aged 65 and over only. Table 2 is criteria for older adults.
const old = new Set(Object.entries(age).filter(([, a]) => a >= 65).map(([s]) => s));
const byPt = {};
dx.forEach((d) => {
  if (!old.has(d.subject_id)) return;
  (byPt[d.subject_id] = byPt[d.subject_id] || []).push({ code: d.icd_code, ver: d.icd_version });
});

const N = Object.keys(byPt).length;
const hit = {}, codesSeen = {};
Object.entries(byPt).forEach(([sid, codes]) => {
  const conds = new Set();
  codes.forEach(({ code, ver }) => {
    Object.entries(icd.MAP).forEach(([cid, m]) => {
      const list = ver === '10' ? (m.icd10 || []) : (m.icd9 || []);
      const p = list.find((x) => code.startsWith(x));
      if (p) { conds.add(cid); (codesSeen[cid] = codesSeen[cid] || new Set()).add(p); }
    });
  });
  conds.forEach((c) => { hit[c] = (hit[c] || 0) + 1; });
});

const label = Object.fromEntries(pim.table2.map((c) => [c.id, c.label]));
console.log(`조건 결속 검증 — MIMIC-IV Clinical Database Demo v2.2\n`);
console.log(`65세 이상 진단코드 보유 환자 ${N}명 · 결속 조건 ${Object.keys(icd.MAP).length}개\n`);
console.log('조건'.padEnd(24) + '환자수   비율    실제로 걸린 코드 접두');
console.log('─'.repeat(78));

const rows = Object.keys(icd.MAP).map((cid) => ({
  cid, n: hit[cid] || 0, codes: [...(codesSeen[cid] || [])],
})).sort((a, b) => b.n - a.n);

rows.forEach((r) => {
  console.log(`${(label[r.cid] || r.cid).padEnd(24)}${String(r.n).padStart(5)} ${((r.n / N) * 100).toFixed(1).padStart(6)}%   `
    + (r.codes.length ? r.codes.slice(0, 6).join(' ') : '— 걸린 코드 없음'));
});

const resolved = rows.filter((r) => r.n > 0).length;
const dead = rows.filter((r) => r.n === 0);
console.log('\n' + '─'.repeat(78));
console.log(`해석된 조건 ${resolved}/${rows.length}`);
if (dead.length) {
  console.log(`걸리지 않은 조건 ${dead.length}개: ${dead.map((d) => label[d.cid] || d.cid).join(', ')}`);
  console.log('  → 코드 범위가 틀렸을 수도 있고, ICU 100명 표본에 해당 환자가 없을 수도 있다.');
  console.log('  → 이 표본만으로는 둘을 구별하지 못한다.');
}
console.log('\n※ 정확도 검증이 아니다. 정답 라벨이 없어 민감도·특이도를 잴 수 없다.');
console.log('※ 미국 중환자실 100명이므로 위 비율을 일반 노인 유병률로 읽으면 안 된다.');
console.log('※ ICU 코호트는 급성기 진단이 과대표되고 만성 경증 조건이 과소표된다.');

module.exports = { N, rows, resolved };
