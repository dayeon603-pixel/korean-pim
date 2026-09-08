#!/usr/bin/env python3
"""Converts the NHANES 2017-2018 files into input for the adjudication engine.

Why NHANES: the largest limitation of this study is that the two axes were compared on a synthetic
cohort. NHANES is released without a credentialing review, and it links prescriptions, comorbidity
and mortality at the level of one person (SEQN), so the same comparison can be run again on real
people.

Limits, which must be reported alongside any result
  1. US data. It is not a Korean prescribing distribution.
  2. Prescriptions are self-reported use over the past 30 days, not claims.
  3. Only 9 of the 18 Table 2 conditions can be ascertained from NHANES questions, so the volume
     the condition axis flags is a lower bound rather than an estimate.
  4. 34 of the 63 Table 1 items appear in NHANES. Most of the rest are either not marketed in the
     United States or available without a prescription.
  5. Mortality follow-up is short, a median of about two years.

Usage:
    python3 analysis/nhanes_prepare.py [output path]
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

# The cycle is taken as an argument, so the same rules can be run again on an independent sample to
# see whether the result replicates.
CYCLES = {
    "2017": ("J", "2017-2018", "NHANES_2017_2018_MORT_2019_PUBLIC.dat"),
    "2015": ("I", "2015-2016", "NHANES_2015_2016_MORT_2019_PUBLIC.dat"),
    "2013": ("H", "2013-2014", "NHANES_2013_2014_MORT_2019_PUBLIC.dat"),
}
CYCLE = next((a for a in sys.argv[1:] if a in CYCLES), "2017")
SUFFIX, CYCLE_LABEL, MORT_FILE = CYCLES[CYCLE]
BASE = f"https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{CYCLE}/DataFiles"
MORT = ("https://ftp.cdc.gov/pub/HEALTH_STATISTICS/NCHS/datalinkage/"
        f"linked_mortality/{MORT_FILE}")
FILES = ["DEMO", "RXQ_RX", "MCQ", "DIQ", "BPQ", "KIQ_U", "SLQ", "BIOPRO"]

AGE_MIN = 65

# NHANES question -> Table 2 condition id. Only what can actually be ascertained goes in; a
# condition with no question behind it is not forced into existence.
# The survey codes are 1=yes, 2=no, 7=refused, 9=don't know.
CONDITION_MAP = {
    "hf":               ("MCQ", "MCQ160B", lambda v: v == 1),      # congestive heart failure
    "stroke_secondary": ("MCQ", "MCQ160F", lambda v: v == 1),      # stroke
    "copd":             ("MCQ", "MCQ160O", lambda v: v == 1),      # chronic obstructive pulmonary disease
    "dm":               ("DIQ", "DIQ010", lambda v: v == 1),       # diabetes
    "htn":              ("BPQ", "BPQ020", lambda v: v == 1),       # hypertension
    "ckd":              ("KIQ_U", "KIQ022", lambda v: v == 1),     # impaired kidney function
    "insomnia":         ("SLQ", "SLQ050", lambda v: v == 1),       # told a doctor about trouble sleeping
    "hyponatremia":     ("BIOPRO", "LBXSNASI", lambda v: v < 135), # serum sodium below 135 mmol/L
}
# Conditions left unmapped. Either NHANES carries no such question, or it carries one that cannot
# establish the part of the condition that matters. age80_primary is excluded because age (80 and
# over) is ascertainable but the intent, taking it for primary prevention, is not.
# Forcing a mapping would over-fire the condition axis and tilt the conclusion in our own favour.
UNMAPPED = ["dementia", "falls", "parkinson", "arrhythmia", "ulcer",
            "constipation", "bph", "bleeding", "glaucoma", "age80_primary"]

# Fixed-width layout of the public mortality linkage file (46 characters)
MORT_COLS = [(0, 6), (14, 15), (15, 16), (16, 19), (41, 44), (44, 47)]
MORT_NAMES = ["SEQN", "ELIGSTAT", "MORTSTAT", "UCOD", "PERMTH_INT", "PERMTH_EXM"]


def fetch(cache: Path) -> None:
    """Downloads the raw files, skipping any already present."""
    cache.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        dst = cache / f"{f}_{SUFFIX}.xpt"
        if not dst.exists():
            urllib.request.urlretrieve(f"{BASE}/{f}_{SUFFIX}.xpt", dst)
    if not (cache / f"mort_{SUFFIX}.dat").exists():
        urllib.request.urlretrieve(MORT, cache / f"mort_{SUFFIX}.dat")


def build(cache: Path) -> dict:
    """Builds the cohort aged 65 and over."""
    load = lambda f: pd.read_sas(cache / f"{f}_{SUFFIX}.xpt", format="xport")

    demo = load("DEMO")[["SEQN", "RIDAGEYR", "RIAGENDR", "WTMEC2YR", "SDMVSTRA", "SDMVPSU"]]
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

    m = pd.read_fwf(cache / f"mort_{SUFFIX}.dat", colspecs=MORT_COLS, names=MORT_NAMES, dtype=str)
    for c in ["SEQN", "ELIGSTAT", "MORTSTAT", "PERMTH_EXM"]:
        m[c] = pd.to_numeric(m[c], errors="coerce")
    mort = m.set_index("SEQN")[["ELIGSTAT", "MORTSTAT", "PERMTH_EXM"]].to_dict("index")

    people = []
    for r in old.itertuples(index=False):
        d = drugs.get(r.SEQN, [])
        if not d:
            continue          # with no prescription there is nothing for either axis to judge
        mo = mort.get(r.SEQN, {})
        people.append({
            "id": int(r.SEQN),
            "age": int(r.RIDAGEYR),
            "drugs": d,
            "conditions": sorted(conds.get(r.SEQN, [])),
            "died": None if pd.isna(mo.get("MORTSTAT")) else int(mo["MORTSTAT"]),
            "followupMonths": None if pd.isna(mo.get("PERMTH_EXM")) else int(mo["PERMTH_EXM"]),
            # NHANES is a stratified multistage probability sample. Carrying the design variables
            # through allows a design-based interval that resamples PSUs within strata, rather than
            # resampling individuals.
            "stratum": None if pd.isna(r.SDMVSTRA) else int(r.SDMVSTRA),
            "psu": None if pd.isna(r.SDMVPSU) else int(r.SDMVPSU),
            "weight": None if pd.isna(r.WTMEC2YR) else float(r.WTMEC2YR),
        })

    return {
        "source": f"NHANES {CYCLE_LABEL} + NCHS Public-Use Linked Mortality File (2019)",
        "cycle": CYCLE_LABEL,
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
    print(f"{out.name}: {n} people (aged 65+, holding a prescription)")
    print(f"  conditions mapped {len(data['mappedConditions'])}/18 · unmapped {len(data['unmappedConditions'])}")
    print(f"  deaths {died} · mean drugs per person {sum(len(p['drugs']) for p in data['people']) / n:.1f}")


if __name__ == "__main__":
    main()
