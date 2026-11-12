/**
 * 30.1 / 15.6 / 5.7 — orphaned minor-power units after a player elimination.
 *
 * 30.1: "If any of the eliminated player's allies were actively fighting in the
 * GW, replace the eliminated player's ally marker with an ally marker belonging
 * to a member of their alliance (that player now controls the minor power's
 * units)."  When no member survives the ally marker is removed — and the same
 * is true for a minor that has already been permanently eliminated.  Before
 * this change those minor-power units were left on the map with no commander.
 *
 * The deterministic cleanup follows 5.7 for an independent minor: withdraw to a
 * friendly controlled space with a LoC (its own home key), otherwise displace a
 * naval unit to an adjacent box, otherwise eliminate the unit.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {eliminatePower} from "./engine/rules";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

interface GwOptions {
  order?: Power[];
  te?: Power[];
  ta?: Power[];
  belligerents?: Power[];
}

const gwState = (options: GwOptions = {}): ImperialElegyState => {
  const G = fresh();
  G.gw = {
    active: true,
    turn: 1,
    order: options.order ?? ["FR", "GE"],
    belligerents: options.belligerents ?? ["FR", "GE"],
    neutrals: [],
    te: options.te ?? ["FR"],
    ta: options.ta ?? ["GE"],
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
  } as GreatWarState;
  G.phase = "gwManeuver";
  return G;
};

/** GE controls Tuscany's ally marker and the minor has an army on GE soil. */
const orphanFixture = (): {G: ImperialElegyState; unit: string} => {
  const G = gwState();
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.spaces.tuscany.ally = "GE";
  // Silesia is GE's formally controlled territory; Tuscany's home stays its own.
  G.spaces.silesia.control = "GE";
  const unit = placeUnit(G, "Tuscany", "army", "silesia", 2).id;
  return {G, unit};
};

const disbandLogs = (G: ImperialElegyState) => G.log.filter((entry) => entry.key === "minorUnitsDisbanded");

describe("30.1 orphaned minor units with no surviving alliance member", () => {
  test("a land unit withdraws to its home key instead of being left orphaned", () => {
    const {G, unit} = orphanFixture();

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.powers.GE.eliminated).toBe(true);
    expect(G.spaces.tuscany.ally).toBeNull();
    expect(G.units[unit]).toBeDefined();
    expect(G.units[unit].space).toBe("tuscany");
    expect(G.spaces.silesia.units).not.toContain(unit);
    const entry = disbandLogs(G)[0];
    expect(entry?.args).toMatchObject({minor: "Tuscany", leaving: "GE", displaced: 1, eliminated: 0});
  });

  test("a unit with no friendly controlled space with a LoC is eliminated", () => {
    const {G, unit} = orphanFixture();
    // GE has taken Tuscany itself, so the minor controls nowhere to withdraw to.
    G.spaces.tuscany.control = "GE";

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[unit]).toBeUndefined();
    const entry = disbandLogs(G)[0];
    expect(entry?.args).toMatchObject({minor: "Tuscany", displaced: 0, eliminated: 1});
  });

  test("a naval unit displaces to an adjacent naval box", () => {
    const G = gwState();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.spaces.tuscany.ally = "GE";
    const fleet = placeUnit(G, "Tuscany", "squadron", "tuscany", 2).id;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[fleet]).toBeDefined();
    expect(G.units[fleet].space).toBe("western-mediterranean");
    expect(disbandLogs(G)[0].args).toMatchObject({minor: "Tuscany", displaced: 1, eliminated: 0});
  });

  test("a permanently eliminated minor's remaining counters leave play", () => {
    const G = gwState();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.spaces.tuscany.ally = "GE";
    G.eliminatedMinors = ["Tuscany"];
    const unit = placeUnit(G, "Tuscany", "army", "tuscany", 2).id;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.units[unit]).toBeUndefined();
    expect(disbandLogs(G)[0].args).toMatchObject({minor: "Tuscany", displaced: 0, eliminated: 1});
  });

  test("the disbandment is logged once and is idempotent", () => {
    const {G} = orphanFixture();

    eliminatePower(G, "GE", makeCtx(), "capital");
    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(disbandLogs(G)).toHaveLength(1);
  });
});

describe("30.1 a surviving alliance member inherits the minor", () => {
  test("the heir takes the ally marker and the minor's units stay in play", () => {
    const G = gwState({order: ["FR", "GE", "OT"], ta: ["GE", "OT"], belligerents: ["FR", "GE", "OT"]});
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.OT.alliance = "taCommitted";
    G.spaces.tuscany.ally = "GE";
    G.spaces.silesia.control = "GE";
    const unit = placeUnit(G, "Tuscany", "army", "silesia", 2).id;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.spaces.tuscany.ally).toBe("OT");
    expect(G.units[unit]).toBeDefined();
    // 30.1 does not leave an orphan: OT now commands Tuscany's units.
    expect(disbandLogs(G)).toHaveLength(0);
  });

  test("a minor that still has its own controller is untouched", () => {
    const G = gwState();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    // Tuscany is controlled by FR, so GE's elimination cannot orphan it.
    G.spaces.tuscany.ally = "FR";
    const unit = placeUnit(G, "Tuscany", "army", "silesia", 2).id;

    eliminatePower(G, "GE", makeCtx(), "capital");

    expect(G.spaces.tuscany.ally).toBe("FR");
    expect(G.units[unit]).toBeDefined();
    expect(disbandLogs(G)).toHaveLength(0);
  });
});

test("a minor unit that was already off the map is ignored", () => {
  const G = gwState();
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.spaces.tuscany.ally = "GE";
  const reserve = placeUnit(G, "Tuscany", "army", "silesia", 2);
  removeUnit(G, reserve.id); // no longer in G.units at all

  eliminatePower(G, "GE", makeCtx(), "capital");

  expect(disbandLogs(G)).toHaveLength(0);
});
