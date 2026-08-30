/* 산문으로 내려간 판정 규칙을 생성형 모델이 되살릴 수 있는가
 *   node analysis/prose_roundtrip.js [모델] [반복]
 *
 * ── 왜 이 실험인가 ────────────────────────────────────────────────────────
 * 일본 국가 지침은 학회 기준의 「対象となる患者群」 전용 열을 없애고 그 조건을
 * 「推奨される使用法」 산문 안에 남겼다. 사람은 읽을 수 있으나 기계가 읽는 열에서는 사라졌다.
 * 본 연구는 이를 "삭제가 아니라 판정 축에서 문장으로의 강등"이라고 서술했다.
 *
 * 그렇다면 당연한 반문이 따라온다. **대규모 언어모델로 산문에서 규칙을 다시 뽑으면 되지 않는가.**
 * 이 반문은 정당하고, 답은 측정으로만 할 수 있다.
 *
 * ── 설계 ──────────────────────────────────────────────────────────────────
 * 구조화된 (조건 → 대상약물) 규칙을 일본 지침과 같은 형식의 **산문으로 렌더링**한 뒤,
 * 모델에게 그 산문만 주고 구조를 복원시킨다. 원본 구조가 정답이다.
 *   구조 → 산문 → (모델) → 구조'      구조와 구조'를 비교한다.
 *
 * 정답의 근거: 이 저장소의 표2 구조는 원문 대조 197건으로 검증돼 있다.
 * 모델의 사전지식이 아니라 **산문에 실제로 담긴 정보만으로** 복원 가능한지를 본다.
 *
 * ── 이 실험이 말할 수 있는 것과 없는 것 ───────────────────────────────────
 *  - 말할 수 있음: 산문이 판정 규칙의 무손실 전달 매체인가.
 *  - 말할 수 없음: 실제 일본 지침 원문에 대한 추출 성능. 우리가 만든 산문은 원문이 아니다.
 *  - 모델 한 종의 결과다. 다른 모델·다른 프롬프트에서 값이 달라질 수 있다.
 */
'use strict';
const pim = require('../src/index.js');

const MODEL = process.argv[2] || 'qwen2.5:14b';
const REPS = parseInt(process.argv[3] || '1', 10);

/** 구조화된 규칙을 일본 지침과 같은 산문 형식으로 바꾼다.
 *  전용 열을 없애고 조건을 문장 안에 녹이는 것이 핵심이다. */
function toProse(c) {
  const names = c.targets.map((t) => t.nameKo);
  return `${names.join(', ')}은(는) ${c.condition} 환자에게는 가능한 한 사용을 피한다. `
       + `${c.reason}의 우려가 있다.`;
}

const PROMPT = (prose) => `다음은 노인 약물요법 지침의 한 항목이다.

"${prose}"

이 문장에서 판정 규칙을 추출하라. 어떤 환자 상태일 때 어떤 약물을 경고해야 하는가.
반드시 아래 형식의 JSON만 출력하라. 설명을 붙이지 마라.
{"condition":"환자 상태","drugs":["약물1","약물2"]}`;

/** 모델에 묻는다. **반드시 HTTP API를 쓴다. CLI 를 쓰면 안 된다.**
 *
 * 처음에는 `ollama run` 을 파이프로 호출했는데 파싱 실패율이 44%로 나왔다.
 * 원출력을 열어 보니 모델 출력은 정상이었고, CLI 가 (1) 스피너·줄지우기 제어문자를 섞고
 * (2) 터미널 폭에 맞춰 **JSON 문자열 안쪽에 줄바꿈을 삽입**하고 있었다.
 * 출력이 길수록 심해져서 대상 약물이 많은 조건만 실패했고, 그대로 보고했다면
 * "규칙이 복잡할수록 모델이 실패한다"는 **없는 발견**을 만들 뻔했다.
 * 측정값을 보고하기 전에 원출력을 확인해야 하는 이유가 이것이다.
 *
 * HTTP API는 제어문자도 줄바꿈 삽입도 없고, format:"json" 으로 형식을 강제할 수 있다.
 */
async function ask(prose) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt: PROMPT(prose), stream: false, format: 'json',
      options: { temperature: 0 },   // 재현성을 위해 고정
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  try { return JSON.parse(body.response); } catch { return null; }
}

console.log(`산문 왕복 복원 — 모델 ${MODEL}, 조건 ${pim.table2.length}개 × ${REPS}회\n`);
console.log('조건                     대상  복원  정확  누락  오생성');

/** 약물명 비교. 표기 흔들림은 흡수하되 서로 다른 약을 같다고 하지 않는다. */
const norm = (s) => String(s).replace(/\s|\(.*?\)|·/g, '').toLowerCase();

console.log(`산문 왕복 복원 — 모델 ${MODEL}, 조건 ${pim.table2.length}개 × ${REPS}회\n`);
console.log('조건                     대상  복원  정확  누락  오생성');

let TP = 0, FN = 0, FP = 0, condOk = 0, parsed = 0, total = 0;
const misses = [];

async function main() {
for (let r = 0; r < REPS; r++) {
  for (const c of pim.table2) {
    total++;
    const prose = toProse(c);
    const got = await ask(prose);
    if (!got) { console.log(`${c.label.padEnd(24)} ${String(c.targets.length).padStart(4)}  응답 실패`); continue; }
    parsed++;
    const gold = new Set(c.targets.map((t) => norm(t.nameKo)));
    const pred = new Set((got.drugs || []).map(norm));
    const tp = [...gold].filter((g) => [...pred].some((p) => p.includes(g) || g.includes(p))).length;
    const fn = gold.size - tp;
    const fp = Math.max(0, pred.size - tp);
    TP += tp; FN += fn; FP += fp;
    // 조건 자체가 복원됐는가. 약물만 맞고 조건을 놓치면 판정에 쓸 수 없다.
    const ok = norm(got.condition || '').includes(norm(c.label).slice(0, 3))
            || norm(c.condition).includes(norm(got.condition || '').slice(0, 3));
    if (ok) condOk++;
    if (fn) misses.push(`${c.label}: 누락 ${[...gold].filter((g) => ![...pred].some((p) => p.includes(g) || g.includes(p))).join(', ')}`);
    console.log(`${c.label.padEnd(24)} ${String(gold.size).padStart(4)} ${String(pred.size).padStart(5)} `
      + `${String(tp).padStart(5)} ${String(fn).padStart(5)} ${String(fp).padStart(6)}${ok ? '' : '  [조건 불일치]'}`);
  }
}

report();
}

function report() {
const prec = TP / (TP + FP), rec = TP / (TP + FN), f1 = 2 * prec * rec / (prec + rec);
console.log(`\n파싱 성공        ${parsed}/${total}`);
console.log(`조건 복원        ${condOk}/${parsed} (${(condOk / parsed * 100).toFixed(1)}%)`);
console.log(`약물 정밀도      ${(prec * 100).toFixed(1)}%   재현율 ${(rec * 100).toFixed(1)}%   F1 ${(f1 * 100).toFixed(1)}%`);
console.log(`누락 ${FN}건 · 오생성 ${FP}건`);
if (misses.length) { console.log('\n누락 사례'); [...new Set(misses)].slice(0, 10).forEach((m) => console.log('  ' + m)); }

console.log('\n※ 우리가 만든 산문이며 일본 지침 원문이 아니다. 원문에 대한 추출 성능이 아니다.');
console.log('※ 모델 한 종의 결과다. 다른 모델·프롬프트에서 값이 달라질 수 있다.');
console.log('※ 정답은 원문 대조 197건으로 검증된 이 저장소의 구조다.');

}

main();
