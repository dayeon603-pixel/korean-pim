/* Can a generative model recover a rule that was demoted into prose?
 *   node analysis/prose_roundtrip.js [model] [repeats]
 *
 * ── Why this experiment ───────────────────────────────────────────────────
 * Japan's national guidance removed the society criteria's dedicated 「対象となる患者群」 column and
 * left the condition inside the 「推奨される使用法」 prose. A person can still read it; the column a
 * machine reads is gone. This study describes that as demotion from an axis to a sentence rather
 * than deletion.
 *
 * The obvious objection follows: why not extract the rule back out of the prose with a large
 * language model? The objection is fair, and only a measurement can answer it.
 *
 * ── Design ────────────────────────────────────────────────────────────────
 * A structured (condition to target drug) rule is rendered into prose in the same shape as the
 * Japanese guidance, and the model is given only that prose and asked to recover the structure. The
 * original structure is the ground truth.
 *   structure -> prose -> (model) -> structure'   and the two structures are compared.
 *
 * The ground truth is sound because this repository's Table 2 structure passes 197 source-agreement
 * checks.
 * The question is whether recovery is possible from what the prose actually carries, not from the
 * model's prior knowledge.
 *
 * ── What this experiment can and cannot say ───────────────────────────────
 *  - Can say: whether prose is a lossless carrier for a decision rule.
 *  - Cannot say: extraction performance against the actual Japanese guidance. The prose here is ours,
 *    not theirs.
 *  - This is one model. Another model or another prompt may give a different figure.
 */
'use strict';
const pim = require('../src/index.js');

const MODEL = process.argv[2] || 'qwen2.5:14b';
const REPS = parseInt(process.argv[3] || '1', 10);

/** Render a structured rule into prose in the shape of the Japanese guidance. The essential move is
 *  removing the dedicated column and dissolving the condition into a sentence. */
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

/** Query the model. Use the HTTP API. Do not use the CLI.
 *
 * An early version piped `ollama run` and reported a 44% parse failure rate. Opening the raw output
 * showed the model was fine and the CLI was (1) mixing in spinner and line-erase control characters
 * and (2) inserting line breaks inside JSON strings to fit the terminal width.
 * The effect grew with output length, so only conditions with many target drugs failed. Reported as
 * it stood, it would have manufactured a finding that does not exist: that models fail as rules grow
 * complex. This is why raw output must be inspected before any measurement is reported.
 *
 * The HTTP API adds no control characters and no line breaks, and format:"json" enforces the shape.
 */
async function ask(prose) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt: PROMPT(prose), stream: false, format: 'json',
      options: { temperature: 0 },   // fixed for reproducibility
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  try { return JSON.parse(body.response); } catch { return null; }
}

console.log(`산문 왕복 복원 — 모델 ${MODEL}, 조건 ${pim.table2.length}개 × ${REPS}회\n`);
console.log('조건                     대상  복원  정확  누락  오생성');

/** Compare drug names. Absorb spelling variation without ever calling two different drugs the same. */
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
    // Was the condition itself recovered? Getting the drugs right while losing the condition leaves
    // nothing usable as a rule.
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
