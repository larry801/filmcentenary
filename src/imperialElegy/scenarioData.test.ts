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
import {applyAuSerbiaClause, applyOttomanWinterJoin, auSerbiaBattleOrStability, blocksUkAmphibiousPort, ottomanJoinsTaInWinter, ukNoAmphibiousGermanPorts} from "./engine/scenario";
import {PENDING_KINDS} from "./types";
import {IE_SCENARIOS, parseNoGw, parseScenarioId} from "./configuration";
import {openSetupDecisions} from "./moves";
import {placeUnit} from "./engine/effects";

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

// ---------------------------------------------------------------------------
// The GW tutorial's three printed special rules
// ---------------------------------------------------------------------------

test("the GW tutorial's AU/Serbia clause charges one stability when no battle was fought", () => {
  const G = setupScenario("gwTutorial");
  const changes: {power: Power; delta: number}[] = [];
  const applied = applyAuSerbiaClause(G, false, (_state, power, delta) => {
    changes.push({power, delta});
  });
  expect(applied).toBe(true);
  expect(changes).toEqual([{power: "AU", delta: -1}]);
  // Idempotent: the clause is paid once.
  expect(applyAuSerbiaClause(G, false, (_state, power, delta) => changes.push({power, delta}))).toBe(false);
});

test("the GW tutorial's AU/Serbia clause is satisfied by a Serbian battle", () => {
  const G = setupScenario("gwTutorial");
  const changes: {power: Power; delta: number}[] = [];
  expect(applyAuSerbiaClause(G, true, (_state, power, delta) => changes.push({power, delta}))).toBe(false);
  expect(changes).toEqual([]);
});

test("the AU/Serbia clause only exists in the scenario that prints it", () => {
  const G = setupScenario("campaign");
  expect(auSerbiaBattleOrStability(G)).toBe(false);
  const changes: number[] = [];
  expect(applyAuSerbiaClause(G, false, (_state, _power, delta) => changes.push(delta))).toBe(false);
  expect(changes).toEqual([]);
});

test("the GW tutorial joins OT to the Triple Alliance in the GW turn 0 winter", () => {
  const G = setupScenario("gwTutorial");
  expect(G.gw?.neutrals).toContain("OT");
  expect(G.gw?.ta).not.toContain("OT");
  expect(applyOttomanWinterJoin(G)).toBe(true);
  expect(G.gw?.ta).toContain("OT");
  expect(G.gw?.neutrals).not.toContain("OT");
  expect(G.gw?.belligerents).toContain("OT");
  expect(G.powers.OT.alliance).toBe("taCommitted");
  // Idempotent: the printed "during the winter step" happens once.
  expect(applyOttomanWinterJoin(G)).toBe(false);
});

test("the OT winter join only exists in the scenario that prints it", () => {
  const G = setupScenario("campaign");
  expect(ottomanJoinsTaInWinter(G)).toBe(false);
  expect(applyOttomanWinterJoin(G)).toBe(false);
});

test("the UK amphibious restriction covers GE home ports holding GE naval units", () => {
  const G = setupScenario("gwTutorial");
  expect(ukNoAmphibiousGermanPorts(G)).toBe(true);
  // Pomerania is a German home port with no German naval unit in the tutorial.
  expect(blocksUkAmphibiousPort(G, "UK", "pomerania")).toBe(false);
  // Put a German squadron in that home port: the printed clause now bites.
  const unit = placeUnit(G, "GE", "squadron", "pomerania", 2);
  expect(blocksUkAmphibiousPort(G, "UK", "pomerania")).toBe(true);
  // Another power is not the UK, so the clause does not apply to them.
  expect(blocksUkAmphibiousPort(G, "FR", "pomerania")).toBe(false);
  // A non-German port is never restricted, even with a German ship in it.
  G.spaces.pomerania.units = G.spaces.pomerania.units.filter((id) => id !== unit.id);
  expect(blocksUkAmphibiousPort(G, "UK", "pomerania")).toBe(false);
});

test("the UK amphibious restriction only exists in the scenario that prints it", () => {
  const G = setupScenario("campaign");
  // The clause itself is scenario data: the campaign prints no such rule, so the
  // live amphibious check never consults the port test (see `moves.ts`).
  expect(ukNoAmphibiousGermanPorts(G)).toBe(false);
  // The *predicate* still describes the situation correctly; it is the scenario
  // gate at the call site that keeps it out of a campaign match.
  placeUnit(G, "GE", "squadron", "pomerania", 2);
  expect(blocksUkAmphibiousPort(G, "UK", "pomerania")).toBe(true);
  expect(ukNoAmphibiousGermanPorts(G)).toBe(false);
});

// ---------------------------------------------------------------------------
// Board controls for the scenario setup decisions
// ---------------------------------------------------------------------------

test.each(["francoPrussianConcession", "scenarioGoalChoice", "gwBuildPoint"] as const)(
  "%s is a declared pending kind with a bilingual label",
  (kind) => {
    expect(PENDING_KINDS).toContain(kind);
  },
);

test("the printed setup decisions are offered in printed order", () => {
  // 1870 offers the Franco-Prussian War first: it is step 1 of the printed
  // "prior to the Prep Phase" procedure.
  const G = setupScenario("s1870");
  const made = openSetupDecisions(G, ctxOf());
  expect(made).toBe(true);
  expect(G.pending?.kind).toBe("francoPrussianConcession");
  expect(G.pending?.power).toBe("FR");
  // Options follow the printed two-way choice.
  expect(G.pending?.options.map((option) => option.id).sort()).toEqual(["concede", "fight"]);
});

test("the campaign has no printed setup decisions", () => {
  const G = setupScenario("campaign");
  expect(openSetupDecisions(G, ctxOf())).toBe(false);
  expect(G.pending).toBeNull();
});

// ---------------------------------------------------------------------------
// Alternate-GW printed counters keep their printed markers
// ---------------------------------------------------------------------------

test.each(["altGw1", "altGw2", "altGw3"])("%s keeps the UK's Indian and OT's Arab counters", (id) => {
  const def = SCENARIOS[id];
  const G = setupScenario(id);
  // The print distinguishes "1 British, N Indian" armies; every Indian counter
  // carries the 33.2.1 marker the engine reads.
  const printedIndian = (def.special.altGw?.units?.UK ?? [])
    .filter((entry) => entry.flags?.indian === true)
    .reduce((sum, entry) => sum + entry.count, 0);
  expect(printedIndian).toBeGreaterThan(0);
  const indian = Object.values(G.units).filter((unit) => unit.owner === "UK" && unit.flags?.indian === true);
  expect(indian).toHaveLength(printedIndian);
  // "3 Turkish armies, 1 Arab army"
  const arab = Object.values(G.units).filter((unit) => unit.owner === "OT" && unit.flags?.arab === true);
  expect(arab).toHaveLength(1);
});

test("the unified Italy's alternate-GW inventory is placed", () => {
  // altGw2 and altGw3 print a unified Italy with its own counters.
  for (const id of ["altGw2", "altGw3"] as const) {
    const def = SCENARIOS[id];
    expect(def.italy?.unified).toBe(true);
    const printed = (def.special.altGw?.units?.Italy ?? []).reduce((sum, entry) => sum + entry.count, 0);
    expect(printed).toBeGreaterThan(0);
    const G = setupScenario(id);
    const italian = Object.values(G.units).filter((unit) => unit.owner === "IT");
    expect(italian.length).toBeGreaterThanOrEqual(printed);
    // Italy's own armies are the Italian counter, not a generic army.
    expect(italian.filter((unit) => unit.kind === "italianArmy").length).toBe(3);
  }
});

// ---------------------------------------------------------------------------
// Scenario + Rule 34 seats (the online path)
// ---------------------------------------------------------------------------

test.each(SCENARIO_IDS)("%s accepts bot seats alongside its setup data", (id) => {
  // An online match always has six boardgame.io seats; `setupData` carries both
  // the scenario and the bot list, and both must survive into the state.
  const G = setupImperialElegy(ctxOf(), {scenario: id, bots: ["UK", "OT"], botDifficulty: "hard"});
  expect(G.scenario).toBe(id);
  expect(G.bots).toEqual(["UK", "OT"]);
  expect(G.botDifficulty).toBe("hard");
  // The scenario's own opening position is still the printed one.
  expect(G.turn).toBe(SCENARIOS[id].firstTurn);
  expect(G.nonPlayerBuildBox?.minors).toEqual(SCENARIOS[id].buildBox);
});

test("a scenario match with no bot seats keeps the field empty and the difficulty absent", () => {
  const G = setupImperialElegy(ctxOf(), {scenario: "s1880"});
  expect(G.bots).toEqual([]);
  expect(G.botDifficulty).toBeUndefined();
});

test("a local match can carry a difficulty without a setupData bot list", () => {
  // The solo/hotseat shell keeps its bot seats on the client, so it names only
  // the difficulty; Rule 34.1's level must still reach the state (34.4.5's free
  // redeployment reads it).
  const G = setupImperialElegy(ctxOf(), {scenario: "campaign", botDifficulty: "hard"});
  expect(G.bots).toEqual([]);
  expect(G.botDifficulty).toBe("hard");
});

test("an unknown scenario token does not block an online match", () => {
  // A stale client or a hand-written fixture must still be able to open a match:
  // the unknown id reads as the campaign, exactly like an absent one.
  const G = setupImperialElegy(ctxOf(), {scenario: "s9999", bots: ["GE"]});
  expect(G.scenario).toBe("campaign");
  expect(G.bots).toEqual(["GE"]);
  expect(G.turn).toBe(1);
});

test("the lobby advertises every printed scenario", () => {
  // The picker is built from `IE_SCENARIOS`; it must list all eight in printed
  // order and no more.
  expect(IE_SCENARIOS.map((entry) => entry.id)).toEqual([
    "campaign",
    "tutorial1850",
    "s1870",
    "s1880",
    "gwTutorial",
    "altGw1",
    "altGw2",
    "altGw3",
  ]);
  for (const entry of IE_SCENARIOS) {
    expect(entry.name.length).toBeGreaterThan(0);
    expect(entry.nameZh.length).toBeGreaterThan(0);
  }
});

test("Scenario 4's modifier is validated separately from the scenario id", () => {
  // Only a real `true` turns the modifier on; every other value reads as a
  // normal scenario, so a typo cannot silently change how a Great War scores.
  expect(parseNoGw({noGw: true})).toBe(true);
  expect(parseNoGw({noGw: "true"})).toBe(false);
  expect(parseNoGw({noGw: 1})).toBe(false);
  expect(parseNoGw({})).toBe(false);
  expect(parseNoGw(undefined)).toBe(false);
  expect(parseScenarioId({scenario: "s1870"})).toBe("s1870");
  expect(parseScenarioId({scenario: "nope"})).toBe("campaign");
  expect(parseScenarioId(undefined)).toBe("campaign");
});
