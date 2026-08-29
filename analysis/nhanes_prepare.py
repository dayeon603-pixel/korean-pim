#!/usr/bin/env python3
"""NHANES 2017-2018 자료를 판정 엔진 입력으로 변환한다.

왜 NHANES인가: 본 연구의 가장 큰 한계는 두 판정 축의 비교를 합성 코호트에서 수행했다는 점이다.
NHANES는 자격 심사 없이 공개되며 처방·기저질환·사망이 한 사람 단위(SEQN)로 연결되므로,
실제 사람에게 같은 비교를 다시 할 수 있다.

한계(결과 해석에 반드시 병기할 것)
  1. 미국 자료다. 한국의 처방 분포가 아니다.
  2. 처방은 자기보고 기반이며 지난 30일 사용분이다. 청구자료가 아니다.
  3. 표2의 18개 조건 중 NHANES 문항으로 확인 가능한 것은 9개뿐이다.
     따라서 조건부 축의 판정량은 **추정치가 아니라 하한**이다.
  4. 표1 63항목 중 NHANES에 등장하는 것은 34개다. 미등장분은 대부분 미국 미시판이거나
     처방 없이 살 수 있는 약이다.
  5. 사망 추적기간이 중앙값 약 2년으로 짧다.

Usage:
    python3 analysis/nhanes_prepare.py [출력경로]
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

CYCLE = "2017"          # NHANES 2017-2018 (파일 접미사 _J)
SUFFIX = "J"
BASE = f"https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{CYCLE}/DataFiles"
MORT = ("https://ftp.cdc.gov/pub/HEALTH_STATISTICS/NCHS/datalinkage/"
        "linked_mortality/NHANES_2017_2018_MORT_2019_PUBLIC.dat")
FILES = ["DEMO", "RXQ_RX", "MCQ", "DIQ", "BPQ", "KIQ_U", "SLQ", "BIOPRO"]

AGE_MIN = 65

# NHANES 문항 → 표2 조건 id. 확인 가능한 것만 넣는다. 없는 조건은 억지로 만들지 않는다.
# 설문 문항은 1=예, 2=아니오, 7=거부, 9=모름 코드를 쓴다.
CONDITION_MAP = {
    "hf":               ("MCQ", "MCQ160B", lambda v: v == 1),      # 울혈성 심부전
    "stroke_secondary": ("MCQ", "MCQ160F", lambda v: v == 1),      # 뇌졸중
    "copd":             ("MCQ", "MCQ160O", lambda v: v == 1),      # 만성폐쇄성폐질환
    "dm":               ("DIQ", "DIQ010", lambda v: v == 1),       # 당뇨
    "htn":              ("BPQ", "BPQ020", lambda v: v == 1),       # 고혈압
    "ckd":              ("KIQ_U", "KIQ022", lambda v: v == 1),     # 신장기능 저하
    "insomnia":         ("SLQ", "SLQ050", lambda v: v == 1),       # 수면 문제로 의사 상담
    "hyponatremia":     ("BIOPRO", "LBXSNASI", lambda v: v < 135), # 혈청 나트륨 135 mmol/L 미만
}
# 매핑하지 않은 조건. NHANES에 해당 문항이 없거나, 있어도 조건의 핵심 요소를 확인할 수 없다.
# age80_primary 는 연령(80세 이상)은 확인되나 "1차 예방 목적 복용"이라는 의도를 확인할 수 없어 제외한다.
# 억지로 매핑하면 조건부 축이 과도하게 발화해 결론이 우리 쪽에 유리해진다.
UNMAPPED = ["dementia", "falls", "parkinson", "arrhythmia", "ulcer",
            "constipation", "bph", "bleeding", "glaucoma", "age80_primary"]

# 사망연계 공개파일 고정폭 레이아웃(46자)
MORT_COLS = [(0, 6), (14, 15), (15, 16), (16, 19), (41, 44), (44, 47)]
MORT_NAMES = ["SEQN", "ELIGSTAT", "MORTSTAT", "UCOD", "PERMTH_INT", "PERMTH_EXM"]


def fetch(cache: Path) -> None:
    """원자료를 내려받는다. 이미 있으면 건너뛴다."""
    cache.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        dst = cache / f"{f}_{SUFFIX}.xpt"
        if not dst.exists():
            urllib.request.urlretrieve(f"{BASE}/{f}_{SUFFIX}.xpt", dst)
    if not (cache / "mort.dat").exists():
        urllib.request.urlretrieve(MORT, cache / "mort.dat")


def build(cache: Path) -> dict:
    """65세 이상 코호트를 만든다."""
    load = lambda f: pd.read_sas(cache / f"{f}_{SUFFIX}.xpt", format="xport")

    demo = load("DEMO")[["SEQN", "RIDAGEYR", "RIAGENDR"]]
    old = demo[demo.RIDAGEYR >= AGE_MIN].copy()

    rx = load("RXQ_RX")[["SEQN", "RXDDRUG"]].copy()
    rx["drug"] = rx.RXDDRUG.str.decode("utf-8", errors="ignore").str.strip().str.lower()
    rx = rx[rx.SEQN.isin(set(old.SEQN)) & rx.drug.notna() & (rx.drug != "")]
    drugs = rx.groupby("SEQN").drug.apply(lambda s: sorted(set(s))).to_dict()

    tables = {name: load(name) for name in {v[0] for v in CONDITION_MAP.values()}}
    conds: dict[float, list[str]] = {}
    for cid, (table, var, test) in CONDITION_MAP.items():
        t = tables[table]
        if var not in t.columns:
            continue
        for seqn, val in t[["SEQN", var]].dropna().itertuples(index=False):
            if test(val):
                conds.setdefault(seqn, []).append(cid)

    m = pd.read_fwf(cache / "mort.dat", colspecs=MORT_COLS, names=MORT_NAMES, dtype=str)
    for c in ["SEQN", "ELIGSTAT", "MORTSTAT", "PERMTH_EXM"]:
        m[c] = pd.to_numeric(m[c], errors="coerce")
    mort = m.set_index("SEQN")[["ELIGSTAT", "MORTSTAT", "PERMTH_EXM"]].to_dict("index")

    people = []
    for r in old.itertuples(index=False):
        d = drugs.get(r.SEQN, [])
        if not d:
            continue          # 처방이 없으면 두 축 모두 판정할 것이 없다
        mo = mort.get(r.SEQN, {})
        people.append({
            "id": int(r.SEQN),
            "age": int(r.RIDAGEYR),
            "drugs": d,
            "conditions": sorted(conds.get(r.SEQN, [])),
            "died": None if pd.isna(mo.get("MORTSTAT")) else int(mo["MORTSTAT"]),
            "followupMonths": None if pd.isna(mo.get("PERMTH_EXM")) else int(mo["PERMTH_EXM"]),
        })

    return {
        "source": "NHANES 2017-2018 + NCHS Public-Use Linked Mortality File (2019)",
        "ageMin": AGE_MIN,
        "mappedConditions": sorted(CONDITION_MAP),
        "unmappedConditions": UNMAPPED,
        "n": len(people),
        "people": people,
    }


def main() -> None:
    cache = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / ".nhanes_cache"
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "nhanes_cohort.json"
    fetch(cache)
    data = build(cache)
    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    n = data["n"]
    died = sum(1 for p in data["people"] if p["died"] == 1)
    print(f"{out.name}: {n}명 (65세 이상, 처방 보유)")
    print(f"  매핑된 조건 {len(data['mappedConditions'])}/18 · 미매핑 {len(data['unmappedConditions'])}개")
    print(f"  사망 {died}명 · 1인 평균 약물 {sum(len(p['drugs']) for p in data['people']) / n:.1f}종")


if __name__ == "__main__":
    main()
