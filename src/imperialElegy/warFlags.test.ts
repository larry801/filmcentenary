import {setupImperialElegy} from "./engine/setup";
import {playResponseCard} from "./moves";
import {createWarState} from "./engine/limitedWar";
import {beginLandBattle} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import type {ImperialElegyState} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

/** Put GE and AU at war in a state where GE can play a response card. */
const startLimitedWar = (G: ImperialElegyState): void => {
  G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  G.war.status = "maneuver";
  G.phase = "wartime";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
};

test("A023/A024 store the war DRM where combat reads it", () => {
  for (const cardId of ["IE-A023", "IE-A024"]) {
    const G = fresh();
    startLimitedWar(G);
    G.powers.GE.hand.push(cardId);
    const ctx = makeCtx("0");

    expect(playResponseCard(G, ctx, cardId)).toBeUndefined();

    expect(G.flags.warLandDrm).toBe(1);
    expect(G.flags.war_warLandDrm).toBeUndefined();
  }
});

test("a land battle applies the war DRM written by New Rifles", () => {
  const baseline = fresh();
  startLimitedWar(baseline);
  placeUnit(baseline, "AU", "army", "saxony", 2);
  const baselineBattle = beginLandBattle(baseline, makeCtx("0"), "GE", "berlin", "saxony");
  expect(baselineBattle).not.toBeNull();

  const withCard = fresh();
  startLimitedWar(withCard);
  withCard.powers.GE.hand.push("IE-A023");
  expect(playResponseCard(withCard, makeCtx("0"), "IE-A023")).toBeUndefined();
  expect(withCard.flags.warLandDrm).toBe(1);
  placeUnit(withCard, "AU", "army", "saxony", 2);
  const boostedBattle = beginLandBattle(withCard, makeCtx("0"), "GE", "berlin", "saxony");
  expect(boostedBattle).not.toBeNull();

  expect(boostedBattle!.attackerDrm).toBe(baselineBattle!.attackerDrm + 1);
});
