/**
 * A13/A14 Colonial Conflict.
 *
 * Printed eligibility: "a space in Asia, Africa, or North America that is
 * controlled by a player but is not a home space belonging to that player …
 * As each space can only contain a single pacification marker it is possible
 * that there are no eligible spaces."  The old filter accepted minor-controlled
 * spaces and spaces that already had a marker (and then stacked +2 on it for a
 * naval base).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
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
  G.powers[power].hand = ["IE-A013"];
  return G;
};

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

describe("A13/A14 Colonial Conflict eligibility", () => {
  test("minor-controlled and already-marked spaces are not offered", () => {
    const G = begin();
    G.spaces.afghanistan.control = "RU";
    G.spaces.afghanistan.pacificationMarker = false;
    G.spaces.morocco.control = "FR";
    G.spaces.morocco.pacification = 0;
    G.spaces.morocco.pacificationMarker = true;
    G.spaces.tripoli.control = "Egypt"; // a minor power, not a player
    G.spaces.tripoli.pacificationMarker = false;
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-A013", "event");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(options(G)).toContain("afghanistan");
    expect(options(G)).not.toContain("morocco");
    expect(options(G)).not.toContain("tripoli");
  });

  test("A14 uses the same eligibility", () => {
    const G = begin();
    G.powers.GE.hand = ["IE-A014"];
    G.spaces.afghanistan.control = "RU";
    G.spaces.afghanistan.pacificationMarker = false;
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A014", "event");
    expect(options(G)).toContain("afghanistan");
  });

  test("a naval base places a 2 marker on an eligible space", () => {
    const G = begin();
    G.spaces["hong-kong"].control = "FR"; // not FR's home space
    G.spaces["hong-kong"].pacificationMarker = false;
    G.spaces["hong-kong"].pacification = 0;
    const ctx = makeCtx(seat("GE"));

    playCard(G, ctx, "IE-A013", "event");
    expect(options(G)).toContain("hong-kong");
    expect(resolvePending(G, ctx, "hong-kong")).toBeUndefined();
    expect(G.spaces["hong-kong"].pacification).toBe(2);
    expect(G.spaces["hong-kong"].pacificationMarker).toBe(true);
  });
});
