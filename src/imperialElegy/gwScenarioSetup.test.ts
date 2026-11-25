/**
 * Great-War scenario setup regression coverage.
 *
 * These tests pin the fixes for the printed scenario pages (`IE_playbook.pdf`
 * pp. 7-10) and the map facts they depend on:
 *
 *  - Hanover's North Sea anchor makes it a port (`3.2.7`), which the historical
 *    setup needs: "Hanover: 3 dreadnoughts, 1 squadron".
 *  - The historical setup's Alsace-Lorraine is German ("Alsace Lorraine: 1 army,
 *    level 2 fort"), so the space carries the GE control marker.
 *  - The alternate GWs' printed setup procedure: step 2 build points are
 *    actually offered, step 3 takes the printed uncontrolled keys, step 4 sets
 *    manpower from the final control markers, step 5 places every printed
 *    counter legally (ports, port capacity, two armies per space, two naval
 *    units per submap).
 *  - The printed minor alliances (AU-Papal States, AU-Poland) and Poland's
 *    reserve army holding box (`22.5(1)`).
 *  - 25.7's alternate-GW initiative order (GE neutral ⇒ the UK's alliance
 *    first), Italy's "unified" status, the tutorial's already-spent Rapid
 *    Deployment, and the alternate victory rule ("the team that wins the GW
 *    wins the game, all other players lose").
 */

import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {SPACES, portBoxes} from "./constant/spaces";
import {POWERS, PendingDecision} from "./types";
import type {ImperialElegyState, Power} from "./types";
import {SCENARIOS} from "./constant/scenarios";
import {PORT_NAVAL_LIMIT, landStackingLimit, recomputeTracks} from "./engine/rules";
import {altGwVictoryOnly, startingGwTurn} from "./engine/scenario";
import {openGwBuildPointDecision} from "./engine/scenarioSetup";
import {resolvePending} from "./moves";
import {endGreatWar} from "./engine/greatWar";
import {beginGwTurn} from "./engine/greatWarFlow";

const ctxOf = (die = 1, playerID: string | null = "0"): Ctx =>
  ({
    playerID,
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

const setup = (scenario: string): ImperialElegyState =>
  setupImperialElegy(ctxOf(), {scenario});

const seatCtx = (power: Power): Ctx => ctxOf(1, String(POWERS.indexOf(power)));

const navalUnits = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.kind === "squadron" || unit.kind === "dreadnought");

const armies = (G: ImperialElegyState) =>
  Object.values(G.units).filter((unit) => unit.kind === "army" || unit.kind === "minorArmy" || unit.kind === "italianArmy" || unit.kind === "usArmy");

// ---------------------------------------------------------------------------
// Map: Hanover's printed anchor
// ---------------------------------------------------------------------------

test("Hanover is a North Sea port (the GW tutorial places the German fleet there)", () => {
  expect(SPACES.hanover.ports).toEqual(["north-atlantic"]);
  expect(portBoxes("hanover")).toEqual(["north-atlantic"]);
});

test("every naval unit the GW tutorial places stands in a port", () => {
  const G = setup("gwTutorial");
  const misplaced = navalUnits(G).filter((unit) => {
    if (unit.space === null || unit.space === undefined) return true;
    return portBoxes(unit.space).length === 0 && SPACES[unit.space]?.type !== "navalBox";
  });
  expect(misplaced).toEqual([]);
  // "Hanover: 3 dreadnoughts, 1 squadron" — the port can hold all four.
  const hanover = G.spaces.hanover.units
    .map((id) => G.units[id])
    .filter((unit) => unit !== undefined && (unit.kind === "squadron" || unit.kind === "dreadnought"));
  expect(hanover).toHaveLength(4);
});

test("the historical setup's Alsace-Lorraine is German", () => {
  const G = setup("gwTutorial");
  expect(G.spaces["alsace-lorraine"].control).toBe("GE");
  // The printed "1 army, level 2 fort" stand there.
  const units = G.spaces["alsace-lorraine"].units.map((id) => G.units[id]).filter((unit) => unit?.owner === "GE");
  expect(units.length).toBeGreaterThan(0);
  expect(G.spaces["alsace-lorraine"].fort).toMatchObject({power: "GE", level: 2});
});

// ---------------------------------------------------------------------------
// Historical GW tutorial: printed status flags
// ---------------------------------------------------------------------------

test("the GW tutorial's Rapid Deployment is already accounted for by the setup", () => {
  // Playbook p. 7: "The setup takes into account … the UK Rapid Deployment
  // national characteristic", so the grant exists but is not a second free move.
  const G = setup("gwTutorial");
  expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "gw", spent: true});
});

test("a scenario that prints 'Italy: Unified' marks Italy unified at runtime", () => {
  for (const id of ["gwTutorial", "altGw2", "altGw3"] as const) {
    const G = setup(id);
    expect(G.persistent.italyUnified).toBe(true);
    expect(SCENARIOS[id].italy?.unified).toBe(true);
  }
  // A scenario that prints "Italy: Not unified" must not.
  expect(setup("altGw1").persistent.italyUnified).toBeUndefined();
});

// ---------------------------------------------------------------------------
// Alternate GW 25.7 initiative order
// ---------------------------------------------------------------------------

test("alternate-GW order: GE's alliance first, or the UK's when GE is neutral", () => {
  // Alt GW 1: GE is in the Triple Entente, so the TE leads.
  expect(setup("altGw1").gw?.order).toEqual(["GE", "UK", "FR", "AU", "OT", "RU"]);
  // Alt GW 2: GE is in the Triple Alliance, so the TA leads.
  expect(setup("altGw2").gw?.order).toEqual(["RU", "FR", "GE", "AU"]);
  // Alt GW 3: GE is neutral, so 25.7 gives the UK's alliance the first impulse.
  expect(setup("altGw3").gw?.order).toEqual(["UK", "FR", "OT", "RU"]);
  // All four alternate/GW setups are 2v2 or 3v3, so no bonus chit is printed.
  for (const id of ["altGw1", "altGw2", "altGw3"] as const) expect(setup(id).gw?.bonusImpulseSide ?? null).toBeNull();
});

// ---------------------------------------------------------------------------
// Alternate GW step 2: the build-point decisions
// ---------------------------------------------------------------------------

test("alternate-GW build points are offered as setup decisions and start the GW planning", () => {
  const G = setup("altGw2");
  // The ledger is seeded and the first decision is already open.
  expect(G.buildPoints?.remaining).toEqual({GE: 7, UK: 5, FR: 6, AU: 6, RU: 6, OT: 6});
  expect(G.flags.gwSetupPending).toBe(true);
  expect(G.pending?.kind).toBe("gwBuildPoint");
  const spendAll = (state: ImperialElegyState): void => {
    let guard = 0;
    while (state.pending !== null && guard < 64) {
      guard += 1;
      const pending: PendingDecision = state.pending;
      // Every point into industry keeps the accounting obvious.
      expect(resolvePending(state, seatCtx(pending.power), "industry")).toBeUndefined();
    }
  };
  const industryBefore = Object.fromEntries(POWERS.map((power) => [power, G.powers[power].industry])) as Record<Power, number>;
  spendAll(G);
  expect(G.buildPoints?.remaining).toEqual({GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0});
  expect(G.flags.gwSetupPending).toBeUndefined();
  // Every grant was actually applied: 7/5/6/6/6/6 industry points.
  const printed = SCENARIOS.altGw2.special.altGw!.buildPoints!;
  for (const power of POWERS) {
    expect(G.powers[power].industry).toBe(industryBefore[power] + (printed[power] ?? 0));
  }
});

test("the build-point opener only offers points that are still unspent", () => {
  const G = setup("altGw1");
  G.buildPoints!.remaining = {GE: 0, UK: 0, FR: 0, AU: 0, RU: 0, OT: 0};
  G.pending = null;
  G.flags.gwSetupPending = false;
  expect(openGwBuildPointDecision(G)).toBe(false);
});

// ---------------------------------------------------------------------------
// Alternate GW steps 3-4: uncontrolled keys and manpower
// ---------------------------------------------------------------------------

test("alternate-GW setup takes its printed uncontrolled keys and derives manpower", () => {
  for (const id of ["altGw1", "altGw2", "altGw3"] as const) {
    const G = setup(id);
    const def = SCENARIOS[id];
    const claimed = G.log.filter((entry) => entry.key === "gwSetupControl");
    expect(claimed.length).toBeGreaterThan(0);
    // Every claimed space now carries that power's control marker.
    for (const entry of claimed) {
      expect(G.spaces[String(entry.args?.space)].control).toBe(entry.power);
    }
    // No power claims more than its printed total.
    const printedTotal = Object.values(def.special.altGw!.uncontrolledKeys).reduce(
      (total, counts) => total + (counts?.africa ?? 0) + (counts?.asia ?? 0),
      0,
    );
    expect(claimed.length).toBeLessThanOrEqual(printedTotal);
    // Step 4: the track state already reflects the final board, so a fresh
    // recomputation changes nothing (manpower, territorial and colonial keys).
    const clone = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
    recomputeTracks(clone);
    for (const power of POWERS) {
      expect(clone.powers[power].manpower).toBe(G.powers[power].manpower);
      expect(clone.powers[power].territorialKeys).toBe(G.powers[power].territorialKeys);
      expect(clone.powers[power].colonialKeys).toBe(G.powers[power].colonialKeys);
    }
  }
});

// ---------------------------------------------------------------------------
// Alternate GW step 5: legal unit placement
// ---------------------------------------------------------------------------

test.each(["altGw2", "altGw3"])("%s places Italy's printed inventory in Italy, not in uncontrolled spaces", (id) => {
  const G = setup(id);
  const italian = Object.values(G.units).filter((unit) => unit.owner === "IT");
  expect(italian.length).toBeGreaterThan(0);
  const deployable = new Set(["rome", "piedmont", "lombardy", "tuscany", "naples"]);
  for (const unit of italian) {
    if (unit.space === null || unit.space === undefined) continue;
    // Italy's own spaces and its printed holdings (scenario 2 also prints
    // Tripoli/Benghazi/Cyprus; those are not unit spaces).
    expect(deployable.has(unit.space)).toBe(true);
  }
  // 22.4: the fleet sits in Naples/Piedmont, never in an ocean box.
  for (const unit of italian.filter((entry) => entry.kind === "squadron" || entry.kind === "dreadnought")) {
    expect(["naples", "piedmont"]).toContain(unit.space);
  }
  expect(italian.filter((unit) => unit.kind === "italianArmy")).toHaveLength(3);
});

test.each(["altGw1", "altGw2", "altGw3"] as const)("%s places every printed counter in a legal position", (id) => {
  const G = setup(id);
  // Naval units are in ports, no port exceeds its printed capacity, and no
  // player has more than the printed two naval units on a non-main submap.
  const perPort: Record<string, number> = {};
  for (const unit of navalUnits(G)) {
    if (unit.space === null || unit.space === undefined) continue;
    expect(portBoxes(unit.space).length > 0 || SPACES[unit.space]?.type === "navalBox").toBe(true);
    perPort[unit.space] = (perPort[unit.space] ?? 0) + 1;
  }
  for (const [space, count] of Object.entries(perPort)) {
    if (SPACES[space]?.type === "navalBox") continue;
    expect(count).toBeLessThanOrEqual(PORT_NAVAL_LIMIT);
  }
  // Land stacking: no space is above its normal stacking limit, and no space
  // has more than the printed two setup armies of one power.
  for (const [space, state] of Object.entries(G.spaces)) {
    if (SPACES[space]?.type === "navalBox") continue;
    const land = state.units.map((unitId) => G.units[unitId]).filter((unit) => unit !== undefined && !unit.naval);
    expect(land.length).toBeLessThanOrEqual(landStackingLimit(space));
    for (const power of POWERS) {
      const ownArmies = land.filter((unit) => unit.owner === power && (unit.kind === "army" || unit.kind === "minorArmy"));
      expect(ownArmies.length).toBeLessThanOrEqual(2);
    }
  }
  // Italy's unification spaces are not overstacked when its inventory is placed.
  if (id !== "altGw1") {
    const rome = G.spaces.rome.units.map((unitId) => G.units[unitId]).filter((unit) => unit?.owner === "IT" && unit.kind === "italianArmy");
    expect(rome.length).toBeLessThanOrEqual(2);
  }
});

test("no printed alternate-GW counter is dropped", () => {
  for (const id of ["altGw1", "altGw2", "altGw3"] as const) {
    const def = SCENARIOS[id];
    const G = setup(id);
    for (const power of POWERS) {
      const inventory = def.special.altGw?.units?.[power] ?? [];
      const printed = inventory.reduce((total, entry) => total + entry.count, 0);
      if (printed === 0) continue;
      const placed = Object.values(G.units).filter((unit) => unit.owner === power).length;
      expect(placed).toBeGreaterThanOrEqual(printed);
    }
    const italy = def.special.altGw?.units?.Italy ?? [];
    if (italy.length > 0) {
      const printed = italy.reduce((total, entry) => total + entry.count, 0);
      expect(Object.values(G.units).filter((unit) => unit.owner === "IT").length).toBeGreaterThanOrEqual(printed);
    }
  }
});

// ---------------------------------------------------------------------------
// Printed alliances, Poland and the starting war
// ---------------------------------------------------------------------------

test("alternate GW 1 gives AU the printed Papal States alliance", () => {
  const G = setup("altGw1");
  expect(G.spaces.rome.ally).toBe("AU");
  expect(G.spaces.rome.control).toBe("Papal States");
});

test("alternate GW 2 records independent Poland, allied to AU and at war with RU", () => {
  const G = setup("altGw2");
  expect(G.spaces.poland.control).toBe("Poland");
  expect(G.spaces.poland.ally).toBe("AU");
  expect(G.persistent["startingWar:RU:Poland"]).toBe(true);
  expect(G.log.some((entry) => entry.key === "scenarioStartingWar")).toBe(true);
  // 22.5(1): the printed "1 reserve army" waits in the Polish reserve box.
  const reserve = G.nonPlayerBuildBox?.poland?.reserveArmies ?? [];
  expect(reserve).toHaveLength(1);
  const unit = G.units[reserve[0]];
  expect(unit).toMatchObject({owner: "Poland", kind: "reserveArmy", steps: 1});
});

// ---------------------------------------------------------------------------
// Victory: the alternate scenarios' own rule
// ---------------------------------------------------------------------------

test("only the alternate GW pages replace 31.0's neutral-VP comparison", () => {
  expect(altGwVictoryOnly(setup("altGw1"))).toBe(true);
  expect(altGwVictoryOnly(setup("altGw2"))).toBe(true);
  expect(altGwVictoryOnly(setup("altGw3"))).toBe(true);
  expect(altGwVictoryOnly(setup("gwTutorial"))).toBe(false);
  expect(altGwVictoryOnly(setup("campaign"))).toBe(false);
});

test("an alternate GW's alliance victory is not stolen by a neutral player", () => {
  // Alternate GW 3: TE = FR/RU, TA = UK/OT, neutral = GE/AU.
  const G = setup("altGw3");
  // Reduce the Triple Alliance to one living power so the war is decided.
  G.powers.OT.eliminated = true;
  // A neutral with a huge VP total must not take the game: the printed rule is
  // "the team that wins the GW wins the game, all other players lose".
  G.powers.GE.vp = 999;
  endGreatWar(G, ctxOf(), "onePower");
  expect(G.gw?.victor).toBe("te");
  expect(G.result?.winners.sort()).toEqual(["FR", "RU"]);
  expect(G.result?.winners).not.toContain("GE");
});

test("every GW scenario still opens inside the Great War", () => {
  for (const id of ["gwTutorial", "altGw1", "altGw2", "altGw3"] as const) {
    expect(startingGwTurn(setup(id))).toBe(0);
  }
});

// ---------------------------------------------------------------------------
// The opening history lines name the scenario that is actually being played
// ---------------------------------------------------------------------------

test("a Great-War scenario does not claim the 1850 campaign has begun", () => {
  for (const id of ["gwTutorial", "altGw1", "altGw2", "altGw3"] as const) {
    const G = setup(id);
    expect(G.log.some((entry) => entry.key === "campaignStarted")).toBe(false);
    // Its own start is already on the ledger (playbook p. 7).
    expect(G.log.some((entry) => entry.key === "greatWarOutbreak")).toBe(true);
  }
  // The campaign itself still opens with the 1850 line.
  expect(setup("campaign").log.some((entry) => entry.key === "campaignStarted")).toBe(true);
});

test("the planning step is written to the log once per GW turn", () => {
  const G = setup("gwTutorial");
  const turn = G.gw?.turn ?? 0;
  // `prepBegin` and the planning phase hook both call beginGwTurn on a fresh
  // match; the history must not show the same planning step twice.
  beginGwTurn(G, ctxOf());
  beginGwTurn(G, ctxOf());
  const planning = G.log.filter((entry) => entry.key === "gwPlanning" && entry.args?.turn === turn);
  expect(planning).toHaveLength(1);
});
