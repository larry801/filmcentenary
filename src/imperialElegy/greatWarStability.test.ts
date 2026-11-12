import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyKeyLoss, outbreakGreatWar, unifyItaly, winter} from "./engine/greatWar";
import * as rules from "./engine/rules";

const makeCtx = (dieValue = 3, onRoll?: () => void): Ctx =>
  ({
    playerID: "0",
    random: {
      Die: (_sides: number) => {
        onRoll?.();
        return dieValue;
      },
    },
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

const activateGw = (G: ImperialElegyState, overrides: Partial<GreatWarState> = {}): void => {
  G.gw = {
    active: true,
    turn: 1,
    order: [],
    belligerents: [],
    neutrals: [],
    te: [],
    ta: [],
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
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("applyKeyLoss", () => {
  test("RU Scorched Earth absorbs the first key loss and not the second", () => {
    const G = fresh();
    activateGw(G);
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;
    G.spaces["st-petersburg"].control = "GE";
    const ctx = makeCtx(3);
    const spy = jest.spyOn(rules, "changeStability");

    // First key loss: Scorched Earth sees cause "keyLoss" and is consumed.
    expect(applyKeyLoss(G, "RU", "st-petersburg", ctx)).toBe(0);
    expect(G.powers.RU.stability).toBe(4);
    expect(G.powers.RU.scorchedEarth).toBe(false);
    expect(spy).toHaveBeenCalledWith(G, "RU", -1, ctx, {
      cause: "keyLoss",
      space: "st-petersburg",
    });

    // Second key loss: the characteristic is spent, so the point is real.
    expect(applyKeyLoss(G, "RU", "st-petersburg", ctx)).toBe(-1);
    expect(G.powers.RU.stability).toBe(3);
    expect(G.powers.RU.scorchedEarth).toBe(false);
  });

  test("AU and FR characteristics stay inert during the Great War", () => {
    const G = fresh();
    activateGw(G);
    G.powers.AU.stability = 3;
    G.powers.AU.rights = ["Hungarians", "Czechs"];
    G.spaces.vienna.control = "GE";
    G.powers.FR.stability = 2;
    G.spaces.paris.control = "GE";
    let rolls = 0;
    const ctx = makeCtx(1, () => {
      rolls += 1;
    });

    expect(applyKeyLoss(G, "AU", "vienna", ctx)).toBe(-1);
    expect(G.powers.AU.stability).toBe(2);
    expect(G.log.some((entry) => entry.key === "auUnstable")).toBe(false);

    expect(applyKeyLoss(G, "FR", "paris", ctx)).toBe(-1);
    expect(G.powers.FR.stability).toBe(1);
    expect(G.powers.FR.government).toBe("secondEmpire");
    expect(G.log.some((entry) => entry.key === "frThirdRepublic")).toBe(false);
    // Neither AU's Unstable Situation nor FR's government check consumes a die.
    expect(rolls).toBe(0);
  });

  test("rejects an unknown power, an unknown/non-key space, and a still-held key", () => {
    const G = fresh();
    activateGw(G);
    G.powers.RU.stability = 4;
    const ctx = makeCtx(3);

    expect(applyKeyLoss(G, "XX" as Power, "st-petersburg", ctx)).toBe(0);
    expect(applyKeyLoss(G, "RU", "does-not-exist", ctx)).toBe(0);
    expect(applyKeyLoss(G, "RU", "algeria", ctx)).toBe(0);

    // The key was retaken (still controlled by RU), so there is no loss.
    G.spaces["st-petersburg"].control = "RU";
    expect(applyKeyLoss(G, "RU", "st-petersburg", ctx)).toBe(0);

    expect(G.powers.RU.stability).toBe(4);
    expect(G.powers.RU.scorchedEarth).toBe(true);
  });
});

describe("Great War stability routing", () => {
  test("the legacy winter helper runs the live 29.2 colonial war and routes stability through changeStability", () => {
    const G = fresh();
    activateGw(G, {
      turn: 0,
      order: ["FR", "RU"],
      belligerents: ["FR", "RU"],
      neutrals: [],
      te: ["FR"],
      ta: ["RU"],
    });
    G.powers.FR.alliance = "teCommitted";
    G.powers.RU.alliance = "taCommitted";
    G.powers.FR.stability = 5;
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;
    const spy = jest.spyOn(rules, "changeStability");

    winter(G, makeCtx(3));

    // The deprecated helper delegates to `resolveGwWinter`, so the printed
    // 29.2 result is recorded and the turn advances.
    expect(G.gw!.lastColonialWar).toBeTruthy();
    expect(G.gw!.lastColonialWar).toHaveProperty("africa");
    expect(G.gw!.lastColonialWar).toHaveProperty("asia");
    expect(G.gw!.turn).toBe(1);
    expect(G.powers.RU.scorchedEarth).toBe(true);

    // Any colonial-war stability change still goes through the routed helper
    // with a single -1 and cause "war".
    const warCalls = spy.mock.calls.filter((call) => call[4]?.cause === "war");
    for (const call of warCalls) expect(call[2]).toBe(-1);
  });

  test("national-will stability boosts go through changeStability", () => {
    const G = fresh();
    G.powers.GE.vp = 5;
    G.powers.GE.stability = 3;
    const ctx = makeCtx(3);
    const spy = jest.spyOn(rules, "changeStability");

    outbreakGreatWar(G, ctx, "GE", "test");

    expect(G.powers.GE.stability).toBe(4);
    expect(spy).toHaveBeenCalledWith(G, "GE", 1, ctx);
  });

  test("Italy unification no longer mutates AU stability as a no-op", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    const ctx = makeCtx(3);
    const spy = jest.spyOn(rules, "changeStability");

    unifyItaly(G, ctx, "GE");

    expect(G.persistent.italyUnified).toBe(true);
    expect(G.powers.AU.stability).toBe(3);
    expect(spy).not.toHaveBeenCalled();
    // Static guard: the old direct assignment cannot come back unnoticed.
    expect(unifyItaly.toString()).not.toContain("powers.AU.stability");
  });
});
