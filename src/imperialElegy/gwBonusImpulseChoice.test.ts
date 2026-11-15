import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Client} from "boardgame.io/client";
import {ImperialElegyGameDef} from "./game";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {advanceGwImpulse, insertNeutralOrderSlot, rebalanceBonusImpulse, startGwManeuver} from "./engine/greatWarFlow";
import {declinePending, gwPass, resolvePending} from "./moves";
import {redactForView} from "./engine/privacy";
import {placeUnit} from "./engine/effects";
import {beginImpulseUpkeep} from "./engine/rules";

const ctxFor = (power: Power): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3, Shuffle: (items: unknown[]) => items},
  events: {setActivePlayers: jest.fn(), setPhase: jest.fn(), endGame: jest.fn()},
  turn: 1,
}) as unknown as Ctx;

const outbreak = (ta: Power[] = ["GE", "AU", "RU"], te: Power[] = ["FR", "UK"]): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor("GE"));
  for (const power of POWERS) {
    G.powers[power].alliance = ta.includes(power) ? "taCommitted" : te.includes(power) ? "teCommitted" : "neutral";
  }
  outbreakGreatWar(G, ctxFor("GE"), "GE", "bonus-impulse regression");
  return G;
};

const maneuver = (): ImperialElegyState => {
  const G = outbreak();
  G.phase = "gwManeuver";
  G.gw!.turn = 1;
  G.activePower = "RU";
  G.turnIndex = 4;
  // Isolate the impulse flow from the map's unrelated upkeep decisions.
  G.units = {};
  for (const space of Object.values(G.spaces)) space.units = [];
  for (const power of POWERS) {
    G.powers[power].gwBudget = 5;
    G.powers[power].gwCard = null;
    G.powers[power].flags.passedGw = false;
  }
  G.powers.RU.gwBudget = 2; // 27.1 permits an ordinary pass only at <=2 CP.
  return G;
};

describe("25.7.1 bonus-impulse alliance choice", () => {
  test("the real phase hook and move dispatcher resume a cross-seat leading-bonus choice", () => {
    const phases = ImperialElegyGameDef.phases!;
    const client = Client({
      game: {
        ...ImperialElegyGameDef,
        setup: () => {
          const G = maneuver();
          G.phase = "gwPlanning";
          G.gw!.order = ["bonus", "GE", "UK", "AU", "FR", "RU"];
          return G;
        },
        phases: {
          ...phases,
          prep: {...phases.prep, start: false},
          gwManeuver: {...phases.gwManeuver, start: true},
        },
      },
      numPlayers: 6, playerID: "1", debug: false,
    });
    client.start();
    try {
      expect(client.getState()!.ctx.phase).toBe("gwManeuver");
      expect(client.getState()!.G.pending).toMatchObject({kind: "gwBonusImpulse", power: "UK"});
      client.moves.resolvePending("FR");
      expect(client.getState()!.G.pending).toBeNull();
      expect(client.getState()!.G.activePower).toBe("FR");
      client.updatePlayerID("2");
      client.moves.gwPass();
      expect(client.getState()!.G.activePower).toBe("GE");
      expect(client.getState()!.G.turnIndex).toBe(1);
      expect(client.getState()!.G.powers.FR.flags.passedGw).toBe(false);
    } finally {
      client.stop();
    }
  });

  test("the live pass suspends before activation and lets the alliance select its second player", () => {
    const G = maneuver();
    const ctx = ctxFor("RU");
    G.powers.UK.flags.gwActionsThisImpulse = 1;
    G.powers.UK.flags.passedGw = true;
    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.pending).toMatchObject({kind: "gwBonusImpulse", power: "UK", blocking: true});
    expect(G.pending!.options.map((entry) => entry.id)).toEqual(["UK", "FR", "skip"]);
    // UK is earlier in the actual initiative order (GE, UK, AU, FR, RU, bonus).
    expect(G.pending!.power).toBe("UK");
    expect(G.activePower).toBe("RU");
    expect(G.turnIndex).toBe(4);
    expect(G.powers.UK.flags.gwActionsThisImpulse).toBe(1);
    expect(G.gw!.bonusImpulses).toEqual([]);
    expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({all: "play"});

    const saved = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
    expect(resolvePending(saved, ctxFor("UK"), "FR")).toBeUndefined();
    expect(saved.pending).toBeNull();
    expect(saved.activePower).toBe("FR");
    expect(saved.turnIndex).toBe(5);
    expect(saved.flags.gwBonusImpulse).toBe(true);
    expect(saved.powers.FR.gwBudget).toBe(5);
    expect(saved.powers.FR.flags.gwActionsThisImpulse).toBe(0);
    expect(saved.gw!.bonusImpulses).toEqual(["FR"]);
    expect(resolvePending(saved, ctxFor("UK"), "FR")).toBe(INVALID_MOVE);
  });

  test.each(["skip", "decline"])("%s skips the slot without changing a member's ordinary pass or budget", (answer) => {
    const G = maneuver();
    expect(gwPass(G, ctxFor("RU"))).toBeUndefined();
    const budget = G.powers.FR.gwBudget;
    const answerCtx = ctxFor(G.pending!.power);
    expect(answer === "skip" ? resolvePending(G, answerCtx, "skip") : declinePending(G, answerCtx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.activePower).toBe("GE");
    expect(G.turnIndex).toBe(0);
    expect(G.powers.FR.flags.passedGw).toBe(false);
    expect(G.powers.FR.gwBudget).toBe(budget);
    expect(G.gw!.bonusImpulses).toEqual([]);
    expect(G.log.some((entry) => entry.key === "gwBonusImpulseSkipped")).toBe(true);
  });

  test("only the alliance's deciding seat sees and submits its choices", () => {
    const G = maneuver();
    gwPass(G, ctxFor("RU"));
    const owner = G.pending!.power;
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctxFor("GE"), "FR")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctxFor(owner), "RU")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
    expect(redactForView(G, String(POWERS.indexOf(owner))).pending!.options).toHaveLength(3);
    expect(redactForView(G, "0").pending!.options).toEqual([]);
    expect(redactForView(G, null).pending!.context).toEqual({});
  });

  test.each(["turn", "order", "side", "eliminated", "active"])("a saved choice rejects stale %s before any mutation", (change) => {
    const G = maneuver();
    gwPass(G, ctxFor("RU"));
    const owner = G.pending!.power;
    if (change === "turn") G.gw!.turn += 1;
    if (change === "order") G.gw!.order.reverse();
    if (change === "side") G.gw!.bonusImpulseSide = "ta";
    if (change === "eliminated") G.powers.FR.eliminated = true;
    if (change === "active") G.activePower = "GE";
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctxFor(owner), "FR")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("a passed player can take the bonus without reopening its ordinary slot", () => {
    const G = maneuver();
    G.powers.FR.flags.passedGw = true;
    gwPass(G, ctxFor("RU"));
    expect(resolvePending(G, ctxFor(G.pending!.power), "FR")).toBeUndefined();
    expect(G.powers.FR.flags.passedGw).toBe(true);
    expect(gwPass(G, ctxFor("FR"))).toBeUndefined();
    expect(G.activePower).toBe("GE");
    expect(G.powers.FR.flags.passedGw).toBe(true);
    expect(G.powers.FR.gwBudget).toBe(5);
  });

  test("passing the bonus does not pass a previously unpassed player's ordinary slot", () => {
    const G = maneuver();
    gwPass(G, ctxFor("RU"));
    resolvePending(G, ctxFor(G.pending!.power), "FR");
    expect(gwPass(G, ctxFor("FR"))).toBeUndefined();
    expect(G.powers.FR.flags.passedGw).toBe(false);
    expect(G.powers.FR.gwBudget).toBe(5);
  });

  test("the last ordinary pass still opens an unplayed bonus slot later in the order", () => {
    const G = maneuver();
    G.gw!.order = ["GE", "UK", "AU", "FR", "RU", "bonus"];
    G.gw!.bonusImpulseSide = "te";
    for (const power of G.gw!.belligerents) G.powers[power].flags.passedGw = true;
    G.powers.RU.flags.passedGw = false;
    G.activePower = "RU";
    G.turnIndex = 4;
    expect(gwPass(G, ctxFor("RU"))).toBeUndefined();
    expect(G.pending).toMatchObject({kind: "gwBonusImpulse", power: "UK"});
    expect(G.phase).toBe("gwManeuver");
    expect(resolvePending(G, ctxFor("UK"), "FR")).toBeUndefined();
    expect(G.activePower).toBe("FR");
    expect(G.turnIndex).toBe(5);
  });

  test("chosen-player upkeep opens after selection, exactly once per activated bonus impulse", () => {
    const G = maneuver();
    for (let i = 0; i < 4; i += 1) placeUnit(G, "FR", "army", "paris", 2);
    const steps = () => Object.values(G.units).reduce((sum, unit) => sum + unit.steps, 0);
    const before = steps();
    gwPass(G, ctxFor("RU"));
    expect(steps()).toBe(before);
    resolvePending(G, ctxFor(G.pending!.power), "FR");
    expect(G.pending).toMatchObject({kind: "impulseLoss", power: "FR"});
    resolvePending(G, ctxFor("FR"), G.pending!.options[0].id);
    expect(steps()).toBe(before - 1);
    expect(beginImpulseUpkeep(G, ctxFor("FR"), "FR")).toBe(false);
    expect(G.pending).toBeNull();
    // Everyone else passed: the same bonus slot can recur for the same player.
    // Re-enter it without another player's activation replacing the stamp.
    G.turnIndex = 4;
    advanceGwImpulse(G, ctxFor("FR"));
    resolvePending(G, ctxFor(G.pending!.power), "FR");
    expect(G.pending).toMatchObject({kind: "impulseLoss", power: "FR"});
    resolvePending(G, ctxFor("FR"), G.pending!.options[0].id);
    expect(steps()).toBe(before - 2);
  });

  test("a sole candidate is unambiguous, and all-passed never wraps into a completed bonus", () => {
    const G = maneuver();
    G.gw!.te = ["FR"];
    G.gw!.belligerents = ["GE", "AU", "RU", "FR"];
    G.gw!.order = ["GE", "FR", "AU", "bonus", "RU", "bonus"];
    expect(advanceGwImpulse(G, ctxFor("RU"))).toMatchObject({ok: true, kind: "bonus", power: "FR", index: 5});
    expect(G.pending).toBeNull();
    for (const power of G.gw!.belligerents) G.powers[power].flags.passedGw = true;
    G.gw!.neutrals = []; // The separate 27.4 neutral windows have their own suite.
    G.turnIndex = 5;
    expect(advanceGwImpulse(G, ctxFor("RU"))).toMatchObject({ok: true, kind: "end"});
    expect(G.gw!.bonusImpulses).toEqual(["FR"]);
  });

  test("a leading elimination-earned bonus is chosen before the first living player next year", () => {
    const G = maneuver();
    G.gw!.order = ["bonus", "UK", "AU", "FR", "RU"];
    G.gw!.ta = ["AU", "RU"];
    G.gw!.belligerents = ["UK", "AU", "FR", "RU"];
    G.gw!.bonusImpulseSide = "ta";
    G.phase = "gwPlanning";
    expect(startGwManeuver(G, ctxFor("UK"))).toMatchObject({ok: true, index: 0, awaitingBonusChoice: true});
    expect(G.pending).toMatchObject({kind: "gwBonusImpulse", power: "AU"});
    expect(resolvePending(G, ctxFor("AU"), "RU")).toBeUndefined();
    expect(G.activePower).toBe("RU");
    expect(G.turnIndex).toBe(0);
    expect(gwPass(G, ctxFor("RU"))).toBeUndefined();
    expect(G.activePower).toBe("UK");
    expect(G.turnIndex).toBe(1);
  });
});

describe("25.7 / 29.3 bonus-marker positions", () => {
  test("outbreak alternates slots and fills each missing player with a bonus", () => {
    expect(outbreak().gw!.order).toEqual(["GE", "UK", "AU", "FR", "RU", "bonus"]);
    expect(outbreak(["GE", "AU", "RU"], ["FR"]).gw!.order).toEqual(["GE", "FR", "AU", "bonus", "RU", "bonus"]);
    expect(outbreak(["GE"], ["FR", "UK", "RU"]).gw!.order).toEqual(["GE", "UK", "bonus", "FR", "bonus", "RU"]);
  });

  test("GE neutral uses the printed UK / FR / AU / RU priority for the first alliance", () => {
    expect(outbreak(["FR", "AU"], ["UK"]).gw!.order).toEqual(["UK", "FR", "bonus", "AU"]);
    expect(outbreak(["AU"], ["FR", "RU"]).gw!.order).toEqual(["FR", "AU", "RU", "bonus"]);
  });

  test("a neutral replaces the earliest bonus spot instead of being appended after players", () => {
    const G = maneuver();
    G.gw!.order = ["GE", "FR", "AU", "bonus", "RU", "bonus", "US", "IT"];
    G.gw!.te = ["FR"];
    expect(insertNeutralOrderSlot(G, "OT")).toBe(3);
    G.gw!.te.push("OT");
    G.gw!.belligerents.push("OT");
    rebalanceBonusImpulse(G);
    expect(G.gw!.order).toEqual(["GE", "FR", "AU", "OT", "RU", "bonus", "US", "IT"]);
    expect(insertNeutralOrderSlot(G, "OT")).toBe(3);
  });

});
