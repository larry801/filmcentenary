/**
 * End-phase completeness tests (rule 20.0–20.12).
 *
 * `resolveEnd` must walk the printed twelve-step order.  These tests pin five
 * things:
 *  - the printed order, via the optional trace sink;
 *  - the steps that already worked (20.1, 20.2, 20.5, 20.6, 20.7, 20.10,
 *    20.11, 20.12) still behave the same;
 *  - 20.3 non-player power builds (the End Phase Build Box bookkeeping);
 *  - 20.4 naval units returning to port (including port stacking and
 *    elimination);
 *  - 20.8 Wars of Independence and the 20.9 alliance-resolution step.
 */

import type {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ALL_CARDS} from "./engine/deck";
import {placeUnit, removeUnit} from "./engine/effects";
import {endPhaseOrder, reserveAllowance} from "./engine/economy";
import {initialNonPlayerBuildBox, nonPlayerBuildPlan} from "./engine/endPhase";
import {unifyItaly} from "./engine/greatWar";
import {allianceMembers} from "./engine/alliance";
import {playCard, resolveEnd} from "./moves";
import {SPACES} from "./constant/spaces";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "end",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const unitsOf = (G: ImperialElegyState, owner: string) =>
  Object.values(G.units).filter((unit) => unit.owner === owner);

// ---------------------------------------------------------------------------
// Printed order
// ---------------------------------------------------------------------------

test("resolveEnd walks all twelve printed steps in order", () => {
  const G = fresh();
  const trace: string[] = [];
  resolveEnd(G, makeCtx(), trace);
  expect(trace).toEqual(endPhaseOrder().map((step) => step.key));
  expect(trace).toHaveLength(12);
  expect(trace[2]).toBe("nonPlayerBuild");
  expect(trace[3]).toBe("navalUnitsToPort");
  expect(trace[7]).toBe("progressWarsOfIndependence");
  expect(trace[8]).toBe("allianceResolution");
});

// ---------------------------------------------------------------------------
// 20.1 / 20.2 — preserved behaviour + Indian fort exemption
// ---------------------------------------------------------------------------

test("20.1 reserve growth is unchanged and 20.2 degrades every non-Indian fort", () => {
  const G = fresh();
  const before = G.powers.GE.reserves.length;
  G.spaces.champagne.fort = {power: "FR", level: 2};
  G.spaces.india.fort = {power: "UK", level: 2, indian: true};

  resolveEnd(G, makeCtx());

  // 20.1 still adds one reserve step for GE (7.3 / 20.1).
  expect(G.powers.GE.reserves.length).toBeGreaterThanOrEqual(before);
  // 20.2: a level-2 fort drops to 1 and a level-1 fort is removed.
  expect(G.spaces.champagne.fort?.level).toBe(1);
  expect(G.spaces.lombardy.fort).toBeNull();
  // 33.2.3: the Indian fort never degrades.
  expect(G.spaces.india.fort).toEqual({power: "UK", level: 2, indian: true});
});

test("the Indian fort is created with fort.indian by the Sun Never Sets home card", () => {
  const G = fresh();
  const ctx = makeCtx([], seat("UK"));
  G.phase = "action";
  G.activePower = "UK";
  G.cpRemaining = 0;
  G.powers.UK.hand.push("IE-H-UK-3");

  expect(playCard(G, ctx, "IE-H-UK-3", "event")).toBeUndefined();
  expect(G.spaces.india.fort).toMatchObject({power: "UK", level: 1, indian: true});

  // 20.2 then leaves it alone while degrading the ordinary forts.
  resolveEnd(G, ctx);
  expect(G.spaces.india.fort?.level).toBe(1);
  expect(G.spaces.lombardy.fort).toBeNull();
});

test("a legacy UK fort in India without the flag is repaired to the Indian fort", () => {
  const G = fresh();
  G.spaces.india.fort = {power: "UK", level: 2};
  resolveEnd(G, makeCtx());
  expect(G.spaces.india.fort).toEqual({power: "UK", level: 2, indian: true});
});

// ---------------------------------------------------------------------------
// 20.3 — Non-Player Power Build Step
// ---------------------------------------------------------------------------

test("the build box defaults to the printed roster and each minor gets one army step", () => {
  const G = fresh();
  // Round 7: `setupImperialElegy` now writes the migrated defaults, so the
  // printed campaign box is already on a fresh state.  Delete it again to keep
  // covering the lazy 20.3 fallback a pre-migration save relies on.
  expect(G.nonPlayerBuildBox?.minors).toEqual(initialNonPlayerBuildBox().minors);
  delete G.nonPlayerBuildBox;

  resolveEnd(G, makeCtx());

  expect(G.nonPlayerBuildBox?.minors).toEqual(initialNonPlayerBuildBox().minors);
  // Tuscany starts with no army: the reduced army from the box is placed on
  // the minor's name space (20.3 example: Serbian units are placed in Serbia).
  const tuscany = unitsOf(G, "Tuscany");
  expect(tuscany).toHaveLength(1);
  expect(tuscany[0].space).toBe("tuscany");
  expect(tuscany[0].steps).toBe(1);
  // Serbia is listed in the red/start box even though the Ottomans control the
  // space, so a reduced Serbian army is placed there too.
  const serbia = unitsOf(G, "Serbia");
  expect(serbia).toHaveLength(1);
  expect(serbia[0].space).toBe("serbia");
});

test("a reduced build-box army is flipped to full strength, not duplicated", () => {
  const G = fresh();
  G.nonPlayerBuildBox = {minors: ["Saxony"], italy: {italianArmy: 0, squadron: 0, dreadnought: 0}};
  // Saxony starts the campaign with one reduced army on the map.
  const saxon = unitsOf(G, "Saxony")[0];
  expect(saxon.steps).toBe(1);
  const plan = nonPlayerBuildPlan(G);
  expect(plan).toEqual([
    {minor: "Saxony", home: "saxony", action: "promote", unitId: saxon.id, space: "saxony"},
  ]);

  resolveEnd(G, makeCtx());
  expect(unitsOf(G, "Saxony")).toHaveLength(1);
  expect(G.units[saxon.id].steps).toBe(2);
});

test("a minor not in the build box never builds a replacement army", () => {
  const G = fresh();
  G.nonPlayerBuildBox = {minors: [], italy: {italianArmy: 0, squadron: 0, dreadnought: 0}};
  resolveEnd(G, makeCtx());
  // Belgium's starting army was not destroyed, but the point is that no new
  // army appears for a minor outside the box.
  expect(unitsOf(G, "Belgium")).toHaveLength(1);
  expect(unitsOf(G, "Tuscany")).toHaveLength(0);
});

test("an independent Poland builds two army steps (22.5 exception)", () => {
  const G = fresh();
  // 22.5 applies only to an independent Poland (it controls a Polish space).
  G.spaces.poland.control = "Poland";
  G.nonPlayerBuildBox = {minors: ["Poland"], italy: {italianArmy: 0, squadron: 0, dreadnought: 0}};
  resolveEnd(G, makeCtx());
  const polish = unitsOf(G, "Poland");
  expect(polish).toHaveLength(2);
  expect(polish.every((unit) => unit.space === "poland" && unit.steps === 1)).toBe(true);
});

test("a unified Italy flips reduced units to full and rebuilds destroyed units", () => {
  const G = fresh();
  // 22.2/22.4: a real unified Italy controls its spaces, so the rebuild can
  // use the printed Rome/frontier/Naples redeployment (not the old seeding).
  unifyItaly(G, makeCtx(), "GE");
  const reduced = unitsOf(G, "IT").find((unit) => unit.kind === "italianArmy")!;
  const doomed = unitsOf(G, "IT").find((unit) => unit.kind === "squadron")!;
  reduced.steps = 1;
  removeUnit(G, doomed.id);
  expect(G.nonPlayerBuildBox?.italy.squadron).toBe(1);

  resolveEnd(G, makeCtx());

  expect(G.units[reduced.id].steps).toBe(2);
  const italianShips = unitsOf(G, "IT").filter((unit) => unit.kind === "squadron");
  expect(italianShips).toHaveLength(1);
  expect(G.nonPlayerBuildBox?.italy).toEqual({italianArmy: 0, squadron: 0, dreadnought: 0});
});

// ---------------------------------------------------------------------------
// 20.4 — Naval Units Go to Port
// ---------------------------------------------------------------------------

test("naval units at sea return to the nearest friendly port, preserving steps", () => {
  const G = fresh();
  const ship = placeUnit(G, "UK", "squadron", "north-atlantic", 1);
  resolveEnd(G, makeCtx());
  const port = G.units[ship.id].space!;
  expect(G.spaces[port].control).toBe("UK");
  expect(SPACES[port].ports).toContain("north-atlantic");
  expect(G.units[ship.id].steps).toBe(1);
});

test("a full port is not overstacked: the unit stays at sea", () => {
  const G = fresh();
  // Strip France's other ports so Provence is the only friendly one, then fill
  // it to the four-unit limit.
  for (const space of ["brittany", "picardy", "aquitaine", "algeria"]) G.spaces[space].control = "GE";
  // West Africa is uncontrolled with French influence (20.4 allows moving in);
  // remove it so Provence really is the only friendly port.
  G.spaces["west-africa"].influence = null;
  G.spaces.provence.units = [];
  for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "squadron", "provence", 2);
  const waiting = placeUnit(G, "FR", "squadron", "western-mediterranean", 2);

  resolveEnd(G, makeCtx());

  expect(G.units[waiting.id].space).toBe("western-mediterranean");
  expect(G.spaces["western-mediterranean"].units).toContain(waiting.id);
});

test("a power that controls no port loses its naval units at sea", () => {
  const G = fresh();
  for (const space of ["provence", "brittany", "picardy", "aquitaine", "algeria"]) G.spaces[space].control = "GE";
  G.spaces["west-africa"].influence = null;
  const ship = placeUnit(G, "FR", "squadron", "western-mediterranean", 2);

  resolveEnd(G, makeCtx());

  expect(G.units[ship.id]).toBeUndefined();
});

test("enemy-controlled ports are never used for the return", () => {
  const G = fresh();
  // Make London enemy-held; the UK fleet must go to Scotland instead.
  G.spaces.london.control = "GE";
  const ship = placeUnit(G, "UK", "squadron", "north-atlantic", 2);
  resolveEnd(G, makeCtx());
  expect(G.units[ship.id].space).not.toBe("london");
  expect(G.spaces[G.units[ship.id].space!].control).toBe("UK");
});

// ---------------------------------------------------------------------------
// 20.8 — Wars of Independence
// ---------------------------------------------------------------------------

test("a +1 WoI marker gains independence, displaces foreign units and costs 1 stability", () => {
  const G = fresh();
  G.spaces.india.rebellion = {minor: "Sepoy", step: 1, rebels: []};
  const ukArmy = placeUnit(G, "UK", "army", "india", 2);
  const rebel = placeUnit(G, "REBEL:Sepoy", "rebelArmy", "india", 2);
  G.spaces.india.rebellion.rebels.push(rebel.id);
  const before = G.powers.UK.stability;

  resolveEnd(G, makeCtx());

  expect(G.spaces.india.control).toBe("Sepoy");
  expect(G.spaces.india.rebellion).toBeNull();
  // The rebel belongs to the new minor and stays; the UK unit is displaced to
  // a friendly space with a LoC (5.7).
  expect(G.units[rebel.id]?.space).toBe("india");
  expect(G.units[ukArmy.id]?.space).not.toBe("india");
  expect(G.powers.UK.stability).toBe(before - 1);
});

test("a 0 WoI marker only flips to +1 during its first end phase", () => {
  const G = fresh();
  G.spaces.serbia.rebellion = {minor: "Serbia", step: 0, rebels: []};

  resolveEnd(G, makeCtx());
  expect(G.spaces.serbia.control).toBe("OT");
  expect(G.spaces.serbia.rebellion?.step).toBe(1);

  // The next end phase (the marker now began on +1) grants independence.
  resolveEnd(G, makeCtx());
  expect(G.spaces.serbia.control).toBe("Serbia");
  expect(G.spaces.serbia.rebellion).toBeNull();
});

// ---------------------------------------------------------------------------
// 20.9 — Alliance resolution
// ---------------------------------------------------------------------------

test("20.9 resolves alliance influence and resets the MPIT to the new position", () => {
  const G = fresh();
  G.powers.GE.mpit = {te: 5, ta: 0, neutral: 0};
  resolveEnd(G, makeCtx());
  expect(G.powers.GE.alliance).toBe("teAligned");
  expect(G.powers.GE.mpit).toEqual({te: 1, ta: 0, neutral: 0});
});

test("20.9 refuses a shift into an alliance that already has three players", () => {
  const G = fresh();
  G.powers.UK.alliance = "teAligned";
  G.powers.FR.alliance = "teCommitted";
  G.powers.RU.alliance = "teAligned";
  expect(allianceMembers(G, "te")).toHaveLength(3);
  G.powers.GE.mpit = {te: 5, ta: 0, neutral: 0};

  resolveEnd(G, makeCtx());

  expect(G.powers.GE.alliance).toBe("neutral");
  expect(G.powers.GE.mpit).toEqual({te: 0, ta: 0, neutral: 1});
});

// ---------------------------------------------------------------------------
// 20.10–20.12 — preserved behaviour
// ---------------------------------------------------------------------------

test("20.10 lowers the WTT, 20.11 draws NGs on turns 1/3/5 and 20.12 advances", () => {
  const G = fresh();
  G.turn = 1;
  G.wtt = 3;
  resolveEnd(G, makeCtx());
  expect(G.wtt).toBe(2);
  expect(G.turn).toBe(2);
  for (const power of POWERS) {
    expect(String(G.powers[power].flags.ngChoices ?? "").split(",").filter(Boolean)).toHaveLength(3);
  }

  G.turn = 2;
  for (const power of POWERS) G.powers[power].flags.ngChoices = "";
  resolveEnd(G, makeCtx());
  expect(G.turn).toBe(3);
  for (const power of POWERS) expect(G.powers[power].flags.ngChoices).toBe("");
});

test("20.5/20.6 keep the existing manpower and industry behaviour", () => {
  const G = fresh();
  G.persistent.imperialGermany = "pending";
  const industryCard = ALL_CARDS.find(
    (card) =>
      card.kind === "action" &&
      card.cp === 1 &&
      card.type !== "mandatory" &&
      card.type !== "mandatoryResponse" &&
      card.type !== "response" &&
      card.type !== "combat",
  )!.id;
  G.powers.GE.industryCard = industryCard;
  G.powers.GE.industry = 1;
  resolveEnd(G, makeCtx([6]));
  expect(G.persistent.imperialGermany).toBe("granted");
  expect(G.powers.GE.industry).toBe(2);
  expect(G.powers.GE.industryCard).toBeNull();
  expect(G.discard).toContain(industryCard);
});

// Keep the build-box helper honest about the printed setup roster.
test("initialNonPlayerBuildBox matches the campaign setup note", () => {
  expect(initialNonPlayerBuildBox().minors).toEqual(["Tuscany", "Serbia", "Bosnia", "Bulgaria", "Romania"]);
  expect(initialNonPlayerBuildBox().italy).toEqual({italianArmy: 0, squadron: 0, dreadnought: 0});
  expect(SPACES.serbia).toBeDefined();
  expect(reserveAllowance(fresh(), "UK")).toBe(0);
});
