/**
 * korean-pim — 한국형 노인 부적절약물(PIM) 2018 판정 라이브러리
 *
 * 출처 논문:
 *   Kim MY, Etherton-Beer C, Kim CB, Yoon JL, Ga H, Kim HC, Song JS, Kim KI, Won CW.
 *   Development of a Consensus List of Potentially Inappropriate Medications for Korean Older Adults.
 *   Ann Geriatr Med Res 2018;22(3):121-129.  DOI 10.4235/agmr.2018.22.3.121
 *
 * 범위: 표1 63항목(조건 무관) + 표2 18개 조건(기저질환·병력) = 고유 102항목.
 * 판정은 전부 결정론적이며 추론 모델을 쓰지 않는다. 같은 입력에는 항상 같은 결과가 나온다.
 *
 * ⚠ 임상 사용 전 반드시 DATA_NOTICE.md를 읽을 것. 데이터는 2차 요약 경로로 디지털화됐고
 *   원문 대조가 완료되지 않았다. 이 라이브러리는 의사·약사의 판단을 대체하지 않는다.
 */
'use strict';

const RAW = require('../data/pim_kr_2018.json');

const table1 = RAW.table1_regardless_of_condition.map((x) => Object.freeze({
  drug: x.drug,          // 논문 원문 표기
  ingredient: x.ing,     // 성분키(소문자 영문)
  nameKo: x.kr,          // 한글 성분명
  classKey: x.cls,       // 효능군 키(표2의 계열 단위 기준 매칭에 쓰임)
  classKo: x.cat,        // 한글 효능군 표시명
  group: x.class,        // 논문의 약효군 분류
  tags: Object.freeze(x.tags || []),
  reason: x.reason,      // 부적절 사유(논문)
  dose: x.dose || null,  // 용량 조건(있는 항목만)
}));

const table2 = RAW.table2_by_condition.map((c) => Object.freeze({
  id: c.id,
  condition: c.condition,   // 논문 원문 조건 표기
  label: c.label,           // 입력 화면용 짧은 라벨
  kind: c.kind,             // 진단 / 병력 / 증상 / 상태 / 연령
  reason: c.reason,
  targets: Object.freeze(c.match.map((m) => Object.freeze({
    token: m.token,   // 논문 원문 표기
    nameKo: m.kr,
    ingredient: m.ing || null,
    class: m.cls || null,
    tag: m.tag || null,
    all: m.all ? Object.freeze(m.all) : null,  // 병용 조건(전부 있어야 성립)
    dose: m.dose || null,
    note: m.note || null,
  }))),
}));

const byIngredient = new Map(table1.map((x) => [x.ingredient, x]));
const byCondition = new Map(table2.map((c) => [c.id, c]));

// 성분키 → 한글명. 표1에 없고 표2에만 나오는 성분(와파린·베라파밀 등)도 이름을 돌려주기 위한 표.
const nameKoByIngredient = new Map(table1.map((x) => [x.ingredient, x.nameKo]));
table2.forEach((c) => c.targets.forEach((t) => {
  if (t.ingredient && !nameKoByIngredient.has(t.ingredient)) nameKoByIngredient.set(t.ingredient, t.nameKo);
  if (t.all) t.all.forEach((ing) => { if (!nameKoByIngredient.has(ing)) nameKoByIngredient.set(ing, ing); });
}));

/** 성분키의 한글명. 이 데이터셋이 아는 성분만 돌려주고, 모르면 입력값을 그대로 돌려준다. */
function nameKo(ingredient) {
  const k = String(ingredient || '').toLowerCase();
  return nameKoByIngredient.get(k) || k;
}

const t1Names = new Set(table1.map((x) => x.drug));
const t2Tokens = new Set(table2.flatMap((c) => c.targets.map((t) => t.token)));
const coverage = Object.freeze({
  table1: table1.length,
  table2Conditions: table2.length,
  table2Only: [...t2Tokens].filter((t) => !t1Names.has(t)).length,
  unique: new Set([...t1Names, ...t2Tokens]).size,
});

const conditions = table2.map((c) => Object.freeze({ id: c.id, label: c.label, kind: c.kind, condition: c.condition }));

/** 성분키 → 표1 항목. 계열 추정을 하지 않는다(완전일치만). 없으면 null. */
function checkIngredient(ingredient) {
  if (!ingredient) return null;
  return byIngredient.get(String(ingredient).toLowerCase()) || null;
}

/** 표1 판정 대상 성분이 맞는지. */
function isTable1(ingredient) { return checkIngredient(ingredient) !== null; }

/** 표1에 있는 성분의 효능군·태그. 표1 밖 성분은 null(호출자가 직접 분류해야 한다). */
function classify(ingredient) {
  const hit = checkIngredient(ingredient);
  return hit ? { class: hit.classKey, classKo: hit.classKo, tags: hit.tags.slice(), group: hit.group } : null;
}

function targetHits(target, drug) {
  if (target.ingredient) return drug.ing === target.ingredient;
  if (target.class) return drug.cls === target.class;
  if (target.tag) return [drug.cls, ...(drug.tags || [])].includes(target.tag);
  return false;
}

/**
 * 표1 + 표2 통합 판정.
 * @param {object} input
 * @param {Array<string|{ing:string,cls?:string,tags?:string[],name?:string}>} input.drugs
 *        문자열이면 성분키로 본다. 표2의 계열 단위 기준(항콜린제·NSAID 등)까지 판정하려면
 *        cls/tags를 함께 넘겨야 한다. 표1 성분은 classify()로 자동 보완된다.
 * @param {string[]} [input.conditions] 표2 조건 id 배열. 비우면 표2는 판정하지 않는다.
 * @returns {{table1: Array, table2: Array, coverage: object}}
 */
function check({ drugs = [], conditions: condIds = [] } = {}) {
  const list = drugs.map((d) => {
    const base = typeof d === 'string' ? { ing: d.toLowerCase() } : { ...d, ing: String(d.ing || '').toLowerCase() };
    const known = checkIngredient(base.ing);
    if (known) {
      base.cls = base.cls || known.classKey;
      base.tags = [...new Set([...(base.tags || []), ...known.tags])];
    }
    base.tags = base.tags || [];
    base.name = base.name || nameKo(base.ing);
    return base;
  });

  // 같은 성분이 여러 번 들어와도 표1 판정은 성분당 1건으로 합친다(경고 중복 방지).
  const t1 = [];
  const seen = new Set();
  list.forEach((d) => {
    const hit = checkIngredient(d.ing);
    if (!hit || seen.has(hit.ingredient)) return;
    seen.add(hit.ingredient);
    t1.push({ drug: d, item: hit, doseConditional: !!hit.dose });
  });

  const on = new Set(condIds || []);
  const t2 = [];
  table2.forEach((c) => {
    if (!on.has(c.id)) return;
    c.targets.forEach((t) => {
      if (t.all) {
        const groups = t.all.map((ing) => list.filter((d) => d.ing === ing)).filter((a) => a.length);
        if (groups.length === t.all.length) t2.push({ condition: c, target: t, drugs: groups.map((g) => g[0]) });
        return;
      }
      const hits = list.filter((d) => targetHits(t, d));
      if (hits.length) t2.push({ condition: c, target: t, drugs: hits });
    });
  });

  return { table1: t1, table2: t2, coverage };
}

module.exports = {
  table1, table2, conditions, coverage,
  checkIngredient, isTable1, classify, check, nameKo,
  byIngredient, byCondition,
  source: RAW.source, doi: RAW.doi, digitized: RAW.digitized, note: RAW.note,
};
