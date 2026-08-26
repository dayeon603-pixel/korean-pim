/**
 * 비트마스크 조건 매칭 — 표2(기저질환 조건부) 판정의 상수시간 구현.
 *
 * 문제: 표2는 18개 조건 × 조건당 여러 판정 대상이라, 약 하나를 볼 때마다
 *       조건과 대상을 모두 순회하면 약물 수 × 조건 수 × 대상 수만큼 비교가 생긴다.
 *
 * 구현: 조건 18개를 비트 위치 0..17에 고정하고, 약물마다 "이 약이 걸리는 조건"을
 *       18비트 마스크로 미리 계산해 캐시한다. 판정은 환자 조건 마스크와 AND 한 번이다.
 *
 *   drugMask & patientMask  →  0이 아니면 판정, 켜진 비트가 곧 성립한 조건
 *
 * 마스크 계산은 약물당 1회이고 캐시되므로, 같은 약이 반복 등장하는 대규모 처방
 * 스크리닝에서 조건 순회가 사라진다. 병용 조건(아스피린+클로피도그렐)은 약 하나로
 * 결정되지 않으므로 마스크에 넣지 않고 별도 처리한다.
 *
 * 결과는 src/index.js의 check()와 항상 일치해야 한다. test/test_bitmask.js가 이를 검증한다.
 */
'use strict';
const pim = require('./index.js');

// 조건 id → 비트 위치 (18개, 순서 고정)
const BIT = new Map(pim.table2.map((c, i) => [c.id, i]));
const CONDITION_COUNT = pim.table2.length;
if (CONDITION_COUNT > 30) throw new Error('조건이 30개를 넘으면 32비트 정수 마스크를 쓸 수 없다');

// 마스크에 넣을 수 있는 대상(단일 약물로 판정되는 것)만 추린다. 병용 조건은 제외.
const SINGLE_TARGETS = [];
pim.table2.forEach((c) => c.targets.forEach((t) => {
  if (!t.all) SINGLE_TARGETS.push({ bit: BIT.get(c.id), cond: c, target: t });
}));
const COMBO_TARGETS = [];
pim.table2.forEach((c) => c.targets.forEach((t) => { if (t.all) COMBO_TARGETS.push({ cond: c, target: t }); }));

// 비트 위치별 대상 목록. 켜진 비트만 펼치면 되므로 전체 대상(59개) 순회를 없앤다.
const TARGETS_BY_BIT = Array.from({ length: CONDITION_COUNT }, () => []);
SINGLE_TARGETS.forEach((s) => TARGETS_BY_BIT[s.bit].push(s));

function targetHits(target, drug) {
  if (target.ingredient) return drug.ing === target.ingredient;
  if (target.class) return drug.cls === target.class;
  if (target.tag) return [drug.cls, ...(drug.tags || [])].includes(target.tag);
  return false;
}

/** 약물 하나가 어떤 조건들에 걸리는지 18비트 마스크로 계산한다. */
function computeDrugMask(drug) {
  let mask = 0;
  for (let i = 0; i < SINGLE_TARGETS.length; i++) {
    const s = SINGLE_TARGETS[i];
    if (targetHits(s.target, drug)) mask |= (1 << s.bit);
  }
  return mask;
}

// 약물 캐시. 키는 성분키 + 효능군 + 태그(호출자가 분류를 다르게 줄 수 있으므로).
const maskCache = new Map();
function drugMask(drug) {
  const key = `${drug.ing}|${drug.cls || ''}|${(drug.tags || []).join(',')}`;
  let m = maskCache.get(key);
  if (m === undefined) { m = computeDrugMask(drug); maskCache.set(key, m); }
  return m;
}

/** 환자의 기저질환 id 배열 → 18비트 마스크 */
function conditionMask(conditionIds) {
  let mask = 0;
  (conditionIds || []).forEach((id) => { const b = BIT.get(id); if (b !== undefined) mask |= (1 << b); });
  return mask;
}

/** 정규화: 문자열이면 성분키로 보고, 표1 등재 성분이면 효능군·태그를 자동 보완 */
function normalize(d) {
  const base = typeof d === 'string' ? { ing: d.toLowerCase() } : { ...d, ing: String(d.ing || '').toLowerCase() };
  const known = pim.checkIngredient(base.ing);
  if (known) {
    base.cls = base.cls || known.classKey;
    base.tags = [...new Set([...(base.tags || []), ...known.tags])];
  }
  base.tags = base.tags || [];
  base.name = base.name || pim.nameKo(base.ing);
  return base;
}

/**
 * 비트마스크 기반 통합 판정. src/index.js의 check()와 동일한 결과를 낸다.
 * @returns {{table1: Array, table2: Array}}
 */
function check({ drugs = [], conditions = [] } = {}) {
  const list = drugs.map(normalize);
  const pMask = conditionMask(conditions);

  const t1 = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const hit = pim.checkIngredient(list[i].ing);
    if (!hit || seen.has(hit.ingredient)) continue;
    seen.add(hit.ingredient);
    t1.push({ drug: list[i], item: hit, doseConditional: !!hit.dose });
  }

  const t2 = [];
  if (pMask !== 0) {
    // 약물별 마스크 AND 한 번으로 "걸리는 조건이 있는가"를 판단한다.
    const active = [];
    for (let i = 0; i < list.length; i++) {
      const m = drugMask(list[i]) & pMask;
      if (m !== 0) active.push({ drug: list[i], mask: m });
    }
    // 켜진 비트만 펼친다. 비트를 하나씩 떼어내며(m &= m-1) 해당 비트의 대상만 확인한다.
    for (let i = 0; i < active.length; i++) {
      let m = active[i].mask;
      const drug = active[i].drug;
      while (m !== 0) {
        const bit = 31 - Math.clz32(m & -m);          // 가장 낮은 켜진 비트 위치
        const targets = TARGETS_BY_BIT[bit];
        for (let j = 0; j < targets.length; j++) {
          if (targetHits(targets[j].target, drug)) {
            t2.push({ condition: targets[j].cond, target: targets[j].target, drugs: [drug] });
          }
        }
        m &= m - 1;                                    // 처리한 비트 제거
      }
    }
    // 병용 조건은 약 하나로 결정되지 않으므로 따로 본다.
    const onIds = new Set(conditions || []);
    COMBO_TARGETS.forEach((c) => {
      if (!onIds.has(c.cond.id)) return;
      const groups = c.target.all.map((ing) => list.filter((d) => d.ing === ing)).filter((a) => a.length);
      if (groups.length === c.target.all.length) t2.push({ condition: c.cond, target: c.target, drugs: groups.map((g) => g[0]) });
    });
  }
  return { table1: t1, table2: t2 };
}

/** 같은 조건·약물이 여러 번 나오는 판정 결과를 index.js 형식과 비교 가능하게 합친다. */
function mergeByTarget(t2) {
  const out = new Map();
  t2.forEach((h) => {
    const k = `${h.condition.id}|${h.target.token}`;
    if (!out.has(k)) out.set(k, { condition: h.condition, target: h.target, drugs: [] });
    out.get(k).drugs.push(...h.drugs);
  });
  return [...out.values()];
}

module.exports = {
  check, drugMask, conditionMask, mergeByTarget,
  CONDITION_COUNT, bitOf: (id) => BIT.get(id),
  cacheSize: () => maskCache.size,
  clearCache: () => maskCache.clear(),
};
