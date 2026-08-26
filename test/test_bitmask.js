/* 비트마스크 엔진 동치 검증 — node test/test_bitmask.js
 * 최적화가 결과를 바꾸면 안 된다. 무작위 조합으로 index.js와 bitmask.js를 대조한다. */
'use strict';
const pim = require('../src/index.js');
const bm = require('../src/bitmask.js');

let pass = 0, fail = 0; const failed = [];
const check = (n, c) => { if (c) pass++; else { fail++; failed.push(n); console.log(`  ✗ ${n}`); } };

// 재현 가능한 난수 (LCG). 시드 고정.
let seed = 20260902;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr, n) => { const c = [...arr]; const out = []; for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };

const ALL_ING = pim.table1.map((x) => x.ingredient)
  .concat(['verapamil', 'diltiazem', 'pioglitazone', 'theophylline', 'caffeine', 'methylphenidate',
           'phenylephrine', 'pseudoephedrine', 'carbamazepine', 'warfarin', 'clopidogrel',
           'apixaban', 'amlodipine', 'metformin', 'simvastatin']);
const ALL_COND = pim.conditions.map((c) => c.id);

const key = (h) => `${h.condition.id}|${h.target.token}|${h.drugs.map((d) => d.ing).sort().join(',')}`;
const norm = (arr) => arr.map(key).sort().join('||');

console.log('비트마스크 엔진 동치 검증\n');
check('조건 18개가 서로 다른 비트에 배정', new Set(pim.conditions.map((c) => bm.bitOf(c.id))).size === 18);
check('비트 위치가 0..17 범위', pim.conditions.every((c) => bm.bitOf(c.id) >= 0 && bm.bitOf(c.id) < 18));
check('조건 없으면 마스크 0', bm.conditionMask([]) === 0);
check('조건 전체면 18비트 전부 켜짐', bm.conditionMask(ALL_COND) === (1 << 18) - 1);
check('모르는 조건 id는 무시', bm.conditionMask(['없는조건']) === 0);
check('마스크는 약물당 1회만 계산되고 캐시됨', (() => {
  bm.clearCache();
  const d = { ing: 'zolpidem', cls: 'zdrug', tags: ['zolpidem'] };
  bm.drugMask(d); bm.drugMask(d); bm.drugMask(d);
  return bm.cacheSize() === 1;
})());

// ── 무작위 500회 대조 ──
let mismatch = 0;
for (let i = 0; i < 500; i++) {
  const drugs = pick(ALL_ING, 1 + Math.floor(rnd() * 12));
  const conds = pick(ALL_COND, Math.floor(rnd() * 6));
  const a = pim.check({ drugs, conditions: conds });
  const b = bm.check({ drugs, conditions: conds });
  if (norm(a.table2) !== norm(bm.mergeByTarget(b.table2))) { mismatch++;
    if (mismatch <= 3) console.log('  불일치:', JSON.stringify({ drugs, conds })); }
  if (a.table1.length !== b.table1.length) { mismatch++; }
}
check(`무작위 500조합에서 기존 엔진과 결과 동일 (불일치 ${mismatch}건)`, mismatch === 0);

// ── 경계 케이스 ──
check('빈 입력 동일', bm.check({ drugs: [], conditions: [] }).table2.length === 0);
check('조건 없으면 표2 판정 없음', bm.check({ drugs: ALL_ING, conditions: [] }).table2.length === 0);
check('병용 조건(아스피린+클로피도그렐) 성립',
  bm.check({ drugs: ['aspirin', 'clopidogrel'], conditions: ['stroke_secondary'] }).table2.some((h) => h.target.all));
check('아스피린 단독은 병용 조건 미성립',
  !bm.check({ drugs: ['aspirin'], conditions: ['stroke_secondary'] }).table2.some((h) => h.target.all));
check('표1 판정은 성분당 1건', bm.check({ drugs: ['diazepam', 'diazepam'] }).table1.length === 1);

console.log(`\n비트마스크 동치: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail}건)`);
if (fail) { console.log('실패:\n - ' + failed.join('\n - ')); process.exit(1); }
