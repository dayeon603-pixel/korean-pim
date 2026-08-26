# korean-pim

**한국형 노인 부적절약물(PIM) 2018 판정 라이브러리.**
표1 63항목(조건 무관) + 표2 18개 조건(기저질환·병력) = **고유 102항목 전량.**
의존성 없음. 결정론적 규칙 판정. 생성형 모델 미사용.

> **검증 상태:** 2026-08-26 **원문 대조 완료(항목 구성 차원)** + **WHO ATC 코드 매핑.**
> 표1 63항목·표2 18개 조건이 원문과 집합·순서까지 일치하고, 63항목 중 59항목에 ATC 5단계 코드를
> 부여했습니다. `npm test`로 284건이 재실행됩니다. 다만 사유 문구의 자구 대조와 **약사·임상의 검토는
> 아직입니다.** 임상 의사결정에 그대로 쓰지 마십시오. 연구·프로토타입·교육용입니다.
> → [VERIFICATION.md](VERIFICATION.md) · [DATA_NOTICE.md](DATA_NOTICE.md)

---

## 왜 만들었나

한국형 PIM 2018은 국내 노인 복약안전의 표준 합의 목록인데, **기계가 읽을 수 있는 형태로 공개된 게 없습니다.**
쓰려면 논문 PDF의 표를 매번 사람이 옮겨 적어야 합니다. 그 과정에서 두 가지가 반복됩니다.

1. 표2(기저질환 조건부 18개)는 구현이 번거로워 자주 생략됩니다. 그런데 실제 위해는 여기서 많이 나옵니다.
2. 계열로 뭉뚱그려 판정하다 **거짓양성**이 쌓입니다. 논문에 글리벤클라미드만 있는데 설폰요소제 전체를 경고하는 식입니다.

이 패키지는 102항목을 성분키·효능군·태그까지 붙여 구조화하고, 표2를 조건×약물 매처로 구현하고,
**계열 추정을 금지**해 그 두 문제를 막습니다.

## 설치

```bash
npm install korean-pim
# 또는 저장소를 그대로 복사해서 require 해도 됩니다. 의존성이 없습니다.
```

## 사용

```js
const pim = require('korean-pim');

pim.coverage;
// { table1: 63, table2Conditions: 18, table2Only: 39, unique: 102 }

// 1) 성분 하나가 노인 주의약물인가
pim.isTable1('zolpidem');        // true
pim.isTable1('glimepiride');     // false  ← 논문에 없으므로 판정하지 않는다
pim.checkIngredient('zolpidem').reason;
// '벤조디아제핀과 유사한 안전성 프로파일(낙상·섬망)'

// 2) 복용 목록 + 기저질환 통합 판정
const r = pim.check({
  drugs: ['warfarin', 'chlorpheniramine', 'zolpidem', 'amlodipine'],
  conditions: ['dementia', 'falls', 'bleeding'],
});

r.table1.map(h => h.item.nameKo);
// ['클로르페니라민', '졸피뎀']          ← 암로디핀·와파린은 표1에 없다

r.table2.map(h => `${h.condition.label} + ${h.target.nameKo}`);
// ['치매·인지장애 + 항콜린제', '치매·인지장애 + 졸피뎀',
//  '낙상·골절 병력 + 항콜린제', '낙상·골절 병력 + 졸피뎀',
//  '출혈 위험 상황 + 와파린']

// 3) 입력 화면에 띄울 기저질환·병력 목록
pim.conditions;
// [{ id:'dementia', label:'치매·인지장애', kind:'진단', condition:'섬망·치매·인지장애' }, ... 18개]
```

`conditions`를 넘기지 않으면 **표2는 아무것도 판정하지 않습니다.** 환자 상태를 모르면 추정하지 않는다는 뜻입니다.

## 표1에 없는 약을 표2 기준으로 판정하려면

표2에는 계열 단위 기준(`항콜린제`, `NSAID`, `오피오이드`, `이뇨제`, `베타차단제`, `스테로이드` 등)이 있습니다.
표1에 등재된 63종은 효능군이 이미 붙어 있어 자동으로 매칭되지만, 그 밖의 약은 **호출자가 분류를 넘겨야** 합니다.

```js
pim.check({
  drugs: [{ ing: 'prednisolone', cls: 'cortico', name: '프레드니솔론' }],
  conditions: ['dm'],
});
// → 당뇨 + 스테로이드(전신)
```

이 설계는 의도적입니다. 라이브러리가 모르는 약의 계열을 **추측하지 않습니다.**

## API

| 함수 | 설명 |
|---|---|
| `coverage` | `{ table1, table2Conditions, table2Only, unique }` |
| `table1` | 63항목 배열 (`drug`, `ingredient`, `nameKo`, `classKey`, `classKo`, `tags`, `reason`, `dose`) |
| `table2` | 18개 조건 배열 (`id`, `condition`, `label`, `kind`, `reason`, `targets`) |
| `conditions` | 입력 UI용 조건 목록 |
| `isTable1(ing)` | 표1 등재 여부 |
| `checkIngredient(ing)` | 표1 항목 또는 `null` |
| `classify(ing)` | 표1 성분의 효능군·태그, 표1 밖이면 `null` |
| `nameKo(ing)` | 성분키의 한글명 |
| `checkAtc(code)` | **ATC 5단계 코드로 역조회** |
| `atcMapping` | ATC 매핑 메타(부여 수, 미부여 사유, 표본 대조 기록) |
| `check({ drugs, conditions })` | 표1 + 표2 통합 판정 |

## 표준 용어체계 (ATC)

표1 63항목 중 **59항목에 WHO ATC 5단계 코드**를 부여했습니다. 표준 코드를 쓰는 처방 시스템·CDSS와
바로 연결하기 위한 것입니다.

```js
pim.checkAtc('N05CF02').nameKo;   // '졸피뎀'
pim.checkIngredient('zolpidem').atc;   // 'N05CF02'
```

**단일 코드로 매핑되지 않는 4항목**은 코드를 비우고 사유를 남겼습니다. 억지로 붙이지 않았습니다.

| 항목 | 사유 |
|---|---|
| Clidinium-chlordiazepoxide | 복합제라 단일 성분 코드로 특정 불가 |
| Scopolamine | 염 형태에 따라 A04AD01·A03BB01로 갈림 |
| Estrogens ± progestins | 성분군이며 제제별로 G03C·G03F로 분산 |
| Insulin, sliding scale | 투여 요법이지 성분이 아님 |

이중 분류 3항목(Aspirin, Ketorolac, Orphenadrine)은 어느 쪽을 택했는지 `atcNote`에 적었습니다.

ATC 코드는 **논문에 없는 우리 매핑 계층**입니다. 9항목을 WHO ATC 인덱스로 표본 대조해
**오류 1건을 발견·수정**했고(Dimenhydrinate), 나머지는 형식·중복 자동 검증만 수행했습니다.
전수 대조는 미완료입니다.

## 설계 원칙

- **성분키 완전일치.** 표1은 계열 추정을 하지 않습니다. 거짓양성은 임의 중단이라는 실제 위해로 이어지기 때문입니다.
- **조건을 모르면 판정하지 않습니다.** 표2는 입력된 기저질환·병력에 대해서만 작동합니다.
- **결정론적.** 같은 입력에는 항상 같은 출력. 판정 근거가 데이터에 고정돼 있습니다.
- **용량 조건을 숨기지 않습니다.** `Aspirin >325 mg/day` 같은 항목은 `dose`와 `doseConditional`로 표시되며,
  용량 확인은 사람이 해야 합니다.

## 테스트

```bash
npm test     # 87건(라이브러리·ATC) + 197건(원문 대조) = 284건
npm run verify   # 원문 대조만: 표1 63항목·표2 18조건이 논문과 일치하는지
```

거짓양성 검증이 별도 섹션으로 있습니다. 글리메피리드·에페리손·트라마돌·세레콕시브처럼
**계열은 비슷하지만 논문에 없는 약이 걸리지 않는지**를 확인합니다.

## 인용

이 패키지를 연구에 쓰셨다면 **원 논문을 인용해 주십시오.**

> Kim MY, Etherton-Beer C, Kim CB, Yoon JL, Ga H, Kim HC, Song JS, Kim KI, Won CW.
> Development of a Consensus List of Potentially Inappropriate Medications for Korean Older Adults.
> *Ann Geriatr Med Res* 2018;22(3):121-129. DOI: 10.4235/agmr.2018.22.3.121

## 기여

표2의 계열 해석(어떤 성분까지를 "항콜린제"로 볼지 등)은 논문이 개별 성분을 열거하지 않은 곳에서
저희가 판단한 것입니다. **이견이 있으면 이슈로 알려 주십시오.** 근거와 함께 주시면 반영합니다.

## 라이선스

코드와 매핑 계층은 MIT. **논문 본문과 표의 저작권은 원 저자·저널에 있습니다.**
자세한 것은 [DATA_NOTICE.md](DATA_NOTICE.md)를 보십시오.

이 소프트웨어는 의료 조언·진단·치료를 제공하지 않습니다.
