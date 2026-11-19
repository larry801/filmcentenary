import type {ScenarioDef, ScenarioUnitSetup} from "./types";

/**
 * Alternate Great War Scenarios 1-3 — `IE_playbook.pdf` pp. 8-10.
 *
 * The printed common procedure (p. 8) is:
 *
 *  1. Initial Control: take control of all spaces explicitly listed.
 *  2. Build Points: "Stability and industry start at the campaign levels (the
 *     circled numbers) for all players.  Players can spend build points to
 *     increase their industry and stability, each build point increases either
 *     industry and stability by one."
 *  3. Taking Control of Uncontrolled Spaces: in turn order players gain control
 *     of uncontrolled keys they can trace a LoC to; the UK takes two each time.
 *  4. Set Manpower: from the keys each player controls.
 *  5. Placing Units: secretly written down, at most 2 armies per space and at
 *     most 2 naval units per player on a submap.
 *
 * Steps 1, 2 and 5 have concrete printed data (below).  Step 3 is a live player
 * choice, so the count is data and the placement happens during play.  Step 4 is
 * derived, so the engine's normal `recomputeTracks` owns it.
 *
 * "Victory: In the Alternate Great War scenarios the team that wins the GW wins
 * the game, all other players lose."
 */

/** Campaign circled track values, the printed baseline for step 2. */
const CAMPAIGN_START = {
  GE: {stability: 3, industry: 1},
  UK: {stability: 3, industry: 2},
  FR: {stability: 3, industry: 1},
  AU: {stability: 3, industry: 1},
  RU: {stability: 3, industry: 0},
  OT: {stability: 3, industry: 0},
} as const;

/** One alternate setup's printed unit inventory, as `ScenarioUnitSetup` rows. */
const inventory = (owner: string, rows: [ScenarioUnitSetup["kind"], number][]): ScenarioUnitSetup[] =>
  rows.flatMap(([kind, count]) =>
    Array.from({length: count}, (): ScenarioUnitSetup => ({
      owner: owner as ScenarioUnitSetup["owner"],
      kind,
      space: null,
      steps: kind === "eliteCorps" || kind === "expeditionary" || kind === "zouave" || kind === "eliteColonialEf" ? 1 : 2,
    })),
  );

/**
 * The printed inventories are listed by kind ("3 armies, 3 reserve armies,
 * 2 ECs, 2 EFs, 2 squadrons and 1 dreadnought").  `units` carries them as
 * unplaced rows (space `null` without being a reserve army is not meaningful, so
 * the alternate setups keep the inventory in `special.altGw.units` and leave
 * `units` empty; `engine/setup.ts#placeAltGwInventory` places them).
 */
const ALT_UNITS: Record<string, [ScenarioUnitSetup["kind"], number][]> = {};

/** Build one alternate-GW scenario definition. */
const altScenario = (def: ScenarioDef): ScenarioDef => def;

export const ALT_GW_SCENARIOS: ScenarioDef[] = [
  // ------------------------------------------------------------------ scenario 1
  altScenario({
    id: "altGw1",
    name: "Alternate Great War 1",
    nameZh: "架空大战剧本 1",
    firstTurn: 7,
    lastTurn: 7,
    wtt: 4,
    powers: {
      GE: {...CAMPAIGN_START.GE, manpower: undefined, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      UK: {
        ...CAMPAIGN_START.UK,
        secondaryManpower: undefined,
        industry: 2,
        territorialKeys: 0,
        colonialKeys: 0,
        alliance: "taCommitted",
      },
      FR: {...CAMPAIGN_START.FR, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      AU: {...CAMPAIGN_START.AU, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
      RU: {...CAMPAIGN_START.RU, tsrr: true, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
      OT: {...CAMPAIGN_START.OT, arabKeys: 0, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
    },
    // The printed inventories are placed by `placeAltGwInventory`, so the static
    // list stays empty (its positions are a secret player choice).
    units: [],
    forts: [],
    diplomacy: [],
    influence: [],
    pacification: [],
    controlOverrides: [
      // "GE: Control all home spaces plus: Schleswig-Holstein, Hanover, and
      // Saxony."  Bavaria stays German too ("control all home spaces").
      {space: "schleswig-holstein", control: "GE"},
      {space: "hanover", control: "GE"},
      {space: "saxony", control: "GE"},
      {space: "bavaria", control: "GE"},
      // "AU: Control all home spaces and Tuscany."
      {space: "tuscany", control: "AU"},
      // "RU: Control all home spaces plus: Central Asia, Manchuria, and Van."
      {space: "central-asia", control: "RU"},
      {space: "manchuria", control: "RU"},
      {space: "van", control: "RU"},
      // "OT: Control all home spaces except Serbia, Bosnia, Van, and the three
      // Egyptian spaces.  Control Somalia and Kuwait."
      {space: "somalia", control: "OT"},
      {space: "kuwait", control: "OT"},
      // Serbia/Bosnia are Serbian in this setup ("Serbia: controls Serbia and
      // Bosnia"), Van is Russian, Egypt is Egyptian.
      {space: "serbia", control: "Serbia"},
      {space: "bosnia-herzegovina", control: "Serbia"},
      {space: "egypt", control: "Egypt"},
      {space: "great-sand-sea", control: "Egypt"},
      {space: "sinai", control: "Egypt"},
    ],
    powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 3, OT: 0},
    removedCards: [],
    buildBox: [],
    suezComplete: true,
    italy: {unified: false},
    independentMinors: ["Egypt"],
    independentMinorMarkers: [
      {minor: "Egypt", space: "great-sand-sea"},
      {minor: "Egypt", space: "sinai"},
    ],
    special: {
      countVp: true,
      ngDrawTurns: [],
      bloodAndIron: false,
      allowsNoGw: false,
      altGw: {
        // "Alliances: TA: UK, AU, and RU. TE: GE, FR, and OT."
        te: ["GE", "FR", "OT"],
        ta: ["UK", "AU", "RU"],
        neutrals: [],
        control: {},
        allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
        uncontrolledKeys: {
          GE: {africa: 3, asia: 1},
          UK: {africa: 4, asia: 3},
          FR: {africa: 4, asia: 2},
          RU: {africa: 0, asia: 1},
        },
        buildPoints: {GE: 7, UK: 5, FR: 6, AU: 6, RU: 6, OT: 6},
        units: {
          GE: [
            {kind: "army", count: 3},
            {kind: "reserveArmy", count: 3},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 2},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 1},
          ],
          UK: [
            {kind: "army", count: 1},
            {kind: "army", count: 3},
            {kind: "expeditionary", count: 3},
            {kind: "squadron", count: 5},
            {kind: "dreadnought", count: 4},
          ],
          FR: [
            {kind: "army", count: 5},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 3},
            {kind: "squadron", count: 3},
            {kind: "dreadnought", count: 2},
          ],
          AU: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 2},
          ],
          RU: [
            {kind: "army", count: 6},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "expeditionary", count: 2},
            {kind: "squadron", count: 3},
            {kind: "dreadnought", count: 1},
          ],
          OT: [
            {kind: "army", count: 3},
            {kind: "army", count: 1},
            {kind: "reserveArmy", count: 2},
            {kind: "expeditionary", count: 1},
            {kind: "squadron", count: 1},
          ],
        },
        tsrrComplete: ["RU"],
        // "AU: Alliance with Papal States."
        minorAlliances: [{power: "AU", minor: "Papal States"}],
        minorControl: [
          {space: "serbia", control: "Serbia"},
          {space: "bosnia-herzegovina", control: "Serbia"},
          {space: "egypt", control: "Egypt"},
        ],
      },
    },
    notes: [
      "Alliances: TA: UK, AU, and RU. TE: GE, FR, and OT (playbook p. 8).",
      "Italy is not unified in this scenario.",
      "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.  Each build point raises industry or stability by one.",
      "Uncontrolled keys each power may take: GE 3 Africa + 1 Asia; UK 4 Africa + 3 Asia; FR 4 Africa + 2 Asia; RU 1 Asia.",
      "RU: Trans-Siberian RR: Complete.  AU: Alliance with Papal States.",
      "Printed units per power are in special.altGw.units; their positions are a secret player choice ('players will secretly write down the location of their starting units'), so the engine places them at the capital and home keys with the printed two-army setup stack limit.",
      "Minor powers: Belgium 1 army, Netherlands 1 army, Denmark 1 army, Serbia controls Serbia and Bosnia with 1 army in Serbia, Bavaria 1 army, Piedmont-Sardinia 1 army, Naples 1 reduced army, Egypt 1 army, Great Sand Sea/Sinai IMP, Suez Canal complete, Greece 1 army, Persia 1 army, Romania 1 army, Ethiopia 1 army, Mexico US control, Japan 1 army and 2 squadrons.",
      "Victory: the team that wins the GW wins the game; all other players lose.",
    ],
  }),

  // ------------------------------------------------------------------ scenario 2
  altScenario({
    id: "altGw2",
    name: "Alternate Great War 2 — Independent Poland",
    nameZh: "架空大战剧本 2 — 独立波兰",
    firstTurn: 7,
    lastTurn: 7,
    wtt: 4,
    powers: {
      GE: {...CAMPAIGN_START.GE, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
      UK: {...CAMPAIGN_START.UK, industry: 2, territorialKeys: 0, colonialKeys: 0, alliance: "neutral"},
      FR: {...CAMPAIGN_START.FR, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      AU: {...CAMPAIGN_START.AU, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      RU: {...CAMPAIGN_START.RU, tsrr: true, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
      OT: {...CAMPAIGN_START.OT, arabKeys: 0, territorialKeys: 0, colonialKeys: 0, alliance: "neutral"},
    },
    units: [],
    forts: [],
    diplomacy: [],
    influence: [],
    pacification: [],
    controlOverrides: [
      // "GE: Control all home German Unification Spaces."
      {space: "schleswig-holstein", control: "GE"},
      {space: "hanover", control: "GE"},
      {space: "saxony", control: "GE"},
      {space: "bavaria", control: "GE"},
      // "FR: Control all home spaces except Alsace-Lorraine.  Control Belgium.
      // … AND all three Egyptian spaces (the Suez Canal is complete)."
      {space: "alsace-lorraine", control: "GE"},
      {space: "belgium", control: "FR"},
      {space: "egypt", control: "FR"},
      {space: "great-sand-sea", control: "FR"},
      {space: "sinai", control: "FR"},
      // "AU: Control all home spaces except Lombardy.  Control Bosnia."
      {space: "lombardy", control: "IT"},
      {space: "bosnia-herzegovina", control: "AU"},
      // "RU: Control all home spaces except: Poland, Western Ukraine, and
      // Belorussia.  Also control Central Asia and Manchuria."
      {space: "central-asia", control: "RU"},
      {space: "manchuria", control: "RU"},
      // Independent Poland: "Poland: 2 armies and an IMP marker", "Western
      // Ukraine: 1 army and an IMP", "Belorussia: IMP marker".
      {space: "poland", control: "Poland"},
      {space: "west-ukraine", control: "Poland"},
      {space: "belorussia", control: "Poland"},
      // "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Libya,
      // Benghazi, Cyprus, and the three Egyptian spaces.  Control Somalia and
      // Kuwait."
      {space: "somalia", control: "OT"},
      {space: "kuwait", control: "OT"},
      // "Italy: Unified.  Control all Italian Unification spaces plus Libya,
      // Benghazi, and Cyprus."
      {space: "lombardy", control: "IT"},
      {space: "piedmont", control: "IT"},
      {space: "tuscany", control: "IT"},
      {space: "naples", control: "IT"},
      {space: "tripoli", control: "IT"},
      {space: "benghazi", control: "IT"},
      {space: "cyprus", control: "IT"},
      // "Japan: 1 army, 2 squadrons, control marker in Korea."
      {space: "korea", control: "Japan"},
    ],
    powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 3, OT: 0},
    removedCards: [],
    buildBox: [],
    suezComplete: true,
    italy: {unified: true, alliance: "neutral"},
    independentMinors: ["Poland", "Egypt"],
    independentMinorMarkers: [
      {minor: "Poland", space: "poland"},
      {minor: "Poland", space: "west-ukraine"},
      {minor: "Poland", space: "belorussia"},
    ],
    special: {
      countVp: true,
      ngDrawTurns: [],
      bloodAndIron: false,
      allowsNoGw: false,
      altGw: {
        // "Alliances: TA: RU and GE. TE: FR and AU. … Neutral: UK, OT, and IT."
        te: ["FR", "AU"],
        ta: ["RU", "GE"],
        neutrals: ["UK", "OT"],
        control: {},
        allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
        uncontrolledKeys: {
          GE: {africa: 3, asia: 0},
          UK: {africa: 5, asia: 4},
          FR: {africa: 3, asia: 2},
          RU: {africa: 0, asia: 1},
        },
        buildPoints: {GE: 7, UK: 5, FR: 6, AU: 6, RU: 6, OT: 6},
        units: {
          GE: [
            {kind: "army", count: 5},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 2},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 3},
          ],
          UK: [
            {kind: "army", count: 1},
            {kind: "army", count: 3},
            {kind: "expeditionary", count: 3},
            {kind: "squadron", count: 5},
            {kind: "dreadnought", count: 5},
          ],
          FR: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 3},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 3},
            {kind: "squadron", count: 3},
            {kind: "dreadnought", count: 1},
          ],
          AU: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 2},
          ],
          RU: [
            {kind: "army", count: 5},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "expeditionary", count: 2},
            {kind: "squadron", count: 3},
          ],
          OT: [
            {kind: "army", count: 3},
            {kind: "army", count: 1},
            {kind: "reserveArmy", count: 2},
            {kind: "expeditionary", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 1},
          ],
        },
        tsrrComplete: ["RU"],
        // "Poland begins the scenario at war and allied with AU."
        startingWars: [{attacker: "RU", defender: "Poland"}],
        minorAlliances: [{power: "AU", minor: "Poland"}],
        independentPoland: true,
        minorControl: [
          {space: "poland", control: "Poland"},
          {space: "west-ukraine", control: "Poland"},
          {space: "belorussia", control: "Poland"},
          {space: "egypt", control: "FR"},
          {space: "great-sand-sea", control: "FR"},
          {space: "sinai", control: "FR"},
          {space: "korea", control: "Japan"},
        ],
      },
    },
    notes: [
      "Alliances: TA: RU and GE.  TE: FR and AU.  Neutral: UK and OT (and the non-player Italy).",
      "Independent Poland: 'Poland begins the scenario at war and allied with AU.'  Poland controls Poland, Western Ukraine and Belorussia with an IMP marker; it has 2 armies in Poland, 1 in Western Ukraine and 1 reserve army.",
      "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.",
      "Uncontrolled keys each power may take: GE 3 Africa; UK 5 Africa + 4 Asia; FR 3 Africa + 2 Asia; RU 1 Asia.",
      "RU: Trans-Siberian RR: Complete.  Italy is unified and controls all Italian Unification spaces plus Libya, Benghazi and Cyprus.",
      "Minor powers: Netherlands 1 army, Denmark 1 army, Serbia 1 army, Bulgaria 1 army, Greece 1 army, Persia 1 army, Romania 1 army, Japan 1 army + 2 squadrons + control marker in Korea.",
      "Printed units per power are in special.altGw.units; their positions are a secret player choice, so the engine places them at the capital and home keys with the printed two-army setup stack limit.",
      "Victory: the team that wins the GW wins the game; all other players lose.",
    ],
  }),

  // ------------------------------------------------------------------ scenario 3
  altScenario({
    id: "altGw3",
    name: "Alternate Great War 3 — Colonial War",
    nameZh: "架空大战剧本 3 — 殖民战争",
    firstTurn: 7,
    lastTurn: 7,
    wtt: 4,
    powers: {
      GE: {...CAMPAIGN_START.GE, territorialKeys: 0, colonialKeys: 0, alliance: "neutral"},
      UK: {...CAMPAIGN_START.UK, industry: 2, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
      FR: {...CAMPAIGN_START.FR, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      AU: {...CAMPAIGN_START.AU, territorialKeys: 0, colonialKeys: 0, alliance: "neutral"},
      RU: {...CAMPAIGN_START.RU, tsrr: true, territorialKeys: 0, colonialKeys: 0, alliance: "teCommitted"},
      OT: {...CAMPAIGN_START.OT, arabKeys: 0, territorialKeys: 0, colonialKeys: 0, alliance: "taCommitted"},
    },
    units: [],
    forts: [],
    diplomacy: [],
    influence: [],
    pacification: [],
    controlOverrides: [
      // "GE: Control all home German Unification Spaces except
      // Alsace-Lorraine."
      {space: "schleswig-holstein", control: "GE"},
      {space: "hanover", control: "GE"},
      {space: "saxony", control: "GE"},
      {space: "bavaria", control: "GE"},
      {space: "alsace-lorraine", control: "FR"},
      // "FR: Control all home spaces. … Control Tunis and Morocco."
      {space: "tunisia", control: "FR"},
      {space: "morocco", control: "FR"},
      // "RU: Control all home spaces. … Also control Central Asia and
      // Manchuria."
      {space: "central-asia", control: "RU"},
      {space: "manchuria", control: "RU"},
      // "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Macedonia,
      // Libya, Benghazi, Tunis, and the three Egyptian spaces."
      {space: "serbia", control: "Serbia"},
      {space: "bosnia-herzegovina", control: "Serbia"},
      {space: "bulgaria", control: "Bulgaria"},
      {space: "macedonia", control: "Bulgaria"},
      {space: "egypt", control: "Egypt"},
      {space: "great-sand-sea", control: "Egypt"},
      {space: "sinai", control: "Egypt"},
      // "Italy: Unified.  Control all Italian Unification spaces except
      // Lombardy."
      {space: "lombardy", control: "AU"},
      {space: "piedmont", control: "IT"},
      {space: "tuscany", control: "IT"},
      {space: "naples", control: "IT"},
      // "Japan: 1 army, 2 squadrons."
      {space: "korea", control: "Japan"},
    ],
    powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 3, OT: 0},
    removedCards: [],
    buildBox: [],
    suezComplete: true,
    italy: {unified: true, alliance: "neutral"},
    independentMinors: ["Egypt"],
    independentMinorMarkers: [
      {minor: "Egypt", space: "egypt"},
      {minor: "Egypt", space: "great-sand-sea"},
      {minor: "Egypt", space: "sinai"},
    ],
    special: {
      countVp: true,
      ngDrawTurns: [],
      bloodAndIron: false,
      allowsNoGw: false,
      altGw: {
        // "Alliances: TA: UK and OT. TE: FR and RU. Neutral: GE, AU, and IT."
        te: ["FR", "RU"],
        ta: ["UK", "OT"],
        neutrals: ["GE", "AU"],
        control: {},
        allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
        uncontrolledKeys: {
          GE: {africa: 3, asia: 0},
          UK: {africa: 6, asia: 5},
          FR: {africa: 3, asia: 1},
          RU: {africa: 0, asia: 2},
        },
        buildPoints: {GE: 7, UK: 5, FR: 6, AU: 6, RU: 6, OT: 6},
        units: {
          GE: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 2},
          ],
          UK: [
            {kind: "army", count: 1},
            {kind: "army", count: 4},
            {kind: "expeditionary", count: 4},
            {kind: "squadron", count: 6},
            {kind: "dreadnought", count: 6},
          ],
          FR: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 3},
            {kind: "eliteCorps", count: 2},
            {kind: "expeditionary", count: 3},
            {kind: "squadron", count: 3},
            {kind: "dreadnought", count: 2},
          ],
          AU: [
            {kind: "army", count: 4},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 1},
          ],
          RU: [
            {kind: "army", count: 6},
            {kind: "reserveArmy", count: 4},
            {kind: "eliteCorps", count: 1},
            {kind: "expeditionary", count: 2},
            {kind: "squadron", count: 3},
          ],
          OT: [
            {kind: "army", count: 3},
            {kind: "army", count: 1},
            {kind: "reserveArmy", count: 1},
            {kind: "expeditionary", count: 1},
            {kind: "squadron", count: 2},
            {kind: "dreadnought", count: 1},
          ],
        },
        tsrrComplete: ["RU"],
        minorControl: [
          {space: "serbia", control: "Serbia"},
          {space: "bosnia-herzegovina", control: "Serbia"},
          {space: "bulgaria", control: "Bulgaria"},
          {space: "macedonia", control: "Bulgaria"},
          {space: "korea", control: "Japan"},
          {space: "egypt", control: "Egypt"},
        ],
      },
    },
    notes: [
      "Alliances: TA: UK and OT.  TE: FR and RU.  Neutral: GE and AU (and the non-player Italy).",
      "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.",
      "Uncontrolled keys each power may take: GE 3 Africa; UK 6 Africa + 5 Asia; FR 3 Africa + 1 Asia; RU 2 Asia.",
      "UK also controls all three Egyptian spaces and the Suez Canal is complete.",
      "RU: Trans-Siberian RR: Complete.  Italy is unified and controls all Italian Unification spaces except Lombardy.",
      "Minor powers: Netherlands 1 army, Belgium 1 army, Denmark 1 army, Serbia 2 armies controlling Serbia and Bosnia, Bulgaria 2 armies controlling Bulgaria and Macedonia, Greece 1 army, Persia 1 army, Romania 1 army, Japan 1 army + 2 squadrons.",
      "Printed units per power are in special.altGw.units; their positions are a secret player choice, so the engine places them at the capital and home keys with the printed two-army setup stack limit.",
      "Victory: the team that wins the GW wins the game; all other players lose.",
    ],
  }),
];
