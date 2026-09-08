# analysis — running the engine on real records

## The data is not in this repository

The MIMIC-IV Clinical Database Demo has to be downloaded from PhysioNet directly. It is not
redistributed here.

```bash
mkdir -p mimic/hosp && cd mimic/hosp
for f in prescriptions diagnoses_icd patients admissions; do
  curl -O "https://physionet.org/files/mimic-iv-demo/2.2/hosp/$f.csv.gz"
done
```

- This is the open release, reachable without a credentialing review (ODC-BY 1.0). 100 patients.
- Citation: Johnson A, Bulgarelli L, Pollard T, Horng S, Celi LA, Mark R.
  MIMIC-IV Clinical Database Demo (version 2.2). PhysioNet. 2023.

## Running it

```bash
node analysis/mimic_demo.js ./mimic/hosp
```

## What this analysis is, and what it is not

**It is** a demonstration that the 2018 Korean PIM adjudication engine runs on real clinical
records. The input is real patients' prescription and diagnosis codes, not synthetic data.

**It is not** an estimate of PIM exposure among older adults in Korea. MIMIC holds US intensive
care admissions and the demo edition covers 100 people. The prescribing pattern differs from
Korean outpatient polypharmacy.

## Known limits

| Item | Detail |
|---|---|
| Scale | 44 patients aged 65 and over. A demonstration, not a statistical estimate |
| Care setting | US intensive care admissions. Prescribing differs from Korean outpatient care |
| Drug mapping | Based on string normalisation. It does not go through RxNorm or any standard code |
| Condition mapping | The ICD ranges in `icd_map.js` are an operational definition made here. They are not in the source article |
| Clinical review | Neither mapping has been reviewed by a pharmacist or clinician |

Narrowing these limits would take (1) the full MIMIC-IV release, which requires a credentialing
review, (2) the HIRA patient sample dataset, (3) an RxNorm mapping, and (4) clinical review of the
ICD ranges.
