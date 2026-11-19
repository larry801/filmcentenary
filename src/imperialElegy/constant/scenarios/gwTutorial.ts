import type {ScenarioDef} from "./types";

/**
 * Historical Great War (GW Tutorial) — `IE_playbook.pdf` p. 7.
 *
 * "Start this scenario with the Maneuver Step of GW turn 0.  The setup takes
 * into account the Outbreak Step of the GW, including the National Will Step and
 * the UK Rapid Deployment national characteristic."
 *
 * So this is not a pre-war scenario with a Great War bolted on: the war is
 * already in progress when play begins, the Outbreak and National Will steps are
 * already resolved, and the printed wartime initiative order is standing.  The
 * data below is transcribed display by display, in printed order.
 */
export const GW_TUTORIAL_SCENARIO: ScenarioDef = {
  id: "gwTutorial",
  name: "Historical Great War",
  nameZh: "历史大战剧本",
  // The scenario follows the seven campaign turns, then opens at the GW.
  firstTurn: 7,
  lastTurn: 7,
  // The tutorial opens after the continuous Outbreak/National Will steps, and
  // rule 25.7 steps the WTT back down to 4 once the war has begun.
  wtt: 4,
  powers: {
    // GE: Stability 6, Industry 7, Manpower 5.
    GE: {stability: 6, manpower: 5, industry: 7, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
    // UK: Stability 6, Industry 5, British Manpower 3 / Colonial 3.
    UK: {
      stability: 6,
      manpower: 3,
      secondaryManpower: 3,
      industry: 5,
      territorialKeys: 0,
      colonialKeys: 0,
      alliance: "teCommitted",
    },
    // FR: Stability 5, Industry 5, Manpower 4.
    FR: {stability: 5, manpower: 4, industry: 5, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
    // AU: Stability 5, Industry 4, Manpower 4.
    AU: {stability: 5, manpower: 4, industry: 4, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
    // RU: Stability 5, Industry 4, Manpower 6, TSRR Built.
    RU: {stability: 5, manpower: 6, industry: 4, territorialKeys: 0, colonialKeys: 0, tsrr: true, alliance: "teCommitted"},
    // OT: Stability 5, Industry 3, Turkish Manpower 3 / Arab 1.
    OT: {
      stability: 5,
      manpower: 3,
      secondaryManpower: 1,
      industry: 3,
      territorialKeys: 0,
      colonialKeys: 0,
      arabKeys: 0,
      // "OT will join the Triple Alliance during the winter step of GW turn 0."
      // The war has not started for OT yet at the opening maneuver step.
      alliance: "neutral",
    },
  },
  units: [
    // ------------------------------------------------------------------ Germany
    {owner: "GE", kind: "army", space: "pomerania", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "pomerania", steps: 1},
    {owner: "GE", kind: "army", space: "alsace-lorraine", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    // "Hanover: 3 dreadnoughts, 1 squadron"
    {owner: "GE", kind: "dreadnought", space: "hanover", steps: 2},
    {owner: "GE", kind: "dreadnought", space: "hanover", steps: 2},
    {owner: "GE", kind: "dreadnought", space: "hanover", steps: 2},
    {owner: "GE", kind: "squadron", space: "hanover", steps: 2},
    // "Schleswig-Holstein: 1 squadron, 1 dreadnought"
    {owner: "GE", kind: "squadron", space: "schleswig-holstein", steps: 2},
    {owner: "GE", kind: "dreadnought", space: "schleswig-holstein", steps: 2},
    // "Cameroon: 1 EF, control marker"
    {owner: "GE", kind: "expeditionary", space: "cameroon", steps: 1},
    // "East Africa: 1 Elite Colonial EF, control marker"
    {owner: "GE", kind: "expeditionary", space: "east-africa", steps: 1, special: "eliteColonialEf"},
    // "Southwest Africa: 1 EF, control marker"
    {owner: "GE", kind: "expeditionary", space: "southwest-africa", steps: 1},
    // "Pacific Ocean: 1 squadron"
    {owner: "GE", kind: "squadron", space: "pacific-ocean", steps: 2},
    // "Reserve Armies: 7"
    ...Array.from({length: 7}, (): {owner: "GE"; kind: "reserveArmy"; space: null; steps: 2} =>
      ({owner: "GE", kind: "reserveArmy", space: null, steps: 2})),

    // ------------------------------------------------------------------ Britain
    // "North Atlantic: 5 dreadnoughts, 3 squadrons"
    {owner: "UK", kind: "dreadnought", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "dreadnought", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "dreadnought", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "dreadnought", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "dreadnought", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "squadron", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "squadron", space: "north-atlantic", steps: 2},
    {owner: "UK", kind: "squadron", space: "north-atlantic", steps: 2},
    // "Picardy: 1 army"
    {owner: "UK", kind: "army", space: "picardy", steps: 2},
    // "Mediterranean: 1 dreadnought, 1 squadron"
    {owner: "UK", kind: "dreadnought", space: "eastern-mediterranean", steps: 2},
    {owner: "UK", kind: "squadron", space: "eastern-mediterranean", steps: 2},
    // "Singapore: 1 squadron"
    {owner: "UK", kind: "squadron", space: "singapore", steps: 2},
    // "India: 2 Indian armies, Level 1 Indian Fort"
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    // "Nigeria: 1 EF, control marker" / "Sudan: 1 EF, control marker"
    {owner: "UK", kind: "expeditionary", space: "nigeria", steps: 1},
    {owner: "UK", kind: "expeditionary", space: "sudan", steps: 1},
    // "South Africa: 1 EF, 1 squadron"
    {owner: "UK", kind: "expeditionary", space: "south-africa", steps: 1},
    {owner: "UK", kind: "squadron", space: "south-africa", steps: 2},
    // "Egypt: 1 EF, control marker"
    {owner: "UK", kind: "expeditionary", space: "egypt", steps: 1},

    // ------------------------------------------------------------------- France
    // "Champagne: 2 armies, level 2 fort"
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    {owner: "FR", kind: "army", space: "champagne", steps: 2},
    // "Burgundy: 1 army, 1 EC, level 1 fort"
    {owner: "FR", kind: "army", space: "burgundy", steps: 2},
    {owner: "FR", kind: "eliteCorps", space: "burgundy", steps: 1},
    // "Paris: 1 army"
    {owner: "FR", kind: "army", space: "paris", steps: 2},
    // "Provence: 2 dreadnoughts, 1 squadron, level 2 fort"
    {owner: "FR", kind: "dreadnought", space: "provence", steps: 2},
    {owner: "FR", kind: "dreadnought", space: "provence", steps: 2},
    {owner: "FR", kind: "squadron", space: "provence", steps: 2},
    // "Algeria: Zouaves, 2 squadrons"
    {owner: "FR", kind: "zouave", space: "algeria", steps: 1},
    {owner: "FR", kind: "squadron", space: "algeria", steps: 2},
    {owner: "FR", kind: "squadron", space: "algeria", steps: 2},
    // "West Congo: 1 EF, French control" / "West Africa: 1 EF, French control"
    {owner: "FR", kind: "expeditionary", space: "west-congo", steps: 1},
    {owner: "FR", kind: "expeditionary", space: "west-africa", steps: 1},
    // "Reserve Armies: 4"
    ...Array.from({length: 4}, (): {owner: "FR"; kind: "reserveArmy"; space: null; steps: 2} =>
      ({owner: "FR", kind: "reserveArmy", space: null, steps: 2})),

    // -------------------------------------------------------------- Austria-Hungary
    // "Galicia: 2 armies, level 1 fort"
    {owner: "AU", kind: "army", space: "galicia", steps: 2},
    {owner: "AU", kind: "army", space: "galicia", steps: 2},
    // "Banat: 1 army"
    {owner: "AU", kind: "army", space: "banat", steps: 2},
    // "Bosnia: 1 army, AU control"
    {owner: "AU", kind: "army", space: "bosnia-herzegovina", steps: 2},
    // "Croatia: 2 dreadnoughts, 1 squadron, level 2 fort"
    {owner: "AU", kind: "dreadnought", space: "croatia", steps: 2},
    {owner: "AU", kind: "dreadnought", space: "croatia", steps: 2},
    {owner: "AU", kind: "squadron", space: "croatia", steps: 2},
    // "Reserve Armies: 3"
    ...Array.from({length: 3}, (): {owner: "AU"; kind: "reserveArmy"; space: null; steps: 2} =>
      ({owner: "AU", kind: "reserveArmy", space: null, steps: 2})),

    // ------------------------------------------------------------------- Russia
    // "St. Petersburg: 1 army, 1 squadron"
    {owner: "RU", kind: "army", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "squadron", space: "st-petersburg", steps: 2},
    // "Riga: 1 army, level 2 fort"
    {owner: "RU", kind: "army", space: "riga", steps: 2},
    // "West Ukraine: 1 army, 1 EC, level 1 fort"
    {owner: "RU", kind: "army", space: "west-ukraine", steps: 2},
    {owner: "RU", kind: "eliteCorps", space: "west-ukraine", steps: 1},
    // "Kharkov: 1 army" / "Georgia: 1 army"
    {owner: "RU", kind: "army", space: "kharkov", steps: 2},
    {owner: "RU", kind: "army", space: "georgia", steps: 2},
    // "Poland: 1 army, level 2 fort"
    {owner: "RU", kind: "army", space: "poland", steps: 2},
    // "Sevastopol: 1 squadron"
    {owner: "RU", kind: "squadron", space: "sevastopol", steps: 2},
    // "Russian Far East: 1 EF" / "Central Asia: 1 EF, control marker"
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    {owner: "RU", kind: "expeditionary", space: "central-asia", steps: 1},
    // "Reserve Armies: 6"
    ...Array.from({length: 6}, (): {owner: "RU"; kind: "reserveArmy"; space: null; steps: 2} =>
      ({owner: "RU", kind: "reserveArmy", space: null, steps: 2})),

    // ------------------------------------------------------------------ Ottoman
    // "Istanbul: level 1 fort, 1 Turkish army"
    {owner: "OT", kind: "army", space: "istanbul", steps: 2},
    // "Erzurum: 1 Turkish army"
    {owner: "OT", kind: "army", space: "erzurum", steps: 2},
    // "Ankara: 1 reduced Turkish army"
    {owner: "OT", kind: "army", space: "ankara", steps: 1},
    // "Baghdad: 1 Arab Army"
    {owner: "OT", kind: "army", space: "baghdad", steps: 2, special: "arab"},
    // "Reserve Armies: 1 Turkish, 1 Arab"
    {owner: "OT", kind: "reserveArmy", space: null, steps: 2},

    // ------------------------------------------------------------------- Italy
    // "Tuscany: 1 army", "Piedmont: 1 army", "Lombardy: 1 army"
    {owner: "IT", kind: "italianArmy", space: "tuscany", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "piedmont", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "lombardy", steps: 2},
    // "Naples, 1 dreadnought, 2 squadrons"
    {owner: "IT", kind: "dreadnought", space: "naples", steps: 2},
    {owner: "IT", kind: "squadron", space: "naples", steps: 2},
    {owner: "IT", kind: "squadron", space: "naples", steps: 2},
    // "Reserve Armies: 1"
    {owner: "IT", kind: "reserveArmy", space: null, steps: 2},

    // ------------------------------------------------------------- Minor powers
    // "Belgium: 1 army, control marker in Congo"
    {owner: "Belgium", kind: "minorArmy", space: "belgium", steps: 2},
    {owner: "Belgium", kind: "minorArmy", space: "central-congo", steps: 2},
    // "Netherlands: 1 army" / "Denmark: 1 army"
    {owner: "Netherlands", kind: "minorArmy", space: "netherlands", steps: 2},
    {owner: "Denmark", kind: "minorArmy", space: "denmark", steps: 2},
    // "Serbia: 2 armies" / "Bulgaria: 2 armies" / "Romania: 2 armies"
    {owner: "Serbia", kind: "minorArmy", space: "serbia", steps: 2},
    {owner: "Serbia", kind: "minorArmy", space: "serbia", steps: 2},
    {owner: "Bulgaria", kind: "minorArmy", space: "bulgaria", steps: 2},
    {owner: "Bulgaria", kind: "minorArmy", space: "bulgaria", steps: 2},
    {owner: "Romania", kind: "minorArmy", space: "romania", steps: 2},
    {owner: "Romania", kind: "minorArmy", space: "romania", steps: 2},
    // "Macedonia: Greek control, 1 reduced Greek army"
    {owner: "Greece", kind: "minorArmy", space: "macedonia", steps: 1},
    // "Japan: 1 army, 2 squadrons, control marker in Korea"
    {owner: "Japan", kind: "minorArmy", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
  ],
  forts: [
    {space: "prussia", power: "GE", level: 2},
    {space: "silesia", power: "GE", level: 2},
    {space: "alsace-lorraine", power: "GE", level: 2},
    {space: "champagne", power: "FR", level: 2},
    {space: "burgundy", power: "FR", level: 1},
    {space: "provence", power: "FR", level: 2},
    {space: "galicia", power: "AU", level: 1},
    {space: "croatia", power: "AU", level: 2},
    {space: "tyrol", power: "AU", level: 2},
    {space: "riga", power: "RU", level: 2},
    {space: "west-ukraine", power: "RU", level: 1},
    {space: "poland", power: "RU", level: 2},
    {space: "istanbul", power: "OT", level: 1},
    {space: "india", power: "UK", level: 1, indian: true},
  ],
  diplomacy: [
    // "Belgium: diplomacy marker" (UK).
    {power: "UK", space: "belgium"},
  ],
  influence: [],
  pacification: [],
  controlOverrides: [
    // GE "Other control markers: All German home spaces, Caroline Islands, New
    // Guinea" — the home spaces are already GE's on the map.
    {space: "caroline-islands", control: "GE"},
    {space: "new-guinea", control: "GE"},
    // GE's African colonies.
    {space: "cameroon", control: "GE"},
    {space: "east-africa", control: "GE"},
    {space: "southwest-africa", control: "GE"},
    // UK "Other control markers: Cyprus, Fiji, Balochistan, Oman, Aden, Kuwait,
    // Great Sand Sea, Sinai, Shanghai, Shandong Peninsula".  Fiji has no space
    // on the map (see notes).
    {space: "cyprus", control: "UK"},
    {space: "balochistan", control: "UK"},
    {space: "oman", control: "UK"},
    {space: "aden", control: "UK"},
    {space: "kuwait", control: "UK"},
    {space: "great-sand-sea", control: "UK"},
    {space: "sinai", control: "UK"},
    {space: "shanghai", control: "UK"},
    {space: "shandong-peninsula", control: "UK"},
    {space: "nigeria", control: "UK"},
    {space: "sudan", control: "UK"},
    {space: "rhodesia", control: "UK"},
    {space: "egypt", control: "UK"},
    // FR "Other control markers: Morocco, Tunisia, Madagascar, Indochina,
    // Guangzhou" plus the printed "French control" of West Congo/West Africa.
    {space: "morocco", control: "FR"},
    {space: "tunisia", control: "FR"},
    {space: "madagascar", control: "FR"},
    {space: "indochina", control: "FR"},
    {space: "guangzhou", control: "FR"},
    {space: "west-congo", control: "FR"},
    {space: "west-africa", control: "FR"},
    // AU "Bosnia: 1 army, AU control".
    {space: "bosnia-herzegovina", control: "AU"},
    // RU "Other control markers: Manchuria".
    {space: "manchuria", control: "RU"},
    {space: "central-asia", control: "RU"},
    // Italy "Control markers: all Italian home spaces, Tripoli, Benghazi,
    // Somalia".  The four Italian unification spaces become Italian here.
    {space: "lombardy", control: "IT"},
    {space: "piedmont", control: "IT"},
    {space: "tuscany", control: "IT"},
    {space: "naples", control: "IT"},
    {space: "rome", control: "IT"},
    {space: "tripoli", control: "IT"},
    {space: "benghazi", control: "IT"},
    {space: "somalia", control: "IT"},
    // Minor powers.
    {space: "central-congo", control: "Belgium"},
    {space: "macedonia", control: "Greece"},
    {space: "korea", control: "Japan"},
    // "Egypt: 1 EF, control marker" is British; the three Egyptian spaces are
    // British here (not the campaign's independent Egypt).
    {space: "great-sand-sea", control: "UK"},
  ],
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [],
  // The Great War has no End Phase Build Box step (24.1's GW sequence replaces
  // the campaign's end phase), so the roster is empty.
  buildBox: [],
  suezComplete: true,
  kielComplete: true,
  italy: {unified: true, alliance: "neutral"},
  independentMinors: [],
  independentMinorMarkers: [],
  special: {
    countVp: true,
    ngDrawTurns: [],
    bloodAndIron: false,
    allowsNoGw: false,
    gwTutorial: {
      turn: 0,
      // "Wartime Initiative Order: GE, RU, AU, FR, Triple Alliance Bonus impulse
      // (which will be taken by OT on GW turn 1), UK."
      order: ["GE", "RU", "AU", "FR", "bonus", "UK"],
      bonusFor: ["OT"],
      te: ["FR", "UK", "RU"],
      ta: ["GE", "AU"],
      // "Alliance Track: Triple Alliance: GE, AU; Triple Entente: FR, UK, RU;
      // Neutral: OT and Italy" — OT is neutral at the opening maneuver step and
      // joins in the GW turn 0 winter step.
      neutrals: ["OT"],
      // "Permanent Events in Effect: Machine guns and Hydraulic Recoil"
      permanentEvents: {machineGuns: true, hydraulicRecoil: true},
      // "In Effect: Suez Canal, Kiel Canal"
      canals: {suez: true, kiel: true},
      // "I Want You Bonus Armies: 2 Armies"
      ukBonusArmies: 2,
    },
    gwSpecial: {
      auSerbiaBattleOrStability: true,
      ukNoAmphibiousGermanPorts: true,
      ottomanJoinsTaInWinter: true,
    },
  },
  notes: [
    "Start this scenario with the Maneuver Step of GW turn 0 (playbook p. 7).",
    "The setup takes into account the Outbreak Step of the GW, including the National Will Step and the UK Rapid Deployment national characteristic.",
    "In Effect: Suez Canal, Kiel Canal. Permanent Events in Effect: Machine guns and Hydraulic Recoil.",
    "Wartime Initiative Order: GE, RU, AU, FR, Triple Alliance Bonus impulse (taken by OT on GW turn 1), UK.",
    "Special: If AU does not launch a land battle against Serbia on GW turn 0 they lose one stability.",
    "Special: The UK cannot amphibiously assault GE home spaces containing a GE naval unit(s).",
    "Special: OT will join the Triple Alliance during the winter step of GW turn 0.",
    "Italy is unified in this scenario with control of all Italian home spaces plus Tripoli, Benghazi and Somalia; its Alliance Track chit is in the neutral box.",
    "The printed UK control list names Fiji, which has no space on this map; every other printed space exists and is transcribed.",
    "'Southern Rhodesia' / 'Rhodesia': the map's Rhodesia space is used.",
    "UK 'I Want You Bonus Armies: 2 Armies' is applied as the GW planning-step placement.",
    "Power Projection is not printed for this scenario; the engine recomputes it from the board at the first end phase.",
  ],
};
