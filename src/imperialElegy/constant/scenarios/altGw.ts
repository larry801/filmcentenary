import type {ScenarioDef, ScenarioUnitSetup} from "./types";

/**
 * Alternate Great War Scenarios 1-3 — `IE_playbook.pdf` pp. 8-10.
 *
 * The printed common procedure (p. 8) is:
 *
 *  1. Initial Control: "take control of all spaces explicitly listed in the
 *     setup".
 *  2. Build Points: "Stability and industry start at the campaign levels (the
 *     circled numbers) for all players.  Players can spend build points to
 *     increase their industry and stability, each build point increases either
 *     industry and stability by one."
 *  3. Taking Control of Uncontrolled Spaces: in turn order players take
 *     uncontrolled keys they can trace a LoC to; "the UK gains control of 2
 *     spaces each time they place markers during this step".
 *  4. Set Manpower: derived from the keys each player controls.
 *  5. Placing Units: "Players will secretly write down the location of their
 *     starting units.  A maximum of 2 armies can be stacked in the same space
 *     during setup.  A maximum of 2 naval units for each player can begin the
 *     game deployed on a submap."
 *
 * "Victory: In the Alternate Great War scenarios the team that wins the GW wins
 * the game, all other players lose."
 *
 * Consequences for the data below:
 *  - `controlOverrides` is the applied control list (step 1); `special.altGw.control`
 *    mirrors the same spaces per power so the printed lists stay readable.
 *  - Steps 3 and 5 make the *player* unit positions a secret choice, so each
 *    power's printed inventory is carried by kind in `special.altGw.units` and
 *    the engine's `placeAltGwInventory` gives it a deterministic legal default.
 *  - The minor powers' printed units have no such freedom: the page names one
 *    counter per minor, placed in that minor's home space, so they are ordinary
 *    `units` rows.
 *  - Steps 2 and 4 leave the track values to the campaign markers, so `powers[]`
 *    carries the campaign circled stability/industry and no manpower (the
 *    engine derives it).
 */

/** The printed "campaign levels (the circled numbers)" — `campaign.ts`. */
const CAMPAIGN_START = {
  GE: {stability: 3, industry: 1},
  UK: {stability: 3, industry: 2},
  FR: {stability: 3, industry: 1},
  AU: {stability: 3, industry: 1},
  RU: {stability: 3, industry: 0},
  OT: {stability: 3, industry: 0},
} as const;

/** One minor power's printed army in its home space. */
const minorArmy = (owner: string, space: string, steps: 1 | 2 = 2): ScenarioUnitSetup => ({
  owner,
  kind: "minorArmy",
  space,
  steps,
});

/** Build one alternate-GW scenario definition (`ALT_GW_SCENARIOS[i]` = altGw(i+1)). */
const altScenario = (def: ScenarioDef): ScenarioDef => def;

// ---------------------------------------------------------------------------
// Scenario 1 (p. 8) — TA: UK, AU, RU / TE: GE, FR, OT
// ---------------------------------------------------------------------------

const ALT_GW_1: ScenarioDef = altScenario({
  id: "altGw1",
  name: "Alternate Great War 1",
  nameZh: "架空大战剧本 1",
  firstTurn: 7,
  lastTurn: 7,
  wtt: 4,
  powers: {
    GE: {...CAMPAIGN_START.GE, alliance: "teCommitted"},
    UK: {...CAMPAIGN_START.UK, alliance: "taCommitted"},
    FR: {...CAMPAIGN_START.FR, alliance: "teCommitted"},
    AU: {...CAMPAIGN_START.AU, alliance: "taCommitted"},
    // "Trans-Siberian RR: Complete"
    RU: {...CAMPAIGN_START.RU, tsrr: true, alliance: "taCommitted"},
    OT: {...CAMPAIGN_START.OT, alliance: "teCommitted"},
  },
  // All six powers' own units are placed by `placeAltGwInventory`; the minor
  // powers' printed counters are concrete.
  units: [
    // "Belgium: 1 army"
    minorArmy("Belgium", "belgium"),
    // "Netherlands: 1 army"
    minorArmy("Netherlands", "netherlands"),
    // "Denmark: 1 army"
    minorArmy("Denmark", "denmark"),
    // "Serbia: controls Serbia and Bosnia.  1 army in Serbia"
    minorArmy("Serbia", "serbia"),
    // "Bavaria: 1 army"
    minorArmy("Bavaria", "bavaria"),
    // "Piedmont-Sardinia: 1 army"
    minorArmy("Sardinia-Piedmont", "piedmont"),
    // "Naples: 1 reduced army"
    minorArmy("Two Sicilies", "naples", 1),
    // "Egypt: 1 army"
    minorArmy("Egypt", "egypt"),
    // "Greece: 1 army"
    minorArmy("Greece", "greece"),
    // "Persia: 1 army"
    minorArmy("Persia", "qajar-persia"),
    // "Romania: 1 Army"
    minorArmy("Romania", "romania"),
    // "Ethiopia: 1 army (these count at Rebels, see x.x)"
    {owner: "REBEL:Ethiopia", kind: "rebelArmy", space: "ethiopia", steps: 2},
    // "Japan: 1 army, 2 squadrons"
    minorArmy("Japan", "japan"),
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
  ],
  forts: [],
  diplomacy: [],
  influence: [],
  pacification: [],
  // "AU: … Alliance with Papal States."  A printed ally marker is applied by
  // the shared setup path (4.8 / 12.5.3); `special.altGw.minorAlliances` keeps
  // the printed line beside it.
  allyMarkers: [{power: "AU", minor: "Papal States", space: "rome"}],
  controlOverrides: [
    // "GE: Control all home spaces plus: Schleswig-Holstein, Hanover, and
    // Saxony."  Bavaria is deliberately NOT named and prints a Bavarian army of
    // its own, so it stays a minor power here.
    {space: "schleswig-holstein", control: "GE"},
    {space: "hanover", control: "GE"},
    {space: "saxony", control: "GE"},
    // "AU: Control all home spaces and Tuscany."
    {space: "tuscany", control: "AU"},
    // "RU: Control all home spaces plus: Central Asia, Manchuria, and Van."
    {space: "central-asia", control: "RU"},
    {space: "manchuria", control: "RU"},
    {space: "van", control: "RU"},
    // "OT: Control all home spaces except Serbia, Bosnia, Van, and the three
    // Egyptian spaces.  Control Somalia and Kuwait."  Kuwait is already OT on
    // the map, so only Somalia is an actual override.
    {space: "somalia", control: "OT"},
    {space: "serbia", control: "Serbia"},
    {space: "bosnia-herzegovina", control: "Serbia"},
    // "Egypt: 1 army" with the three Egyptian spaces outside OT's list.
    {space: "egypt", control: "Egypt"},
    {space: "great-sand-sea", control: "Egypt"},
    {space: "sinai", control: "Egypt"},
    // "Mexico: US control marker"
    {space: "mexico", control: "United States"},
    // "Japan: 1 army, 2 squadrons" — Korea's printed control marker is not
    // repeated in this scenario's list, so it keeps the map default.
  ],
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [],
  buildBox: [],
  // "Suez Canal is complete"
  suezComplete: true,
  // "Italy: Not unified."
  italy: {unified: false},
  // "Egypt: 1 army" plus "Great Sand Sea: IMP marker" and "Sinai: IMP marker".
  independentMinors: ["Egypt"],
  independentMinorMarkers: [
    {minor: "Egypt", space: "great-sand-sea"},
    {minor: "Egypt", space: "sinai"},
  ],
  special: {
    countVp: true,
    // The alternate GWs are won by the Great War's own victory rules, not by
    // the campaign's end-of-turn NG draws.
    ngDrawTurns: [],
    bloodAndIron: false,
    allowsNoGw: false,
    altGw: {
      // "Alliances: TA: UK, AU, and RU.  TE: GE, FR, and OT."
      te: ["GE", "FR", "OT"],
      ta: ["UK", "AU", "RU"],
      neutrals: [],
      control: {
        GE: ["schleswig-holstein", "hanover", "saxony"],
        UK: [],
        FR: [],
        AU: ["tuscany"],
        RU: ["central-asia", "manchuria", "van"],
        OT: ["somalia", "kuwait"],
      },
      // Every power's list starts "Control all home spaces".
      allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
      // "Control four uncontrolled keys: three in Africa, one in Asia" (GE) /
      // "seven uncontrolled keys (four in Africa, three in Asia)" (UK) /
      // "six … (four in Africa, two in Asia)" (FR) / "one other … in Asia" (RU).
      uncontrolledKeys: {
        GE: {africa: 3, asia: 1},
        UK: {africa: 4, asia: 3},
        FR: {africa: 4, asia: 2},
        RU: {africa: 0, asia: 1},
      },
      buildPoints: {GE: 7, UK: 5, FR: 6, AU: 6, RU: 6, OT: 6},
      // "Units: …" per power, verbatim.  The UK's "1 British, 3 Indian" and the
      // OT's "3 Turkish armies, 1 Arab army" and FR's "3 EFs (including the
      // Zouaves)" name counter types this per-kind inventory cannot split, so
      // they are counted together and the split is recorded in `notes`.
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
          // "1 British, 3 Indian"
          {kind: "army", count: 1},
          {kind: "army", count: 3, flags: {indian: true}},
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
          // "3 Turkish armies, 1 Arab army"
          {kind: "army", count: 3},
          {kind: "army", count: 1, flags: {arab: true}},
          {kind: "reserveArmy", count: 2},
          {kind: "expeditionary", count: 1},
          {kind: "squadron", count: 1},
        ],
      },
      tsrrComplete: ["RU"],
      // "AU: Alliance with Papal States."
      minorAlliances: [{power: "AU", minor: "Papal States"}],
      // The minor-power control markers the player lists do not name.
      minorControl: [
        {space: "serbia", control: "Serbia"},
        {space: "bosnia-herzegovina", control: "Serbia"},
        {space: "egypt", control: "Egypt"},
        {space: "great-sand-sea", control: "Egypt"},
        {space: "sinai", control: "Egypt"},
        {space: "mexico", control: "United States"},
      ],
    },
  },
  notes: [
    "Alliances: TA: UK, AU, and RU.  TE: GE, FR, and OT (playbook p. 8).",
    "Victory: the team that wins the GW wins the game; all other players lose.",
    "Italy is not unified in this scenario.",
    "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.  Stability and industry start at the campaign circled values; each build point raises industry or stability by one.",
    "Uncontrolled keys each power may take: GE three in Africa and one in Asia; UK four in Africa and three in Asia; FR four in Africa and two in Asia; RU one in Asia.  The UK takes two spaces each time it places markers during that step.",
    "RU: Trans-Siberian RR: Complete.  RU also controls Central Asia, Manchuria and Van.",
    "AU: Control all home spaces and Tuscany; Alliance with the Papal States.",
    "GE: Control all home spaces plus Schleswig-Holstein, Hanover and Saxony.  Bavaria is not named and prints its own army, so it stays a Bavarian minor power.",
    "OT: Control all home spaces except Serbia, Bosnia, Van and the three Egyptian spaces; plus Somalia and Kuwait.  Serbia controls Serbia and Bosnia.",
    "Suez Canal is complete.  Great Sand Sea and Sinai carry Egypt's IMP markers.",
    "Minor powers: Belgium 1 army; Netherlands 1 army; Denmark 1 army; Serbia 1 army in Serbia; Bavaria 1 army; Piedmont-Sardinia 1 army; Naples 1 reduced army; Egypt 1 army; Greece 1 army; Persia 1 army; Romania 1 army; Ethiopia 1 army (these count as Rebels); Mexico under US control; Japan 1 army and 2 squadrons.",
    "A player's printed unit inventory is in `special.altGw.units`; the printed step 5 makes its positions a secret player choice, so `units` holds no player rows and `engine/scenario.ts#placeAltGwInventory` places them deterministically at the capital and the power's controlled home keys, at most two armies per space and within the normal stacking/port limits (the printed setup stack limit).",
    "Printed step 3 (taking the listed uncontrolled keys in turn order, UK two per placement, LoC required) is applied by `engine/scenario.ts#applyAltGwUncontrolledSpaces` as the deterministic legal default; printed step 4 then derives manpower from the final control markers.  Step 2's build points are real decisions: they are offered from the opening Great War planning step and each one raises stability or industry by one.",
    "The inventories count counter types this per-kind field cannot split: the UK row is \"1 British, 3 Indian, 3 EFs, 5 squadrons and 4 dreadnoughts\" (the 3 Indian armies are recorded as plain armies), FR's \"3 EFs (including the Zouaves)\" is 3 expeditionary rows with no Zouave marker, and OT's \"3 Turkish armies, 1 Arab army\" is two army rows with no Arab marker.",
    "Minor powers' control markers that no player list names (Serbia, Bosnia, the three Egyptian spaces, Mexico) are in `controlOverrides` and mirrored in `special.altGw.minorControl`.",
    "Power Projection is not printed for the alternate setups; the engine derives it from port control and naval units at the first end phase.",
  ],
});

// ---------------------------------------------------------------------------
// Scenario 2 (p. 9) — Independent Poland.  TA: RU, GE / TE: FR, AU
// ---------------------------------------------------------------------------

const ALT_GW_2: ScenarioDef = altScenario({
  id: "altGw2",
  name: "Alternate Great War 2 — Independent Poland",
  nameZh: "架空大战剧本 2 — 独立波兰",
  firstTurn: 7,
  lastTurn: 7,
  wtt: 4,
  powers: {
    GE: {...CAMPAIGN_START.GE, alliance: "taCommitted"},
    UK: {...CAMPAIGN_START.UK, alliance: "neutral"},
    FR: {...CAMPAIGN_START.FR, alliance: "teCommitted"},
    AU: {...CAMPAIGN_START.AU, alliance: "teCommitted"},
    RU: {...CAMPAIGN_START.RU, tsrr: true, alliance: "taCommitted"},
    OT: {...CAMPAIGN_START.OT, alliance: "neutral"},
  },
  units: [
    // "Netherlands: 1 army"
    minorArmy("Netherlands", "netherlands"),
    // "Denmark: 1 army"
    minorArmy("Denmark", "denmark"),
    // "Serbia: 1 army"
    minorArmy("Serbia", "serbia"),
    // "Bulgaria: 1 army"
    minorArmy("Bulgaria", "bulgaria"),
    // "Greece: 1 army"
    minorArmy("Greece", "greece"),
    // "Persia: 1 army"
    minorArmy("Persia", "qajar-persia"),
    // "Romania: 1 Army"
    minorArmy("Romania", "romania"),
    // "Poland: 2 armies and an IMP marker" / "Western Ukraine: 1 army and an
    // IMP marker" / "1 reserve army"
    {owner: "Poland", kind: "army", space: "poland", steps: 2},
    {owner: "Poland", kind: "army", space: "poland", steps: 2},
    {owner: "Poland", kind: "army", space: "west-ukraine", steps: 2},
    // 22.5(1): the Polish reserve counter waits in the Polish reserve armies
    // holding box at its printed reduced strength.
    {owner: "Poland", kind: "reserveArmy", space: null, steps: 1},
    // "Japan: 1 army, 2 squadrons, control marker in Korea"
    minorArmy("Japan", "japan"),
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
  ],
  forts: [],
  diplomacy: [],
  influence: [],
  pacification: [],
  // "Independent Poland … Poland begins the scenario at war and allied with
  // AU."  The alliance is a printed ally marker in Poland's space.
  allyMarkers: [{power: "AU", minor: "Poland", space: "poland"}],
  controlOverrides: [
    // "GE: Control all home German Unification Spaces."  Those are the map's
    // Germany-flashpoint spaces: Hanover, Saxony, Bavaria, Silesia and
    // Schleswig-Holstein (Silesia is already a GE home key).
    {space: "hanover", control: "GE"},
    {space: "saxony", control: "GE"},
    {space: "bavaria", control: "GE"},
    {space: "schleswig-holstein", control: "GE"},
    // "FR: Control all home spaces except Alsace-Lorraine.  Control Belgium."
    // Alsace-Lorraine is the one German-held French home space (see notes).
    {space: "alsace-lorraine", control: "GE"},
    {space: "belgium", control: "FR"},
    // "… AND all three Egyptian spaces (the Suez Canal is complete)."
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
    // Ukraine: 1 army and an IMP marker", "Belorussia: IMP marker".
    {space: "poland", control: "Poland"},
    {space: "west-ukraine", control: "Poland"},
    {space: "belorussia", control: "Poland"},
    // "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Libya,
    // Benghazi, Cyprus, and the three Egyptian spaces.  Control Somalia and
    // Kuwait."  Kuwait is already OT on the map, so only Somalia is an override.
    {space: "serbia", control: "Serbia"},
    {space: "bulgaria", control: "Bulgaria"},
    {space: "tripoli", control: "IT"},
    {space: "benghazi", control: "IT"},
    {space: "cyprus", control: "IT"},
    {space: "somalia", control: "OT"},
    // "Italy: Unified.  Control all Italian Unification spaces plus Libya,
    // Benghazi, and Cyprus."
    {space: "piedmont", control: "IT"},
    {space: "tuscany", control: "IT"},
    {space: "rome", control: "IT"},
    {space: "naples", control: "IT"},
    // "Japan: … control marker in Korea."
    {space: "korea", control: "Japan"},
  ],
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [],
  buildBox: [],
  // "(the Suez Canal is complete)"
  suezComplete: true,
  // "Italy: Unified".  Italy is a non-player power and this scenario's
  // Alliance Track line puts it in the neutral box ("Neutral: UK, OT, and IT"),
  // so only `unified` is written: `engine/greatWar.ts#beginScenarioGw` treats a
  // present `italy.alliance` as "Italy is in the war".
  italy: {unified: true},
  // "Belorussia: IMP marker" and the two Polish IMP markers.
  independentMinors: ["Poland"],
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
      // "Alliances: TA: RU and GE.  TE: FR and AU.  Neutral: UK, OT, and IT."
      te: ["FR", "AU"],
      ta: ["RU", "GE"],
      neutrals: ["UK", "OT"],
      control: {
        GE: ["hanover", "saxony", "bavaria", "schleswig-holstein"],
        UK: [],
        FR: ["belgium", "egypt", "great-sand-sea", "sinai"],
        AU: ["bosnia-herzegovina"],
        RU: ["central-asia", "manchuria"],
        OT: ["somalia", "kuwait"],
        Italy: ["piedmont", "tuscany", "rome", "naples", "tripoli", "benghazi", "cyprus"],
      },
      // Every power's list starts "Control all home spaces" (GE's says "all home
      // German Unification Spaces", FR's and AU's carry one exception each).
      allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
      // "Control three uncontrolled keys: three in Africa" (GE) / "nine
      // uncontrolled keys (five in Africa, four in Asia)" (UK) / "five … (three
      // in Africa, two in Asia)" (FR) / "one other … in Asia" (RU).
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
          // "1 British, 3 Indian"
          {kind: "army", count: 1},
          {kind: "army", count: 3, flags: {indian: true}},
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
          // "3 Turkish armies, 1 Arab army"
          {kind: "army", count: 3},
          {kind: "army", count: 1, flags: {arab: true}},
          {kind: "reserveArmy", count: 2},
          {kind: "expeditionary", count: 1},
          {kind: "squadron", count: 2},
          {kind: "dreadnought", count: 1},
        ],
        // "Italy: Unified.  … Units: 3 armies, 2 reserve armies, 1 EF, 3
        // squadrons and 1 dreadnought."
        Italy: [
          {kind: "italianArmy", count: 3},
          {kind: "reserveArmy", count: 2},
          {kind: "expeditionary", count: 1},
          {kind: "squadron", count: 3},
          {kind: "dreadnought", count: 1},
        ],
      },
      tsrrComplete: ["RU"],
      // "Poland begins the scenario at war and allied with AU."  The page names
      // no attacker; Russia is the neighbouring Triple Alliance power whose
      // home list gives up Poland, Western Ukraine and Belorussia.
      startingWars: [{attacker: "RU", defender: "Poland", minorTarget: {minor: "Poland", ally: "AU"}}],
      minorAlliances: [{power: "AU", minor: "Poland"}],
      independentPoland: true,
      minorControl: [
        {space: "poland", control: "Poland"},
        {space: "west-ukraine", control: "Poland"},
        {space: "belorussia", control: "Poland"},
        {space: "serbia", control: "Serbia"},
        {space: "bulgaria", control: "Bulgaria"},
        {space: "korea", control: "Japan"},
      ],
    },
  },
  notes: [
    "Alliances: TA: RU and GE.  TE: FR and AU.  Neutral: UK and OT (and the non-player Italy).",
    "Independent Poland: \"Poland begins the scenario at war and allied with AU.\"  Poland controls Poland, Western Ukraine and Belorussia, holds 2 armies in Poland, 1 army in Western Ukraine and 1 reserve army, and Belorussia carries the IMP marker.",
    "Victory: the team that wins the GW wins the game; all other players lose.",
    "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.",
    "Uncontrolled keys each power may take: GE three in Africa; UK five in Africa and four in Asia; FR three in Africa and two in Asia; RU one in Asia.  The UK takes two spaces each time it places markers during that step.",
    "GE: Control all home German Unification Spaces — Hanover, Saxony, Bavaria, Silesia and Schleswig-Holstein.",
    "FR: Control all home spaces except Alsace-Lorraine, control Belgium, and control the three Egyptian spaces (Suez Canal complete).  Alsace-Lorraine is German in this setup (FR's own list is the only one that names it, as an exception), which is why it is a GE control marker.",
    "AU: Control all home spaces except Lombardy (which is Italian) and control Bosnia.",
    "RU: Control all home spaces except Poland, Western Ukraine and Belorussia; also Central Asia and Manchuria.  Trans-Siberian RR: Complete.",
    "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Libya (Tripoli), Benghazi, Cyprus and the three Egyptian spaces; plus Somalia and Kuwait.",
    "Italy: Unified.  Control all Italian Unification spaces plus Libya, Benghazi and Cyprus; 3 armies, 2 reserve armies, 1 EF, 3 squadrons and 1 dreadnought.",
    "Minor powers: Netherlands 1 army; Denmark 1 army; Serbia 1 army; Bulgaria 1 army; Greece 1 army; Persia 1 army; Romania 1 army; Poland 2 armies in Poland, 1 in Western Ukraine and 1 reserve army; Japan 1 army, 2 squadrons and a control marker in Korea.",
    "A player's printed unit inventory is in `special.altGw.units`; the printed step 5 makes its positions a secret player choice, so `units` holds no player rows and `engine/scenario.ts#placeAltGwInventory` places them deterministically at the capital and the power's controlled home keys, at most two armies per space.",
    "Italy (a non-player power) prints its own inventory, carried under the `Italy` key of `special.altGw.units`.  `engine/setup.ts` places it through the 22.4 Italian deployment order (Rome/frontier armies, Naples or Piedmont fleet) and marks Italy `italyUnified` at runtime.",
    "`startingWars` records Poland at war: the page does not name the attacker, so RU (the Triple Alliance neighbour that gives up Poland, Western Ukraine and Belorussia) is recorded, with Poland's printed AU ally.",
    "The inventories count counter types this per-kind field cannot split: the UK's \"1 British, 3 Indian\" and OT's \"3 Turkish armies, 1 Arab army\" are recorded as plain army rows, and FR's \"3 EFs (including the Zouaves)\" as 3 expeditionary rows.",
    "There is no \"Bavaria\" or \"Hanover\"/\"Saxony\" minor army in this setup: those spaces are German unification spaces under GE control.",
    "Power Projection is not printed for the alternate setups; the engine derives it from the board.",
  ],
});

// ---------------------------------------------------------------------------
// Scenario 3 (p. 10) — Colonial War.  TA: UK, OT / TE: FR, RU
// ---------------------------------------------------------------------------

const ALT_GW_3: ScenarioDef = altScenario({
  id: "altGw3",
  name: "Alternate Great War 3 — Colonial War",
  nameZh: "架空大战剧本 3 — 殖民战争",
  firstTurn: 7,
  lastTurn: 7,
  wtt: 4,
  powers: {
    GE: {...CAMPAIGN_START.GE, alliance: "neutral"},
    UK: {...CAMPAIGN_START.UK, alliance: "taCommitted"},
    FR: {...CAMPAIGN_START.FR, alliance: "teCommitted"},
    AU: {...CAMPAIGN_START.AU, alliance: "neutral"},
    RU: {...CAMPAIGN_START.RU, tsrr: true, alliance: "teCommitted"},
    OT: {...CAMPAIGN_START.OT, alliance: "taCommitted"},
  },
  units: [
    // "Netherlands: 1 army"
    minorArmy("Netherlands", "netherlands"),
    // "Belgium: 1 army"
    minorArmy("Belgium", "belgium"),
    // "Denmark: 1 army"
    minorArmy("Denmark", "denmark"),
    // "Serbia: 2 armies, control Serbia and Bosnia"
    minorArmy("Serbia", "serbia"),
    minorArmy("Serbia", "serbia"),
    // "Bulgaria: 2 armies, control Bulgaria and Macedonia"
    minorArmy("Bulgaria", "bulgaria"),
    minorArmy("Bulgaria", "bulgaria"),
    // "Greece: 1 army"
    minorArmy("Greece", "greece"),
    // "Persia: 1 army"
    minorArmy("Persia", "qajar-persia"),
    // "Romania: 1 army"
    minorArmy("Romania", "romania"),
    // "Japan: 1 army, 2 squadrons"
    minorArmy("Japan", "japan"),
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
    {owner: "Japan", kind: "squadron", space: "japan", steps: 2},
  ],
  forts: [],
  diplomacy: [],
  influence: [],
  pacification: [],
  controlOverrides: [
    // "GE: Control all home German Unification Spaces except Alsace-Lorraine."
    {space: "hanover", control: "GE"},
    {space: "saxony", control: "GE"},
    {space: "bavaria", control: "GE"},
    {space: "schleswig-holstein", control: "GE"},
    // "FR: Control all home spaces.  Control Tunis and Morocco."
    {space: "tunisia", control: "FR"},
    {space: "morocco", control: "FR"},
    // "UK: … AND all three Egyptian spaces (the Suez Canal is complete)."
    {space: "egypt", control: "UK"},
    {space: "great-sand-sea", control: "UK"},
    {space: "sinai", control: "UK"},
    // "RU: Control all home spaces.  Also control Central Asia and Manchuria."
    {space: "central-asia", control: "RU"},
    {space: "manchuria", control: "RU"},
    // "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Macedonia,
    // Libya, Benghazi, Tunis, and the three Egyptian spaces."
    {space: "serbia", control: "Serbia"},
    {space: "bosnia-herzegovina", control: "Serbia"},
    {space: "bulgaria", control: "Bulgaria"},
    {space: "macedonia", control: "Bulgaria"},
    // "Libya" (Tripoli) and Benghazi are excluded from OT's list and given to no
    // one, and Tunis is French: all three are uncontrolled / French here, not
    // the map's Ottoman defaults.
    {space: "tripoli", control: null},
    {space: "benghazi", control: null},
    // "Italy: Unified.  Control all Italian Unification spaces except Lombardy."
    // AU's map default already holds Lombardy, so it needs no override here.
    {space: "piedmont", control: "IT"},
    {space: "tuscany", control: "IT"},
    {space: "rome", control: "IT"},
    {space: "naples", control: "IT"},
  ],
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [],
  buildBox: [],
  // "(the Suez Canal is complete)"
  suezComplete: true,
  // "Italy: Unified".  Non-player power in the neutral box, so only `unified`
  // is written (see the note on scenario 2's `italy`).
  italy: {unified: true},
  special: {
    countVp: true,
    ngDrawTurns: [],
    bloodAndIron: false,
    allowsNoGw: false,
    altGw: {
      // "Alliances: TA: UK and OT.  TE: FR and RU.  Neutral: GE, AU, and IT."
      te: ["FR", "RU"],
      ta: ["UK", "OT"],
      neutrals: ["GE", "AU"],
      control: {
        GE: ["hanover", "saxony", "bavaria", "schleswig-holstein"],
        UK: ["egypt", "great-sand-sea", "sinai"],
        FR: ["tunisia", "morocco"],
        AU: [],
        RU: ["central-asia", "manchuria"],
        OT: [],
        Italy: ["piedmont", "tuscany", "rome", "naples"],
      },
      // Every power's list starts "Control all home spaces".
      allHomeSpaces: {GE: true, UK: true, FR: true, AU: true, RU: true, OT: true},
      // "Control three uncontrolled keys: three in Africa" (GE) / "eleven
      // uncontrolled keys (six in Africa, five in Asia)" (UK) / "four … (three in
      // Africa, one in Asia)" (FR) / "two other … in Asia" (RU).
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
          // "1 British, 4 Indian"
          {kind: "army", count: 1},
          {kind: "army", count: 4, flags: {indian: true}},
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
          // "3 Turkish armies, 1 Arab army"
          {kind: "army", count: 3},
          {kind: "army", count: 1, flags: {arab: true}},
          {kind: "reserveArmy", count: 1},
          {kind: "expeditionary", count: 1},
          {kind: "squadron", count: 2},
          {kind: "dreadnought", count: 1},
        ],
        // "Italy: Unified.  … Units: 3 armies, 2 reserve armies, 1 EF, 3
        // squadrons and 1 dreadnought."
        Italy: [
          {kind: "italianArmy", count: 3},
          {kind: "reserveArmy", count: 2},
          {kind: "expeditionary", count: 1},
          {kind: "squadron", count: 3},
          {kind: "dreadnought", count: 1},
        ],
      },
      tsrrComplete: ["RU"],
      minorControl: [
        {space: "serbia", control: "Serbia"},
        {space: "bosnia-herzegovina", control: "Serbia"},
        {space: "bulgaria", control: "Bulgaria"},
        {space: "macedonia", control: "Bulgaria"},
      ],
    },
  },
  notes: [
    "Alliances: TA: UK and OT.  TE: FR and RU.  Neutral: GE and AU (and the non-player Italy).",
    "Victory: the team that wins the GW wins the game; all other players lose.",
    "Build Points: GE 7, UK 5, FR 6, AU 6, RU 6, OT 6.",
    "Uncontrolled keys each power may take: GE three in Africa; UK six in Africa and five in Asia; FR three in Africa and one in Asia; RU two in Asia.  The UK takes two spaces each time it places markers during that step.",
    "UK also controls all three Egyptian spaces and the Suez Canal is complete.",
    "GE: Control all home German Unification Spaces except Alsace-Lorraine; Alsace-Lorraine is a French home space here.",
    "RU: Control all home spaces, Central Asia and Manchuria.  Trans-Siberian RR: Complete.",
    "OT: Control all home spaces except Bosnia, Serbia, Bulgaria, Macedonia, Libya (Tripoli), Benghazi, Tunis and the three Egyptian spaces.  Tripoli, Benghazi and Tunis are therefore not Ottoman: Tunis is French and Tripoli/Benghazi are left uncontrolled.",
    "Italy: Unified.  Control all Italian Unification spaces except Lombardy (which is Austrian); 3 armies, 2 reserve armies, 1 EF, 3 squadrons and 1 dreadnought.",
    "Minor powers: Netherlands 1 army; Belgium 1 army; Denmark 1 army; Serbia 2 armies controlling Serbia and Bosnia; Bulgaria 2 armies controlling Bulgaria and Macedonia; Greece 1 army; Persia 1 army; Romania 1 army; Japan 1 army and 2 squadrons.",
    "A player's printed unit inventory is in `special.altGw.units` (Italy's included, under the \"Italy\" key); the printed step 5 makes its positions a secret player choice, so `units` holds no player rows and `engine/scenario.ts#placeAltGwInventory` places them deterministically at the capital and the power's controlled home keys, at most two armies per space.",
    "Italy (a non-player power) prints its own inventory under the `Italy` key of `special.altGw.units`; `engine/setup.ts` places it through the 22.4 Italian deployment order and marks Italy `italyUnified` at runtime.",
    "The inventories count counter types this per-kind field cannot split: the UK's \"1 British, 4 Indian\" and OT's \"3 Turkish armies, 1 Arab army\" are recorded as plain army rows, and FR's \"3 EFs (including the Zouaves)\" as 3 expeditionary rows.",
    "This setup prints no IMP markers, so no minor power is independent at the start (the three Egyptian spaces are British).",
    "Power Projection is not printed for the alternate setups; the engine derives it from the board.",
  ],
});

export const ALT_GW_SCENARIOS: ScenarioDef[] = [ALT_GW_1, ALT_GW_2, ALT_GW_3];
