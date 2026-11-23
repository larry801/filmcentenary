/**
 * Rule 32.4 — Attacking neutral non-player powers in the Great War.
 *
 * "Players can declare war on non-player powers at any point during their
 * impulse.  When this happens a player from the opposing alliance immediately
 * places an alliance marker in the minor power's space. ... If a neutral player
 * is allied to or has a diplomacy marker in the attacked power's space, that
 * neutral player has the option to immediately join the GW with the opposing
 * alliance."
 *
 * 30.2 then makes a minor "effectively eliminated from the war" when all its
 * troops are gone and its home space(s) are occupied; this suite also pins the
 * inheritance of its alliance marker by a surviving alliance member.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {beginLandBattle} from "./engine/combat";
import {legalLandBattleTarget, hostileOwner} from "./engine/rules";
import {
  checkGwNonPlayerDeclaration,
  gwNonPlayerWarTargets,
  resolveGwNonPlayerEliminations,
} from "./engine/gwNonPlayerWar";
import {gwNonPlayerBelligerents} from "./engine/gwNonPlayer";

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
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const gwState = (): GreatWarState =>
  ({
    active: true,
    turn: 1,
    order: ["GE", "UK", "FR", "AU", "RU", "OT"],
    belligerents: ["GE", "UK", "FR", "AU"],
    neutrals: ["RU", "OT"],
    te: ["UK", "FR"],
    ta: ["GE", "AU"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    combatCardsInFront: [],
  }) as unknown as GreatWarState;

const gwManeuver = (active: Power = "GE"): ImperialElegyState => {
  const G = fresh();
  G.gw = gwState();
  G.phase = "gwManeuver";
  G.activePower = active;
  G.pending = null;
  G.battle = null;
  return G;
};

const declare = (G: ImperialElegyState, target: string, dice: number[] = [6, 1]): void => {
  const {gwDeclareWarOnNonPlayer} = require("./moves") as typeof import("./moves");
  const result = gwDeclareWarOnNonPlayer(G, makeCtx(dice, seat("GE")), target);
  expect(result).toBeUndefined();
};

const clearUnits = (G: ImperialElegyState, owner: string): void => {
  for (const [id, unit] of Object.entries(G.units)) {
    if (unit.owner !== owner) continue;
    delete G.units[id];
    for (const state of Object.values(G.spaces)) {
      state.units = state.units.filter((unitId) => unitId !== id);
    }
  }
};

describe("32.4 — the neutral non-player is not a free target", () => {
  test("before a declaration an independent minor is neither hostile nor a legal land target", () => {
    const G = gwManeuver();
    expect(G.spaces.belgium.ally).toBeNull();
    expect(hostileOwner(G, "GE", "Belgium")).toBe(false);
    expect(legalLandBattleTarget(G, "GE", "Belgium")).toBe(false);
  });

  test("the declaration places an opposing-alliance marker and makes the minor a belligerent", () => {
    const G = gwManeuver();
    // TE's two living members (UK, FR) roll off because they cannot be assumed
    // to agree; the higher roll receives the marker.
    declare(G, "Belgium", [6, 1]);

    expect(G.spaces.belgium.ally).toBe("UK");
    const entry = gwNonPlayerBelligerents(G).find((item) => item.power === "Belgium");
    expect(entry).toMatchObject({power: "Belgium", side: "te", ally: "UK", declaredBy: "GE", turn: 1});
    expect(hostileOwner(G, "GE", "Belgium")).toBe(true);
    expect(hostileOwner(G, "AU", "Belgium")).toBe(true);
    expect(hostileOwner(G, "UK", "Belgium")).toBe(false);
    expect(legalLandBattleTarget(G, "GE", "Belgium")).toBe(true);
  });

  test("a land battle now names the controlling alliance member, not the attacker", () => {
    const G = gwManeuver();
    placeUnit(G, "GE", "army", "westphalia", 2);
    declare(G, "Belgium", [6, 1]);
    const battle = beginLandBattle(G, makeCtx([6, 1]), "GE", "westphalia", "belgium");
    expect(battle).not.toBeNull();
    expect(battle!.attacker).toBe("GE");
    expect(battle!.defender).toBe("UK");
    // The record also keeps the non-player identity: the log names Belgium,
    // not the attacker and not a fictitious civil war.
    expect(battle!.defenderNonPlayer).toBe("Belgium");
  });

  test("a lone non-player defender keeps its identity in the battle record", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = {
      attacker: "GE", defender: "Denmark", attackerAllies: [], defenderAllies: [],
      attackerMinors: [], defenderMinors: ["Denmark"],
      minorTarget: {minor: "Denmark", ally: null},
      budgets: {GE: 2}, status: "maneuver", initiative: ["GE"],
    } as unknown as ImperialElegyState["war"];
    placeUnit(G, "GE", "army", "hanover", 2);
    const battle = beginLandBattle(G, makeCtx([6, 1]), "GE", "hanover", "schleswig-holstein");
    expect(battle).not.toBeNull();
    // The fallback still gives the loss/retreat helpers a power, but the real
    // defender is preserved for the log and the result dialog.
    expect(battle!.defender).toBe("GE");
    expect(battle!.defenderNonPlayer).toBe("Denmark");
  });
});

describe("32.4 — declaration gate", () => {
  test("only the active belligerent in its GW maneuver impulse may declare", () => {
    const G = gwManeuver();
    expect(checkGwNonPlayerDeclaration(G, "UK", "Belgium")).toMatchObject({ok: false, reason: "not-active"});
    G.phase = "action";
    expect(checkGwNonPlayerDeclaration(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "wrong-phase"});
  });

  test("a neutral player is not a declarer and the US cannot be invaded", () => {
    const G = gwManeuver();
    G.activePower = "RU";
    expect(checkGwNonPlayerDeclaration(G, "RU", "Belgium")).toMatchObject({ok: false, reason: "not-belligerent"});
    G.activePower = "GE";
    expect(checkGwNonPlayerDeclaration(G, "GE", "Italy")).toMatchObject({ok: false, reason: "not-non-player"});
  });

  test("a strict-neutrality marker blocks the declaration", () => {
    const G = gwManeuver();
    G.spaces.belgium.strictNeutrality = true;
    expect(checkGwNonPlayerDeclaration(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "strict-neutrality"});
  });

  test("a minor already on the attacker's side is not a target", () => {
    const G = gwManeuver();
    G.spaces.belgium.ally = "AU";
    expect(checkGwNonPlayerDeclaration(G, "GE", "Belgium")).toMatchObject({ok: false, reason: "friendly"});
  });

  test("the target list is exactly the legal declarations", () => {
    const G = gwManeuver();
    const powers = gwNonPlayerWarTargets(G, "GE").map((entry) => entry.power);
    expect(powers).toContain("Belgium");
    // A player-controlled minor on the attacker's side is filtered out.
    G.spaces.bavaria.ally = "AU";
    expect(gwNonPlayerWarTargets(G, "GE").map((entry) => entry.power)).not.toContain("Bavaria");
  });
});

describe("32.4 — a neutral player with a marker gets the join option", () => {
  test("the ally marker holder is asked and may join the opposing alliance", () => {
    const G = gwManeuver();
    // Belgium is allied to the neutral RU before the attack.
    G.spaces.belgium.ally = "RU";
    const {gwDeclareWarOnNonPlayer, resolvePending} = require("./moves") as typeof import("./moves");

    expect(gwDeclareWarOnNonPlayer(G, makeCtx([6, 1], seat("GE")), "Belgium")).toBeUndefined();
    expect(G.spaces.belgium.ally).toBe("UK");
    expect(G.pending?.kind).toBe("gwNonPlayerJoin");
    expect(G.pending?.power).toBe("RU");

    expect(resolvePending(G, makeCtx([], seat("RU")), "join")).toBeUndefined();
    expect(G.gw!.te).toContain("RU");
    expect(G.gw!.belligerents).toContain("RU");
    expect(G.gw!.neutrals).not.toContain("RU");
    expect(G.pending).toBeNull();
  });

  test("staying out leaves the neutral player untouched", () => {
    const G = gwManeuver();
    G.spaces.belgium.ally = "RU";
    const {gwDeclareWarOnNonPlayer, resolvePending} = require("./moves") as typeof import("./moves");
    expect(gwDeclareWarOnNonPlayer(G, makeCtx([6, 1], seat("GE")), "Belgium")).toBeUndefined();
    expect(resolvePending(G, makeCtx([], seat("RU")), "stay")).toBeUndefined();
    expect(G.gw!.neutrals).toContain("RU");
    expect(G.gw!.belligerents).not.toContain("RU");
    expect(G.pending).toBeNull();
  });
});

describe("30.2 — effective elimination and marker inheritance", () => {
  test("a minor with no troops and occupied homes leaves the war and its marker passes to the alliance", () => {
    const G = gwManeuver();
    declare(G, "Belgium", [6, 1]);
    expect(G.spaces.belgium.ally).toBe("UK");

    clearUnits(G, "Belgium");
    G.spaces.belgium.occupiedBy = "GE";

    const eliminated = resolveGwNonPlayerEliminations(G, makeCtx([1, 6]));
    expect(eliminated).toEqual([{power: "Belgium", heir: "FR"}]);
    const entry = gwNonPlayerBelligerents(G).find((item) => item.power === "Belgium");
    expect(entry?.eliminated).toBe(true);
    // UK and FR survive, so the 30.1 die roll decides; FR wins here.
    expect(entry?.ally).toBe("FR");
    expect(G.spaces.belgium.ally).toBe("FR");
  });

  test("a minor that still has troops, or whose home is not occupied, stays in the war", () => {
    const G = gwManeuver();
    declare(G, "Belgium", [6, 1]);
    expect(resolveGwNonPlayerEliminations(G, makeCtx([3]))).toEqual([]);
    // All troops gone but the home is still Belgian-controlled and unoccupied.
    clearUnits(G, "Belgium");
    expect(resolveGwNonPlayerEliminations(G, makeCtx([3]))).toEqual([]);
    expect(gwNonPlayerBelligerents(G)[0].eliminated).not.toBe(true);
  });
});

describe("32.4 — a unified Italy is a non-player major", () => {
  test("attacking neutral Italy brings it in on the opposing alliance and 30.2 applies", () => {
    const G = gwManeuver();
    G.persistent.italyUnified = true;
    G.flags.italyUnified = true;
    G.spaces.rome.control = "IT";
    G.spaces.naples.control = "IT";
    clearUnits(G, "IT");
    const {gwDeclareWarOnNonPlayer} = require("./moves") as typeof import("./moves");
    const result = gwDeclareWarOnNonPlayer(G, makeCtx([6, 1], seat("GE")), "IT");
    expect(result).toBeUndefined();
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("te");
    expect(gwNonPlayerBelligerents(G).find((item) => item.power === "IT")).toMatchObject({
      side: "te", declaredBy: "GE",
    });
    expect(legalLandBattleTarget(G, "GE", "IT")).toBe(true);
    expect(legalLandBattleTarget(G, "UK", "IT")).toBe(false);
  });
});
