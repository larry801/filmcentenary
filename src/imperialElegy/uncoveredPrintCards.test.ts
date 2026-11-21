/**
 * Direct checks for the last cards that had no per-card regression: A42 The
 * Ruhr, A50 Reforms of the 1860s, A90 The Eiffel Tower, H-OT-12 Jihad and
 * H-RU-9 Russo-Turkish Wars.  These assert the printed clauses rather than a
 * handler name.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 3,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (power: Power, card: string): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  G.powers[power].hand = [card];
  return G;
};

describe("uncovered print cards", () => {
  test("A42 The Ruhr raises German industry without using the industrialisation card", () => {
    const G = begin("FR", "IE-A042");
    const before = G.powers.GE.industry;
    playCard(G, makeCtx([], seat("FR")), "IE-A042", "event");
    expect(G.powers.GE.industry).toBe(before + 1);
    expect(G.powers.GE.industryCard).toBeNull();
  });

  test("A50 Reforms of the 1860s applies each die band", () => {
    const low = begin("FR", "IE-A050");
    low.powers.RU.stability = 3;
    playCard(low, makeCtx([1], seat("FR")), "IE-A050", "event");
    expect(low.powers.RU.stability).toBe(2);

    const middle = begin("FR", "IE-A050");
    middle.powers.RU.stability = 3;
    playCard(middle, makeCtx([3], seat("FR")), "IE-A050", "event");
    expect(middle.powers.RU.stability).toBe(4);

    const high = begin("FR", "IE-A050");
    high.powers.RU.stability = 3;
    const markers = high.powers.RU.cardMarkers;
    playCard(high, makeCtx([5], seat("FR")), "IE-A050", "event");
    expect(high.powers.RU.stability).toBe(4);
    expect(high.powers.RU.cardMarkers).toBe(markers + 1);
  });

  test("A90 The Eiffel Tower gives France one City of Light point, capped at 6", () => {
    const G = begin("FR", "IE-A090");
    G.powers.FR.cityOfLight = 2;
    playCard(G, makeCtx([], seat("FR")), "IE-A090", "event");
    expect(G.powers.FR.cityOfLight).toBe(3);

    const capped = begin("FR", "IE-A090");
    capped.powers.FR.cityOfLight = 6;
    playCard(capped, makeCtx([], seat("FR")), "IE-A090", "event");
    expect(capped.powers.FR.cityOfLight).toBe(6);
  });

  test("H-OT-12 Jihad gains two markers and the declaration entitlement without a penalty", () => {
    const G = begin("OT", "IE-H-OT-12");
    G.powers.OT.jihad = 0;
    const wtt = G.wtt;
    const stability = G.powers.OT.stability;
    playCard(G, makeCtx([], seat("OT")), "IE-H-OT-12", "event");
    expect(G.powers.OT.jihad).toBe(2);
    expect(G.powers.OT.flags.warDeclaration).toBe(true);
    expect(G.powers.OT.flags.warDeclarationCard).toBe("IE-H-OT-12");
    expect(G.wtt).toBe(wtt);
    expect(G.powers.OT.stability).toBe(stability);
  });

  test("H-RU-9 Russo-Turkish Wars allies a Balkan diplomacy marker and leaves a declaration", () => {
    const G = begin("RU", "IE-H-RU-9");
    G.spaces.serbia.control = "Serbia";
    G.spaces.serbia.diplomacy = "RU";
    G.spaces.serbia.ally = null;
    const ctx = makeCtx([], seat("RU"));
    playCard(G, ctx, "IE-H-RU-9", "event");
    const option = G.pending?.options.find((o) => o.id === "serbia") ?? G.pending?.options[0];
    expect(option).toBeDefined();
    expect(resolvePending(G, ctx, option!.id)).toBeUndefined();
    expect(G.spaces.serbia.ally).toBe("RU");
    expect(G.spaces.serbia.diplomacy).toBeNull();
    expect(G.powers.RU.flags.warDeclaration).toBe(true);
    expect(G.powers.RU.flags.warDeclarationCard).toBe("IE-H-RU-9");
  });
});
