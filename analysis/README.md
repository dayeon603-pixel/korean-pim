# analysis — 실제 진료기록 분석

## 데이터는 저장소에 없다

MIMIC-IV Clinical Database Demo는 PhysioNet에서 직접 받아야 한다. 재배포하지 않는다.

```bash
mkdir -p mimic/hosp && cd mimic/hosp
for f in prescriptions diagnoses_icd patients admissions; do
  curl -O "https://physionet.org/files/mimic-iv-demo/2.2/hosp/$f.csv.gz"
done
```

- 자격 심사 없이 접근 가능한 공개 배포본이다(ODC-BY 1.0). 환자 100명.
- 인용: Johnson A, Bulgarelli L, Pollard T, Horng S, Celi LA, Mark R.
  MIMIC-IV Clinical Database Demo (version 2.2). PhysioNet. 2023.

## 실행

```bash
node analysis/mimic_demo.js ./mimic/hosp
```

## 이 분석이 무엇이고 무엇이 아닌가

**맞다** — 한국형 PIM 2018 판정 엔진이 실제 진료기록에서 동작함을 보이는 시연.
합성 데이터가 아니라 실제 환자의 처방·진단 코드를 입력으로 쓴다.

**아니다** — 한국 노인의 PIM 노출률 추정.
MIMIC은 미국 중환자실 입원 기록이고 데모판은 100명이다. 한국 외래 다제약물 양상과 다르다.

## 알려진 한계

| 항목 | 내용 |
|---|---|
| 규모 | 65세 이상 44명. 통계적 추정이 아니라 시연 규모 |
| 진료 환경 | 미국 중환자실 입원. 한국 외래와 처방 양상이 다르다 |
| 약물 매핑 | 문자열 정규화 기반. RxNorm 등 표준 코드를 거치지 않음 |
| 조건 매핑 | `icd_map.js`의 ICD 범위는 **우리가 정한 조작적 정의**. 논문에 없다 |
| 임상 검토 | 두 매핑 모두 약사·임상의 검토 전 |

한계를 줄이려면 (1) MIMIC-IV 정식판(자격 심사 필요), (2) 심평원 환자표본자료,
(3) RxNorm 매핑 도입, (4) ICD 범위의 임상 검토가 필요하다.
