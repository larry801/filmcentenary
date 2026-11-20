/**
 * A97 Diplomatic Recognition.
 *
 * The old handler picked the first 0 WoI marker on the board, flipped it to
 * +1 and wrote the minor's control marker there.  It never asked the active
 * player which marker to flip and skipped 20.8's printed independence
 * sequence: displace every non-minor unit [5.7] and make the player who lost
 * the space lose 1 stability.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {playCard, resolvePending} from "./moves";

const makeCtx = (playerID = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 3,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  G.powers[power].hand = ["IE-A097"];
  return G;
};

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

describe("A97 Diplomatic Recognition", () => {
  test("offers every 0 WoI marker instead of picking the first one", () => {
    const G = begin();
    G.spaces.serbia.control = "OT";
    G.spaces.serbia.rebellion = {minor: "Serbia", step: 0, rebels: []};
    G.spaces.greece.control = "OT";
    G.spaces.greece.rebellion = {minor: "Greece", step: 0, rebels: []};
    G.spaces.bulgaria.control = "OT";
    G.spaces.bulgaria.rebellion = {minor: "Bulgaria", step: 1, rebels: []};
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-A097", "event");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(options(G).sort()).toEqual(["greece", "serbia"]);
  });

  test("the chosen space runs the printed independence sequence", () => {
    const G = begin();
    G.spaces.serbia.control = "OT";
    G.spaces.serbia.rebellion = {minor: "Serbia", step: 0, rebels: []};
    const otArmy = placeUnit(G, "OT", "army", "serbia", 2);
    G.spaces.greece.control = "OT";
    G.spaces.greece.rebellion = {minor: "Greece", step: 0, rebels: []};
    const stabilityBefore = G.powers.OT.stability;
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-A097", "event");
    expect(resolvePending(G, ctx, "serbia")).toBeUndefined();

    expect(G.spaces.serbia.control).toBe("Serbia");
    expect(G.spaces.serbia.rebellion).toBeNull();
    // 20.8: the player who lost the space loses 1 stability.
    expect(G.powers.OT.stability).toBe(stabilityBefore - 1);
    // 5.7: the Ottoman army is displaced out of the newly independent space.
    expect(G.units[otArmy.id]?.space).not.toBe("serbia");
    // The unselected marker is untouched.
    expect(G.spaces.greece.rebellion?.step).toBe(0);
    expect(G.spaces.greece.control).toBe("OT");
    expect(G.log.some((entry) => entry.key === "woiIndependence" && entry.args?.space === "serbia")).toBe(true);
  });

  test("no 0 marker means no effect and no silent flip", () => {
    const G = begin();
    G.spaces.serbia.control = "OT";
    G.spaces.serbia.rebellion = {minor: "Serbia", step: 1, rebels: []};
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A097", "event");
    expect(G.pending).toBeNull();
    expect(G.spaces.serbia.rebellion?.step).toBe(1);
    expect(G.spaces.serbia.control).toBe("OT");
  });
});
