/**
 * 15.4: an allied minor power's units fight for their controller.  A Great War
 * battle must therefore never be opened against a minor unit controlled by the
 * attacker (or by one of the attacker's allies).  The shared `hostileOwner`
 * predicate is what `beginLandBattle`, naval contact and the support helpers
 * all read, so the regression is pinned here as well as through a seeded game.
 */
import {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {ImperialElegyState, Power} from "./types";
import {hostileOwner, minorController} from "./engine/rules";
import {beginLandBattle} from "./engine/combat";
import {MINOR_POWER_HOMES} from "./constant/setup";
import {neighboursOf} from "./constant/spaces";

const ctx = {playerID: "0", random: {Die: () => 3}} as unknown as Ctx;

const withMinor = (minor: string, controller: Power | null): ImperialElegyState => {
  const G = setupImperialElegy(ctx);
  const home = MINOR_POWER_HOMES[minor]!;
  G.spaces[home].control = minor;
  G.spaces[home].ally = controller;
  return G;
};

describe("15.4 allied minor units are friendly", () => {
  test("a minor controlled by the same power is not hostile", () => {
    const G = withMinor("Bavaria", "GE");
    expect(minorController(G, "Bavaria")).toBe("GE");
    expect(hostileOwner(G, "GE", "Bavaria")).toBe(false);
  });

  test("a minor controlled by an ally is not hostile during the Great War", () => {
    const G = withMinor("Netherlands", "AU");
    G.gw = {
      active: true, turn: 1, order: ["UK", "AU"], belligerents: ["UK", "AU"], neutrals: [],
      te: ["UK", "AU"], ta: [], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    expect(hostileOwner(G, "FR", "Netherlands")).toBe(false);
  });

  test("a minor controlled by an enemy is hostile and can be attacked", () => {
    const G = withMinor("Bavaria", "GE");
    const bavaria = MINOR_POWER_HOMES.Bavaria!;
    const from = neighboursOf(bavaria)[0];
    const attacker = Object.values(G.units).find((unit) => unit.owner === "FR" && !unit.naval && unit.space !== null);
    expect(attacker).toBeDefined();
    attacker!.space = from;
    attacker!.steps = 2;
    G.spaces[from].units = [attacker!.id];
    G.units.uBavaria = {id: "uBavaria", kind: "minorArmy", owner: "Bavaria", steps: 2, space: bavaria, naval: false};
    G.spaces[bavaria].units = ["uBavaria"];
    G.gw = {
      active: true, turn: 1, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    expect(hostileOwner(G, "FR", "Bavaria")).toBe(true);
    expect(beginLandBattle(G, ctx, "FR", from, bavaria)).not.toBeNull();
  });

  test("the controlling power cannot open a battle against its own minor", () => {
    const G = withMinor("Bavaria", "GE");
    const bavaria = MINOR_POWER_HOMES.Bavaria!;
    const from = neighboursOf(bavaria)[0];
    const attacker = Object.values(G.units).find((unit) => unit.owner === "GE" && !unit.naval && unit.space !== null);
    expect(attacker).toBeDefined();
    attacker!.space = from;
    attacker!.steps = 2;
    G.spaces[from].units = [attacker!.id];
    G.units.uBavaria = {id: "uBavaria", kind: "minorArmy", owner: "Bavaria", steps: 2, space: bavaria, naval: false};
    G.spaces[bavaria].units = ["uBavaria"];
    G.gw = {
      active: true, turn: 1, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    expect(beginLandBattle(G, ctx, "GE", from, bavaria)).toBeNull();
  });
});
