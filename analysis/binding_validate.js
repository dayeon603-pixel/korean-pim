/* 우리가 저작한 조건 결속을 실제 코드화 자료에 대고 검증한다.
 *   node analysis/binding_validate.js <MIMIC demo hosp 디렉터리>
 *
 * ── 무엇을 검증하는가 ─────────────────────────────────────────────────────
 * 이 저장소의 icd_map 은 학술 기준이 임상 용어로만 쓴 조건을 진단코드 범위로 옮긴 것이다.
 * 원문에 없는 결속이므로 **우리가 정한 조작적 정의**이고, 그대로 내놓으면 근거가 없다.
 * 최소한 두 가지는 확인할 수 있다.
 *   (1) 해석 가능성 — 지정한 코드 범위가 실제 코드화된 진료기록에 실제로 걸리는가.
 *       걸리지 않는 범위는 오타이거나 실무에서 쓰이지 않는 코드다.
 *   (2) 상대 빈도 — 걸리는 조건들의 상대 순위가 임상적으로 납득 가능한가.
 *
 * ── 무엇을 검증하지 못하는가 ──────────────────────────────────────────────
 * 정확도(민감도·특이도)는 검증하지 못한다. 정답 라벨이 없기 때문이다.
 * MIMIC-IV Demo 는 미국 중환자실 100명이므로 여기 빈도를 일반 노인 유병률로 읽으면 안 된다.
 * ICU 코호트는 급성기 진단이 과대표되고 만성 경증 조건이 과소표된다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');
const icd = require('./icd_map.js');

const dir = process.argv[2];
if (!dir) { console.error('사용법: node analysis/binding_validate.js <hosp 디렉터리>'); process.exit(1); }

/** gz csv 를 읽어 헤더 기준 객체 배열로 돌려준다. */
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

// 65세 이상만 본다. 표2는 노인 기준이다.
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
