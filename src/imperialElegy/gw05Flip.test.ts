import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {facedownGwCombatCards, faceupCombatCards} from "./engine/greatWarFlow";
import {playGwCardMove, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 1},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx);

const gwState = (turn = 2): GreatWarState => ({
  active: true,
  turn,
  order: ["GE", "FR"],
  belligerents: ["GE", "FR"],
  neutrals: ["UK", "AU", "RU", "OT"],
  te: ["FR"],
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
  combatCardsInFront: [],
  discard: [],
});

/** A GW-05 event window for GE at the start of its maneuver impulse. */
const gw05EventWindow = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "gwManeuver";
  G.gw = gwState(2);
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.discard = [];
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.gwCard = "IE-GW-05";
  G.gw.discard = [];
  return G;
};

describe("GW-05 normal-event flip mode", () => {
  test("the event opens a flip choice for every facedown combat card", () => {
    const G = gw05EventWindow();
    G.gw!.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];

    expect(playGwCardMove(G, makeCtx("0"), "event")).toBeUndefined();

    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["flip0", "flip1"]);
    // The event is consumed immediately, from the GW hand into the GW discard.
    expect(G.powers.GE.gwCard).toBeNull();
    expect(G.gw!.discard).toContain("IE-GW-05");
    expect(G.discard).not.toContain("IE-GW-05");
    // Nothing is flipped until the choice is resolved.
    expect(facedownGwCombatCards(G)).toHaveLength(2);
  });

  test("resolving the choice flips the chosen card and updates the faceup map", () => {
    const G = gw05EventWindow();
    G.gw!.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];

    expect(playGwCardMove(G, makeCtx("0"), "event")).toBeUndefined();
    expect(resolvePending(G, makeCtx("0"), "flip1")).toBeUndefined();

    expect(G.pending).toBeNull();
    const cards = G.gw!.combatCardsInFront!;
    expect(cards.find((entry) => entry.cardId === "IE-GW-04")).toMatchObject({faceup: true});
    expect(cards.find((entry) => entry.cardId === "IE-GW-03")).toMatchObject({faceup: false});
    expect(faceupCombatCards(G)).toMatchObject({GE: "IE-GW-04"});
    expect(facedownGwCombatCards(G).map((entry) => entry.cardId)).toEqual(["IE-GW-03"]);
  });

  test("without a facedown combat card the play is invalid and the card is kept", () => {
    const G = gw05EventWindow();
    G.gw!.combatCardsInFront = [{holder: "FR", cardId: "IE-GW-03", faceup: true}];

    expect(playGwCardMove(G, makeCtx("0"), "event")).toBe(INVALID_MOVE);

    expect(G.powers.GE.gwCard).toBe("IE-GW-05");
    expect(G.pending).toBeNull();
    expect(G.gw!.discard).toEqual([]);
    expect(G.discard).toEqual([]);
  });

  test("a second GW-05 in the same impulse is rejected", () => {
    const G = gw05EventWindow();
    G.gw!.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];

    expect(playGwCardMove(G, makeCtx("0"), "event")).toBeUndefined();
    expect(resolvePending(G, makeCtx("0"), "flip0")).toBeUndefined();
    // A facedown card remains, so only the one-event-per-impulse guard can
    // reject the replay.
    expect(facedownGwCombatCards(G)).toHaveLength(1);

    G.powers.GE.gwCard = "IE-GW-05";
    const discardBefore = G.gw!.discard!.length;
    expect(playGwCardMove(G, makeCtx("0"), "event")).toBe(INVALID_MOVE);
    expect(G.powers.GE.gwCard).toBe("IE-GW-05");
    expect(G.gw!.discard).toHaveLength(discardBefore);
  });

  test("the GW-05 card is discarded only to the Great War pile", () => {
    const G = gw05EventWindow();
    G.gw!.combatCardsInFront = [{holder: "FR", cardId: "IE-GW-03", faceup: false}];

    expect(playGwCardMove(G, makeCtx("0"), "event")).toBeUndefined();

    expect(G.gw!.discard).toEqual(["IE-GW-05"]);
    expect(G.discard.filter((id) => id === "IE-GW-05")).toEqual([]);
  });
});
