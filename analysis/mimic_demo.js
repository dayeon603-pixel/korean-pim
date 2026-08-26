/**
 * 실제 진료기록에 대한 조건부 판정 시연 — MIMIC-IV Clinical Database Demo v2.2
 *
 * 실행: node analysis/mimic_demo.js <MIMIC demo hosp 디렉터리>
 *
 * 데이터: MIMIC-IV Clinical Database Demo v2.2 (환자 100명).
 *   PhysioNet 공개 배포본이며 **자격 심사 없이 접근 가능**하다(ODC-BY 1.0).
 *   Johnson A, Bulgarelli L, Pollard T, Horng S, Celi LA, Mark R.
 *   MIMIC-IV Clinical Database Demo (version 2.2). PhysioNet. 2023.
 *
 * ⚠ 이것이 무엇이고 무엇이 아닌가
 *   맞다: 한국형 PIM 2018 판정 엔진이 **실제 진료기록**에서 동작함을 보이는 시연.
 *   아니다: 한국 노인의 PIM 노출률 추정. MIMIC은 **미국 중환자실 입원 기록**이고
 *          환자 100명 규모다. 여기서 나온 비율을 한국 역학 수치로 읽으면 안 된다.
 *
 * 남은 한계
 *   - 약물명 매핑은 문자열 정규화 기반이며 RxNorm 등 표준 코드를 거치지 않았다.
 *   - ICD→조건 매핑은 우리가 정한 조작적 정의이며 임상 검토를 받지 않았다.
 *   - 입원 처방이라 외래 다제약물 양상과 다르다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const pim = require('../src/index.js');
const hira = require('../src/hira2022.js');
const { conditionsFromIcd } = require('./icd_map.js');

const DIR = process.argv[2];
if (!DIR) { console.error('사용법: node analysis/mimic_demo.js <MIMIC demo hosp 디렉터리>'); process.exit(1); }

function readCsvGz(file) {
  const text = zlib.gunzipSync(fs.readFileSync(path.join(DIR, file))).toString('utf8');
  const lines = text.split('\n').filter((l) => l.length);
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    // 따옴표 안 쉼표 처리
    const cells = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

// ── 약물명 정규화: MIMIC은 상품명·제형·염 표기가 섞여 있다 ──
const STRIP = /\b(iv|po|oral|inj|injection|tablet|tab|cap|capsule|solution|soln|syringe|flush|bag|premix|human|citrate|sulfate|hcl|hydrochloride|sodium|tartrate|succinate|maleate|besylate|mesylate|fumarate|bitartrate|acetate|conjugated|suspension|patch|buffered|disintegrating|protocol|ciwa|desensitization)\b/g;
function normDrug(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(STRIP, ' ')
    .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}
const T1 = pim.table1.map((x) => x.ingredient);
function toIngredients(drugName) {
  const n = normDrug(drugName);
  return T1.filter((ing) => n.includes(ing));
}

console.log('실제 진료기록 조건부 판정 시연 — MIMIC-IV Demo v2.2\n');

const patients = readCsvGz('patients.csv.gz');
const dx = readCsvGz('diagnoses_icd.csv.gz');
const rx = readCsvGz('prescriptions.csv.gz');
console.log(`환자 ${patients.length}명 · 진단 ${dx.length.toLocaleString()}건 · 처방 ${rx.length.toLocaleString()}건`);

const elderly = patients.filter((p) => parseInt(p.anchor_age, 10) >= 65);
console.log(`65세 이상 ${elderly.length}명 (연령 ${Math.min(...elderly.map((p) => +p.anchor_age))}~${Math.max(...elderly.map((p) => +p.anchor_age))}세)\n`);

const dxBy = {}, rxBy = {};
dx.forEach((d) => { (dxBy[d.subject_id] = dxBy[d.subject_id] || []).push({ code: d.icd_code, version: d.icd_version }); });
rx.forEach((r) => { (rxBy[r.subject_id] = rxBy[r.subject_id] || []).push(r.drug); });

let anyT1 = 0, anyT2 = 0, onlyT2 = 0, byHira = 0, noDx = 0;
const t1Counter = {}, t2Counter = {}, examples = [];

elderly.forEach((p) => {
  const age = parseInt(p.anchor_age, 10);
  const ings = [...new Set((rxBy[p.subject_id] || []).flatMap(toIngredients))];
  const drugs = ings.map((ing) => {
    const k = pim.checkIngredient(ing);
    return { ing, cls: k.classKey, tags: k.tags, cat: k.classKo };
  });
  const codes = dxBy[p.subject_id] || [];
  if (!codes.length) noDx++;
  const conds = conditionsFromIcd(codes);
  if (age >= 80) conds.push('age80_primary');

  const r = pim.check({ drugs: ings, conditions: conds });
  const hiraHit = drugs.some((d) => hira.isCovered(d, d.cat));

  if (r.table1.length) { anyT1++; r.table1.forEach((h) => { t1Counter[h.item.nameKo] = (t1Counter[h.item.nameKo] || 0) + 1; }); }
  if (r.table2.length) {
    anyT2++;
    r.table2.forEach((h) => { const k = `${h.condition.label} + ${h.target.nameKo}`; t2Counter[k] = (t2Counter[k] || 0) + 1; });
  }
  if (hiraHit) byHira++;
  if (r.table2.length && !hiraHit) {
    onlyT2++;
    if (examples.length < 6) examples.push({ age, ings: ings.slice(0, 8), conds,
      hits: [...new Set(r.table2.map((h) => `${h.condition.label} + ${h.target.nameKo}`))].slice(0, 3) });
  }
});

const pct = (n) => `${(n / elderly.length * 100).toFixed(1)}%`;
console.log('── 판정 결과 (65세 이상 ' + elderly.length + '명) ──');
console.log(`표1(조건 무관) 해당      ${anyT1}명 (${pct(anyT1)})`);
console.log(`표2(조건부) 해당         ${anyT2}명 (${pct(anyT2)})`);
console.log(`국가 기준(약물 단독) 해당 ${byHira}명 (${pct(byHira)})`);
console.log(`**국가 기준 미해당 · 표2만 해당  ${onlyT2}명 (${pct(onlyT2)})**`);
console.log(`진단코드 없는 환자        ${noDx}명`);

console.log('\n── 표1 검출 상위 ──');
Object.entries(t1Counter).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}명  ${k}`));

console.log('\n── 표2 조건부 판정 상위 ──');
Object.entries(t2Counter).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}명  ${k}`));

if (examples.length) {
  console.log('\n── 국가 기준이 놓친 사례 ──');
  examples.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.age}세 · 약물 ${e.ings.join(', ')}`);
    console.log(`     조건 ${e.conds.join(', ')}`);
    console.log(`     판정 ${e.hits.join(' / ')}`);
  });
}

console.log('\n※ MIMIC-IV는 미국 중환자실 입원기록이며 데모판은 100명 규모다.');
console.log('   위 비율은 엔진이 실제 기록에서 동작함을 보이는 것이지 한국 역학 추정치가 아니다.');
console.log('   약물명 매핑은 문자열 정규화 기반이고 ICD→조건 매핑은 조작적 정의다. 둘 다 임상 검토 전이다.');
