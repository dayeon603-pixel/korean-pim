/* 결속을 다르게 그으면 판정이 얼마나 달라지는가
 *   node analysis/binding_sensitivity.js <MIMIC demo hosp 디렉터리>
 *
 * ── 왜 재는가 ─────────────────────────────────────────────────────────────
 * 본 연구는 "학술 기준이 조건을 임상 용어로만 쓰므로 값집합을 저작해야 하고,
 * 저작 결과는 저작자마다 달라질 수 있다"고 주장한다. 그러나 주장만으로는 부족하다.
 * 같은 조건문을 서로 다르게, 그러나 **둘 다 방어 가능하게** 결속했을 때
 * 판정 건수가 얼마나 벌어지는지를 재야 그 주장이 측정이 된다.
 *
 * ── 설계 ──────────────────────────────────────────────────────────────────
 * 원문이 여러 개념을 한 조건에 묶어 둔 항목을 고른다. 예컨대 표2의 낙상 조건은
 * 「낙상·골절·실신·기립성 저혈압 병력」으로 네 개념을 묶는다. 이때
 *   좁은 결속 — 조건명의 핵심 개념만 (낙상 사건·낙상 병력)
 *   넓은 결속 — 원문이 열거한 개념 전부 (+ 골절·실신·기립성 저혈압)
 * 둘 다 원문에서 방어할 수 있다. 어느 쪽이 옳은지 원문은 말하지 않는다.
 *
 * ── 해석 ──────────────────────────────────────────────────────────────────
 * 두 결속의 판정 건수 차이가 크다면, 그 조건의 지표값은 결속 저작자의 선택에
 * 좌우된다. 이는 결속을 공개하지 않은 지표가 재현될 수 없음을 뜻한다.
 * 반대로 차이가 작다면 그 조건은 결속 선택에 둔감하다.
 *
 * ── 한계 ──────────────────────────────────────────────────────────────────
 *  - 어느 결속이 옳은지 판정하지 않는다. 정답이 없기 때문이다. 벌어지는 폭만 잰다.
 *  - MIMIC-IV Demo 중환자실 44명이므로 절대 비율은 일반 노인 유병률이 아니다.
 *  - 두 변형은 저자가 만든 것이며 실제 다른 기관이 저작한 값집합이 아니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');

const dir = process.argv[2];
if (!dir) { console.error('사용법: node analysis/binding_sensitivity.js <hosp 디렉터리>'); process.exit(1); }

function readCsv(name) {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
  const rows = raw.trim().split('\n');
  const head = rows[0].replace(/\r/g, '').split(',');
  return rows.slice(1).map((r) => {
    const v = r.replace(/\r/g, '').split(',');
    return Object.fromEntries(head.map((h, i) => [h, v[i]]));
  });
}

/** 원문이 여러 개념을 묶어 둔 조건. 좁게/넓게 둘 다 원문에서 방어된다. */
const VARIANTS = {
  falls: {
    text: '낙상·골절·실신·기립성 저혈압 병력',
    narrow: { icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181'],
              icd9: ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588'], why: '낙상 사건과 낙상 병력만' },
    broad:  { icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181', 'S72', 'R55', 'I951'],
              icd9: ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588', '820', '7802', '4580'],
              why: '원문이 열거한 골절·실신·기립성 저혈압까지' },
  },
  dementia: {
    text: '섬망·치매·인지장애',
    narrow: { icd10: ['F00', 'F01', 'F02', 'F03', 'G30'], icd9: ['290', '3310'], why: '치매만' },
    broad:  { icd10: ['F00', 'F01', 'F02', 'F03', 'F05', 'G30', 'G31'],
              icd9: ['290', '2941', '2942', '2948', '3310', '2930'], why: '섬망과 기타 인지장애까지' },
  },
  ulcer: {
    text: '위·십이지장 궤양 병력',
    narrow: { icd10: ['K25', 'K26'], icd9: ['531', '532'], why: '위·십이지장 궤양만' },
    broad:  { icd10: ['K25', 'K26', 'K27', 'K28'], icd9: ['531', '532', '533', '534'],
              why: '부위 미상·문합부 궤양까지' },
  },
  ckd: {
    text: '만성 콩팥병',
    narrow: { icd10: ['N183', 'N184', 'N185'], icd9: ['5853', '5854', '5855', '5856'],
              why: '3기 이상만 (약물 감량이 통상 필요해지는 단계)' },
    broad:  { icd10: ['N18'], icd9: ['585'], why: '병기 무관 전체' },
  },
  bleeding: {
    text: '출혈 위험 상황',
    narrow: { icd10: ['D68', 'D69'], icd9: ['286', '287'], why: '응고·혈소판 장애만' },
    broad:  { icd10: ['D68', 'D69', 'K922', 'I60', 'I61', 'I62', 'K920'],
              icd9: ['286', '287', '5789', '431', '432', '4553'], why: '실제 출혈 사건까지' },
  },
};

const dx = readCsv('diagnoses_icd.csv.gz');
const pts = readCsv('patients.csv.gz');
const age = Object.fromEntries(pts.map((p) => [p.subject_id, parseInt(p.anchor_age, 10)]));
const byPt = {};
dx.forEach((d) => {
  if (!(age[d.subject_id] >= 65)) return;
  (byPt[d.subject_id] = byPt[d.subject_id] || []).push(d);
});
const N = Object.keys(byPt).length;

function count(spec) {
  return Object.values(byPt).filter((codes) => codes.some((d) => {
    const list = d.icd_version === '10' ? spec.icd10 : spec.icd9;
    return list.some((p) => d.icd_code.startsWith(p));
  })).length;
}

const label = Object.fromEntries(pim.table2.map((c) => [c.id, c.label]));
console.log(`결속 선택에 따른 판정 변동 — MIMIC-IV Demo 65세 이상 ${N}명\n`);
console.log('조건'.padEnd(18) + '좁게   넓게   차이   배수   원문 조건문');
console.log('─'.repeat(88));

const rows = [];
Object.entries(VARIANTS).forEach(([cid, v]) => {
  const n = count(v.narrow), b = count(v.broad);
  const ratio = n === 0 ? null : b / n;
  rows.push({ cid, n, b, ratio });
  console.log(`${(label[cid] || cid).padEnd(18)}${String(n).padStart(4)}  ${String(b).padStart(5)}  `
    + `${String(b - n).padStart(5)}  ${(ratio === null ? '  —' : ratio.toFixed(1) + '배').padStart(6)}   ${v.text}`);
});

const valid = rows.filter((r) => r.ratio !== null);
const maxR = Math.max(...valid.map((r) => r.ratio));
const changed = rows.filter((r) => r.b !== r.n).length;
console.log('\n' + '─'.repeat(88));
console.log(`결속 선택에 따라 판정 건수가 달라진 조건 ${changed}/${rows.length}`);
console.log(`최대 변동 ${maxR.toFixed(1)}배`);
console.log('\n두 변형은 모두 원문에서 방어된다. 원문은 어느 쪽이 옳은지 말하지 않는다.');
console.log('따라서 결속을 공개하지 않은 지표는 같은 기준을 쓰더라도 재현되지 않는다.');
console.log('\n※ 어느 결속이 옳은지 판정하지 않는다. 벌어지는 폭만 잰다.');
console.log('※ 중환자실 44명이므로 절대 비율을 일반 노인 유병률로 읽으면 안 된다.');
console.log('※ 두 변형은 저자가 만든 것이며 다른 기관이 실제 저작한 값집합이 아니다.');

module.exports = { N, rows, maxRatio: maxR, changed };
