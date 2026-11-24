/**
 * 4.9.3 / 13.3 — a war of conquest's WTT increase is a *player action*, not a
 * card effect.
 *
 * "Certain events and player actions will increase the WTT.  When the WTT
 * reaches 5 a crisis roll [23.0] is made and the GW may occur."
 *
 * The conquest declaration raises the WTT inside `declareWar` (13.3), so no
 * `wtt` effect and no post-event check ever sees it.  The declaration itself
 * has to open the Crisis Table roll once its penalty lands on 5.  Rule 12.17.1
 * forbids a fresh declaration at WTT 3+, so the reachable case is a declaration
 * that was validated below the gate and finalizes after the tension rose while
 * its 13.4.2 / 33.3 decision was open — exactly the state these tests build.
 * The war is already created when the roll opens, so the declaration is never
 * suspended.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {declareWar, resolvePending} from "./moves";

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
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A legal FR war of conquest against AU over the single key Bohemia. */
const declareConquest = (G: ImperialElegyState, wtt: number): string | void => {
  G.phase = "action";
  G.activePower = "FR";
  G.cpRemaining = 4;
  G.pending = null;
  G.war = null;
  G.wtt = wtt;
  G.powers.FR.goals = ["NG-24"];
  G.spaces.bohemia.control = "AU";
  return declareWar(G, makeCtx([], seat("FR")), "AU", "conquest", ["bohemia"], 2);
};

describe("13.3 conquest declaration and the crisis roll", () => {
  test("a penalty that lands on 5 opens the Crisis Table roll", () => {
    const G = fresh();
    expect(declareConquest(G, 2)).toBeUndefined();
    // 33.3's reveal choice keeps the declaration open before the war exists.
    expect(G.pending?.kind).toBe("napoleonsLegacy");
    expect(G.wtt).toBe(2);

    // The tension rises while the declaration decision waits (the declaration
    // itself was validated below 12.17.1's gate).
    G.wtt = 4;
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    // The declaration completed — the war is live — and 13.3's +1 reached 5, so
    // 4.9.3/23.0's roll is owed.
    expect(G.war?.attacker).toBe("FR");
    expect(G.war?.warAim).toBe("conquest");
    expect(G.wtt).toBe(5);
    expect(G.phase).toBe("wartime");
    expect(G.pending?.kind).toBe("crisis");
    expect(G.pending?.power).toBe("FR");
    // A player action has no printed crisis row, so the roll answers the
    // fallback row rather than some card's row.
    expect(G.flags.crisisIncitingCard).toBe("");
    expect(G.pending?.context?.inciting).toBeUndefined();
  });

  test("an International Conference defuses it and keeps the war", () => {
    const G = fresh();
    declareConquest(G, 2);
    G.wtt = 4;
    resolvePending(G, makeCtx([], seat("FR")), "decline");
    expect(G.pending?.kind).toBe("crisis");

    // The fallback row: 1-4 are narrative (the GW starts), 5-6 the conference.
    expect(resolvePending(G, makeCtx([5], seat("FR")), "roll")).toBeUndefined();
    expect(G.gw).toBeNull();
    expect(G.wtt).toBe(4);
    expect(G.persistent.conferenceUsed).toBe(true);
    expect(G.war?.attacker).toBe("FR");
    expect(G.pending).toBeNull();
  });

  test("an outbreak starts the Great War from the declaration's own roll", () => {
    const G = fresh();
    declareConquest(G, 2);
    G.wtt = 4;
    resolvePending(G, makeCtx([], seat("FR")), "decline");
    expect(G.pending?.kind).toBe("crisis");

    expect(resolvePending(G, makeCtx([2], seat("FR")), "roll")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    expect(G.phase).toBe("gwPlanning");
    // 25.7 steps the track back down once the war has begun.
    expect(G.wtt).toBe(4);
  });

  test("a declaration below the top of the track opens no roll", () => {
    const G = fresh();
    expect(declareConquest(G, 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("napoleonsLegacy");
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    expect(G.wtt).toBe(3);
    expect(G.war?.warAim).toBe("conquest");
    expect(G.pending).toBeNull();
  });

  test("a non-conquest declaration leaves the tension alone", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.cpRemaining = 4;
    G.pending = null;
    G.war = null;
    G.wtt = 4;
    G.powers.FR.goals = [];
    G.spaces.bohemia.control = "AU";
    // 12.17.1 still refuses the declaration at WTT 3+.
    expect(declareWar(G, makeCtx([], seat("FR")), "AU", "liberation", ["bohemia"], 2)).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
    expect(G.wtt).toBe(4);
  });
});
