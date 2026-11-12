/**
 * The printed Crisis Table (rulebook 23.0–23.5, playbook "CRISIS TABLE").
 *
 * The grid below is transcribed from the playbook back page; the test asserts
 * the engine's data matches it row by row and that one die result resolves to
 * the structured outcome the live layer consumes.  No game state is needed.
 */
import {
  BALKAN_MINORS,
  BALKAN_STATE_TABLE,
  CRISIS_INCITING,
  CRISIS_ROWS,
  CrisisResultKind,
  CrisisRowId,
  FALLBACK_CRISIS_ROW,
  PRINTED_CRISIS_ROWS,
  balkanCellForRoll,
  crisisIncitingFor,
  crisisLabel,
  drawBalkanState,
  resolveCrisisRoll,
} from "./engine/crisisTable";

const ROW_IDS: CrisisRowId[] = [
  "assassination",
  "navalArmsRace",
  "powderKegStep1",
  "powderKegStep2",
  "blackHandStep1",
  "blackHandStep2",
  "bosnianCrisis",
  "moroccanCrisis",
  "impulsiveLeader",
  "allianceSystem",
];

type Printed = readonly [CrisisResultKind, string];

/**
 * The printed grid, results 1..6.  Labels are exactly the words on the table.
 */
const GRID: Record<Exclude<CrisisRowId, "fallback">, Printed[]> = {
  assassination: [
    ["minorityNationality", "Minority Nationality"],
    ["minorityNationality", "Minority Nationality"],
    ["borderingNation", "Bordering Nation"],
    ["borderingNation", "Bordering Nation"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  navalArmsRace: [
    ["firedOnFishingBoats", "Fired on fishing boats"],
    ["colonialProxyWar", "Colonial proxy war"],
    ["colonialProxyWar", "Colonial proxy war"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  powderKegStep1: [
    ["balkanTable", "Balkan Table (Roll twice)"],
    ["balkanTable", "Balkan Table (Roll twice)"],
    ["balkanTable", "Balkan Table (Roll once)"],
    ["balkanTable", "Balkan Table (Roll once)"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  powderKegStep2: [
    ["allyRespondent", "Ally (Russia if no ally)"],
    ["allyRespondent", "Ally (France if no ally)"],
    ["allyRespondent", "Ally (France if no ally)"],
    ["allyRespondent", "Ally (Austria if no ally)"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  blackHandStep1: [
    ["targetPower", "Germany"],
    ["targetPower", "UK"],
    ["targetPower", "France"],
    ["targetPower", "Russia"],
    ["targetPower", "Austria"],
    ["targetPower", "Ottomans"],
  ],
  blackHandStep2: [
    ["minorityNationality", "Minority Nationality"],
    ["minorityNationality", "Minority Nationality"],
    ["borderingNation", "Bordering Nation"],
    ["borderingNation", "Bordering Nation"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  bosnianCrisis: [
    ["balkanTable", "Balkan Table (Roll twice)"],
    ["targetPower", "Russia (Unless AU Ally)"],
    ["targetPower", "Ottomans (Unless AU Ally)"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  moroccanCrisis: [
    ["losingPower", "Losing Power"],
    ["losingPower", "Losing Power"],
    ["losingPower", "Losing Power"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
  impulsiveLeader: [
    ["targetPower", "Germany"],
    ["targetPower", "UK"],
    ["targetPower", "France"],
    ["targetPower", "Russia"],
    ["targetPower", "Austria"],
    ["targetPower", "Ottomans"],
  ],
  allianceSystem: [
    ["borderIncident", "Border incident"],
    ["borderIncident", "Border incident"],
    ["espionage", "Espionage"],
    ["espionage", "Espionage"],
    ["internationalConference", "International Conference"],
    ["internationalConference", "International Conference"],
  ],
};

test("the ten printed rows are present with their printed Event/Incident columns", () => {
  expect(PRINTED_CRISIS_ROWS.map((row) => row.id)).toEqual(ROW_IDS);
  const columns: Record<string, [string, string, 1 | 2 | null]> = {
    assassination: ["Assassination", "Blame", null],
    navalArmsRace: ["Naval Arms Race", "Naval Incident", null],
    powderKegStep1: ["Powder Keg/Balkans Wars: Step 1", "Random Balkan state", 1],
    powderKegStep2: ["Powder Keg/Balkans Wars: Step 2", "Balkan state appeals to", 2],
    blackHandStep1: ["The Black Hand: Step 1", "Target", 1],
    blackHandStep2: ["The Black Hand: Step 2", "Terrorism supported by", 2],
    bosnianCrisis: ["Bosnian Crisis", "Outraged by annexation", null],
    moroccanCrisis: ["Moroccan Crisis/'Urabi Revolt", "Outraged by annexation", null],
    impulsiveLeader: ["Impulsive Leader", "Rash decision made by", null],
    allianceSystem: ["Alliance System/Shifting Alliances", "Inciting Incident", null],
  };
  for (const row of PRINTED_CRISIS_ROWS) {
    expect([row.event, row.incident, row.step]).toEqual(columns[row.id]);
    expect(row.cells).toHaveLength(6);
  }
});

test("every row matches the printed cells for every die result", () => {
  for (const rowId of ROW_IDS) {
    const row = CRISIS_ROWS[rowId];
    const expected = GRID[rowId as Exclude<CrisisRowId, "fallback">];
    for (let roll = 1; roll <= 6; roll += 1) {
      const res = resolveCrisisRoll({rowId, roll});
      if (expected[roll - 1][0] === "internationalConference") {
        expect({roll, kind: res.kind}).toEqual({roll, kind: "conference"});
      } else {
        expect({roll, kind: res.kind}).toEqual({roll, kind: "outbreak"});
        if (res.kind !== "outbreak") continue;
        expect({roll, kind: res.result.kind, label: res.result.label}).toEqual({
          roll,
          kind: expected[roll - 1][0],
          label: expected[roll - 1][1],
        });
        expect(res.rowId).toBe(rowId);
        expect(res.incident.event).toBe(row.event);
        expect(res.incident.incident).toBe(row.incident);
        expect(res.incident.step).toBe(row.step);
      }
    }
  }
});

describe("footnote * — International Conference", () => {
  test("a conference does not start the Great War and reports the reroll flag", () => {
    const first = resolveCrisisRoll({rowId: "assassination", roll: 5});
    expect(first).toMatchObject({kind: "conference", reroll: false, roll: 5});
    const second = resolveCrisisRoll({rowId: "assassination", roll: 6, conferenceUsed: true});
    expect(second).toMatchObject({kind: "conference", reroll: true});
  });

  test("any total above 6 is an International Conference", () => {
    // The fallback row's 4 is narrative; +3 DRM makes it 7 and therefore a
    // conference ("Treat any results >6 as an International Conference*").
    expect(resolveCrisisRoll({rowId: "fallback", roll: 4}).kind).toBe("outbreak");
    expect(resolveCrisisRoll({rowId: "fallback", roll: 4, drm: 3})).toMatchObject({
      kind: "conference",
      roll: 7,
    });
  });

  test("a total below 1 is treated as a 1", () => {
    const res = resolveCrisisRoll({rowId: "assassination", roll: 1, drm: -3});
    expect(res.kind).toBe("outbreak");
    if (res.kind === "outbreak") expect(res.result.kind).toBe("minorityNationality");
    const balkan = resolveCrisisRoll({rowId: "powderKegStep1", roll: 2, drm: -5});
    expect(balkan.kind).toBe("outbreak");
    if (balkan.kind === "outbreak") expect(balkan.result.kind).toBe("balkanTable");
  });
});

describe("footnote † — Bosnian Crisis 'Unless AU Ally'", () => {
  test("2 and 3 are Russia/Ottomans normally and a Balkan Table when allied to AU", () => {
    const russia = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 2});
    expect(russia.kind).toBe("outbreak");
    if (russia.kind === "outbreak") {
      expect(russia.result.kind).toBe("targetPower");
      expect(russia.result.target).toBe("RU");
      expect(russia.result.dagger).toBe(true);
    }
    const allied = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 2, alliedToAU: ["RU"]});
    expect(allied.kind).toBe("outbreak");
    if (allied.kind === "outbreak") {
      expect(allied.result.kind).toBe("balkanTable");
      expect(allied.result.rolls).toBe(2);
      expect(allied.special).toBe(true);
    }
    const ottomans = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 3});
    expect(ottomans.kind).toBe("outbreak");
    if (ottomans.kind === "outbreak") expect(ottomans.result.target).toBe("OT");
    const ottomansAlly = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 3, alliedToAU: ["OT"]});
    expect(ottomansAlly.kind).toBe("outbreak");
    if (ottomansAlly.kind === "outbreak") expect(ottomansAlly.result.kind).toBe("balkanTable");
  });

  test("a power allied to AU that the row does not name does not change the result", () => {
    const res = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 2, alliedToAU: ["GE"]});
    expect(res.kind).toBe("outbreak");
    if (res.kind === "outbreak") expect(res.result.kind).toBe("targetPower");
  });
});

describe("special results (§23.3) and follow-ups", () => {
  test("only the ** cells are special", () => {
    const specials = new Set([
      "assassination:3",
      "assassination:4",
      "powderKegStep1:1",
      "powderKegStep1:2",
      "powderKegStep1:3",
      "powderKegStep1:4",
      "blackHandStep2:3",
      "blackHandStep2:4",
      "bosnianCrisis:1",
    ]);
    for (const rowId of ROW_IDS) {
      for (let roll = 1; roll <= 6; roll += 1) {
        const res = resolveCrisisRoll({rowId, roll});
        if (res.kind !== "outbreak") continue;
        expect({roll, special: res.special}).toEqual({roll, special: specials.has(`${rowId}:${roll}`)});
      }
    }
  });

  test("bordering nation asks for the bordering power choice", () => {
    const res = resolveCrisisRoll({rowId: "assassination", roll: 3, targetPower: "AU"});
    expect(res.kind).toBe("outbreak");
    if (res.kind !== "outbreak") return;
    expect(res.incident.targetPower).toBe("AU");
    expect(res.followUps).toEqual([{kind: "borderingNation", targetPower: "AU"}]);
  });

  test("balkan table follow-ups carry the roll count and the step 2 respondent", () => {
    const twice = resolveCrisisRoll({rowId: "powderKegStep1", roll: 1, threatenedMinor: "Bulgaria"});
    expect(twice.kind).toBe("outbreak");
    if (twice.kind !== "outbreak") return;
    expect(twice.followUps).toEqual([
      {kind: "balkanTable", rolls: 2, threatenedMinor: "Bulgaria"},
      {kind: "respondent", threatenedMinor: "Bulgaria"},
    ]);
    const once = resolveCrisisRoll({rowId: "powderKegStep1", roll: 4});
    expect(once.kind).toBe("outbreak");
    if (once.kind !== "outbreak") return;
    expect(once.followUps[0]).toMatchObject({kind: "balkanTable", rolls: 1});
  });

  test("the Bosnian Crisis Balkan Table has no step 2 respondent", () => {
    const res = resolveCrisisRoll({rowId: "bosnianCrisis", roll: 1});
    expect(res.kind).toBe("outbreak");
    if (res.kind !== "outbreak") return;
    expect(res.followUps.map((f) => f.kind)).toEqual(["balkanTable"]);
  });

  test("narrative cells carry no state follow-up", () => {
    const cases: [CrisisRowId, number][] = [
      ["navalArmsRace", 1],
      ["navalArmsRace", 2],
      ["allianceSystem", 1],
      ["allianceSystem", 3],
      ["moroccanCrisis", 1],
      ["impulsiveLeader", 1],
      ["blackHandStep1", 4],
    ];
    for (const [rowId, roll] of cases) {
      const res = resolveCrisisRoll({rowId, roll});
      expect(res.kind).toBe("outbreak");
      if (res.kind !== "outbreak") continue;
      expect(res.special).toBe(false);
      expect(res.followUps.map((f) => f.kind)).not.toContain("balkanTable");
      expect(res.followUps.map((f) => f.kind)).not.toContain("borderingNation");
    }
  });

  test("minority nationality names the targeted player but does not change state", () => {
    const res = resolveCrisisRoll({rowId: "assassination", roll: 1, targetPower: "FR"});
    expect(res.kind).toBe("outbreak");
    if (res.kind !== "outbreak") return;
    expect(res.special).toBe(false);
    expect(res.followUps).toEqual([{kind: "minorityNationality", targetPower: "FR"}]);
  });

  test("the Black Hand step 1 row names the target power", () => {
    expect(resolveCrisisRoll({rowId: "blackHandStep1", roll: 1})).toMatchObject({
      kind: "outbreak",
      result: {kind: "targetPower", target: "GE"},
    });
    expect(resolveCrisisRoll({rowId: "blackHandStep1", roll: 6})).toMatchObject({
      kind: "outbreak",
      result: {kind: "targetPower", target: "OT"},
    });
  });

  test("the Losing Power result names the losing space", () => {
    const res = resolveCrisisRoll({rowId: "moroccanCrisis", roll: 2, losingSpace: "morocco"});
    expect(res.kind).toBe("outbreak");
    if (res.kind !== "outbreak") return;
    expect(res.incident.losingSpace).toBe("morocco");
    expect(res.followUps).toEqual([{kind: "losingPower", space: "morocco"}]);
  });

  test("crisisLabel prints Event — Incident — Result", () => {
    const res = resolveCrisisRoll({rowId: "navalArmsRace", roll: 2});
    expect(res.kind).toBe("outbreak");
    if (res.kind !== "outbreak") return;
    expect(crisisLabel(res.incident, res.result)).toBe("Naval Arms Race — Naval Incident — Colonial proxy war");
  });
});

describe("inciting events map to their printed rows", () => {
  test("each printed card maps to the right rows and incident", () => {
    const expected: Record<string, [CrisisRowId[], string]> = {
      "IE-A017": [["assassination"], "blame"],
      "IE-A092": [["navalArmsRace"], "navalIncident"],
      "IE-A053": [["powderKegStep1", "powderKegStep2"], "balkanState"],
      "IE-A100": [["powderKegStep1", "powderKegStep2"], "balkanState"],
      "IE-A101": [["blackHandStep1", "blackHandStep2"], "blackHandTarget"],
      "IE-A103": [["bosnianCrisis"], "annexation"],
      "IE-A102": [["moroccanCrisis"], "annexation"],
      "IE-A071": [["moroccanCrisis"], "annexation"],
      "IE-A105": [["impulsiveLeader"], "rashDecision"],
      "IE-A015": [["allianceSystem"], "incitingIncident"],
      "IE-A111": [["allianceSystem"], "incitingIncident"],
    };
    expect(Object.keys(CRISIS_INCITING).sort()).toEqual(Object.keys(expected).sort());
    for (const [card, [rows, incident]] of Object.entries(expected)) {
      const def = crisisIncitingFor(card);
      expect(def.rows).toEqual(rows);
      expect(def.incident).toBe(incident);
      expect(def.cardId).toBe(card);
    }
  });

  test("the annexation rows know which space loses its controller", () => {
    expect(crisisIncitingFor("IE-A102").losingSpace).toBe("morocco");
    expect(crisisIncitingFor("IE-A071").losingSpace).toBe("egypt");
  });

  test("an unmatched inciting card falls back to a narrative row", () => {
    for (const card of ["", "IE-A099", "test", null, undefined]) {
      const def = crisisIncitingFor(card);
      expect(def.cardId).toBeNull();
      expect(def.rows).toEqual(["fallback"]);
      expect(def.incident).toBe("unknown");
    }
    expect(FALLBACK_CRISIS_ROW.cells.slice(0, 4).every((c) => c.kind === "narrative")).toBe(true);
    expect(FALLBACK_CRISIS_ROW.cells.slice(4).every((c) => c.kind === "internationalConference")).toBe(true);
  });
});

describe("the Balkan States table", () => {
  test("rolls 1..6 are printed on the table", () => {
    expect(BALKAN_STATE_TABLE).toHaveLength(6);
    expect(balkanCellForRoll(1)).toMatchObject({choice: true});
    expect(balkanCellForRoll(2)).toMatchObject({minor: "Bosnia"});
    expect(balkanCellForRoll(3)).toMatchObject({minor: "Serbia"});
    expect(balkanCellForRoll(4)).toMatchObject({minor: "Bulgaria"});
    expect(balkanCellForRoll(5)).toMatchObject({minor: "Romania"});
    expect(balkanCellForRoll(6)).toMatchObject({minor: "Greece"});
    expect(BALKAN_MINORS).toEqual(["Bosnia", "Serbia", "Bulgaria", "Romania", "Greece"]);
  });

  test("non-independent states reroll until an independent one appears", () => {
    const independent = new Set(["Greece", "Romania"]);
    const draw = drawBalkanState([2, 3, 6], (minor) => independent.has(minor));
    expect(draw).toEqual({drawn: "Greece", choice: false, consumed: 3, exhausted: false});
  });

  test("a Choice result consumes one roll and asks for the player's choice", () => {
    const draw = drawBalkanState([1], () => false);
    expect(draw).toEqual({drawn: null, choice: true, consumed: 1, exhausted: false});
  });

  test("running out of dice reports exhausted", () => {
    const draw = drawBalkanState([2, 3], () => false);
    expect(draw).toEqual({drawn: null, choice: false, consumed: 2, exhausted: true});
  });
});
