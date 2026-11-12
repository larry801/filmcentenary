import {setupImperialElegy} from "./engine/setup";
import {playResponseCard, resolvePending, resolveWar, WAR_DURATION_FLAG_DEFAULTS} from "./moves";
import {createWarState} from "./engine/limitedWar";
import {beginLandBattle} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {CARDS} from "./constant/cards.data";
import type {ImperialElegyState} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

/** Put GE and AU at war, as in warFlags.test.ts. */
const startLimitedWar = (G: ImperialElegyState): void => {
  G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  G.war.status = "maneuver";
  G.phase = "wartime";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
};

/** Play the two printed war-duration response cards: New Rifles and Rapid Mobilization. */
const setWarDurationFlags = (G: ImperialElegyState): void => {
  const ctx = makeCtx("0");
  G.powers.GE.hand.push("IE-A023", "IE-A063");
  expect(playResponseCard(G, ctx, "IE-A023")).toBeUndefined();
  expect(playResponseCard(G, ctx, "IE-A063")).toBeUndefined();
  expect(G.flags.warLandDrm).toBe(1);
  expect(G.flags.rapidMobilization).toBe(true);
};

/** Give the attacker a normal victory and settle with no treaty choices. */
const settleWithoutTreaties = (G: ImperialElegyState): void => {
  const ctx = makeCtx("0");
  G.spaces.bohemia.control = "GE";
  expect(resolveWar(G, ctx, [])).toBeUndefined();
  expect(G.war).toBeNull();
};

test("settlement clears war-duration flags but leaves game-duration flags alone", () => {
  const G = fresh();
  startLimitedWar(G);
  setWarDurationFlags(G);
  G.persistent.machineGuns = true;

  settleWithoutTreaties(G);

  expect(G.flags.warLandDrm).toBe(0);
  expect(G.flags.rapidMobilization).toBe(false);
  expect(G.persistent.machineGuns).toBe(true);
});

test("the interactive treaty path also clears war-duration flags", () => {
  const G = fresh();
  startLimitedWar(G);
  setWarDurationFlags(G);
  const ctx = makeCtx("0");
  G.spaces.bohemia.control = "GE";

  expect(resolveWar(G, ctx)).toBeUndefined();
  expect(G.war).not.toBeNull();
  expect(G.pending?.kind).toBe("treatyOption");
  expect(resolvePending(G, ctx, "done")).toBeUndefined();

  expect(G.war).toBeNull();
  expect(G.flags.warLandDrm).toBe(0);
  expect(G.flags.rapidMobilization).toBe(false);
});

test("a second war starts from the baseline land battle DRM", () => {
  const baseline = fresh();
  startLimitedWar(baseline);
  placeUnit(baseline, "AU", "army", "saxony", 2);
  const baselineBattle = beginLandBattle(baseline, makeCtx("0"), "GE", "berlin", "saxony");
  expect(baselineBattle).not.toBeNull();

  const G = fresh();
  startLimitedWar(G);
  setWarDurationFlags(G);
  settleWithoutTreaties(G);
  expect(G.flags.warLandDrm).toBe(0);

  startLimitedWar(G);
  placeUnit(G, "AU", "army", "saxony", 2);
  const secondWarBattle = beginLandBattle(G, makeCtx("0"), "GE", "berlin", "saxony");
  expect(secondWarBattle).not.toBeNull();
  expect(secondWarBattle!.attackerDrm).toBe(baselineBattle!.attackerDrm);
});

test("the cleanup covers every duration:war flag in the card data", () => {
  const warFlags = new Set<string>();
  for (const card of [...CARDS.actions, ...CARDS.home, ...CARDS.greatWar]) {
    const effects = [...card.effects, ...(card.options?.flatMap((option) => option.effects) ?? [])];
    for (const effect of effects) {
      if (effect.type === "flag" && effect.duration === "war") warFlags.add(effect.flag);
    }
  }
  expect([...warFlags].sort()).toEqual(Object.keys(WAR_DURATION_FLAG_DEFAULTS).sort());
});
