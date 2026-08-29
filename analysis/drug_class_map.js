/* 표1 밖 약물의 계열·태그 사전 — 실제 진료자료에 판정 축을 적용하기 위한 최소 사전.
 *
 * 왜 필요한가: 판정 엔진은 표1 63종의 성분키만 안다. 그러나 두 판정 축은 모두 표1 밖 약물을
 *   지목한다. 표2는 베라파밀·COX-2 억제제·오피오이드 등을 조건별 대상으로 삼고, 국가 기준의
 *   14계열도 표1에 없는 성분을 포함한다. 사전 없이 실제 처방을 판정하면 두 축이 함께 침묵한다.
 *
 * 설계 원칙
 *   1. **표1에 이미 있는 성분은 넣지 않는다.** 엔진의 판정과 어긋날 수 있고, 어긋나면
 *      어느 쪽이 맞는지 판단할 근거가 없다. 시험이 중복 등재를 막는다.
 *   2. 두 축 중 어느 쪽에도 관련이 없는 약(스타틴, ACE 억제제 등)은 넣지 않는다.
 *      넣어도 판정이 바뀌지 않고 사전만 커진다.
 *   3. **한쪽 축에만 유리한 사전을 만들지 않는다.** 약물 단독 축이 쓰는 계열과 조건부 축이 쓰는
 *      계열을 같은 기준으로 함께 채운다.
 *   4. 임상적으로 구분되는 약을 뭉뚱그리지 않는다. 탐스로신·실로도신은 요로선택적이라
 *      표2의 말초 알파-1 차단제(테라조신·독사조신·프라조신)와 분리한다. 뭉치면 낙상 조건에서
 *      과판정한다.
 *
 * 값 형식: [계열키, ...태그]
 *
 * 표1에 이미 있는 성분 19종(테라조신·독사조신·프라조신·이부프로펜·나프록센·디클로페낙·인도메타신·
 * 케토롤락·설린닥·티클로피딘·아스피린·쿠에티아핀·리스페리돈·테마제팜·클로나제팜·클로르디아제폭사이드·
 * 메토카르바몰·스코폴라민·메토클로프라미드)은 초안에서 뺐다. 엔진이 이미 아는 약이다.
 */
'use strict';

const MAP = {
  // ── 오피오이드 (표2: 낙상·만성변비) ──────────────────────────────────
  tramadol: ['opioid'], hydrocodone: ['opioid'], oxycodone: ['opioid'],
  morphine: ['opioid'], fentanyl: ['opioid'], codeine: ['opioid'],
  hydromorphone: ['opioid'], methadone: ['opioid'], buprenorphine: ['opioid'],

  // ── 말초 알파-1 차단제 (표2: 낙상) ───────────────────────────────────
  // 탐스로신·실로도신·나프토피딜은 요로선택적이라 제외한다. 아래 UROSELECTIVE 참조.

  // ── NSAID (표2: 심부전·궤양·만성콩팥병 / 국가 기준: 비선택적 NSAID) ── etodolac: ['nsaid', 'nsaid', 'nsaid_ns'],
  nabumetone: ['nsaid', 'nsaid', 'nsaid_ns'],
  celecoxib: ['cox2', 'cox2'],

  // ── 베타차단제 (표2: 당뇨 저혈당 은폐) ───────────────────────────────
  metoprolol: ['bb', 'betablocker'], carvedilol: ['bb', 'betablocker'],
  atenolol: ['bb', 'betablocker'], propranolol: ['bb', 'betablocker'],
  nebivolol: ['bb', 'betablocker'], bisoprolol: ['bb', 'betablocker'],
  sotalol: ['bb', 'betablocker'], nadolol: ['bb', 'betablocker'],

  // ── 전신 스테로이드 (표2: 당뇨) ──────────────────────────────────────
  // 흡입·국소 제제는 전신 노출이 다르므로 넣지 않는다.
  prednisone: ['cortico', 'corticosteroid'], prednisolone: ['cortico', 'corticosteroid'],
  methylprednisolone: ['cortico', 'corticosteroid'], dexamethasone: ['cortico', 'corticosteroid'],

  // ── 이뇨제 (표2: 저나트륨혈증) ───────────────────────────────────────
  furosemide: ['diuretic', 'diuretic'], hydrochlorothiazide: ['diuretic', 'diuretic'],
  chlorthalidone: ['diuretic', 'diuretic'], torsemide: ['diuretic', 'diuretic'],
  bumetanide: ['diuretic', 'diuretic'], indapamide: ['diuretic', 'diuretic'],
  spironolactone: ['kdiuretic', 'diuretic'], triamterene: ['kdiuretic', 'diuretic'],
  eplerenone: ['kdiuretic', 'diuretic'], amiloride: ['kdiuretic', 'diuretic'],

  // ── 항혈전제 (표2: 출혈 위험·궤양 병력) ──────────────────────────────
  clopidogrel: ['antiplatelet'], cilostazol: ['antiplatelet'],
  prasugrel: ['antiplatelet'], ticagrelor: ['antiplatelet'],
  warfarin: ['anticoag'], apixaban: ['noac'], rivaroxaban: ['noac'],
  dabigatran: ['noac'], edoxaban: ['noac'],

  // ── 비DHP 칼슘차단제 (표2: 심부전) ──────────────────────────────────
  verapamil: ['ccbnd'], diltiazem: ['ccbnd'],

  // ── 항경련제 (표2: 저나트륨혈증) ─────────────────────────────────────
  carbamazepine: ['anticonv', 'anticonvulsant'], oxcarbazepine: ['anticonv', 'anticonvulsant'],
  gabapentin: ['anticonv', 'anticonvulsant'], pregabalin: ['anticonv', 'anticonvulsant'],
  levetiracetam: ['anticonv', 'anticonvulsant'], phenytoin: ['anticonv', 'anticonvulsant'],
  valproate: ['anticonv', 'anticonvulsant'], lamotrigine: ['anticonv', 'anticonvulsant'],
  topiramate: ['anticonv', 'anticonvulsant'],

  // ── 항우울제 (국가 기준 계열 / 표2: 저나트륨혈증) ────────────────────
  sertraline: ['ssri', 'antidepressant'], citalopram: ['ssri', 'antidepressant'],
  escitalopram: ['ssri', 'antidepressant'], fluoxetine: ['ssri', 'antidepressant'],
  paroxetine: ['ssri', 'antidepressant'], duloxetine: ['snri', 'antidepressant'],
  venlafaxine: ['snri', 'antidepressant'], mirtazapine: ['antidep_other', 'antidepressant'],
  bupropion: ['antidep_other', 'antidepressant'], trazodone: ['antidep_other', 'antidepressant'],

  // ── 항정신병약 (국가 기준 계열 / 표2: 치매) ──────────────────────────
  aripiprazole: ['antipsych', 'antipsychotic'], ziprasidone: ['antipsych', 'antipsychotic'],
  paliperidone: ['antipsych', 'antipsychotic'], lurasidone: ['antipsych', 'antipsychotic'],

  // ── 벤조디아제핀 (국가 기준 계열 / 표2: 치매·낙상) ───────────────────
  oxazepam: ['bzd', 'benzodiazepine'],

  // ── H2 차단제 (표2: 치매) ────────────────────────────────────────────
  ranitidine: ['h2ra', 'h2ra'], famotidine: ['h2ra', 'h2ra'], nizatidine: ['h2ra', 'h2ra'],

  // ── 근이완제 (국가 기준 계열) ────────────────────────────────────────
  cyclobenzaprine: ['musclerelax'],
  baclofen: ['musclerelax'], tizanidine: ['musclerelax'], carisoprodol: ['musclerelax'],

  // ── 항콜린 작용 약물 (표2: 치매·전립선비대·변비·녹내장) ──────────────
  meclizine: ['antihist1', 'anticholinergic'], dicyclomine: ['antispas', 'anticholinergic'],
  promethazine: ['antihist1', 'anticholinergic'],
  tolterodine: ['oab', 'anticholinergic'], solifenacin: ['oab', 'anticholinergic'],
  darifenacin: ['oab', 'anticholinergic'], trospium: ['oab', 'anticholinergic'],

  // ── 기타 표2 지목 성분 ───────────────────────────────────────────────
  theophylline: ['xanthine'], caffeine: ['stimulant'], methylphenidate: ['stimulant'],
  pseudoephedrine: ['decongest'], phenylephrine: ['decongest'],
  pioglitazone: ['tzd'],
  clonidine: ['clonidine'], disopyramide: ['disopyramide'],
  carboplatin: ['onco'], cisplatin: ['onco'], cyclophosphamide: ['onco'], vincristine: ['onco'],
};

/** 요로선택적 알파차단제. 표2의 말초 알파-1 차단제와 **분리해야 한다.**
 *  뭉뚱그리면 낙상 조건에서 과판정한다. 사전에서 의도적으로 제외한 목록을 남겨 둔다. */
const UROSELECTIVE = ['tamsulosin', 'silodosin', 'naftopidil'];

module.exports = { MAP, UROSELECTIVE };
