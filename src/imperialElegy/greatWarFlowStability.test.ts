/**
 * 29.2.1 Colonial War Stability — the printed effects are UK-only and RU-only:
 * the UK loses 1 stability for each colonial-war roll its alliance loses, and
 * RU loses 1 when at least two of Central Asia, Qajar Persia and Manchuria are
 * enemy controlled.  Both go through `changeStability(..., {cause: "war"})`,
 * unlike a 30.0 key loss (which Scorched Earth may absorb).
 */
import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {resolveGwWinter} from "./engine/greatWarFlow";
import * as rules from "./engine/rules";

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

const gwState = (
  te: Power[],
  ta: Power[],
  overrides: Partial<GreatWarState> = {},
): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 0, // turn 0 skips the blockade so only the colonial wars change stability
    order: [...te, ...ta],
    belligerents: [...te, ...ta],
    neutrals: [],
    te: [...te],
    ta: [...ta],
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
  for (const power of te) G.powers[power].alliance = "teCommitted";
  for (const power of ta) G.powers[power].alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("29.2.1 UK colonial-war stability", () => {
  test("losing the African roll costs the UK 1 stability with {cause: 'war'}", () => {
    const G = gwState(["UK"], ["GE"]);
    G.powers.UK.stability = 5;
    // Break TE's continental control and give TA a large African modifier.
    G.spaces.nigeria.control = "GE";
    placeUnit(G, "GE", "eliteColonialEf", "east-africa", 1);
    placeUnit(G, "GE", "eliteColonialEf", "somalia", 1);
    const spy = jest.spyOn(rules, "changeStability");

    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.colonialWar.africa.winner).toBe("ta");
    expect(G.powers.UK.stability).toBe(4);
    const ukCall = spy.mock.calls.find((call) => call[1] === "UK" && call[2] === -1);
    expect(ukCall).toBeTruthy();
    expect(ukCall![3]).toBeInstanceOf(Object);
    expect(ukCall![4]).toEqual({cause: "war"});
    // 29.2.1 is UK/RU-only: the Central Powers do not lose stability for the
    // other roll they lost.
    const geCall = spy.mock.calls.find((call) => call[1] === "GE" && call[2] === -1);
    expect(geCall).toBeUndefined();
  });

  test("winning both colonial rolls costs the UK nothing", () => {
    const G = gwState(["UK"], ["GE"]);
    const before = G.powers.UK.stability;
    const res = resolveGwWinter(G, makeCtx(6));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.UK.stability).toBe(before);
  });
});

describe("29.2.1 RU colonial-war stability", () => {
  test("two enemy-controlled check spaces cost RU 1 stability with {cause: 'war'}", () => {
    const G = gwState(["GE"], ["RU"]);
    G.powers.RU.stability = 4;
    G.spaces["central-asia"].control = "GE";
    G.spaces["qajar-persia"].control = "GE";
    const spy = jest.spyOn(rules, "changeStability");

    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.RU.stability).toBe(3);
    const ruCall = spy.mock.calls.find((call) => call[1] === "RU" && call[2] === -1);
    expect(ruCall).toBeTruthy();
    expect(ruCall![4]).toEqual({cause: "war"});
  });

  test("one enemy-controlled check space does not cost RU stability", () => {
    const G = gwState(["GE"], ["RU"]);
    G.powers.RU.stability = 4;
    G.spaces["manchuria"].control = "GE";
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.RU.stability).toBe(4);
  });
});
