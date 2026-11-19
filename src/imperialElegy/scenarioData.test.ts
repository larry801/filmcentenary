import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {SCENARIOS, SCENARIO_IDS, scenarioById} from "./constant/scenarios";
import type {ScenarioDef} from "./constant/scenarios/types";
import {SPACES} from "./constant/spaces";
import {POWERS} from "./types";
import type {ImperialElegyState, Power} from "./types";
import {CARDS} from "./constant/cards.data";
import {GOALS_BY_ID, goalsForPower} from "./constant/goals";
import {
  buildPointsRemaining,
  campaignWindow,
  countsVp,
  drawsNgsThisTurn,
  extraPrepCards,
  hasBloodAndIron,
  isFinalTurn,
  ngDrawCount,
  scenarioLength,
  startingGwTurn,
} from "./engine/scenario";
import {
  applyFrancoPrussianConcession,
  impMarkerOf,
  isIndependentMinor,
  pendingGoalChoice,
  resolveGoalChoice,
  spendBuildPoint,
} from "./engine/scenarioSetup";
import {truceRivals} from "./engine/limitedWar";

/** A deterministic boardgame.io context: every die rolls its maximum. */
const ctxOf = (die = 1): Ctx => ({
  playerID: "0",
  random: {Die: (sides: number) => (die === 1 ? sides : Math.min(sides, die))},
  events: {
    setPhase: () => undefined,
    setActivePlayers: () => undefined,
    endGame: () => undefined,
    endTurn: () => undefined,
  },
  turn: 1,
  phase: "prep",
} as unknown as Ctx);

/** Set up one scenario through the same entry point the game definition uses. */
const setupScenario = (scenario: string, options: {noGw?: boolean; bots?: Power[]} = {}): ImperialElegyState => {
  const ctx = ctxOf();
  return setupImperialElegy(ctx, {scenario, ...options});
};

// ---------------------------------------------------------------------------
// Every printed scenario exists and is self-consistent
// ---------------------------------------------------------------------------

test.each(SCENARIO_IDS)("%s is registered with a complete printed definition", (id) => {
  const def = SCENARIOS[id];
  expect(def.id).toBe(id);
  expect(def.name.length).toBeGreaterThan(0);
  expect(def.nameZh.length).toBeGreaterThan(0);
  expect(def.firstTurn).toBeGreaterThanOrEqual(1);
  expect(def.lastTurn).toBeGreaterThanOrEqual(def.firstTurn);
  // Every power prints a start on every scenario page.
  for (const power of POWERS) {
    expect(def.powers[power]).toBeDefined();
    expect(def.powers[power].stability).toBeGreaterThanOrEqual(0);
    expect(def.powers[power].industry).toBeGreaterThanOrEqual(0);
  }
  // The special-rules block is the engine's only scenario switch.
  expect(def.special).toBeDefined();
  expect(typeof def.special.countVp).toBe("boolean");
  expect(Array.isArray(def.special.ngDrawTurns)).toBe(true);
});

test.each(SCENARIO_IDS)("%s only uses real space ids on the printed map", (id) => {
  const def = SCENARIOS[id];
  const unknown: string[] = [];
  const check = (space: string, where: string) => {
    if (SPACES[space] === undefined) unknown.push(`${where} -> ${space}`);
  };
  for (const unit of def.units) if (unit.space !== null) check(unit.space, "unit");
  for (const fort of def.forts) check(fort.space, "fort");
  for (const entry of def.diplomacy) check(entry.space, "diplomacy");
  for (const entry of def.influence) check(entry.space, "influence");
  for (const entry of def.pacification) check(entry.space, "pacification");
  for (const entry of def.controlOverrides) check(entry.space, "control");
  for (const entry of def.allyMarkers ?? []) check(entry.space, "ally");
  for (const entry of def.independentMinorMarkers ?? []) check(entry.space, "imp");
  expect(unknown).toEqual([]);
});

test.each(SCENARIO_IDS)("%s only removes cards that really exist", (id) => {
  const def = SCENARIOS[id];
  const missing = def.removedCards.filter(
    (title) => !CARDS.actions.some((card) => card.title === title),
  );
  // Every printed removal must name a real action card; a typo would silently
  // leave the card in the deck instead of removing it.
  expect(missing).toEqual([]);
});

test.each(SCENARIO_IDS)("%s sets up through the live game entry point", (id) => {
  const G = setupScenario(id);
  expect(G.scenario).toBe(id);
  const def = SCENARIOS[id];
  expect(G.turn).toBe(def.firstTurn);
  expect(G.wtt).toBe(def.wtt);
  // The printed unit inventory is on the board (plus any unit a scenario's
  // setup procedure adds later, so `>=`).
  expect(Object.keys(G.units).length).toBeGreaterThanOrEqual(def.units.length);
  // The printed removals are out of the game.
  for (const title of def.removedCards) {
    const card = CARDS.actions.find((entry) => entry.title === title);
    if (card) expect(G.removed).toContain(card.id);
  }
  // The printed build box is the 20.3 roster.
  expect(G.nonPlayerBuildBox?.minors).toEqual(def.buildBox);
});

// ---------------------------------------------------------------------------
// The scenario window replaces the hard-coded turn 7
// ---------------------------------------------------------------------------

test.each(SCENARIO_IDS)("%s reports its printed turn window", (id) => {
  const G = setupScenario(id);
  const def = SCENARIOS[id];
  expect(campaignWindow(G)).toEqual({first: def.firstTurn, last: def.lastTurn});
  expect(scenarioLength(G)).toBe(def.lastTurn - def.firstTurn + 1);
  expect(isFinalTurn(G, def.firstTurn)).toBe(def.firstTurn >= def.lastTurn);
  expect(isFinalTurn(G, def.lastTurn)).toBe(true);
  expect(isFinalTurn(G, def.lastTurn - 1)).toBe(def.lastTurn - 1 >= def.lastTurn);
});

test("the campaign plays seven turns and the two shorter scenarios four and two", () => {
  expect(scenarioLength(setupScenario("campaign"))).toBe(7);
  expect(scenarioLength(setupScenario("tutorial1850"))).toBe(2);
  expect(scenarioLength(setupScenario("s1870"))).toBe(4);
  expect(scenarioLength(setupScenario("s1880"))).toBe(4);
});

// ---------------------------------------------------------------------------
// National Goal draws
// ---------------------------------------------------------------------------

test("the campaign draws NGs on turns 1, 3 and 5 and starts with none", () => {
  const G = setupScenario("campaign");
  expect(hasBloodAndIron(G)).toBe(true);
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 2;
  expect(drawsNgsThisTurn(G)).toBe(false);
  G.turn = 3;
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 5;
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 7;
  expect(drawsNgsThisTurn(G)).toBe(false);
  // 20.11's Play Note: no opening NGs in the campaign.
  expect(setupScenario("campaign").powers.GE.goals).toHaveLength(0);
});

test("the 1870 scenario draws on turns 3 and 5 and starts with one NG", () => {
  const G = setupScenario("s1870");
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 4;
  expect(drawsNgsThisTurn(G)).toBe(false);
  G.turn = 5;
  expect(drawsNgsThisTurn(G)).toBe(true);
  expect(hasBloodAndIron(G)).toBe(false);
  // "players start with 1 NG in the 1870 and 1880 scenarios"
  for (const power of POWERS) expect(G.powers[power].goals).toHaveLength(1);
  // "The GE player only draws 2 NGs"
  expect(ngDrawCount(G, "GE")).toBe(2);
  expect(ngDrawCount(G, "UK")).toBe(3);
});

test("the 1880 scenario draws on turns 4 and 6 and deals OT an extra card", () => {
  const G = setupScenario("s1880");
  // The scenario's first turn is 4, which is one of its draw turns ("Additional
  // NGs are drawn during the End Phase of turns 4 and 6").
  expect(G.turn).toBe(4);
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 5;
  expect(drawsNgsThisTurn(G)).toBe(false);
  G.turn = 4;
  expect(drawsNgsThisTurn(G)).toBe(true);
  G.turn = 6;
  expect(drawsNgsThisTurn(G)).toBe(true);
  expect(extraPrepCards(G, "OT")).toBe(1);
  expect(extraPrepCards(G, "GE")).toBe(0);
  for (const power of POWERS) expect(G.powers[power].goals).toHaveLength(1);
});

test("the 1850 tutorial counts no VPs and draws no NGs", () => {
  const G = setupScenario("tutorial1850");
  expect(countsVp(G)).toBe(false);
  expect(drawsNgsThisTurn(G)).toBe(false);
  expect(G.powers.GE.goals).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Printed goal-deck edits
// ---------------------------------------------------------------------------

test.each(["s1870", "s1880"])("%s adds Precarious Position to AU's deck and offers the removal", (id) => {
  const G = setupScenario(id);
  // The scenario pool includes the ninth Austrian goal.
  expect(goalsForPower("AU", id as never).map((goal) => goal.id)).toContain("NG-31");
  expect(G.powers.AU.goalDeck).toContain("NG-31");
  // "they may remove either 'Contain Italy' or 'Contain Prussia'"
  const pending = pendingGoalChoice(G);
  expect(pending).toHaveLength(1);
  expect(pending[0].power).toBe("AU");
  expect(pending[0].candidates.sort()).toEqual(["NG-29", "NG-30"]);
});

test("the campaign pool excludes the scenario-only Austrian goal", () => {
  expect(goalsForPower("AU").map((goal) => goal.id)).not.toContain("NG-31");
  expect(GOALS_BY_ID["NG-31"].scenarioOnly).toBe(true);
  expect(setupScenario("campaign").powers.AU.goalDeck).not.toContain("NG-31");
});

test("resolving the printed goal removal keeps one and drops the other", () => {
  const G = setupScenario("s1870");
  expect(resolveGoalChoice(G, "AU", "NG-29")).toBe(true);
  expect(G.powers.AU.goalDeck).toContain("NG-29");
  expect(G.powers.AU.goalDeck).not.toContain("NG-30");
  expect(pendingGoalChoice(G)).toEqual([]);
  // A second attempt is refused: the choice is spent.
  expect(resolveGoalChoice(G, "AU", "NG-30")).toBe(false);
});

// ---------------------------------------------------------------------------
// Scenario 4 — No GW
// ---------------------------------------------------------------------------

test("Scenario 4 is a setup flag, not a scenario of its own", () => {
  const normal = setupScenario("campaign");
  expect(normal.noGw).toBeUndefined();
  const noGw = setupScenario("campaign", {noGw: true});
  expect(noGw.noGw).toBe(true);
  // The flag changes only the victory condition: the board is identical.
  expect(Object.keys(noGw.units).sort()).toEqual(Object.keys(normal.units).sort());
});

test("a No-GW state keeps the printed scenario window", () => {
  const G = setupScenario("s1880", {noGw: true});
  expect(campaignWindow(G)).toEqual({first: 4, last: 7});
});

// ---------------------------------------------------------------------------
// 1870 — The Franco-Prussian War
// ---------------------------------------------------------------------------

test("the 1870 Franco-Prussian concession applies all six printed steps", () => {
  const G = setupScenario("s1870");
  const ctx = ctxOf();
  const geEcBefore = Object.values(G.units).filter((u) => u.owner === "GE" && u.kind === "eliteCorps").length;
  const frArmiesBefore = Object.values(G.units).filter((u) => u.owner === "FR" && u.kind === "army").length;
  expect(applyFrancoPrussianConcession(G, ctx)).toBe(true);
  // 1. GE gains control of Alsace-Lorraine, Bavaria and Saxony.
  expect(G.spaces["alsace-lorraine"].control).toBe("GE");
  expect(G.spaces.bavaria.control).toBe("GE");
  expect(G.spaces.saxony.control).toBe("GE");
  // … eliminates both GE ECs.
  expect(Object.values(G.units).filter((u) => u.owner === "GE" && u.kind === "eliteCorps")).toHaveLength(0);
  expect(geEcBefore).toBe(2);
  // 2. FR loses 2 armies and 1 EC.
  expect(Object.values(G.units).filter((u) => u.owner === "FR" && u.kind === "army")).toHaveLength(frArmiesBefore - 2);
  expect(Object.values(G.units).filter((u) => u.owner === "FR" && u.kind === "eliteCorps")).toHaveLength(0);
  // 3. Alliance Track: GE Triple Alliance (uncommitted), FR committed TE.
  expect(G.powers.GE.alliance).toBe("taAligned");
  expect(G.powers.FR.alliance).toBe("teCommitted");
  // 4. The turn-4 marker is recorded for FR.
  expect(G.flags.francoPrussianTurn4Marker).toBe(4);
  // 5. Cards: GE no home card, FR one less card.
  expect(G.flags.francoPrussianNoHomeCard).toBe("GE");
  // 6. Skip GE's first impulse.
  expect(G.flags.francoPrussianSkipGeImpulse).toBe(true);
  // Truce markers: 2 turns between GE and FR.
  expect(truceRivals(G, "GE")).toContain("FR");
  expect(truceRivals(G, "FR")).toContain("GE");
  // The printed key totals are recorded against the board.
  expect(G.flags.francoPrussianGeKeys).toBe(10);
  expect(G.flags.francoPrussianFrKeys).toBe(8);
});

test("the Franco-Prussian concession is idempotent", () => {
  const G = setupScenario("s1870");
  const ctx = ctxOf();
  expect(applyFrancoPrussianConcession(G, ctx)).toBe(true);
  const snapshot = JSON.stringify({units: G.units, powers: G.powers, spaces: G.spaces});
  expect(applyFrancoPrussianConcession(G, ctx)).toBe(false);
  expect(JSON.stringify({units: G.units, powers: G.powers, spaces: G.spaces})).toBe(snapshot);
});

test("only the 1870 scenario offers the Franco-Prussian concession", () => {
  for (const id of ["campaign", "tutorial1850", "s1880"] as const) {
    const G = setupScenario(id);
    expect(applyFrancoPrussianConcession(G, ctxOf())).toBe(false);
  }
});

// ---------------------------------------------------------------------------
// Printed truces and IMP markers
// ---------------------------------------------------------------------------

test("the 1880 scenario's printed truces bind their two pairs", () => {
  const G = setupScenario("s1880");
  expect(truceRivals(G, "GE")).toContain("FR");
  expect(truceRivals(G, "FR")).toContain("GE");
  expect(truceRivals(G, "RU")).toContain("OT");
  expect(truceRivals(G, "OT")).toContain("RU");
  // Unrelated pairs hold no truce.
  expect(truceRivals(G, "GE")).not.toContain("OT");
});

test("the campaign starts with no scenario truces", () => {
  const G = setupScenario("campaign");
  for (const power of POWERS) expect(truceRivals(G, power)).toEqual([]);
});

test.each(["s1870", "s1880"])("%s records its printed IMP markers", (id) => {
  const G = setupScenario(id);
  expect(isIndependentMinor(G, "Egypt") && id === "s1870").toBe(id === "s1870");
  for (const marker of SCENARIOS[id].independentMinorMarkers ?? []) {
    expect(impMarkerOf(G, marker.space)).toBe(marker.minor);
  }
});

// ---------------------------------------------------------------------------
// Alternate Great War build points
// ---------------------------------------------------------------------------

test.each(["altGw1", "altGw2", "altGw3"])("%s grants its printed build points", (id) => {
  const def = SCENARIOS[id];
  expect(def.special.altGw).toBeDefined();
  expect(def.special.altGw?.buildPoints).toBeDefined();
  const G = setupScenario(id);
  for (const power of POWERS) {
    expect(buildPointsRemaining(G, power)).toBe(def.special.altGw?.buildPoints?.[power] ?? 0);
  }
});

test("a build point raises exactly one of stability or industry", () => {
  const G = setupScenario("altGw1");
  const before = {stability: G.powers.GE.stability, industry: G.powers.GE.industry};
  const points = buildPointsRemaining(G, "GE");
  expect(points).toBeGreaterThan(0);
  expect(spendBuildPoint(G, "GE", "stability")).toBe(true);
  expect(G.powers.GE.stability).toBe(before.stability + 1);
  expect(G.powers.GE.industry).toBe(before.industry);
  expect(buildPointsRemaining(G, "GE")).toBe(points - 1);
  expect(G.buildPoints?.spends).toEqual([{power: "GE", field: "stability"}]);
});

test("a power cannot overspend its build points", () => {
  const G = setupScenario("altGw1");
  const total = buildPointsRemaining(G, "AU");
  for (let i = 0; i < total; i += 1) expect(spendBuildPoint(G, "AU", "industry")).toBe(true);
  expect(buildPointsRemaining(G, "AU")).toBe(0);
  expect(spendBuildPoint(G, "AU", "industry")).toBe(false);
  expect(G.powers.AU.industry).toBe(SCENARIOS.altGw1.powers.AU.industry + total);
});

// ---------------------------------------------------------------------------
// Great War scenarios open inside the war
// ---------------------------------------------------------------------------

test("the Great War tutorial opens at GW turn 0 with the printed order", () => {
  const G = setupScenario("gwTutorial");
  expect(startingGwTurn(G)).toBe(0);
  expect(G.gw?.active).toBe(true);
  expect(G.gw?.turn).toBe(0);
  // "Wartime Initiative Order: GE, RU, AU, FR, Triple Alliance Bonus impulse
  // (which will be taken by OT on GW turn 1), UK"
  expect(G.gw?.order).toEqual(["GE", "RU", "AU", "FR", "bonus", "UK"]);
  expect(G.gw?.bonusImpulses).toEqual(["OT"]);
  // "Alliance Track: Triple Alliance: GE, AU; Triple Entente: FR, UK, RU;
  // Neutral: OT and Italy"
  expect(G.gw?.te.sort()).toEqual(["FR", "RU", "UK"]);
  expect(G.gw?.ta.sort()).toEqual(["AU", "GE"]);
  expect(G.gw?.neutrals).toEqual(["OT"]);
  // "Permanent Events in Effect: Machine guns and Hydraulic Recoil"
  expect(G.persistent.machineGuns).toBe(true);
  expect(G.persistent.hydraulicRecoil).toBe(true);
  // "In Effect: Suez Canal, Kiel Canal"
  expect(G.persistent.suezCanal).toBe(true);
  expect(G.persistent.kielCanal).toBe(true);
  // The Outbreak and National Will steps are already resolved by the setup.
  expect(G.gw?.outbreakDone).toBe(true);
  expect(G.gw?.nationalWillDone).toBe(true);
  // GW turn 0 has no trenches yet (28.1 starts them at GW turn 1).
  expect(Object.keys(G.gw?.trenches ?? {})).toHaveLength(0);
});

test.each(["altGw1", "altGw2", "altGw3"])("%s opens inside the Great War", (id) => {
  const G = setupScenario(id);
  expect(startingGwTurn(G)).toBe(0);
  expect(G.gw?.active).toBe(true);
  const def = SCENARIOS[id];
  expect(G.gw?.te.sort()).toEqual([...def.special.altGw!.te].sort());
  expect(G.gw?.ta.sort()).toEqual([...def.special.altGw!.ta].sort());
  expect(G.gw?.neutrals.sort()).toEqual([...def.special.altGw!.neutrals].sort());
  // Every printed unit inventory is on the board.
  for (const power of POWERS) {
    const inventory = def.special.altGw?.units?.[power] ?? [];
    const printed = inventory.reduce((sum, entry) => sum + entry.count, 0);
    if (printed === 0) continue;
    const placed = Object.values(G.units).filter((unit) => unit.owner === power).length;
    expect(placed).toBeGreaterThanOrEqual(printed);
  }
});

test("a pre-war scenario starts at GW turn zero of nothing", () => {
  for (const id of ["campaign", "tutorial1850", "s1870", "s1880"] as const) {
    expect(startingGwTurn(setupScenario(id))).toBeNull();
    expect(setupScenario(id).gw).toBeNull();
  }
});

// ---------------------------------------------------------------------------
// Unknown input is not fatal
// ---------------------------------------------------------------------------

test("an unknown scenario id reads as the campaign", () => {
  const ctx = ctxOf();
  const G = setupImperialElegy(ctx, {scenario: "not-a-scenario"});
  expect(G.scenario).toBe("campaign");
  expect(scenarioById("not-a-scenario").id).toBe("campaign");
});

test("the scenario table covers every printable id", () => {
  expect(Object.keys(SCENARIOS).sort()).toEqual([...SCENARIO_IDS].sort());
});

/** Every scenario's definition is JSON-serializable (it travels in setupData). */
test.each(SCENARIO_IDS)("%s is JSON-serializable", (id) => {
  const def: ScenarioDef = SCENARIOS[id];
  expect(JSON.parse(JSON.stringify(def))).toEqual(def);
});
