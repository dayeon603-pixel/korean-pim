/**
 * Registry of potentially inappropriate medication criteria, for comparing whether each carries a
 * condition-dependent axis.
 *
 * Purpose: to compare, in one place, whether each criteria set has an axis that requires the
 *   patient's state, and how large it is. The question behind it is whether that axis survives into
 *   national operating standards.
 *
 * Rule: record a number only where it was verified. Anything unverified stays null with a reason.
 *   Where the full text sits behind copyright or a paywall, only the total is recorded and the
 *   condition count is left unverified.
 *   Estimates are not entered, because one would cost the whole table its credibility.
 */
'use strict';
const pim = require('./index.js');
const beers = require('./beers2023.js');
const hira = require('./hira2022.js');

const CRITERIA = [
  {
    id: 'kim2018', region: 'Korea', kind: 'academic consensus',
    name: 'Korean list of potentially inappropriate medications (Kim et al., 2018)',
    source: 'Ann Geriatr Med Res 2018;22(3):121-129. DOI 10.4235/agmr.2018.22.3.121',
    drugOnlyItems: pim.coverage.table1,          // Table 1
    conditionCount: pim.coverage.table2Conditions, // Table 2
    conditionAxis: true,
    implemented: 'full',                          // implemented in full in this repository
    note: '63 Table 1 items and 18 Table 2 conditions. Open access, so all of it could be structured.',
  },
  {
    id: 'beers2023', region: 'USA', kind: 'academic consensus',
    name: 'AGS Beers Criteria 2023',
    source: 'J Am Geriatr Soc 2023;71(7):2052-2081. DOI 10.1111/jgs.18372',
    drugOnlyItems: null,                          // Table 2; outside this study's scope and not counted
    conditionCount: beers.conditionCount,         // Table 3
    conditionAxis: true,
    implemented: 'table3-only',
    note: 'Only the 9 conditions of Table 3 (drug-disease and drug-syndrome) were structured, for '
        + 'comparison. The full text is not reproduced; it is an AGS copyrighted work.',
  },
  {
    id: 'stopp3', region: 'Europe', kind: 'academic consensus',
    name: 'STOPP/START version 3 (2023)',
    source: 'Eur Geriatr Med 2023. DOI 10.1007/s41999-023-00777-y',
    drugOnlyItems: null,
    conditionCount: null,                         // unverified
    conditionAxis: true,                          // structurally condition-stated, but the count is unverified
    implemented: 'none',
    totalCriteria: 133,                           // total STOPP criteria, verified
    note: 'The 133 STOPP criteria are organised by physiological system and stated together with '
        + 'their clinical context. Access to the full list is restricted, so the number of '
        + 'condition-conditioned items could not be counted. It is left unverified.',
  },
  {
    id: 'hira2022', region: 'Korea', kind: 'national operating standard',
    name: 'HIRA draft standard for inappropriate polypharmacy in older adults (2022)',
    source: '건강보험심사평가원 G000F8Q-2022-170',
    drugOnlyItems: hira.totalIngredients,         // 77 ingredients
    conditionCount: 0,
    conditionAxis: false,
    implemented: 'class-level',
    note: '77 ingredients in 14 classes, settled from 297 candidates. No condition-conditioned '
        + 'rules. The final 77 ingredient names are unpublished, so this is implemented at class '
        + 'level only.',
  },
];

/** Criteria sets with a condition axis, and those without. */
function split() {
  return {
    withAxis: CRITERIA.filter((c) => c.conditionAxis),
    withoutAxis: CRITERIA.filter((c) => !c.conditionAxis),
    counted: CRITERIA.filter((c) => c.conditionCount !== null),
    uncounted: CRITERIA.filter((c) => c.conditionCount === null),
  };
}

module.exports = { CRITERIA, split };
