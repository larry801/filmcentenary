import type {ScenarioDef} from "./types";

/**
 * Scenario 1 — Campaign and Tutorial (`IE_playbook.pdf` p. 3).
 *
 * This is the setup the game shipped with, re-expressed on the shared
 * `ScenarioDef` shape so every scenario is described the same way.  The
 * quantities are unchanged: `scenarioData.test.ts` pins them and cross-checks
 * the module's saved game (`data/generated/campaign-setup.json`), exactly as the
 * older `setup.test.ts`/`data.test.ts` did.
 */
export const CAMPAIGN_SCENARIO: ScenarioDef = {
  id: "campaign",
  name: "Campaign 1850-1920",
  nameZh: "1850-1920 战役",
  firstTurn: 1,
  lastTurn: 7,
  wtt: 0,
  powers: {
    GE: {stability: 3, manpower: 2, industry: 1, territorialKeys: 5, colonialKeys: 0},
    UK: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 2, territorialKeys: 5, colonialKeys: 7},
    FR: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0, cityOfLight: 0},
    AU: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0},
    RU: {stability: 3, manpower: 5, industry: 0, territorialKeys: 12, colonialKeys: 0, tsrr: false},
    OT: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 0, territorialKeys: 8, colonialKeys: 0, arabKeys: 5},
  },
  units: [
    // Germany
    {owner: "GE", kind: "army", space: "berlin", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "berlin", steps: 1},
    {owner: "GE", kind: "army", space: "prussia", steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    // United Kingdom
    {owner: "UK", kind: "army", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "scotland", steps: 2},
    {owner: "UK", kind: "squadron", space: "malta", steps: 2},
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    {owner: "UK", kind: "expeditionary", space: "south-africa", steps: 1},
    // France
    {owner: "FR", kind: "army", space: "paris", steps: 2},
    {owner: "FR", kind: "eliteCorps", space: "paris", steps: 1},
    {owner: "FR", kind: "army", space: "alsace-lorraine", steps: 2},
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    {owner: "FR", kind: "army", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "brittany", steps: 2},
    {owner: "FR", kind: "zouave", space: "algeria", steps: 1},
    // Austria-Hungary
    {owner: "AU", kind: "army", space: "vienna", steps: 2},
    {owner: "AU", kind: "army", space: "lombardy", steps: 2},
    {owner: "AU", kind: "army", space: "hungary", steps: 2},
    {owner: "AU", kind: "army", space: "bohemia", steps: 2},
    // Russia
    {owner: "RU", kind: "army", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "squadron", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "army", space: "riga", steps: 2},
    {owner: "RU", kind: "army", space: "west-ukraine", steps: 1},
    {owner: "RU", kind: "army", space: "bessarabia", steps: 2},
    {owner: "RU", kind: "army", space: "georgia", steps: 1},
    {owner: "RU", kind: "squadron", space: "sevastopol", steps: 2},
    {owner: "RU", kind: "expeditionary", space: "dagestan", steps: 1},
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    // Ottoman
    {owner: "OT", kind: "army", space: "istanbul", steps: 2},
    {owner: "OT", kind: "army", space: "macedonia", steps: 2},
    {owner: "OT", kind: "army", space: "erzurum", steps: 1},
    {owner: "OT", kind: "army", space: "syria", steps: 1, special: "arab"},
    // Minor powers
    {owner: "Belgium", kind: "minorArmy", space: "belgium", steps: 2},
    {owner: "Netherlands", kind: "minorArmy", space: "netherlands", steps: 2},
    {owner: "Hanover", kind: "minorArmy", space: "hanover", steps: 1},
    {owner: "Saxony", kind: "minorArmy", space: "saxony", steps: 1},
    {owner: "Bavaria", kind: "minorArmy", space: "bavaria", steps: 2},
    {owner: "Denmark", kind: "minorArmy", space: "schleswig-holstein", steps: 2},
    {owner: "Denmark", kind: "squadron", space: "denmark", steps: 1},
    {owner: "Sardinia-Piedmont", kind: "minorArmy", space: "piedmont", steps: 2},
    {owner: "Two Sicilies", kind: "minorArmy", space: "naples", steps: 1},
    {owner: "Greece", kind: "minorArmy", space: "greece", steps: 1},
    {owner: "Persia", kind: "minorArmy", space: "qajar-persia", steps: 2},
    {owner: "Egypt", kind: "minorArmy", space: "egypt", steps: 2},
    {owner: "REBEL:Ethiopia", kind: "rebelArmy", space: "ethiopia", steps: 2},
  ],
  forts: [
    {space: "champagne", power: "FR", level: 1},
    {space: "lombardy", power: "AU", level: 1},
    {space: "st-petersburg", power: "RU", level: 1},
    {space: "sevastopol", power: "RU", level: 1},
  ],
  diplomacy: [
    {power: "UK", space: "belgium"},
    {power: "FR", space: "piedmont"},
    {power: "RU", space: "romania"},
  ],
  influence: [{power: "FR", space: "west-africa"}],
  pacification: [
    {space: "algeria", value: 0},
    {space: "dagestan", value: 1},
  ],
  controlOverrides: [
    {space: "egypt", control: "Egypt"},
    {space: "sinai", control: "Egypt"},
    {space: "great-sand-sea", control: "Egypt"},
  ],
  powerProjection: {GE: 0, UK: 8, FR: 2, AU: 0, RU: 3, OT: 0},
  removedCards: [],
  buildBox: ["Tuscany", "Serbia", "Bosnia", "Bulgaria", "Romania"],
  // Egypt's independence is expressed the campaign's way: the three spaces are
  // controlled by the minor power "Egypt" in `controlOverrides`.  The IMP marker
  // is how the 1870/1880/GW setups print it, so the campaign adds none.
  italy: {unified: false},
  special: {
    countVp: true,
    // 2.4 / 20.11: draw NGs at the end of turns 1, 3 and 5.
    ngDrawTurns: [1, 3, 5],
    // Rule 20.11's Play Note: the campaign starts with no National Goals.
    startingGoalDraw: undefined,
    bloodAndIron: true,
    allowsNoGw: true,
  },
  notes: [
    "Campaign length: 7 turns (1850s-1910s).",
    "All players start in the neutral box of the Alliance Track.",
    "AU: Metternich's Legacy triggers at the end of the turn 1 diplomacy phase.",
    "UK India Stability marker starts on its stable side.",
    "FR starts as the Second Empire with 0 City of Light points.",
    "OT: 3 Turkish manpower / 1 Arab manpower; British manpower 3 / colonial manpower 1.",
    "Minor powers in the End Phase Build Box at the start: Tuscany, Serbia, Bosnia, Bulgaria, Romania.",
  ],
};
