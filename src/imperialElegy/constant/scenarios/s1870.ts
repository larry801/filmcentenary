import type {ScenarioDef} from "./types";

/**
 * Scenario 2 — 1870 (`IE_playbook.pdf` p. 4, "Scenario Length: 4 turns,
 * Turn 3 (1870s) - Turn 6 (1900s)").
 *
 * Every quantity below is transcribed from the printed display, in the printed
 * order.  `units` has one entry per printed unit (`"1 army"` = two steps,
 * `"1 reduced army"` = one), reserve armies use `space: null`, and the minor
 * powers' own armies keep their printed names as `owner` (rules 12.5.3).
 *
 * Two printed items do not fit `ScenarioDef` yet and are kept in `notes`:
 * the printed "Ally markers" (GE: Bavaria, Saxony; RU: Romania) — a field the
 * type does not have — and Egypt's IMP markers on Great Sand Sea and Sinai
 * (`independentMinors` is a flat list of minor names, so it only records
 * "Egypt").
 */
export const S1870_SCENARIO: ScenarioDef = {
  id: "s1870",
  name: "1870 Scenario",
  nameZh: "1870 剧本",
  firstTurn: 3,
  lastTurn: 6,
  wtt: 1,
  powers: {
    // GE: Stability 4, Industry 3, Manpower 3, Territorial 7, Colonial 0.
    // "Alliance Track: all players start in the neutral space" — the Triple
    // Alliance / Triple Entente placement is printed only inside the optional
    // Franco-Prussian-War branch, so the main setup starts every chit neutral.
    GE: {
      stability: 4,
      manpower: 3,
      industry: 3,
      territorialKeys: 7,
      colonialKeys: 0,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // UK: Stability 4, Industry 4, Manpower British 3 / Colonial 2,
    // Territorial 5, Colonial 9.  India's Stability marker is on its stable
    // side (the `createEmptyPowerState` default).
    UK: {
      stability: 4,
      manpower: 3,
      secondaryManpower: 2,
      industry: 4,
      territorialKeys: 5,
      colonialKeys: 9,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // FR: Stability 3, Industry 3, Manpower 4, Territorial 9, Colonial 1,
    // City of Light 1.  The 1870 setup is before the Franco-Prussian War, so
    // France is still the Second Empire (33.3).
    FR: {
      stability: 3,
      manpower: 4,
      industry: 3,
      territorialKeys: 9,
      colonialKeys: 1,
      cityOfLight: 1,
      government: "secondEmpire",
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // AU: Stability 3, Industry 2, Manpower 3, Citizenship Hungarians,
    // Territorial 8.
    AU: {
      stability: 3,
      manpower: 3,
      industry: 2,
      territorialKeys: 8,
      citizenship: ["Hungarians"],
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // RU: Stability 4, Industry 1 (industry autocomplete marker), Manpower 5,
    // Territorial 13; Trans-Siberian RR incomplete.
    RU: {
      stability: 4,
      manpower: 5,
      industry: 1,
      autoIndustry: true,
      territorialKeys: 13,
      colonialKeys: 0,
      tsrr: false,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // OT: Stability 3, Industry 1, Manpower Turkish 3 / Arab 1, Arab Keys 5,
    // Territorial 7.
    OT: {
      stability: 3,
      manpower: 3,
      secondaryManpower: 1,
      industry: 1,
      territorialKeys: 7,
      colonialKeys: 0,
      arabKeys: 5,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
  },
  units: [
    // ------------------------------------------------------------------ Germany
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    {owner: "GE", kind: "army", space: "berlin", steps: 2},
    // "Reserve Armies: 3"
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    // ------------------------------------------------------------------- Britain
    {owner: "UK", kind: "army", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "london", steps: 2},
    {owner: "UK", kind: "squadron", space: "scotland", steps: 2},
    {owner: "UK", kind: "squadron", space: "malta", steps: 2},
    // "India: 1 Indian Army, Level 1 Indian Fort"
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    {owner: "UK", kind: "squadron", space: "singapore", steps: 2},
    {owner: "UK", kind: "expeditionary", space: "south-africa", steps: 1},
    // "Balochistan: influence marker, 1 EF, Pac 1"
    {owner: "UK", kind: "expeditionary", space: "balochistan", steps: 1},
    // -------------------------------------------------------------------- France
    {owner: "FR", kind: "army", space: "paris", steps: 2},
    {owner: "FR", kind: "army", space: "alsace-lorraine", steps: 2},
    {owner: "FR", kind: "eliteCorps", space: "alsace-lorraine", steps: 1},
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    {owner: "FR", kind: "army", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "brittany", steps: 2},
    {owner: "FR", kind: "zouave", space: "algeria", steps: 1},
    // "West Africa: influence marker, 1 EF, Pac 0"
    {owner: "FR", kind: "expeditionary", space: "west-africa", steps: 1},
    // "Reserve Armies: 1"
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},
    // -------------------------------------------------------------- Austria-Hungary
    {owner: "AU", kind: "army", space: "vienna", steps: 2},
    {owner: "AU", kind: "army", space: "hungary", steps: 2},
    {owner: "AU", kind: "army", space: "bohemia", steps: 2},
    // "Croatia: 1 squadron" (full, not reduced)
    {owner: "AU", kind: "squadron", space: "croatia", steps: 2},
    // "Reserve Armies: 2"
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},
    // -------------------------------------------------------------------- Russia
    {owner: "RU", kind: "army", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "squadron", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "army", space: "riga", steps: 2},
    // "West Ukraine: 1 reduced army"
    {owner: "RU", kind: "army", space: "west-ukraine", steps: 1},
    {owner: "RU", kind: "army", space: "bessarabia", steps: 2},
    // "Georgia: 1 reduced army"
    {owner: "RU", kind: "army", space: "georgia", steps: 1},
    {owner: "RU", kind: "squadron", space: "sevastopol", steps: 2},
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    // "Central Asia: Influence marker, 1 EF, 0 Pac"
    {owner: "RU", kind: "expeditionary", space: "central-asia", steps: 1},
    // "Reserve Armies: 2"
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    // ------------------------------------------------------------------- Ottoman
    // "1 Turkish army"
    {owner: "OT", kind: "army", space: "istanbul", steps: 2},
    {owner: "OT", kind: "army", space: "macedonia", steps: 2},
    // "1 reduced Turkish army"
    {owner: "OT", kind: "army", space: "erzurum", steps: 1},
    // "Syria: 1 reduced Arab army"
    {owner: "OT", kind: "army", space: "syria", steps: 1, special: "arab"},
    // "Reserve Armies: 1 Turkish"
    {owner: "OT", kind: "reserveArmy", space: null, steps: 2},
    // --------------------------------------------------------------- Italy (unified)
    // "Italy Status: Unified" — the units below are the Kingdom of Italy's.
    {owner: "IT", kind: "italianArmy", space: "lombardy", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "piedmont", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "tuscany", steps: 2},
    {owner: "IT", kind: "squadron", space: "naples", steps: 2},
    // ------------------------------------------------------------- Minor powers
    {owner: "Belgium", kind: "minorArmy", space: "belgium", steps: 2},
    {owner: "Netherlands", kind: "minorArmy", space: "netherlands", steps: 2},
    // "Saxony: 1 reduced army"
    {owner: "Saxony", kind: "minorArmy", space: "saxony", steps: 1},
    {owner: "Bavaria", kind: "minorArmy", space: "bavaria", steps: 2},
    {owner: "Denmark", kind: "minorArmy", space: "denmark", steps: 2},
    {owner: "Greece", kind: "minorArmy", space: "greece", steps: 2},
    {owner: "Persia", kind: "minorArmy", space: "qajar-persia", steps: 2},
    {owner: "Romania", kind: "minorArmy", space: "romania", steps: 2},
    // "Ethiopia: 1 army (these count as Rebels, see 21.0)"
    {owner: "REBEL:Ethiopia", kind: "rebelArmy", space: "ethiopia", steps: 2},
    // "Egypt: 1 army, IMP marker"
    {owner: "Egypt", kind: "minorArmy", space: "egypt", steps: 2},
  ],
  forts: [
    // "Paris: 1 army, level 1 fort"
    {space: "paris", power: "FR", level: 1},
    // "India: 1 Indian Army, Level 1 Indian Fort" (33.2.3: never degrades)
    {space: "india", power: "UK", level: 1, indian: true},
    // "St. Petersburg: 1 army, 1 naval squadron, level 1 fort"
    {space: "st-petersburg", power: "RU", level: 1},
    // "Sevastopol: 1 naval squadron, level 1 fort"
    {space: "sevastopol", power: "RU", level: 1},
  ],
  diplomacy: [
    // "Belgium: Diplomacy marker"
    {power: "UK", space: "belgium"},
  ],
  influence: [
    // "Influence marker: Nigeria and Afghanistan"
    {power: "UK", space: "nigeria"},
    {power: "UK", space: "afghanistan"},
    // "Balochistan: influence marker, 1 EF, Pac 1"
    {power: "UK", space: "balochistan"},
    // "West Africa: influence marker, 1 EF, Pac 0"
    {power: "FR", space: "west-africa"},
    // "Central Asia: Influence marker, 1 EF, 0 Pac"
    {power: "RU", space: "central-asia"},
  ],
  pacification: [
    // "Balochistan: influence marker, 1 EF, Pac 1"
    {space: "balochistan", value: 1},
    // "Algeria: Zouaves EF, Pac 2"
    {space: "algeria", value: 2},
    // "West Africa: influence marker, 1 EF, Pac 0" — printed 0, not "unset".
    {space: "west-africa", value: 0},
    // "Central Asia: Influence marker, 1 EF, 0 Pac"
    {space: "central-asia", value: 0},
  ],
  // "Ally markers: Bavaria, Saxony" (GE) and "Romania: Ally marker" (RU).
  allyMarkers: [
    {power: "GE", minor: "Bavaria", space: "bavaria"},
    {power: "GE", minor: "Saxony", space: "saxony"},
    {power: "RU", minor: "Romania", space: "romania"},
  ],
  controlOverrides: [
    // GE "Control markers: Schleswig-Holstein, Hanover" (both print as Danish
    // and Hanoverian map defaults).
    {space: "schleswig-holstein", control: "GE"},
    {space: "hanover", control: "GE"},
    // UK "Control markers: Shanghai, Guangzhou".
    {space: "shanghai", control: "UK"},
    {space: "guangzhou", control: "UK"},
    // FR "Control markers: Indochina".
    {space: "indochina", control: "FR"},
    // RU "Control marker: Manchuria".
    {space: "manchuria", control: "RU"},
    // "Mexico: US control marker".
    {space: "mexico", control: "United States"},
  ],
  // The print lists no Power Projection for this scenario.
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [
    "Suez Canal",
    "American Civil War",
    "Sepoy Mutiny",
    "Second Opium War",
    "Folie de Grandeur",
    "The Dual Monarchy",
    "Reforms of the 1860s",
    "Ironclads",
  ],
  // "End Phase Build Box: Bulgaria, Serbia, and Bosnia"
  buildBox: ["Bulgaria", "Serbia", "Bosnia"],
  suezComplete: true,
  italy: {unified: true},
  // "Egypt: 1 army, IMP marker" (also printed on Great Sand Sea and Sinai).
  // The 1870 setup prints the IMP markers but hands no control marker to Egypt,
  // so the spaces keep their map-default control and only carry the marker.
  independentMinors: ["Egypt"],
  independentMinorMarkers: [
    {minor: "Egypt", space: "egypt"},
    {minor: "Egypt", space: "great-sand-sea"},
    {minor: "Egypt", space: "sinai"},
  ],
  // "AU: the AU player adds the 'Precarious Position' NG to their NG deck, and
  // they may remove either 'Contain Italy' or 'Contain Prussia' from their NG
  // deck."
  goalDeck: [{power: "AU", add: "NG-31", removeOneOf: ["NG-29", "NG-30"]}],
  special: {
    countVp: true,
    // "Additional NGs are drawn during the End Phase of turns 3 and 5."
    ngDrawTurns: [3, 5],
    // "players draw 3 NGs and pick one. Exception: See GE below." — GE draws 2.
    startingGoalDraw: {GE: 2, UK: 3, FR: 3, AU: 3, RU: 3, OT: 3},
    // The same reduced GE draw applies in the end phase ("The GE player only
    // draws 2 NGs at the start of this scenario and during the end phase of
    // turns 3 and 5" / "4 and 6").
    ngDrawCount: {GE: 2},
    bloodAndIron: false,
    // "The Franco-Prussian War: Prior to the Prep Phase of turn 3, the FR player
    // may decide to concede defeat and skip the Franco-Prussian War."
    francoPrussianWar: true,
    allowsNoGw: true,
  },
  notes: [
    "Scenario length: 4 turns (turn 3, 1870s - turn 6, 1900s).",
    "WTT starts at 1. Suez Canal Status: Complete.",
    "Alliance Track (main setup): all players start in the neutral space, so every power's `alliance` is neutral. The Franco-Prussian-War branch places GE in the Triple Alliance (uncommitted) box and FR in the committed Triple Entente box; that state is applied by `engine/scenarioSetup.ts#applyFrancoPrussianConcession`, not by the scenario data, because FR decides it after setup.",
    "Italy Status: Unified (Lombardy, Piedmont, Tuscany and Naples carry Italian units). The display prints no control markers for those spaces, so no controlOverrides are recorded for them.",
    "TODO(ally markers): GE — Bavaria, Saxony; RU — Romania. The printed 'Ally marker' entries have no field on ScenarioDef; only the printed control markers are in controlOverrides.",
    "Egypt is an independent minor power (IMP marker): `independentMinors: [\"Egypt\"]`; the print also places the IMP marker on Great Sand Sea and Sinai, which the flat independentMinors list cannot name separately.",
    "IMP markers on the map: Egypt, Great Sand Sea, Sinai.",
    "The 1870 display prints IMP markers but no control markers for Egypt, Sinai or Great Sand Sea, so their control is left at the map default (OT) rather than overridden to Egypt the way the campaign setup does.",
    "Mexico is under United States control (printed 'Mexico: US control marker').",
    "NGs: prior to the Prep Phase of turn 3 every player draws 3 NGs and keeps 1; GE draws only 2 and keeps 1 (startingGoalDraw).",
    "GE also draws only 2 NGs during the end phase of turns 3 and 5 (special.ngDrawCount).",
    "AU National Goal deck: add 'Precarious Position'; may remove either 'Contain Italy' or 'Contain Prussia'.",
    "Franco-Prussian War (optional, decided before the turn 3 Prep Phase; FR concedes and skips the war):",
    "  1. GE: gains control of Alsace-Lorraine, Bavaria and Saxony; eliminate the Saxon and Bavarian armies and both GE ECs; 1 GE standing army takes a step loss; GE territorial keys 10; GE gains a +1 card marker and a 2-turn FR truce marker.",
    "  2. FR: displace any units in Alsace-Lorraine; eliminate 2 FR standing armies and 1 EC; FR territorial keys 8; FR gains a -1 card marker and a 2-turn GE truce marker.",
    "  3. Alliance Track: GE in the Triple Alliance (uncommitted) box, FR in the committed box of the Triple Entente; all other markers stay neutral.",
    "  4. Turn Track: a -1 card marker with an FR control marker on turn 4.",
    "  5. Cards: on the first turn GE selects no home card and FR receives one less card.",
    "  6. Turn Sequence: skip GE's first impulse (they are assumed to have fought the war).",
    "The Franco-Prussian-War branch's truces (GE/FR, 2 turns) and card markers (GE +1, FR -1) are printed only inside that branch, so `truces` and `cardMarkers` are unset here.",
    "Power Projection is not printed in this scenario; the engine recomputes it from the board at the first end phase.",
    "UK India Stability marker starts on its stable side. UK Reserve Armies: N/A.",
    "Minor powers in the End Phase Build Box at the start: Bulgaria, Serbia, Bosnia.",
  ],
};
