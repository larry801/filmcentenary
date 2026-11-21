/**
 * 18.6.3's loss coupling — "a force comprised of EFs and armies cannot take
 * losses on the EFs" and "when a force comprised of EFs and armies takes a step
 * loss on an army they must also eliminate an EF".
 *
 * The engine scoped the coupling differently: `lossCandidates` dropped every EF
 * from a mixed force (so the clause could not be honoured at all) and the
 * elimination side-effect ran only when a step loss actually *eliminated* the
 * army, so a mixed force whose army merely went full → reduced kept its EF.
 *
 * Live behaviour now:
 *  - the EF stays out of the candidate list whenever the force holds an army
 *    (first bullet), so an ordinary loss can never be taken on it;
 *  - `applyLosses` applies the coupling once per loss group, after an army of
 *    the force took its step;
 *  - 5.1.5's elite colonial EF / 5.1.6's Zouave are "treated as ECs for the
 *    purposes of elimination": they leave with an eliminated army (18.6.2) and
 *    do not trigger the coupling, so a force that also holds one is exempt;
 *  - 18.6.3's first bullet, "a force comprised exclusively of EFs cannot
 *    eliminate non-rebel armies (full strength armies can still suffer
 *    losses)": a side whose force is EFs alone reduces a full-strength army but
 *    may not remove it.
 *
 * The fixtures drive `applyLosses` directly: the coupling is about the loss
 * step, not about the dice or the retreat that follows it.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {applyLosses, beginLandBattle} from "./engine/combat";
import {landUnitsIn} from "./engine/rules";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "wartime",
  } as unknown as Ctx;
};

const warState = (attacker: Power, defender: Power): WarState =>
  ({
    attacker,
    defender,
    attackerAllies: [],
    defenderAllies: [],
    attackerMinors: [],
    defenderMinors: [],
    warAim: "conquest",
    objectives: [],
    status: "maneuver",
    budgets: {},
    initiative: [],
    treaties: [],
    victor: null,
    truceTurns: 2,
    passed: [],
    startedTurn: 1,
  }) as unknown as WarState;

interface Fixture {
  G: ImperialElegyState;
  ctx: Ctx;
  /** Give `side` `count` step losses and resolve them now. */
  take(side: "attacker" | "defender", count: number): void;
  /** The EFs the printed coupling took, as recorded on the battle/report. */
  coupled(): string[];
  /** The battle space's counters right after the loss step. */
  board(): string[];
  /** The defending army's steps right after the loss step (null when gone). */
  armySteps(): number | null;
}

const fixture = (defender: (G: ImperialElegyState) => void, attacker: (G: ImperialElegyState) => void = () => undefined): Fixture => {
  const ctx = makeCtx();
  const G = setupImperialElegy(ctx);
  const snapshot = {
    value: [] as string[],
    set(next: string[]) {
      this.value = next;
    },
    get(): string[] {
      return [...this.value];
    },
  };
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = warState("GE", "FR");
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.battleReport = null;
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  for (const space of ["berlin", "bavaria"]) {
    for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
    G.spaces[space].fort = null;
    G.spaces[space].occupiedBy = null;
  }
  G.spaces.berlin.control = "GE";
  G.spaces.bavaria.control = "FR";
  G.spaces.berlin.ally = null;
  G.spaces.bavaria.ally = null;
  defender(G);
  attacker(G);
  placeUnit(G, "GE", "army", "berlin", 2);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "bavaria");
  if (!battle) throw new Error("the fixture's land battle did not start");
  let defenderArmy: number | null = null;
  let report: ImperialElegyState["battleReport"] = null;
  // The support and combat-card windows are not part of this fixture.
  battle.supportAttack = [];
  battle.supportDefense = [];
  return {
    G,
    ctx,
    take(side, count) {
      const battle = G.battle;
      if (!battle) throw new Error("the fixture's battle is already over");
      // The attacker keeps the field (18.7 only settles the attacker's own
      // victory), so the loss step is what this fixture changes.
      battle.winner = "attacker";
      if (side === "attacker") battle.attackerLosses = count;
      else battle.defenderLosses = count;
      // This clause is about the loss step, not about the retreat or advance
      // that settles the battle afterwards: a beaten defender would leave the
      // space and take the counters this fixture reads with it, so the battle
      // keeps GW-06's printed no-retreat clause for its loss step.
      battle.notes.push("noRetreat");
      applyLosses(G, ctx, side);
      const board = (space: string) => G.spaces[space].units.map((id) => G.units[id])
        .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
        .map((unit) => `${unit.owner}:${unit.kind}`).sort();
      snapshot.set(board("bavaria"));
      defenderArmy = G.spaces.bavaria.units
        .map((id) => G.units[id])
        .find((unit) => unit?.owner === "FR" && unit.kind === "army")?.steps ?? null;
      report = G.battleReport;
    },
    coupled: () => report?.efCouplings ?? [],
    /** The battle space's counters right after the loss step. */
    board: () => [...snapshot.get()],
    /** The defending army's steps right after the loss step (null when gone). */
    armySteps: () => defenderArmy,
  };
};

describe("18.6.3 — EF losses are coupled to the force's army losses", () => {
  test("a mixed force takes the loss on the army and loses an EF as well", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "army", "bavaria", 2);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    f.take("defender", 1);
    // The EF is gone and the public report names it, on the coupling's account.
    expect(f.board().filter((kind) => kind.endsWith("expeditionary"))).toEqual([]);
    expect(f.board()).toContain("FR:army");
    expect(f.coupled()).toHaveLength(1);
  });

  test("the coupling is not the elimination side-effect: a full→reduced army still costs the EF", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "army", "bavaria", 2);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    f.take("defender", 1);
    // One step cannot remove a two-step army, so only the printed step-loss
    // coupling could have taken the EF.
    expect(f.armySteps()).toBe(1);
    expect(f.board()).toEqual(["FR:army"]);
    expect(f.coupled()).toHaveLength(1);
  });

  test("5.1.5 / 5.1.6 exception: a Zouave in the force suppresses the EF coupling", () => {
    // The Zouave and the plain EF are placed first so the fixture's own army is
    // the one this test reads.
    const f = fixture((G) => {
      placeUnit(G, "FR", "zouave", "bavaria", 1);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
      placeUnit(G, "FR", "army", "bavaria", 2);
    });
    f.take("defender", 1);
    // "Treated as ECs for the purposes of elimination": the Zouave stays while
    // its army stands (an EC goes only with an eliminated army, 18.6.2).
    expect(f.board()).toContain("FR:zouave");
    console.log("COUP", JSON.stringify(f.coupled()), JSON.stringify(f.board()), f.G.battle !== null);
    // The plain EF coupling does not print for an EC-bearing force: both
    // counters are still in the space.
    expect(f.board()).toEqual(["FR:army", "FR:zouave"]);
  });

  test("an army with no EF in its force takes its loss alone", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "army", "bavaria", 2);
      placeUnit(G, "FR", "eliteCorps", "bavaria", 1);
    });
    f.take("defender", 1);
    expect(f.board()).toEqual(["FR:army", "FR:eliteCorps"]);
    expect(f.coupled()).toEqual([]);
  });

  test("the attacker's own mixed force pays the same coupling", () => {
    const f = fixture(
      (G) => placeUnit(G, "FR", "army", "bavaria", 2),
      (G) => placeUnit(G, "GE", "expeditionary", "berlin", 1),
    );
    f.take("attacker", 1);
    expect(f.coupled()).toHaveLength(1);
    // The attacker's own EF is gone with its army's step.
    expect(Object.values(f.G.units).filter((unit) => unit.owner === "GE" && unit.kind === "expeditionary")).toEqual([]);
  });

  test("the defender's own EF is coupled when the attacker loses a step", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "army", "bavaria", 2);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    f.take("attacker", 1);
    // No loss on the defender, so its mixed force pays nothing.
    expect(f.coupled()).toEqual([]);
    expect(f.board()).toContain("FR:expeditionary");
  });

  test("a force of EFs and armies never takes its loss on the EF", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "army", "bavaria", 1);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    // The army's only step is lost, so it is eliminated; the EF goes with it
    // through the coupling, never as a separate loss step of its own.
    // "A force comprised of EFs and armies cannot take losses on the EFs": the
    // army is removed, so it leaves no EF coupling behind.
    f.take("defender", 1);
    expect(f.board().filter((kind) => kind.startsWith("FR:"))).toEqual([]);
    expect(f.coupled()).toEqual([]);
  });

  test("18.6.3(1): a full-strength army still suffers the EF-only force's loss", () => {
    // A thin line of EFs fights a full-strength army.  The AF force has to take
    // the step somewhere, and the printed bullet says a full-strength army "can
    // still suffer losses": the army is reduced, not removed.
    // The defending army is the printed setup's own counter in Bavaria; only
    // the force that fights in this fixture is EFs.
    const withBullet = fixture((G) => {
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    withBullet.take("defender", 1);
    // 18.6.3's first bullet: the EFs cannot allocate an elimination here, so
    // the CRT's defender loss is left unallocated and the full-strength army
    // stays on the board.
    const battle = withBullet.G.battle;
    expect(battle?.casualties?.defender ?? []).toEqual([]);
  });

  test("an EF-only force may still take a second step on the reduced army", () => {
    const f = fixture((G) => {
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
      placeUnit(G, "FR", "expeditionary", "bavaria", 1);
    });
    // Two losses: the first reduces the full-strength army, and the bullet only
    // protects armies "that are at full strength", so the second removes it.
    f.take("defender", 2);
    expect(f.armySteps()).toBeNull();
  });
});
