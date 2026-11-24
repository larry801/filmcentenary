import type {ScenarioDef} from "./types";

/**
 * Scenario 3 — 1880 (`IE_playbook.pdf` pp. 5-6, "Scenario Length: 4 turns,
 * Turn 4 (1880s) - Turn 7 (1910s)").
 *
 * Transcribed from the printed display in printed order.  Germany is already
 * unified (its design note: "they have already unified Germany thus completing
 * their 4 VP NG"), so `powers.GE.unified` is true and the German minors carry
 * GE control markers instead of separate minor armies.  Italy is the unified
 * Kingdom of Italy with its own units.
 *
 * Printed items that `ScenarioDef` cannot hold yet are kept in `notes`: the RU
 * "Ally markers: Romania, Serbia, Bulgaria" (no field exists) and the IMP
 * markers on Bulgaria and Serbia / the US control of Mexico.
 */
export const S1880_SCENARIO: ScenarioDef = {
  id: "s1880",
  name: "1880 Scenario",
  nameZh: "1880 剧本",
  firstTurn: 4,
  lastTurn: 7,
  wtt: 1,
  powers: {
    // GE: Stability 4, Industry 4, Manpower 5, Territorial 10, Colonial 0.
    // "1 turn FR Truce"; already unified Germany.
    GE: {
      stability: 4,
      manpower: 5,
      industry: 4,
      territorialKeys: 10,
      colonialKeys: 0,
      unified: true,
      alliance: "taCommitted",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // UK: Stability 4, Industry 4, Manpower British 3 / Colonial 2,
    // Territorial 5, Colonial 11.  India's Stability marker is on its stable
    // side (the `createEmptyPowerState` default).
    UK: {
      stability: 4,
      manpower: 3,
      secondaryManpower: 2,
      industry: 4,
      territorialKeys: 5,
      colonialKeys: 11,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // FR: Stability 3, Industry 3, Manpower 3, Territorial 8, Colonial 2,
    // City of Light 1.  "1 turn GE Truce" (the same GE/FR truce as GE's).
    FR: {
      stability: 3,
      manpower: 3,
      industry: 3,
      territorialKeys: 8,
      colonialKeys: 2,
      cityOfLight: 1,
      // The 1880 display does not name the government, but the scenario is
      // ten years past the Franco-Prussian War and its printed removed-card
      // list ("Paris Commune", "Reforms of the 1860s") treats those events as
      // already past, so France is the Third Republic (33.3) here.  The
      // alternative (Second Empire) would grant the printed +1 GW budget that
      // 33.3 gives the empire alone.
      government: "thirdRepublic",
      alliance: "teCommitted",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // AU: Stability 3, Industry 3, Manpower 3, Citizenship Hungarians,
    // Territorial 8.  Reserve Armies: 3.
    AU: {
      stability: 3,
      manpower: 3,
      industry: 3,
      territorialKeys: 8,
      citizenship: ["Hungarians"],
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // RU: Stability 4, Industry 2, Manpower 5, Territorial 13; Trans-Siberian
    // RR incomplete; "1 turn OT Truce"; "+1 card marker".
    RU: {
      stability: 4,
      manpower: 5,
      industry: 2,
      territorialKeys: 13,
      colonialKeys: 0,
      tsrr: false,
      cardMarkers: 1,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
    // OT: Stability 3, Industry 1 (industry autocomplete marker),
    // Manpower Turkish 2 / Arab 1, Arab Keys 5, Territorial 6.
    // "1 turn RU Truce" (the same RU/OT truce as RU's).
    OT: {
      stability: 3,
      manpower: 2,
      secondaryManpower: 1,
      industry: 1,
      autoIndustry: true,
      territorialKeys: 6,
      colonialKeys: 0,
      arabKeys: 5,
      alliance: "neutral",
      mpit: {te: 0, ta: 0, neutral: 1},
    },
  },
  units: [
    // ------------------------------------------------------------------ Germany
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "alsace-lorraine", steps: 2},
    {owner: "GE", kind: "army", space: "berlin", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "berlin", steps: 1},
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
    // "Balochistan: 1 EF"
    {owner: "UK", kind: "expeditionary", space: "balochistan", steps: 1},
    // "Egypt: 1 EF"
    {owner: "UK", kind: "expeditionary", space: "egypt", steps: 1},
    // -------------------------------------------------------------------- France
    {owner: "FR", kind: "army", space: "paris", steps: 2},
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    {owner: "FR", kind: "army", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "brittany", steps: 2},
    // "Algeria: Zouaves EF"
    {owner: "FR", kind: "zouave", space: "algeria", steps: 1},
    // "West Africa: influence marker, 1 EF, Pac 1"
    {owner: "FR", kind: "expeditionary", space: "west-africa", steps: 1},
    // "Reserve Armies: 1"
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},
    // -------------------------------------------------------------- Austria-Hungary
    {owner: "AU", kind: "army", space: "vienna", steps: 2},
    {owner: "AU", kind: "army", space: "hungary", steps: 2},
    {owner: "AU", kind: "army", space: "bohemia", steps: 2},
    // "Croatia: 1 squadron" (full, not reduced)
    {owner: "AU", kind: "squadron", space: "croatia", steps: 2},
    // "Reserve Armies: 3"
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},
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
    // "Russian Far East: 1 EF" — the printed list contains this line twice
    // (before and after the Central Asia / ally-marker lines); see notes.
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    // "Central Asia: Influence marker, 1 EF, Pac 1"
    {owner: "RU", kind: "expeditionary", space: "central-asia", steps: 1},
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    // "Reserve Armies: 2"
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    // ------------------------------------------------------------------- Ottoman
    // "1 Turkish army"
    {owner: "OT", kind: "army", space: "istanbul", steps: 2},
    {owner: "OT", kind: "army", space: "macedonia", steps: 2},
    // "Syria: 1 Arab army" (full, not reduced in this scenario)
    {owner: "OT", kind: "army", space: "syria", steps: 2, special: "arab"},
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
    {owner: "Denmark", kind: "minorArmy", space: "denmark", steps: 2},
    {owner: "Greece", kind: "minorArmy", space: "greece", steps: 2},
    {owner: "Persia", kind: "minorArmy", space: "qajar-persia", steps: 2},
    {owner: "Romania", kind: "minorArmy", space: "romania", steps: 2},
    // "Bulgaria: 1 Army, IMP marker"
    {owner: "Bulgaria", kind: "minorArmy", space: "bulgaria", steps: 2},
    // "Serbia: 1 army, IMP marker"
    {owner: "Serbia", kind: "minorArmy", space: "serbia", steps: 2},
    // "Ethiopia: 1 army (these count as Rebels, see 21.0)"
    {owner: "REBEL:Ethiopia", kind: "rebelArmy", space: "ethiopia", steps: 2},
    // "Japan: 1 army, 1 squadron"
    {owner: "Japan", kind: "minorArmy", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
  ],
  forts: [
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
    // "West Africa: influence marker, 1 EF, Pac 1"
    {power: "FR", space: "west-africa"},
    // "Central Asia: Influence marker, 1 EF, Pac 1"
    {power: "RU", space: "central-asia"},
  ],
  pacification: [
    // "West Africa: influence marker, 1 EF, Pac 1"
    {space: "west-africa", value: 1},
    // "Central Asia: Influence marker, 1 EF, Pac 1"
    {space: "central-asia", value: 1},
  ],
  // "Ally markers: Romania, Serbia, Bulgaria" (RU).
  allyMarkers: [
    {power: "RU", minor: "Romania", space: "romania"},
    {power: "RU", minor: "Serbia", space: "serbia"},
    {power: "RU", minor: "Bulgaria", space: "bulgaria"},
  ],
  controlOverrides: [
    // GE "Control markers: Schleswig-Holstein, Hanover, Bavaria, Saxony,
    // Alsace-Lorraine" (map defaults are Denmark, Hanover, Bavaria, Saxony, FR).
    {space: "schleswig-holstein", control: "GE"},
    {space: "hanover", control: "GE"},
    {space: "bavaria", control: "GE"},
    {space: "saxony", control: "GE"},
    {space: "alsace-lorraine", control: "GE"},
    // UK "Control markers: Balochistan, Shanghai, Guangzhou, Egypt, Sanai,
    // Great Sand Sea (the latter three are colonial home spaces)".
    {space: "balochistan", control: "UK"},
    {space: "shanghai", control: "UK"},
    {space: "guangzhou", control: "UK"},
    {space: "egypt", control: "UK"},
    {space: "sinai", control: "UK"},
    {space: "great-sand-sea", control: "UK"},
    // FR "Control markers: Indochina".
    {space: "indochina", control: "FR"},
    // RU "Control marker: Manchuria".
    {space: "manchuria", control: "RU"},
    // "Mexico: US control marker".
    {space: "mexico", control: "United States"},
  ],
  // v1.1 Playbook p.5 prints "Power Projection: UK 8, FR 4, RU 3, OT 0, AU 0,
  // GE 0" and "UK and FR dominate Power Projection".  The setup stores those
  // printed markers; France's fourth point is the +1 over the campaign's FR 3
  // (the printed Indochina control marker adds an Indian Ocean port on top of
  // North Atlantic 1 and Western Mediterranean 2).
  // AU is the one printed value the board overrules.  3.3.1 scores Croatia's
  // port plus AU's starting squadron at 1, so the stored marker is that derived
  // 1 rather than the printed 0 (a playbook slip), keeping the setup display
  // and the first end-phase recompute equal.
  powerProjection: {GE: 0, UK: 8, FR: 4, AU: 1, RU: 3, OT: 0},
  removedCards: [
    "Suez Canal",
    "American Civil War",
    "Sepoy Mutiny",
    "Second Opium War",
    "Folie de Grandeur",
    "The Dual Monarchy",
    "Reforms of the 1860s",
    "Ironclads",
    "Urabi Revolt",
    "Meiji Restoration",
    "Zulus",
    "Paris Commune",
  ],
  // "End Phase Build Box: Egypt and Bosnia"
  buildBox: ["Egypt", "Bosnia"],
  // GE "1 turn FR Truce" and FR "1 turn GE Truce" are the same truce; so are
  // RU's "1 turn OT Truce" and OT's "1 turn RU Truce".
  truces: [
    {a: "GE", b: "FR", turns: 1},
    {a: "RU", b: "OT", turns: 1},
  ],
  suezComplete: true,
  italy: {unified: true},
  // "Bulgaria: 1 Army, IMP marker" and "Serbia: 1 army, IMP marker".
  independentMinors: ["Bulgaria", "Serbia"],
  // "Bulgaria: 1 Army, IMP marker" and "Serbia: 1 army, IMP marker".
  independentMinorMarkers: [
    {minor: "Bulgaria", space: "bulgaria"},
    {minor: "Serbia", space: "serbia"},
  ],
  // "AU: the AU player adds the 'Precarious Position' NG to their NG deck, and
  // they may remove either 'Contain Italy' or 'Contain Prussia'".
  goalDeck: [{power: "AU", add: "NG-31", removeOneOf: ["NG-29", "NG-30"]}],
  special: {
    countVp: true,
    // "Additional NGs are drawn during the End Phase of turns 4 and 6
    // (instead of turns 3 and 5)."
    ngDrawTurns: [4, 6],
    // "players draw 3 NGs and pick one. Exception: See GE below." — GE draws 2.
    startingGoalDraw: {GE: 2, UK: 3, FR: 3, AU: 3, RU: 3, OT: 3},
    // The same reduced GE draw applies in the end phase ("The GE player only
    // draws 2 NGs at the start of this scenario and during the end phase of
    // turns 3 and 5" / "4 and 6").
    ngDrawCount: {GE: 2},
    bloodAndIron: false,
    // "Berlin Conference: set aside five random action cards and the Berlin
    // Conference mandatory event. Shuffle the six cards and place them on the
    // top of the deck."
    berlinConference: true,
    // "OT Special Rules: During the prep phase of each turn of this scenario,
    // OT is dealt one additional card."
    extraPrepCards: {OT: 1},
    allowsNoGw: true,
  },
  notes: [
    "Scenario length: 4 turns (turn 4, 1880s - turn 7, 1910s).",
    "WTT starts at 1. Suez Canal Status: Complete.",
    "Alliance Track: GE in the committed box of the Triple Alliance and FR in the committed box of the Triple Entente; all other players (and Italy) are in the neutral box.",
    "Italy Status: Unified (Lombardy, Piedmont, Tuscany and Naples carry Italian units). The display prints no control markers for those spaces, so no controlOverrides are recorded for them.",
    "GE is already unified Germany (printed design note: 'they have already unified Germany thus completing their 4 VP NG'); powers.GE.unified is true.",
    "TODO(ally markers): RU — Romania, Serbia, Bulgaria. The printed 'Ally markers' entries have no field on ScenarioDef; only the printed control markers are in controlOverrides.",
    "Bulgaria and Serbia are independent minor powers (IMP markers): `independentMinors: [\"Bulgaria\", \"Serbia\"]`.",
    "Mexico is under United States control (printed 'Mexico: US control marker').",
    "UK's Egypt, Sinai and Great Sand Sea control markers make all three British colonial home spaces; in the campaign those spaces start Egyptian.",
    "NGs: prior to the Prep Phase of turn 4 every player draws 3 NGs and keeps 1; GE draws only 2 and keeps 1 (startingGoalDraw).",
    "GE also draws only 2 NGs during the end phase of turns 4 and 6 (special.ngDrawCount).",
    "AU National Goal deck: add 'Precarious Position'; may remove either 'Contain Italy' or 'Contain Prussia'.",
    "OT is dealt one additional card in every prep phase of this scenario (`extraPrepCards.OT = 1`).",
    "Berlin Conference: at the start of the scenario, set aside five random action cards plus the Berlin Conference mandatory event, shuffle the six and place them on top of the deck.",
    "The printed RU list gives 'Russian Far East: 1 EF' twice (once before the Central Asia line, once after the ally-marker lines). Both are transcribed as printed; if the repeat is a typographical error the second entry should be dropped.",
    "FR's government is not printed for this scenario, so `government` is left unset; note that `createEmptyPowerState` falls back to 'secondEmpire' for FR.",
    "Power Projection (v1.1 Playbook p.5): UK 8, FR 4, RU 3, OT 0, AU 0, GE 0 - 'UK and FR dominate Power Projection'. The scenario stores those printed markers, except AU: 3.3.1 derives AU 1 from Croatia's port and the starting squadron, so the display keeps that value rather than the printed 0 so the first end-phase recompute cannot change it.",
    "UK India Stability marker starts on its stable side. UK Reserve Armies: N/A.",
    "Minor powers in the End Phase Build Box at the start: Egypt, Bosnia.",
  ],
};
