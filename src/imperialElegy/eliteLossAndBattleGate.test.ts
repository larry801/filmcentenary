/**
 * Regressions for the log a live player reported after turn 1:
 *
 *   - the Berlin EC was used as the first step loss (5.3.1/18.6.2 say ECs have
 *     no steps and cannot take losses);
 *   - the EC then "automatically" died after its bonus, although Machine Guns
 *     (A080) and Hydraulic Recoil (A091) were not in the deck yet;
 *   - neutral Hanover was attacked during a war with Bavaria without a
 *     declaration (12.16/13.4).
 */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, resolveBattleRoll} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {resolvePending} from "./moves";
import {POWERS, type ImperialElegyState, type Power} from "./types";

const makeCtx = (dice: number[] = [], playerID = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 3,
    phase: "action",
  } as unknown as Ctx;
};

const seatOf = (power: string): string => String((POWERS as readonly string[]).indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const warState = (attacker: Power, defender: Power, defenderMinors: string[] = []) => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors,
  warAim: "conquest" as const,
  objectives: [],
  status: "maneuver" as const,
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
});

/** Clear Berlin/Saxony and stage a GE (armies + optional EC) vs FR battle. */
const stage = (
  attackArmies: number,
  defenceArmies: number,
  withEc: boolean,
  eliteKind: "eliteCorps" | "eliteColonialEf" | "zouave" = "eliteCorps",
) => {
  const G = fresh();
  G.phase = "wartime";
  G.war = {...warState("GE", "FR"), defenderMinors: []} as never;
  for (const unit of [...landUnitsIn(G, "berlin"), ...landUnitsIn(G, "saxony")]) removeUnit(G, unit.id);
  const armies = [];
  for (let i = 0; i < attackArmies; i += 1) armies.push(placeUnit(G, "GE", "army", "berlin", 2));
  const ec = withEc ? placeUnit(G, "GE", eliteKind, "berlin", 1) : null;
  for (let i = 0; i < defenceArmies; i += 1) placeUnit(G, "FR", "army", "saxony", 2);
  const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
  if (!battle) throw new Error("battle did not start");
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
  return {G, battle, ec, armies};
};

const ctxForPending = (G: ImperialElegyState): Ctx =>
  makeCtx([], G.pending ? seatOf(String(G.pending.power)) : "0");

/** Answer every window up to the elite question (or the dice). */
const drainUntil = (G: ImperialElegyState, kind: string, limit = 20): void => {
  for (let guard = 0; G.pending && guard < limit; guard += 1) {
    if (G.pending.kind === kind) return;
    if (G.pending.kind === "combatElite") return;
    const done = G.pending.options.find((option) => option.id === "done");
    const decline = G.pending.options.find((option) => option.id === "decline");
    resolvePending(G, ctxForPending(G), done ? "done" : decline ? "decline" : G.pending.options[0].id);
  }
};

const drainAll = (G: ImperialElegyState, limit = 30): void => {
  for (let guard = 0; G.pending && guard < limit; guard += 1) {
    const done = G.pending.options.find((option) => option.id === "done");
    const decline = G.pending.options.find((option) => option.id === "decline");
    resolvePending(G, ctxForPending(G), done ? "done" : decline ? "decline" : G.pending.options[0].id);
  }
};

/** Answer the elite question, which also rolls the dice, with fixed dice. */
const answerElite = (
  G: ImperialElegyState,
  optionId: "commit" | "decline",
  dice: number[],
): void => {
  drainUntil(G, "combatElite");
  expect(G.pending?.kind).toBe("combatElite");
  resolvePending(G, makeCtx(dice, seatOf(String(G.pending.power))), optionId);
};

describe("5.3.1 / 18.6.2 — ECs cannot take step losses", () => {
  test("a main-force EC is not offered as a loss while an army remains", () => {
    const {G, battle, ec, armies} = stage(2, 3, true);
    answerElite(G, "decline", [3, 3]);
    expect(battle.attackerLosses).toBeGreaterThan(0);
    expect(G.pending?.kind).toBe("combatLosses");
    const ids = (G.pending?.options ?? []).map((option) => option.id);
    expect(ids).not.toContain(ec!.id);
    expect(ids).toContain(armies[0].id);
  });

  test("the first loss reduces the army and leaves the EC in place", () => {
    const {G, battle, ec, armies} = stage(2, 3, true);
    answerElite(G, "decline", [3, 3]);
    expect(G.pending?.kind).toBe("combatLosses");
    resolvePending(G, ctxForPending(G), armies[0].id);
    expect(G.units[armies[0].id]?.steps).toBe(1);
    expect(G.units[ec!.id]).toBeDefined();
    expect(battle.mainAttack).toContain(ec!.id);
  });

  test("an eliminated army takes its attached EC with it (18.6.2)", () => {
    // One full army takes two losses on a -3+ differential, so it is removed.
    const {G, ec} = stage(1, 3, true);
    answerElite(G, "decline", [1, 6]);
    drainAll(G);
    expect(G.units[ec!.id]).toBeUndefined();
  });
});

describe("5.3.1 / A080 / A091 — EC bonus only self-destructs after the addendum", () => {
  test("without Machine Guns/Hydraulic Recoil the EC survives using its bonus", () => {
    const {G, ec} = stage(3, 3, true);
    answerElite(G, "commit", [6, 1]);
    drainAll(G);
    expect(G.units[ec!.id]).toBeDefined();
    expect(G.log.some((entry) => entry.key === "eliteBonusDestroyed")).toBe(false);
  });

  test("with Machine Guns the EC is destroyed after using its bonus", () => {
    const {G, ec} = stage(3, 3, true);
    G.persistent.machineGuns = true;
    answerElite(G, "commit", [6, 1]);
    drainAll(G);
    expect(G.units[ec!.id]).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "eliteBonusDestroyed")).toBe(true);
  });

  test("an elite colonial EF carries the clause on its own counter (5.1.5)", () => {
    const {G, ec} = stage(3, 3, true, "eliteColonialEf");
    answerElite(G, "commit", [6, 1]);
    drainAll(G);
    expect(G.units[ec!.id]).toBeUndefined();
  });

  test("the Zouave carries the same clause (5.1.6)", () => {
    const {G, ec} = stage(3, 3, true, "zouave");
    answerElite(G, "commit", [6, 1]);
    drainAll(G);
    expect(G.units[ec!.id]).toBeUndefined();
  });

  test("the destruction is logged against the committed unit's owner", () => {
    // A defender's EC is destroyed on FR's behalf, not the attacker's.
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR") as never;
    G.persistent.machineGuns = true;
    for (const unit of [...landUnitsIn(G, "berlin"), ...landUnitsIn(G, "saxony")]) removeUnit(G, unit.id);
    // A defeated defender retreats (18.7); give FR a friendly Hanover so the
    // committed EC survives the retreat step and reaches the printed clause.
    for (const unit of landUnitsIn(G, "hanover")) removeUnit(G, unit.id);
    G.spaces.hanover.control = "FR";
    G.spaces.hanover.ally = null;
    for (let i = 0; i < 3; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    const ec = placeUnit(G, "FR", "eliteCorps", "saxony", 1);
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    battle!.attackerDrm = 0;
    battle!.defenderDrm = 0;
    // The attacker has no elite, so the first question belongs to FR.
    drainUntil(G, "combatElite");
    expect(G.pending?.kind).toBe("combatElite");
    resolvePending(G, makeCtx([1, 6], seatOf("FR")), "commit");
    drainAll(G);
    expect(G.units[ec.id]).toBeUndefined();
    const destroyed = [...G.log].reverse().find((entry) => entry.key === "eliteBonusDestroyed");
    expect(destroyed?.power).toBe("FR");
    expect(destroyed?.args).toMatchObject({side: "defender"});
  });
});

describe("12.16 / 13.4 — non-player targets need a declaration", () => {
  test("neutral Hanover cannot be attacked from Berlin in peacetime", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    expect(beginLandBattle(G, makeCtx(), "GE", "berlin", "hanover")).toBeNull();
  });

  test("a war on Bavaria does not make Hanover a legal target", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "AU", ["Bavaria"]) as never;
    expect(beginLandBattle(G, makeCtx(), "GE", "berlin", "hanover")).toBeNull();
  });

  test("a declared war listing Hanover opens the battle", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "AU", ["Bavaria", "Hanover"]) as never;
    const battle = beginLandBattle(G, makeCtx(), "GE", "berlin", "hanover");
    expect(battle).not.toBeNull();
    expect(battle?.mainDefense.length).toBeGreaterThan(0);
  });
});
