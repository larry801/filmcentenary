/**
 * A16 Liberal Reforms.
 *
 * "All players eliminate 2 reserve army steps … The CP from this card cannot be
 * used to build new armies."  The own-power build gate existed, but the
 * minor-ally build path did not read it, so the event's CP could still raise a
 * Bavarian or Serbian army.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {minorBuildDecision} from "./engine/characteristics";
import {playCard, recruit} from "./moves";

const makeCtx = (playerID = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
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
  G.powers[power].hand = ["IE-A016"];
  return G;
};

describe("A16 Liberal Reforms", () => {
  test("the event sets the no-army-build restriction for its impulse", () => {
    const G = begin();
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A016", "event");
    expect(G.powers.GE.flags.noBuildArmiesThisImpulse).toBe(true);
    expect(recruit(G, makeCtx(seat("GE")), "berlin", "army", 1)).toBe(INVALID_MOVE);
  });

  test("the same CP cannot build a minor ally's new army", () => {
    const G = begin();
    // A legal Bavarian build except for the card's restriction.
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A016", "event");

    const decision = minorBuildDecision(G, "GE", "Bavaria", "army", "bavaria");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("Liberal Reforms");
  });
});
