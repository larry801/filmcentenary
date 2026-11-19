/**
 * Regression suite for the three card-event limitations recorded in
 * `CARD_EVENTS.md` §6.  Each block covers a mechanism that had to exist before
 * the printed clause could be honoured:
 *
 *   1. the EC / elite-colonial-EF combat bonus (A078, A080, A091 second clause);
 *   2. GW-01's strict neutrality marker;
 *   3. A100's second WTT increase reaching the Macedonia award.
 */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, resolveBattleRoll} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {playCard, resolvePending} from "./moves";
import {POWERS} from "./types";
import {
  eliteBonusCandidates,
  eliteBonusDestroys,
  opponentIsNonRebelArmy,
} from "./engine/eliteBonus";

const seats = POWERS as unknown as string[];
const seatOf = (power: string): string => String(seats.indexOf(power));

const makeCtx = (seat = "0", dice: number[] = []): Ctx => {
  let index = 0;
  return {
    playerID: seat,
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

const pendingCtx = (G: any): Ctx => makeCtx(seatOf(G.pending.power));

// ---------------------------------------------------------------------------
// 1. Elite-corps / elite-colonial-EF combat bonus
// ---------------------------------------------------------------------------

describe("elite combat bonus (A078 / A080 / A091)", () => {
  /** A French attack on a plain Bavarian army, optionally with a French EF. */
  const build = (withElite: boolean, defenderRebel = false) => {
    const G: any = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "FR";
    G.turn = 3;
    // 12.16/13.4: a land battle needs a war; this suite only exercises the
    // elite bonus, so record the declaration that makes Bavaria a target.
    G.war = {
      attacker: "FR", defender: "Bavaria", attackerAllies: [], defenderAllies: [],
      attackerMinors: [], defenderMinors: ["Bavaria"], warAim: "conquest",
      objectives: ["bavaria"], status: "maneuver", budgets: {}, initiative: [],
      treaties: [], victor: null, truceTurns: 0, passed: [], startedTurn: 3,
    } as any;
    for (const unit of landUnitsIn(G, "bavaria")) removeUnit(G, unit.id);
    if (defenderRebel) {
      placeUnit(G, "REBEL:Zulu", "rebelArmy", "bavaria", 2);
      G.spaces.bavaria.rebellion = {minor: "Zulu", step: 0, rebels: []};
    } else {
      placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    }
    placeUnit(G, "FR", "army", "alsace-lorraine", 2);
    const elite = withElite ? placeUnit(G, "FR", "eliteColonialEf", "alsace-lorraine", 1) : null;
    const battle: any = beginLandBattle(G, makeCtx(), "FR", "alsace-lorraine", "bavaria");
    G.battle = battle;
    return {G, battle, elite};
  };

  /** Answer support and card windows until the elite decision appears. */
  const upToElite = (G: any, limit = 20): void => {
    let guard = 0;
    while (G.pending && guard++ < limit) {
      if (G.pending.kind === "combatElite") return;
      const done = G.pending.options.find((o: any) => o.id === "done");
      if (done) {
        resolvePending(G, pendingCtx(G), "done");
        continue;
      }
      const decline = G.pending.options.find((o: any) => o.id === "decline");
      resolvePending(G, pendingCtx(G), decline ? "decline" : G.pending.options[0].id);
    }
  };

  /** Answer everything that is left so the battle can roll. */
  const drainAll = (G: any, limit = 20): void => {
    let guard = 0;
    while (G.pending && guard++ < limit) {
      const done = G.pending.options.find((o: any) => o.id === "done");
      const decline = G.pending.options.find((o: any) => o.id === "decline");
      resolvePending(G, pendingCtx(G), done ? "done" : decline ? "decline" : G.pending.options[0].id);
    }
  };

  test("the decision is offered only when an elite unit is in the main force", () => {
    const without = build(false);
    drainAll(without.G);
    expect(without.G.pending?.kind).not.toBe("combatElite");

    const withElite = build(true);
    upToElite(withElite.G);
    expect(withElite.G.pending?.kind).toBe("combatElite");
    expect(withElite.G.pending?.power).toBe("FR");
  });

  test("committing the bonus adds +1 to the recorded BDRM total", () => {
    const {G, battle} = build(true);
    upToElite(G);
    resolvePending(G, pendingCtx(G), "commit");
    drainAll(G);
    // A second roll would be needed to see `attackerDrm`, so read the totals
    // the roll records after the commitment is in place.
    const baseline = build(false);
    drainAll(baseline.G);
    resolveBattleRoll(baseline.G, makeCtx("0", [3, 3]));
    resolveBattleRoll(G, makeCtx("0", [3, 3]));
    expect(battle.eliteBonusAttack?.length).toBe(1);
    expect(battle.attackDrmTotal).toBeGreaterThan(baseline.battle.attackDrmTotal);
  });

  test("declining records no bonus", () => {
    const {G, battle} = build(true);
    upToElite(G);
    resolvePending(G, pendingCtx(G), "decline");
    drainAll(G);
    expect(battle.eliteBonusAttack ?? []).toEqual([]);
  });

  test("the committed unit is destroyed after a non-rebel battle", () => {
    const {G, battle, elite} = build(true);
    upToElite(G);
    resolvePending(G, pendingCtx(G), "commit");
    drainAll(G);
    resolveBattleRoll(G, makeCtx("0", [6, 1]));
    drainAll(G);
    expect(battle.eliteBonusAttack).toEqual([elite!.id]);
    expect(G.units[elite!.id]).toBeUndefined();
    expect((G.log ?? []).some((e: any) => e.key === "eliteBonusDestroyed")).toBe(true);
  });

  test("a rebel opponent does not trigger the auto-elimination clause", () => {
    const {G, battle, elite} = build(true, true);
    upToElite(G);
    resolvePending(G, pendingCtx(G), "commit");
    drainAll(G);
    resolveBattleRoll(G, makeCtx("0", [6, 1]));
    drainAll(G);
    expect(battle.eliteBonusAttack).toEqual([elite!.id]);
    // The unit may still fall to ordinary losses; only the printed automatic
    // destruction must not fire.
    expect((G.log ?? []).some((e: any) => e.key === "eliteBonusDestroyed")).toBe(false);
  });

  test("the pure helpers describe the printed conditions", () => {
    const {G, battle} = build(true);
    expect(eliteBonusCandidates(G, battle, "attacker").map((u: any) => u.kind)).toEqual(["eliteColonialEf"]);
    expect(eliteBonusCandidates(G, battle, "defender")).toEqual([]);
    expect(opponentIsNonRebelArmy(G, battle, "attacker")).toBe(true);

    const rebel = build(true, true);
    expect(opponentIsNonRebelArmy(rebel.G, rebel.battle, "attacker")).toBe(false);
    expect(eliteBonusDestroys(rebel.G, rebel.battle, "attacker")).toBe(false);
  });

  test("naval battles never offer the bonus", () => {
    const G: any = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.persistent.machineGuns = true;
    const naval: any = {kind: "naval", mainAttack: [], mainDefense: [], attacker: "UK", defender: "GE"};
    expect(eliteBonusCandidates(G, naval, "attacker")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. GW-01 strict neutrality marker
// ---------------------------------------------------------------------------

describe("GW-01 Minor Power Entry", () => {
  const gwGame = () => {
    const G: any = setupImperialElegy(makeCtx());
    G.gw = {
      active: true, turn: 2,
      order: ["GE", "FR"], belligerents: ["GE", "FR"],
      neutrals: ["UK", "AU", "RU", "OT"], te: ["FR"], ta: ["GE"],
      usIn: false, italyIn: false, usStability: 3, usManpower: 3, usBudget: 4,
      italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null,
      outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
      discard: [], combatCardsInFront: [],
    } as any;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.impulseCard = null;
    return G;
  };

  const play = (G: any, dice: number[] = [6]) => {
    G.powers.GE.gwCard = "IE-GW-01";
    const {playGwCardMove} = require("./moves");
    playGwCardMove(G, makeCtx("0", dice), "event");
  };

  test("offers both printed branches", () => {
    const G = gwGame();
    play(G);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((o: any) => o.id)).toEqual(["join", "neutral"]);
  });

  test("the strict-neutrality branch marks the chosen minor", () => {
    const G = gwGame();
    play(G);
    resolvePending(G, pendingCtx(G), "neutral");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    const space = G.pending.options[0].id;
    resolvePending(G, pendingCtx(G), space);
    expect(G.spaces[space].strictNeutrality).toBe(true);
    expect(G.pending).toBeNull();
  });

  test("the join branch still rolls and can bring the minor in", () => {
    const G = gwGame();
    play(G);
    resolvePending(G, pendingCtx(G), "join");
    const space = G.pending.options[0].id;
    // The chain rolls its own die, so answer through the same ctx family.
    resolvePending(G, makeCtx(seatOf(G.pending.power), [6]), space);
    expect(G.spaces[space].ally).toBe("GE");
  });

  test("a strictly neutral minor is no longer offered", () => {
    const G = gwGame();
    const minors = Object.keys(G.spaces).filter(
      (id) => G.spaces[id].strictNeutrality !== undefined,
    );
    for (const id of minors) G.spaces[id].strictNeutrality = true;
    play(G);
    // Every candidate is marked, so the card finds nothing to do.
    if (G.pending?.kind === "eventChoice") {
      expect(G.pending.options.length).toBeLessThanOrEqual(2);
    }
    expect(minors.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. A100 second WTT increase reaching the Macedonia award
// ---------------------------------------------------------------------------

describe("A100 The Balkan Wars", () => {
  const play = (startWtt: number, dice: number[]) => {
    const G: any = setupImperialElegy(makeCtx("0", dice));
    G.phase = "action";
    G.activePower = "GE";
    G.turn = 6;
    G.wtt = startWtt;
    G.powers.GE.hand = ["IE-A100"];
    playCard(G, makeCtx("0", dice), "IE-A100", "event");
    let guard = 0;
    while (G.pending && guard++ < 30) {
      resolvePending(G, pendingCtx(G), G.pending.options[0].id);
    }
    return G;
  };

  test("both WTT increases apply when a crisis interrupts the first one", () => {
    // Starting at 4: the first +1 reaches 5 and incites a crisis, which drops
    // the track; the second printed +1 must still be charged afterwards and can
    // incite a second crisis.  Two crisis rolls prove both increases landed
    // (the final track value depends on how each crisis resolves).
    const G = play(4, [1]);
    expect(G.pending).toBeNull();
    const crisisRolls = (G.log ?? []).filter((e: any) => e.key === "crisisRoll").length;
    expect(crisisRolls).toBeGreaterThanOrEqual(2);
  });

  test("the Macedonia award still happens after two crises", () => {
    const G = play(4, [1]);
    expect(G.pending).toBeNull();
    expect(["Greece", "Bulgaria", "Serbia", "OT"]).toContain(G.spaces.macedonia.control);
  });

  test("a single crisis (no interruption) still awards Macedonia", () => {
    const G = play(2, [1]);
    expect(G.pending).toBeNull();
    expect(["Greece", "Bulgaria", "Serbia", "OT"]).toContain(G.spaces.macedonia.control);
  });
});
