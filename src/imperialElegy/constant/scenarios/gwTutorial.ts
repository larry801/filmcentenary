import type {ScenarioDef} from "./types";

/**
 * Historical Great War (GW Tutorial) — `IE_playbook.pdf` p. 7.
 *
 * "Start this scenario with the Maneuver Step of GW turn 0.  The setup takes
 * into account the Outbreak Step of the GW, including the National Will Step and
 * the UK Rapid Deployment national characteristic."
 *
 * This is therefore not a pre-war scenario with a Great War bolted on: when play
 * begins the war is already running, the Outbreak and National Will steps are
 * already resolved and the printed wartime initiative order is standing.  The
 * data below is transcribed display by display, in printed order, and every
 * printed unit/fort/control marker is expressed concretely.
 *
 * Unlike the campaign, this page prints no key totals: the six powers' starting
 * `territorialKeys`/`colonialKeys` are derived from the board by
 * `engine/rules.ts#recomputeTracks`, so they are deliberately omitted here
 * instead of being written as numbers the page does not show.
 */
export const GW_TUTORIAL_SCENARIO: ScenarioDef = {
  id: "gwTutorial",
  name: "Historical Great War",
  nameZh: "历史大战剧本",
  // The scenario follows the seven campaign turns and opens at the Great War
  // that comes after turn 7 (playbook p. 7: "Maneuver Step of GW turn 0").
  firstTurn: 7,
  lastTurn: 7,
  // Rule 25.7 steps the WTT back down once the war has begun.
  wtt: 4,
  powers: {
    // GE: Stability 6, Industry 7, Manpower 5.  Germany is unified in 1914: the
    // printed 4 dreadnoughts (+ 3 more) exceed the 2/2 pre-unification naval
    // limit of rule 4.2, so the setup only makes sense with GE.unified.
    GE: {
      stability: 6,
      manpower: 5,
      industry: 7,
      unified: true,
      alliance: "taCommitted",
    },
    // UK: Stability 6, Industry 5, Brit. Manpower 3, Col. Manpower 3.  "Indian
    // Stability marker on its stable side" is the `createEmptyPowerState`
    // default (`indiaStable: true`).
    UK: {
      stability: 6,
      manpower: 3,
      secondaryManpower: 3,
      industry: 5,
      alliance: "teCommitted",
    },
    // FR: Stability 5, Industry 5, Manpower 4.
    FR: {stability: 5, manpower: 4, industry: 5, alliance: "teCommitted"},
    // AU: Stability 5, Industry 4, Manpower 4.
    AU: {stability: 5, manpower: 4, industry: 4, alliance: "taCommitted"},
    // RU: Stability 5, Industry 4, Manpower 6, "TSRR: Built".
    RU: {stability: 5, manpower: 6, industry: 4, tsrr: true, alliance: "teCommitted"},
    // OT: Stability 5, Industry 3, Turkish Manpower 3, Arab Manpower 1.
    OT: {
      stability: 5,
      manpower: 3,
      secondaryManpower: 1,
      industry: 3,
      // "OT will join the Triple Alliance during the winter step of GW turn 0":
      // at the opening maneuver step its chit is still in the neutral box.
      alliance: "neutral",
    },
  },
  units: [
    // ------------------------------------------------------------------ Germany
    // "Pomerania: 1 army, 1 EC"
    {owner: "GE", kind: "army", space: "pomerania", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "pomerania", steps: 1},
    // "Alsace Lorraine: 1 army, level 2 fort"
    {owner: "GE", kind: "army", space: "alsace-lorraine", steps: 2},
    // "Westphalia: 3 armies, 2 ECs"
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "army", space: "westphalia", steps: 2},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    {owner: "GE", kind: "eliteCorps", space: "westphalia", steps: 1},
    // "Hanover: 3 dreadnoughts, 1 squadron".  Hanover is a land key with no
    // printed port on this map, but the page places the German fleet there, so
    // the naval units are transcribed exactly as printed (see notes).
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
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},
    {owner: "GE", kind: "reserveArmy", space: null, steps: 2},

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
    // "Mediterranean: 1 dreadnought, 1 squadron" — the print names the sea, not
    // one of the two Mediterranean boxes; the map has no space called
    // "Mediterranean", so the Western Mediterranean Box (Malta's box, where the
    // campaign setup puts the UK squadron) is used.  See notes.
    {owner: "UK", kind: "dreadnought", space: "western-mediterranean", steps: 2},
    {owner: "UK", kind: "squadron", space: "western-mediterranean", steps: 2},
    // "Singapore: 1 squadron"
    {owner: "UK", kind: "squadron", space: "singapore", steps: 2},
    // "India: 2 Indian armies, Level 1 Indian Fort"
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    {owner: "UK", kind: "army", space: "india", steps: 2, special: "indian"},
    // "Nigeria: 1 EF, control marker"
    {owner: "UK", kind: "expeditionary", space: "nigeria", steps: 1},
    // "Sudan: 1 EF, control marker"
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
    // "West Congo: 1 EF, French control"
    {owner: "FR", kind: "expeditionary", space: "west-congo", steps: 1},
    // "West Africa: 1 EF, French control"
    {owner: "FR", kind: "expeditionary", space: "west-africa", steps: 1},
    // "Reserve Armies: 4"
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},
    {owner: "FR", kind: "reserveArmy", space: null, steps: 2},

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
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "AU", kind: "reserveArmy", space: null, steps: 2},

    // ------------------------------------------------------------------- Russia
    // "St. Petersburg: 1 army, 1 squadron"
    {owner: "RU", kind: "army", space: "st-petersburg", steps: 2},
    {owner: "RU", kind: "squadron", space: "st-petersburg", steps: 2},
    // "Riga: 1 army, level 2 fort"
    {owner: "RU", kind: "army", space: "riga", steps: 2},
    // "West Ukraine: 1 army, 1 EC, level 1 fort"
    {owner: "RU", kind: "army", space: "west-ukraine", steps: 2},
    {owner: "RU", kind: "eliteCorps", space: "west-ukraine", steps: 1},
    // "Kharkov: 1 army"
    {owner: "RU", kind: "army", space: "kharkov", steps: 2},
    // "Georgia: 1 army"
    {owner: "RU", kind: "army", space: "georgia", steps: 2},
    // "Poland: 1 army, level 2 fort"
    {owner: "RU", kind: "army", space: "poland", steps: 2},
    // "Sevastopol: 1 squadron"
    {owner: "RU", kind: "squadron", space: "sevastopol", steps: 2},
    // "Russian Far East: 1 EF"
    {owner: "RU", kind: "expeditionary", space: "russian-far-east", steps: 1},
    // "Central Asia: 1 EF, control marker"
    {owner: "RU", kind: "expeditionary", space: "central-asia", steps: 1},
    // "Reserve Armies: 6"
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},
    {owner: "RU", kind: "reserveArmy", space: null, steps: 2},

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
    {owner: "OT", kind: "reserveArmy", space: null, steps: 2, special: "arab"},

    // ------------------------------------------------------------------- Italy
    // Italy is a non-player power here (unified, neutral box): its counters use
    // owner "IT" / kind "italianArmy", exactly as the 1870 and 1880 setups do.
    // "Tuscany: 1 army", "Piedmont: 1 army", "Lombardy: 1 army"
    {owner: "IT", kind: "italianArmy", space: "tuscany", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "piedmont", steps: 2},
    {owner: "IT", kind: "italianArmy", space: "lombardy", steps: 2},
    // "Naples, 1 dreadnought, 2 squadrons"
    {owner: "IT", kind: "dreadnought", space: "naples", steps: 2},
    {owner: "IT", kind: "squadron", space: "naples", steps: 2},
    {owner: "IT", kind: "squadron", space: "naples", steps: 2},
    // "Reserve Armies: 1".  Italy has no player seat, so this counter stays in
    // the non-player counter pool rather than a player's reserve box (see notes).
    {owner: "IT", kind: "reserveArmy", space: null, steps: 2},

    // ------------------------------------------------------------- Minor powers
    // "Belgium: 1 army, control marker in Congo" — the army belongs to the
    // "Belgium:" bullet, so it stands in Belgium; only the control marker is
    // printed for the Congo.
    {owner: "Belgium", kind: "minorArmy", space: "belgium", steps: 2},
    // "Netherlands: 1 army"
    {owner: "Netherlands", kind: "minorArmy", space: "netherlands", steps: 2},
    // "Denmark: 1 army"
    {owner: "Denmark", kind: "minorArmy", space: "denmark", steps: 2},
    // "Serbia: 2 armies"
    {owner: "Serbia", kind: "minorArmy", space: "serbia", steps: 2},
    {owner: "Serbia", kind: "minorArmy", space: "serbia", steps: 2},
    // "Bulgaria: 2 armies"
    {owner: "Bulgaria", kind: "minorArmy", space: "bulgaria", steps: 2},
    {owner: "Bulgaria", kind: "minorArmy", space: "bulgaria", steps: 2},
    // "Romania: 2 armies"
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
    // GE
    {space: "prussia", power: "GE", level: 2},
    {space: "silesia", power: "GE", level: 2},
    {space: "alsace-lorraine", power: "GE", level: 2},
    // FR
    {space: "champagne", power: "FR", level: 2},
    {space: "burgundy", power: "FR", level: 1},
    {space: "provence", power: "FR", level: 2},
    // AU
    {space: "galicia", power: "AU", level: 1},
    {space: "croatia", power: "AU", level: 2},
    {space: "tyrol", power: "AU", level: 2},
    // RU
    {space: "riga", power: "RU", level: 2},
    {space: "west-ukraine", power: "RU", level: 1},
    {space: "poland", power: "RU", level: 2},
    // OT
    {space: "istanbul", power: "OT", level: 1},
    // UK — "Level 1 Indian Fort" (33.2.3: the Indian fort never degrades).
    {space: "india", power: "UK", level: 1, indian: true},
  ],
  diplomacy: [
    // "Belgium: diplomacy marker" (printed on the UK display).
    {power: "UK", space: "belgium"},
  ],
  // The page prints no influence or pacification markers for this setup:
  // "West Congo"/"West Africa: 1 EF, French control" are control markers, not
  // the campaign's influence marker in West Africa.
  influence: [],
  pacification: [],
  controlOverrides: [
    // ------------------------------------------------------------- Germany
    // "Other control markers: All German home spaces, Caroline Islands, New
    // Guinea".  The five German home keys are already GE on the map, but the
    // German unification spaces (Hanover, Saxony, Bavaria) and
    // Schleswig-Holstein print as minors/Danish by default and are German in
    // 1914 — the page's own "All German home spaces" plus the German units it
    // prints in Hanover and Schleswig-Holstein require them.
    {space: "hanover", control: "GE"},
    {space: "saxony", control: "GE"},
    {space: "bavaria", control: "GE"},
    {space: "schleswig-holstein", control: "GE"},
    {space: "caroline-islands", control: "GE"},
    {space: "new-guinea", control: "GE"},
    // "Cameroon: 1 EF, control marker" / "East Africa: … control marker" /
    // "Southwest Africa: … control marker"
    {space: "cameroon", control: "GE"},
    {space: "east-africa", control: "GE"},
    {space: "southwest-africa", control: "GE"},

    // --------------------------------------------------------------- Britain
    // "Other control markers: Cyprus, Fiji, Balochistan, Oman, Aden, Kuwait,
    // Great Sand Sea, Sinai, Shanghai, Shandong Peninsula".  Fiji has no space
    // on this map (see notes), so the remaining nine are transcribed.
    {space: "cyprus", control: "UK"},
    {space: "balochistan", control: "UK"},
    {space: "oman", control: "UK"},
    {space: "aden", control: "UK"},
    {space: "kuwait", control: "UK"},
    {space: "great-sand-sea", control: "UK"},
    {space: "sinai", control: "UK"},
    {space: "shanghai", control: "UK"},
    {space: "shandong-peninsula", control: "UK"},
    // "Nigeria: 1 EF, control marker" / "Sudan: 1 EF, control marker" /
    // "Rhodesia: control marker" / "Egypt: 1 EF, control marker".
    {space: "nigeria", control: "UK"},
    {space: "sudan", control: "UK"},
    {space: "rhodesia", control: "UK"},
    {space: "egypt", control: "UK"},

    // ---------------------------------------------------------------- France
    // "Other control markers: Morocco, Tunisia, Madagascar, Indochina,
    // Guangzhou" plus the printed "West Congo: … French control" and
    // "West Africa: … French control".
    {space: "morocco", control: "FR"},
    {space: "tunisia", control: "FR"},
    {space: "madagascar", control: "FR"},
    {space: "indochina", control: "FR"},
    {space: "guangzhou", control: "FR"},
    {space: "west-congo", control: "FR"},
    {space: "west-africa", control: "FR"},

    // --------------------------------------------------------- Austria-Hungary
    // "Bosnia: 1 army, AU control"
    {space: "bosnia-herzegovina", control: "AU"},

    // ---------------------------------------------------------------- Russia
    // "Other control markers: Manchuria" / "Central Asia: 1 EF, control marker"
    {space: "manchuria", control: "RU"},
    {space: "central-asia", control: "RU"},

    // ----------------------------------------------------------------- Italy
    // "Control markers: all Italian home spaces, Tripoli, Benghazi, Somalia".
    // The Italian home spaces on this map are the five unification spaces, whose
    // defaults are the four Italian minors plus AU (Lombardy).
    {space: "piedmont", control: "IT"},
    {space: "lombardy", control: "IT"},
    {space: "tuscany", control: "IT"},
    {space: "rome", control: "IT"},
    {space: "naples", control: "IT"},
    {space: "tripoli", control: "IT"},
    {space: "benghazi", control: "IT"},
    {space: "somalia", control: "IT"},

    // ---------------------------------------------------------- Minor powers
    // "Minor Powers: Belgium: 1 army, control marker in Congo"; "Macedonia:
    // Greek control, 1 reduced Greek army"; "Japan: … control marker in Korea".
    // Serbia and Bulgaria are printed as minor powers with their own armies, so
    // they take their own control markers back from the map's Ottoman defaults.
    // (Romania's map default is already Romanian, so it needs no override.)
    {space: "central-congo", control: "Belgium"},
    {space: "macedonia", control: "Greece"},
    {space: "korea", control: "Japan"},
    {space: "serbia", control: "Serbia"},
    {space: "bulgaria", control: "Bulgaria"},
  ],
  // Power Projection is not printed for this scenario; the engine derives it
  // from port control and naval units (`recomputeTracks`).
  powerProjection: {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0},
  removedCards: [],
  // "The Great War has no End Phase Build Box step" (24.1 replaces the campaign
  // end phase), so the 20.3 roster is empty.
  buildBox: [],
  // "In Effect: Suez Canal, Kiel Canal."
  suezComplete: true,
  kielComplete: true,
  // Unified Italy, neutral Alliance Track chit (the printed Alliance Track line
  // names only GE, AU, FR, UK, RU, OT).
  italy: {unified: true},
  special: {
    // Scenario 4's "do not count VPs" note belongs to the 1850 tutorial; the
    // Great War is scored normally.
    countVp: true,
    // The Great War victory is decided by the winter/collapse rules of 30.0, not
    // by the campaign's end-of-turn NG draws.
    ngDrawTurns: [],
    bloodAndIron: false,
    allowsNoGw: false,
    gwTutorial: {
      // "Start this scenario with the Maneuver Step of GW turn 0."
      turn: 0,
      // "Wartime Initiative Order: GE, RU, AU, FR, Triple Alliance Bonus impulse
      // (which will be taken by OT on GW turn 1), UK."
      order: ["GE", "RU", "AU", "FR", "bonus", "UK"],
      bonusFor: ["OT"],
      // "Alliance Track: Triple Alliance: GE, AU; Triple Entente: FR, UK, RU;
      // Neutral: OT and Italy."
      te: ["FR", "UK", "RU"],
      ta: ["GE", "AU"],
      neutrals: ["OT"],
      // "Permanent Events in Effect: Machine guns and Hydraulic Recoil"
      permanentEvents: {machineGuns: true, hydraulicRecoil: true},
      // "In Effect: Suez Canal, Kiel Canal"
      canals: {suez: true, kiel: true},
      // "I Want You Bonus Armies: 2 Armies" (the National Will Step result).
      ukBonusArmies: 2,
    },
    gwSpecial: {
      // "If AU does not launch a land battle against Serbia on GW turn 0 they
      // lose one stability."
      auSerbiaBattleOrStability: true,
      // "The UK cannot amphibiously assault GE home spaces containing a GE
      // naval unit(s)."
      ukNoAmphibiousGermanPorts: true,
      // "OT will join the Triple Alliance during the winter step of GW turn 0."
      ottomanJoinsTaInWinter: true,
    },
  },
  notes: [
    "Start this scenario with the Maneuver Step of GW turn 0.  The setup takes into account the Outbreak Step of the GW, including the National Will Step and the UK Rapid Deployment national characteristic.",
    "In Effect: Suez Canal, Kiel Canal.  Permanent Events in Effect: Machine guns and Hydraulic Recoil.",
    "Wartime Initiative Order: GE, RU, AU, FR, Triple Alliance Bonus impulse (which will be taken by OT on GW turn 1), UK.",
    "Alliance Track: Triple Alliance: GE, AU; Triple Entente: FR, UK, RU; Neutral: OT and Italy.  The printed line does not place Italy on the Alliance Track at all, so `italy` records only `unified: true` and Italy's chit is neutral.",
    "Special: If AU does not launch a land battle against Serbia on GW turn 0 they lose one stability.",
    "Special: The UK cannot amphibiously assault GE home spaces containing a GE naval unit(s).",
    "Special: OT will join the Triple Alliance during the winter step of GW turn 0.",
    "Italy: Control markers: all Italian home spaces, Tripoli, Benghazi, Somalia.  Tuscany, Piedmont and Lombardy each hold 1 army, Naples holds 1 dreadnought and 2 squadrons, and Italy has 1 reserve army.",
    "The page prints no territorial/colonial key totals for any power (it prints stability, industry and manpower only), so `powers[]` omits the key tracks; `recomputeTracks` derives them from the control markers.",
    "printed space not on the map: Fiji — the UK list prints \"Other control markers: Cyprus, Fiji, Balochistan, Oman, Aden, Kuwait, Great Sand Sea, Sinai, Shanghai, Shandong Peninsula\", and this map has no Fiji space.  The other nine markers are in `controlOverrides`.",
    "printed space not on the map: \"Mediterranean\" — the UK line \"Mediterranean: 1 dreadnought, 1 squadron\" names no box on this map (there is a Western and an Eastern Mediterranean Box).  The Western Mediterranean Box is used: it is Malta's box, where the campaign setup already puts the UK squadron.",
    "Hanover is printed with \"3 dreadnoughts, 1 squadron\" but Hanover is a land key with no port in `constant/spaces.ts`; the naval units are transcribed where the page places them.",
    "The printed \"Belgium: 1 army, control marker in Congo\" is read as: 1 Belgian army in Belgium (its home key) and the Belgian control marker in the Congo.  The map has two Congo spaces; Central Congo is the Belgian one on this map, so the marker is placed there and the army stays in Belgium.",
    "Serbia, Bulgaria and Romania print as minor powers with their own armies (\"Serbia: 2 armies\", \"Bulgaria: 2 armies\", \"Romania: 2 armies\"), so their control markers are overridden from the map's Ottoman defaults to the minors themselves.  \"Macedonia: Greek control\" is transcribed to Greece.",
    "The German unification spaces (Hanover, Saxony, Bavaria) and Schleswig-Holstein are German in this setup and are listed as GE control markers even though the map's defaults are the German minors and Denmark; Germany is therefore unified (`powers.GE.unified: true`), which its printed 4+ dreadnoughts also require (rule 4.2's pre-unification 2/2 naval limit).",
    "The three Egyptian spaces are British here (\"Egypt: 1 EF, control marker\", plus the Great Sand Sea and Sinai markers), not the campaign's independent Egypt: there are no IMP markers in this setup.",
    "UK \"Other control markers\" also gives Great Sand Sea and Sinai to the UK, which the campaign setup gives to Egypt.",
    "India prints 2 Indian armies and a Level 1 Indian Fort; the Indian Stability marker starts on its stable side.",
    "Italy's printed \"Reserve Armies: 1\" is transcribed as an `IT` reserve-army row.  Italy has no player seat, so the engine holds that counter in the non-player counter pool (4.2 chart row IT) rather than in a player's reserve box.",
    "The Ottoman \"Reserve Armies: 1 Turkish, 1 Arab\" are two separate counters; the Arab one carries `special: \"arab\"`.",
    "Power Projection is not printed for this scenario; the engine recomputes it from the board.",
    "The Great War has no End Phase Build Box, so `buildBox` is empty.",
  ],
};
