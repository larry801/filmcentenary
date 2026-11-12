/**
 * 29.1 Blockade — the RU Pacific gate applies to RU's allies.
 *
 * "Exception: for the purposes of this rule, the RU player can only trace a LOC
 * to the Pacific Ocean if the TSRR is completed."  15.2.5 grants the same TSRR
 * route to "players allied to RU", and the GW rail helper already reads
 * eligibility through `tsrrConnectionUsable`.  The blockade trace therefore
 * lets RU and its allies reach the Pacific boxes / TSRR land connections only
 * while the railroad is complete; a power not allied to RU keeps the ordinary
 * sea route.  The Baltic/Black Sea exemption and the enemy-box rule are
 * unchanged.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {blockadePlan, blockadeTrace, tsrrConnectionUsable} from "./engine/greatWarFlow";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 2,
    order: ["FR", "GE", "RU"],
    belligerents: ["FR", "GE", "RU"],
    neutrals: ["UK", "AU", "OT"],
    te: ["FR", "RU"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    ...overrides,
  };
  G.powers.FR.alliance = "teCommitted";
  G.powers.RU.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

/** Cut every sea box so the only route to the Pacific is the TSRR. */
const cutTheSeas = (G: ImperialElegyState): void => {
  for (const box of [
    "north-atlantic",
    "south-atlantic",
    "western-mediterranean",
    "eastern-mediterranean",
    "indian-ocean",
    "baltic-sea",
    "black-sea",
  ]) {
    placeUnit(G, "GE", "squadron", box, 2);
  }
};

/** A friendly land corridor from Paris to Moscow, so FR can reach the TSRR. */
const openFrToMoscow = (G: ImperialElegyState): void => {
  for (const space of ["picardy", "belgium", "westphalia", "saxony", "silesia", "poland", "belorussia", "smolensk"]) {
    G.spaces[space].control = "FR";
  }
};

describe("29.1 RU allies and the Pacific gate", () => {
  test("the TSRR eligibility is RU / RU-allied only and requires a complete railroad", () => {
    const G = baseGw();
    expect(tsrrConnectionUsable(G, "RU")).toBe(false);
    expect(tsrrConnectionUsable(G, "FR")).toBe(false);
    G.powers.RU.tsrr = true;
    expect(tsrrConnectionUsable(G, "RU")).toBe(true);
    expect(tsrrConnectionUsable(G, "FR")).toBe(true);
    expect(tsrrConnectionUsable(G, "GE")).toBe(false);
  });

  test("an RU ally's only Pacific route is the completed railroad", () => {
    const G = baseGw();
    cutTheSeas(G);
    openFrToMoscow(G);

    // Incomplete: the TSRR land links are closed and the Pacific is not
    // reachable, so the only boxes are the exempt Baltic/Black Seas.
    expect(blockadeTrace(G, "FR").filter((box) => box === "pacific-ocean" || box === "south-central-pacific")).toEqual([]);
    expect(blockadePlan(G)).toContain("FR");

    // Complete: RU's ally may use the line, opening both Pacific boxes.
    G.powers.RU.tsrr = true;
    expect(blockadeTrace(G, "FR")).toContain("pacific-ocean");
    expect(blockadePlan(G)).not.toContain("FR");
  });

  test("an RU ally without the TSRR cannot reach the Pacific even by its own sea route", () => {
    const G = baseGw({te: ["UK", "RU"], ta: ["GE"], belligerents: ["UK", "RU", "GE"]});
    G.powers.UK.alliance = "teCommitted";
    // The Indian Ocean is open and UK's Asian ports touch the Pacific.
    expect(blockadeTrace(G, "UK")).toContain("indian-ocean");
    expect(blockadeTrace(G, "UK")).not.toContain("pacific-ocean");

    G.powers.RU.tsrr = true;
    expect(blockadeTrace(G, "UK")).toContain("pacific-ocean");
  });

  test("a power not allied to RU keeps its ordinary Pacific sea route", () => {
    const G = baseGw({te: ["RU"], ta: ["UK", "GE"], belligerents: ["RU", "UK", "GE"]});
    G.powers.UK.alliance = "taCommitted";
    G.powers.RU.tsrr = false;
    // UK is at war with RU, so the RU ally gate does not apply.
    expect(blockadeTrace(G, "UK")).toContain("pacific-ocean");
  });

  test("RU itself still cannot use the Pacific while the railroad is incomplete", () => {
    const G = baseGw({te: ["RU"], ta: ["GE"], order: ["RU", "GE"], belligerents: ["RU", "GE"]});
    cutTheSeas(G);
    expect(blockadeTrace(G, "RU")).not.toContain("pacific-ocean");
    expect(blockadePlan(G)).toContain("RU");
    G.powers.RU.tsrr = true;
    expect(blockadeTrace(G, "RU")).toContain("pacific-ocean");
    expect(blockadePlan(G)).not.toContain("RU");
  });

});

