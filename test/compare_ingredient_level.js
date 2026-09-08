/* Ingredient-level comparison — node test/compare_ingredient_level.js
 *
 * Checks whether the 63 ingredients of Kim 2018 Table 1 actually reached the candidate list, by
 * searching for each ingredient name directly in the text of Appendix 1 of the 2022 HIRA report
 * (a list of 297 candidate ingredients).
 *
 * Why a direct search: the appendix is a two-column table, and column parsing truncates ingredient
 * names. The first attempt wrongly reported Doxepin, Digoxin, Insulin and Aspirin as absent; they
 * are present as "Doxepin >6 mg/day", "Digoxin for first-line treatment of..." and so on. Parsing
 * was replaced by a direct search of the source text.
 *
 * Limit: Appendix 1 is the list of 297 candidates. The report does not publish the names of the 77
 * ingredients finally adopted, so this can establish only whether an ingredient reached the
 * candidate list, never whether it survived into the final one.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const pim = require('../src/index.js');

const RAW = fs.readFileSync(path.join(__dirname, '../data/hira2022_appendix1_raw.txt'), 'utf8').toLowerCase();

// Name variants, so an ingredient is still found when the source uses a different spelling.
const ALIAS = {
  glibenclamide: ['glyburide'],
  pethidine: ['meperidine'],
  mefenamic: ['mefenamic acid'],
  insulin_sliding: ['insulin'],
  estrogen: ['estrogen', 'estrogens'],
  somatropin: ['growth hormone', 'somatropin'],
  clidinium: ['clidinium'],
  chlorpheniramine: ['chlorpheniramine', 'chlorphenamine'],
};

function inAppendix(ing) {
  const keys = [ing.replace(/_/g, ' '), ...(ALIAS[ing] || [])];
  return keys.some((k) => RAW.includes(k.toLowerCase()));
}

const found = [], missing = [];
pim.table1.forEach((x) => (inAppendix(x.ingredient) ? found : missing).push(x));

/** Prints the report. Must not run when another script imports the figures only. */
function report() {
  console.log('Ingredient-level comparison — Kim 2018 Table 1 (63) vs the 2022 HIRA candidate list (Appendix 1, 297)\n');
  console.log(`present in the candidate list   ${found.length}/63 (${(found.length / 63 * 100).toFixed(1)}%)`);
  console.log(`absent from it                  ${missing.length}/63 (${(missing.length / 63 * 100).toFixed(1)}%)\n`);
  if (missing.length) {
    console.log('Kim 2018 Table 1 drugs that were never considered as candidates for the national standard:');
    missing.forEach((x) => console.log(`  ${x.nameKo.padEnd(12)} ${x.drug}  [${x.classKo}]`));
  }
  console.log('\nNote: Appendix 1 lists the 297 candidates. The report does not publish the names of the 77');
  console.log('      finally adopted, so only candidacy can be established, never final adoption.');
  console.log('Note: the 18 condition rules of Table 2 have no counterpart at all, because the candidate');
  console.log('      list is itself organised by drug.');
}

if (require.main === module) report();


module.exports = { found: found.length, missing: missing.map((x) => x.drug) };
