/**
 * Rules 16.1.4 / 16.1.5 — the primaries' agreed peace.
 *
 * "Both primary belligerents agree to end the fighting with one side conceding
 * one treaty option. If players agreed on a specific treaty option to end the
 * fighting, that agreement is binding."  A white peace awards no treaty option.
 * Both end the maneuver step at once (15.5), so the all-passed boundary is not
 * required.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {declinePending, proposeWarPeace, resolvePending} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "wartime",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** A live GE-vs-AU maneuver with both seats still in the fight. */
const maneuver = (G: ImperialElegyState) => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  const war = createWarState(G, "GE", "AU", "conquest", ["lombardy"], 2);
  war.status = "maneuver";
  war.initiative = ["GE", "AU"];
  G.war = war;
  return war;
};

describe("16.1.4 negotiated peace", () => {
  test("the other primary must agree; acceptance ends the war with one treaty pick", () => {
    const G = fresh();
    maneuver(G);
    expect(proposeWarPeace(G, makeCtx(seat("GE")), "negotiated", "defender")).toBeUndefined();
    expect(G.pending?.kind).toBe("warPeace");
    expect(G.pending?.power).toBe("AU");

    // The defender declines: the war continues and the proposal closes.
    expect(declinePending(G, makeCtx(seat("AU")))).toBeUndefined();
    expect(G.war).not.toBeNull();
    expect(G.pending).toBeNull();

    // Re-propose; this time the defender accepts.  The attacker (the side that
    // did not concede) is the victor and chooses one treaty option.
    expect(proposeWarPeace(G, makeCtx(seat("GE")), "negotiated", "defender")).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
  });

  test("a specific option is binding: the agreed war reparations apply without a chooser", () => {
    const G = fresh();
    maneuver(G);
    // 16.2.3 needs the winning side to occupy a home controlled by AU.
    G.spaces.vienna.occupiedBy = "GE";
    const geBefore = G.powers.GE.cardMarkers;
    const auBefore = G.powers.AU.cardMarkers;
    expect(
      proposeWarPeace(G, makeCtx(seat("GE")), "negotiated", "defender", "warReparations"),
    ).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.powers.GE.cardMarkers).toBe(geBefore + 1);
    // AU also takes any 17.1 blockade marker, so the treaty's own -1 is checked
    // through the applied entry rather than the final total.
    expect(
      G.log.some((entry) => entry.key === "treatyApplied" && entry.args?.option === "warReparations"),
    ).toBe(true);
    expect(G.powers.AU.cardMarkers).toBeLessThanOrEqual(auBefore - 1);
  });

  test("a side cannot agree on its own concession alone", () => {
    const G = fresh();
    maneuver(G);
    // The attacker is the only actor who can propose; a malformed conceding
    // side is refused before any pending opens.
    expect(proposeWarPeace(G, makeCtx(seat("GE")), "negotiated")).toBe(INVALID_MOVE);
    expect(G.pending).toBeNull();
  });
});

describe("16.1.5 white peace", () => {
  test("acceptance ends the war at once with no treaty options", () => {
    const G = fresh();
    maneuver(G);
    expect(proposeWarPeace(G, makeCtx(seat("GE")), "white")).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars?.at(-1)?.victoryPrimary ?? G.wars?.at(-1)?.victor).toBeDefined();
  });

  test("the proposal does not require the all-passed boundary", () => {
    const G = fresh();
    const war = maneuver(G);
    war.passed = [];
    expect(proposeWarPeace(G, makeCtx(seat("GE")), "white")).toBeUndefined();
    expect(resolvePending(G, makeCtx(seat("AU")), "accept")).toBeUndefined();
    expect(G.war).toBeNull();
  });
});
