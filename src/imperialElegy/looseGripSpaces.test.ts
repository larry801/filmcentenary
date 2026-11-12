/**
 * A79 Loose Grip (round 4, agent 5).
 *
 * "Take control of the two spaces in Libya (Tripoli and Benghazi) if they are
 * Ottoman controlled. Take control of Tunisia if it is Ottoman controlled.
 * Remove from the game if Tunisia and Libya are no longer Ottoman controlled."
 *
 * The event applies every still-Ottoman named space deterministically (it is
 * not a choice) and removes itself once nothing is left to take.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard} from "./moves";
import {eventPlayability} from "./engine/playability";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (n: number) => Math.min(n, 3)},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const clearHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) G.powers[power].hand = [];
};

const playLooseGrip = (G: ImperialElegyState, power: Power): Ctx => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  clearHands(G);
  G.powers[power].hand = ["IE-A079"];
  const ctx = makeCtx(seat(power));
  expect(playCard(G, ctx, "IE-A079", "event")).toBeUndefined();
  return ctx;
};

const NAMED = ["tripoli", "benghazi", "tunisia"] as const;

describe("A79 Loose Grip takes every named Ottoman space", () => {
  test("all three Ottoman spaces change hands in one deterministic play", () => {
    const G = fresh();
    G.powers.GE.unified = true;
    for (const id of NAMED) G.spaces[id].control = "OT";

    playLooseGrip(G, "GE");

    expect(G.pending).toBeNull();
    for (const id of NAMED) expect(G.spaces[id].control).toBe("GE");
    const entries = G.log.filter((entry) => entry.key === "looseGrip");
    expect(entries.map((entry) => entry.args?.space)).toEqual([...NAMED]);
    expect(G.discard).toContain("IE-A079");
    expect(G.removed).not.toContain("IE-A079");
  });

  test("only the still-Ottoman spaces are taken", () => {
    const G = fresh();
    G.powers.GE.unified = true;
    G.spaces.tripoli.control = "OT";
    G.spaces.benghazi.control = "FR";
    G.spaces.tunisia.control = "OT";

    playLooseGrip(G, "GE");

    expect(G.spaces.tripoli.control).toBe("GE");
    expect(G.spaces.benghazi.control).toBe("FR");
    expect(G.spaces.tunisia.control).toBe("GE");
    const entries = G.log.filter((entry) => entry.key === "looseGrip");
    expect(entries.map((entry) => entry.args?.space)).toEqual(["tripoli", "tunisia"]);
  });

  test("a UK play takes the spaces for the UK", () => {
    const G = fresh();
    for (const id of NAMED) G.spaces[id].control = "OT";

    playLooseGrip(G, "UK");

    for (const id of NAMED) expect(G.spaces[id].control).toBe("UK");
  });

  test("nothing Ottoman left removes the card from the game", () => {
    const G = fresh();
    for (const id of NAMED) G.spaces[id].control = "FR";

    playLooseGrip(G, "UK");

    expect(G.removed).toContain("IE-A079");
    // The removed card must not also sit in the discard pile (a later
    // reshuffle would otherwise deal it again).
    expect(G.discard).not.toContain("IE-A079");
    for (const id of NAMED) expect(G.spaces[id].control).toBe("FR");
    expect(G.log.some((entry) => entry.key === "looseGripRemoved")).toBe(true);
    expect(G.pending).toBeNull();
  });

  test("Tunisia alone keeps the card in play and in the discard", () => {
    const G = fresh();
    G.spaces.tripoli.control = "FR";
    G.spaces.benghazi.control = "FR";
    G.spaces.tunisia.control = "OT";

    playLooseGrip(G, "UK");

    expect(G.spaces.tunisia.control).toBe("UK");
    expect(G.removed).not.toContain("IE-A079");
    expect(G.discard).toContain("IE-A079");
  });

  test("Libya alone keeps the card in play and in the discard", () => {
    const G = fresh();
    G.spaces.tripoli.control = "OT";
    G.spaces.benghazi.control = "OT";
    G.spaces.tunisia.control = "FR";

    playLooseGrip(G, "UK");

    expect(G.spaces.tripoli.control).toBe("UK");
    expect(G.spaces.benghazi.control).toBe("UK");
    expect(G.spaces.tunisia.control).toBe("FR");
    expect(G.removed).not.toContain("IE-A079");
    expect(G.discard).toContain("IE-A079");
  });
});

describe("A79 printed power list", () => {
  test("the Ottomans cannot play it", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "OT";
    G.cpRemaining = 0;
    clearHands(G);
    G.powers.OT.hand = ["IE-A079"];
    const before = JSON.stringify(G);

    expect(eventPlayability(G, "OT", "IE-A079")).toEqual({ok: false, reason: "power-list"});
    expect(playCard(G, makeCtx(seat("OT")), "IE-A079", "event")).toBe(INVALID_MOVE);
    expect(G.spaces.tripoli.control).toBe("OT");
    expect(JSON.stringify(G)).not.toBe(before); // the rejection is logged
  });

  test("Germany needs unification", () => {
    const G = fresh();
    G.powers.GE.unified = false;
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 0;
    clearHands(G);
    G.powers.GE.hand = ["IE-A079"];

    expect(eventPlayability(G, "GE", "IE-A079")).toEqual({ok: false, reason: "germany-unified"});
    expect(playCard(G, makeCtx(seat("GE")), "IE-A079", "event")).toBe(INVALID_MOVE);
    expect(G.spaces.tripoli.control).toBe("OT");

    G.powers.GE.unified = true;
    expect(eventPlayability(G, "GE", "IE-A079")).toEqual({ok: true});
  });
});
