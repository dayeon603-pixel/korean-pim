#!/usr/bin/env python3
"""Measured (not self-reported) clinical state for the NHANES ablation cohort.

Why: the ablation ascertains seven of its eight conditions by self-report, and the manuscript
states the consequence: self-report under-ascertains a condition, so the share of flagged people
who lack it is biased upward. Three of those conditions can instead be read from the examination
and the laboratory, which is what this file extracts so that the bias can be measured rather than
only signed.

  Hypertension      mean of up to three seated readings, systolic >= 140 or diastolic >= 90 mmHg
                    (BPX); plus self-reported current use of prescribed antihypertensive medicine
                    (BPQ050A), the standard NHANES definition for treated hypertension
  Diabetes          HbA1c >= 6.5% (GHB)
  Kidney disease    eGFR < 60 mL/min/1.73m2 by CKD-EPI 2021 (race-free) from serum creatinine
                    (BIOPRO), or urine albumin-to-creatinine ratio >= 30 mg/g (ALB_CR)
  CrCl < 30         Cockcroft-Gault creatinine clearance below 30 mL/min (BIOPRO, BMX weight).
                    The Korean criterion names "chronic kidney disease (CrCl < 30)", so this is the
                    condition as the criterion itself defines it.

Every value is kept as measured (null where not measured), so the definitions are applied in
analysis/measured_ablation.js and can be changed there without re-downloading.

Usage:
    python3 analysis/nhanes_measured.py 2017     # writes analysis/nhanes_measured_2017.json
    python3 analysis/nhanes_measured.py 2015     # writes analysis/nhanes_measured_2015.json
"""

from __future__ import annotations

import json
import logging
import math
import sys
import urllib.request
from pathlib import Path

import pandas as pd

log = logging.getLogger("nhanes_measured")

CYCLES = {"2017": "J", "2015": "I"}
FILES = ["DEMO", "BPX", "BPQ", "GHB", "BIOPRO", "ALB_CR", "BMX"]
AGE_MIN = 65


def fetch(cache: Path, cycle: str, suffix: str) -> None:
    """Downloads each public-use file once into the cache."""
    cache.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        dst = cache / f"{f}_{suffix}.xpt"
        if not dst.exists():
            url = f"https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{cycle}/DataFiles/{f}_{suffix}.xpt"
            log.info("download %s", url)
            urllib.request.urlretrieve(url, dst)


def ckd_epi_2021(scr: float, age: float, female: bool) -> float:
    """CKD-EPI 2021 creatinine equation without race (Inker et al., NEJM 2021)."""
    k, a = (0.7, -0.241) if female else (0.9, -0.302)
    return 142 * min(scr / k, 1) ** a * max(scr / k, 1) ** -1.200 * 0.9938 ** age * (1.012 if female else 1)


def cockcroft_gault(scr: float, age: float, weight: float, female: bool) -> float:
    """Cockcroft-Gault creatinine clearance in mL/min, actual body weight."""
    return (140 - age) * weight / (72 * scr) * (0.85 if female else 1)


def num(v: object) -> float | None:
    """A finite float or None."""
    try:
        f = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def build(cache: Path, suffix: str) -> dict[int, dict]:
    """Per SEQN (aged 65+): the measured values the three definitions need."""
    load = lambda f: pd.read_sas(cache / f"{f}_{suffix}.xpt", format="xport").set_index("SEQN")
    demo = load("DEMO")
    demo = demo[demo.RIDAGEYR >= AGE_MIN]
    bpx, bpq, ghb, bio, alb, bmx = (load(f) for f in ["BPX", "BPQ", "GHB", "BIOPRO", "ALB_CR", "BMX"])

    out: dict[int, dict] = {}
    for seqn, d in demo.iterrows():
        female = d.RIAGENDR == 2
        age = float(d.RIDAGEYR)
        sys_ = [num(bpx.at[seqn, c]) for c in ("BPXSY1", "BPXSY2", "BPXSY3")] if seqn in bpx.index else []
        dia = [num(bpx.at[seqn, c]) for c in ("BPXDI1", "BPXDI2", "BPXDI3")] if seqn in bpx.index else []
        sys_ = [v for v in sys_ if v]
        dia = [v for v in dia if v]  # a diastolic of 0 is a recording artefact in NHANES, dropped
        scr = num(bio.at[seqn, "LBXSCR"]) if seqn in bio.index else None
        wt = num(bmx.at[seqn, "BMXWT"]) if seqn in bmx.index else None
        out[int(seqn)] = {
            "female": bool(female),
            "sbp": sum(sys_) / len(sys_) if sys_ else None,
            "dbp": sum(dia) / len(dia) if dia else None,
            "bpMed": (num(bpq.at[seqn, "BPQ050A"]) == 1) if seqn in bpq.index and "BPQ050A" in bpq.columns else None,
            "hba1c": num(ghb.at[seqn, "LBXGH"]) if seqn in ghb.index else None,
            "scr": scr,
            "egfr": ckd_epi_2021(scr, age, female) if scr else None,
            "crcl": cockcroft_gault(scr, age, wt, female) if scr and wt else None,
            "acr": num(alb.at[seqn, "URDACT"]) if seqn in alb.index else None,
        }
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cycle = next((a for a in sys.argv[1:] if a in CYCLES), "2017")
    suffix = CYCLES[cycle]
    here = Path(__file__).parent
    cache = here / ".nhanes_cache"
    fetch(cache, cycle, suffix)
    data = build(cache, suffix)
    dst = here / f"nhanes_measured_{cycle}.json"
    dst.write_text(json.dumps({"cycle": cycle, "people": data}), encoding="utf-8")
    have = lambda k: sum(1 for v in data.values() if v[k] is not None)
    log.info("%s: %d people aged %d+; measured sbp %d, hba1c %d, egfr %d, crcl %d, acr %d",
             dst.name, len(data), AGE_MIN, have("sbp"), have("hba1c"), have("egfr"), have("crcl"), have("acr"))


if __name__ == "__main__":
    main()
