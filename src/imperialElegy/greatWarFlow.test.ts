import {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, Power} from "../types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {resolvePending} from "./moves";
import {
  advanceGwImpulse,
  beginGwTurn,
  enterGwAlly,
  faceupCombatCards,
  performGwManeuver,
  resolveGwWinter,
  startGwManeuver,
  transferGwBudget,
} from "./engine/greatWarFlow";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["FR"],
    ta: ["GE"],
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
    ...overrides,
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwPlanning";
  return G;
};

const reserveId = (G: ImperialElegyState): string => {
  const id = G.powers.GE.reserves[0];
  expect(id).toBeTruthy();
  return id;
};

describe("Great War planning", () => {
  test("deals/refreshes cards, marks faceup combat cards and resets war budgets", () => {
    const G = baseGw();
    G.powers.GE.industry = 5;
    G.powers.GE.gwCard = "IE-GW-03"; // combat card, held over on purpose
    // Only in-front cards are faceup combat cards (26.1); planning flips this
    // facedown card and leaves the held GW-03 out of the faceup display.
    G.gw!.combatCardsInFront = [{holder: "GE", cardId: "IE-GW-04", faceup: false}];
    const res = beginGwTurn(G, makeCtx());

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.phase).toBe("gwPlanning");
    expect(G.powers.GE.gwCard).toBe("IE-GW-03");
    expect(faceupCombatCards(G).GE).toBe("IE-GW-04");
    expect(res.faceupCombat.GE).toBe("IE-GW-04");
    expect(String(G.flags.gwFaceupCombat)).toContain("GE:IE-GW-04");
    expect(faceupCombatCards(G).GE).not.toBe("IE-GW-03");
    expect(res.dealt.GE).toBeUndefined();
    expect(res.dealt.FR).toBeTruthy();

    // All non-eliminated powers end planning with a GW card.
    for (const p of ["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]) {
      expect(G.powers[p].gwCard).toBeTruthy();
    }
    // GE industry 5 -> 5; FR industry 1 -> max(2,1) + Second Empire 1 = 3.
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.powers.FR.gwBudget).toBe(3);
    expect(G.powers.GE.warBudget).toBe(0);
    expect(G.powers.GE.flags.gwCpTransferDone).toBe(false);
    expect(G.turnIndex).toBe(0);
  });

  test("CP transfer only works within an alliance and only once per planning", () => {
    const G = baseGw({
      te: ["FR", "UK"],
      ta: ["GE"],
      belligerents: ["FR", "UK", "GE"],
      order: ["GE", "FR", "UK"],
    });
    G.powers.GE.gwBudget = 4;
    G.powers.FR.gwBudget = 3;
    G.powers.UK.gwBudget = 2;
    const ctx = makeCtx();

    const transfer = transferGwBudget(G, ctx, "FR", "UK", 2);
    expect(transfer.ok).toBe(true);
    if (!transfer.ok) throw new Error(transfer.message);
    expect(G.powers.FR.gwBudget).toBe(1);
    expect(G.powers.UK.gwBudget).toBe(4);
    expect(G.powers.FR.flags.gwCpTransferDone).toBe(true);

    const again = transferGwBudget(G, ctx, "FR", "UK", 1);
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error("expected a failure");
    expect(again.error).toBe("alreadyUsed");

    const enemy = transferGwBudget(G, ctx, "GE", "FR", 1);
    expect(enemy.ok).toBe(false);
    if (enemy.ok) throw new Error("expected a failure");
    expect(enemy.error).toBe("notAllied");
    expect(G.powers.GE.gwBudget).toBe(4);
  });

  test("startGwManeuver begins at the first living order slot", () => {
    const G = baseGw({order: [null, "FR", "GE"], te: ["FR"], ta: ["GE"]});
    const res = startGwManeuver(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.phase).toBe("gwManeuver");
    expect(res.power).toBe("FR");
    expect(res.index).toBe(1);
    expect(G.activePower).toBe("FR");
    expect(G.turnIndex).toBe(1);
  });
});

describe("Great War impulse order", () => {
  test("resolves a bonus slot for the smaller alliance without jumping back", () => {
    const G = baseGw({
      order: ["GE", "bonus", "FR", "UK"],
      te: ["FR", "UK"],
      ta: ["GE"],
      belligerents: ["GE", "FR", "UK"],
    });
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    const ctx = makeCtx();

    const bonus = advanceGwImpulse(G, ctx);
    expect(bonus.ok).toBe(true);
    if (!bonus.ok) throw new Error(bonus.message);
    expect(bonus.kind).toBe("bonus");
    expect(bonus.power).toBe("GE");
    expect(bonus.index).toBe(1);
    expect(bonus.side).toBe("ta");
    expect(G.flags.gwBonusImpulse).toBe(true);
    expect(G.gw!.bonusImpulses).toContain("GE");

    // The bonus power is the same as slot 0; the cursor must move on to FR
    // (index 2), not back to GE's first slot.
    const next = advanceGwImpulse(G, ctx);
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.message);
    expect(next.kind).toBe("power");
    expect(next.power).toBe("FR");
    expect(next.index).toBe(2);
    expect(G.flags.gwBonusImpulse).toBe(false);
    expect(G.activePower).toBe("FR");
  });

  test("skips passed powers and reports when every belligerent has passed", () => {
    const G = baseGw({order: ["GE", "FR"], te: ["FR"], ta: ["GE"]});
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.flags.passedGw = true;
    const ctx = makeCtx();

    const r = advanceGwImpulse(G, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.message);
    expect(r.power).toBe("FR");

    G.powers.FR.flags.passedGw = true;
    const end = advanceGwImpulse(G, ctx);
    expect(end.ok).toBe(true);
    if (!end.ok) throw new Error(end.message);
    expect(end.kind).toBe("end");
    expect(end.allPassed).toBe(true);
  });

  test("US entry adds an ally impulse slot controlled by its side", () => {
    const G = baseGw({order: ["GE", "FR"], te: ["FR"], ta: ["GE"]});
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    const ctx = makeCtx();

    const entry = enterGwAlly(G, ctx, "US", "te");
    expect(entry.ok).toBe(true);
    if (!entry.ok) throw new Error(entry.message);
    expect(G.gw!.usIn).toBe(true);
    expect(G.flags.usSide).toBe("te");
    expect(G.gw!.order).toContain("US");
    expect(entry.bonusImpulse).toBe(true);

    const toFr = advanceGwImpulse(G, ctx);
    expect(toFr.ok && toFr.power).toBe("FR");
    const us = advanceGwImpulse(G, ctx);
    expect(us.ok).toBe(true);
    if (!us.ok) throw new Error(us.message);
    expect(us.kind).toBe("ally");
    expect(us.slot).toBe("US");
    expect(us.power).toBe("FR");
    expect(G.gw!.bonusImpulses).toContain("US");

    const duplicate = enterGwAlly(G, ctx, "US", "ta");
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error("expected a failure");
    expect(duplicate.error).toBe("alreadyEntered");
  });
});

describe("Great War maneuver budget spending", () => {
  test("deploy, draft, rail, march and refit each spend exactly one GW budget", () => {
    const G = baseGw({
      order: ["GE"],
      te: [],
      ta: ["GE"],
      belligerents: ["GE"],
      neutrals: ["FR", "UK", "AU", "RU", "OT"],
    });
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.gwBudget = 6;
    G.powers.GE.manpower = 3;
    G.spaces.berlin.control = "GE";
    G.spaces.pomerania.control = "GE";
    G.spaces.prussia.control = "GE";
    const ctx = makeCtx();
    const reserve = reserveId(G);
    // 15.2.3: the newly deployed reserve cannot move, so rail/march use a
    // pre-existing Berlin army instead.
    const mover = G.spaces.berlin.units
      .map((id) => G.units[id])
      .find((unit) => unit.owner === "GE" && unit.kind === "army" && unit.steps === 2)!.id;

    const deploy = performGwManeuver(G, ctx, {kind: "deploy", power: "GE", space: "berlin"});
    expect(deploy.ok).toBe(true);
    if (!deploy.ok) throw new Error(deploy.message);
    expect(deploy.cost).toBe(1);
    expect(deploy.budgetAfter).toBe(5);
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.powers.GE.reserves).not.toContain(reserve);
    expect(G.units[reserve].space).toBe("berlin");
    expect(G.units[reserve].flags?.deployedThisImpulse).toBe(true);

    const berlinBefore = G.spaces.berlin.units.length;
    const draft = performGwManeuver(G, ctx, {kind: "draft", power: "GE", space: "berlin"});
    expect(draft.ok).toBe(true);
    if (!draft.ok) throw new Error(draft.message);
    expect(G.powers.GE.gwBudget).toBe(4);
    expect(G.powers.GE.manpower).toBe(2);
    // 27.5.2: one reduced army in the requested space, then a second-space
    // decision ("no more than one per space").
    expect(G.spaces.berlin.units.length).toBe(berlinBefore + 1);
    expect(G.pending?.kind).toBe("gwDraft");
    expect(G.pending?.options.map((entry) => entry.id)).not.toContain("berlin");
    expect(resolvePending(G, ctx, "silesia")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.silesia.units).toHaveLength(1);

    const rail = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId: mover, to: "pomerania"});
    expect(rail.ok).toBe(true);
    if (!rail.ok) throw new Error(rail.message);
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.units[mover].space).toBe("pomerania");

    const march = performGwManeuver(G, ctx, {kind: "march", power: "GE", unitId: mover, to: "prussia"});
    expect(march.ok).toBe(true);
    if (!march.ok) throw new Error(march.message);
    expect(G.powers.GE.gwBudget).toBe(2);
    expect(G.units[mover].space).toBe("prussia");

    // The deployed reserve itself is refused (and no budget is spent).
    const blocked = performGwManeuver(G, ctx, {kind: "rail", power: "GE", unitId: reserve, to: "pomerania"});
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("invalidTarget");
    expect(G.powers.GE.gwBudget).toBe(2);
    expect(G.units[reserve].space).toBe("berlin");

    const drafted = G.spaces.berlin.units
      .map((id) => G.units[id])
      .find((unit) => unit.owner === "GE" && unit.kind === "army" && unit.steps === 1);
    expect(drafted).toBeTruthy();
    const refit = performGwManeuver(G, ctx, {kind: "refit", power: "GE", unitId: drafted!.id});
    expect(refit.ok).toBe(true);
    if (!refit.ok) throw new Error(refit.message);
    expect(G.powers.GE.gwBudget).toBe(1);
    expect(G.units[drafted!.id].steps).toBe(2);

    // An empty budget is a structured failure and does not mutate state.
    G.powers.GE.gwBudget = 0;
    const before = JSON.stringify(G);
    const broke = performGwManeuver(G, ctx, {kind: "deploy", power: "GE", space: "berlin"});
    expect(broke.ok).toBe(false);
    if (broke.ok) throw new Error("expected a failure");
    expect(broke.error).toBe("insufficientBudget");
    expect(JSON.stringify(G)).toBe(before);
  });

  test("land battle spends one budget and delegates to the combat engine", () => {
    const G = baseGw({
      order: ["GE"],
      te: ["FR"],
      ta: ["GE"],
      belligerents: ["GE", "FR"],
      neutrals: ["UK", "AU", "RU", "OT"],
    });
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.gwBudget = 2;
    placeUnit(G, "FR", "army", "saxony", 2);
    const ctx = makeCtx();

    const battle = performGwManeuver(G, ctx, {
      kind: "landBattle",
      power: "GE",
      from: "berlin",
      to: "saxony",
    });
    expect(battle.ok).toBe(true);
    if (!battle.ok) throw new Error(battle.message);
    expect(battle.battle).toMatchObject({kind: "land", attacker: "GE", defender: "FR", from: "berlin", to: "saxony"});
    expect(G.powers.GE.gwBudget).toBe(1);
    expect(G.battle).not.toBeNull();
    expect(G.pending).not.toBeNull(); // normal support prompt is still authoritative
  });

  test("naval, joint naval and fleet refit use the same budget guard", () => {
    const G = baseGw({
      order: ["UK"],
      te: ["UK", "FR"],
      ta: ["GE"],
      belligerents: ["UK", "FR", "GE"],
      neutrals: ["AU", "RU", "OT"],
    });
    G.phase = "gwManeuver";
    G.activePower = "UK";
    G.turnIndex = 0;
    G.powers.UK.gwBudget = 4;
    G.powers.UK.alliance = "teCommitted";
    G.powers.FR.alliance = "teCommitted";
    const ctx = makeCtx();
    const ukSquadron = Object.values(G.units).find(
      (unit) => unit.owner === "UK" && unit.naval && unit.space === "london",
    );
    expect(ukSquadron).toBeTruthy();

    const naval = performGwManeuver(G, ctx, {
      kind: "naval",
      power: "UK",
      unitIds: [ukSquadron!.id],
      to: "north-atlantic",
    });
    expect(naval.ok).toBe(true);
    if (!naval.ok) throw new Error(naval.message);
    expect(G.powers.UK.gwBudget).toBe(3);
    expect(G.units[ukSquadron!.id].space).toBe("north-atlantic");

    const frSquadron = placeUnit(G, "FR", "squadron", "north-atlantic", 2);
    const joint = performGwManeuver(G, ctx, {
      kind: "jointNaval",
      power: "UK",
      ally: "FR",
      unitIds: [ukSquadron!.id],
      allyUnitIds: [frSquadron.id],
      to: "london",
    });
    expect(joint.ok).toBe(true);
    if (!joint.ok) throw new Error(joint.message);
    expect(joint.ally).toBe("FR");
    expect(G.powers.UK.gwBudget).toBe(2);
    expect(G.units[ukSquadron!.id].space).toBe("london");
    expect(G.units[frSquadron.id].space).toBe("london");

    G.units[ukSquadron!.id].steps = 1;
    const refit = performGwManeuver(G, ctx, {kind: "refitFleet", power: "UK", unitId: ukSquadron!.id});
    expect(refit.ok).toBe(true);
    if (!refit.ok) throw new Error(refit.message);
    expect(G.powers.UK.gwBudget).toBe(1);
    expect(G.units[ukSquadron!.id].steps).toBe(2);
  });
});

describe("Great War winter", () => {
  test("resolves colonial war, waits for the neutral choice and advances to next planning", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "AU", "FR"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
      neutrals: ["OT"],
    });
    G.phase = "gwWinter";
    G.powers.OT.alliance = "neutral";
    G.powers.AU.alliance = "taCommitted";
    placeUnit(G, "FR", "expeditionary", "sudan", 1);
    const ctx = makeCtx();

    const res = resolveGwWinter(G, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingNeutrals).toBe(true);
    // 29.1/29.2 already ran; 29.3 is the open player decision.
    expect(res.turnBefore).toBe(2);
    expect(res.turnAfter).toBe(2);
    expect(res.colonialWar.africa.winner).toBe("te");
    expect(G.gw!.lastColonialWar?.africa).toBe("te");
    expect(G.pending?.kind).toBe("gwNeutralEntry");
    expect(G.pending?.power).toBe("OT");

    // Join the Entente (the only neutral), then finish its free-action menu.
    const ot = {...makeCtx(), playerID: "5"};
    expect(resolvePending(G, ot, "join:te")).toBeUndefined();
    expect(resolvePending(G, ot, "done")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw!.te).toContain("OT");
    expect(G.gw!.belligerents).toContain("OT");
    expect(G.powers.OT.alliance).toBe("teCommitted");
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
    // The next planning step has already recalculated budgets and dealt cards.
    expect(G.powers.GE.gwBudget).toBeGreaterThanOrEqual(2);
    expect(G.powers.GE.gwCard).toBeTruthy();
  });

  test("stability zero eliminates a belligerent and ends the war", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "FR"],
      te: ["FR"],
      ta: ["GE"],
      neutrals: [],
    });
    G.phase = "gwWinter";
    G.powers.FR.stability = 0;
    G.powers.GE.stability = 3;
    const ctx = makeCtx();

    const res = resolveGwWinter(G, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.powers.FR.eliminated).toBe(true);
    expect(res.eliminated).toContain("FR");
    expect(G.gw!.victor).toBe("ta");
    expect(res.ended).toBe(true);
    expect(res.reason).toBe("elimination");
    expect(G.result?.reason).toBe("greatWar:ta");
    expect(G.result?.winners).toEqual(["GE"]);
    expect(G.phase).toBe("gameOver");
  });

  test("31.0: an alliance down to one power with no neutrals is defeated", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "AU", "FR"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
      neutrals: [],
    });
    G.phase = "gwWinter";
    G.powers.AU.alliance = "taCommitted";

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    // FR is the only Entente power left and no neutral can join it: the
    // Entente is defeated even though FR still stands (31.0 second bullet).
    expect(G.powers.FR.eliminated).toBe(false);
    expect(G.gw!.victor).toBe("ta");
    expect(res.ended).toBe(true);
    expect(G.result?.reason).toBe("greatWar:ta");
    expect(G.result?.winners).toEqual(["GE", "AU"]);
    expect(G.phase).toBe("gameOver");
  });

  test("31.0: two powers in the depleted alliance keep the war going", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "AU", "FR", "UK"],
      te: ["FR", "UK"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "UK", "GE", "AU"],
      neutrals: [],
    });
    G.phase = "gwWinter";
    G.powers.AU.alliance = "taCommitted";
    G.powers.UK.alliance = "teCommitted";

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.result).toBeNull();
    expect(G.gw!.victor).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
  });

  test("31.0: a 1v1 endgame is not a defeat and runs to the turn limit", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "FR"],
      te: ["FR"],
      ta: ["GE"],
      belligerents: ["FR", "GE"],
      neutrals: [],
    });
    G.phase = "gwWinter";

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.result).toBeNull();
    expect(G.gw!.victor).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
  });

  test("31.0: one neutral player left keeps the depleted alliance alive", () => {
    const G = baseGw({
      turn: 2,
      order: ["GE", "AU", "FR"],
      te: ["FR"],
      ta: ["GE", "AU"],
      belligerents: ["FR", "GE", "AU"],
      neutrals: ["OT"],
    });
    G.phase = "gwWinter";
    G.powers.AU.alliance = "taCommitted";

    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingNeutrals).toBe(true);
    expect(G.pending?.kind).toBe("gwNeutralEntry");
    // OT stays out, so a neutral player remains and the Entente is not yet
    // defeated; the winter then closes normally.
    const ot = {...makeCtx(), playerID: "5"};
    expect(resolvePending(G, ot, "stay")).toBeUndefined();
    expect(resolvePending(G, ot, "done")).toBeUndefined();
    expect(G.gw!.neutrals).toContain("OT");
    expect(G.result).toBeNull();
    expect(G.gw!.victor).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
  });

  test("ends at the GW turn 5 limit instead of starting turn 6", () => {
    const G = baseGw({
      turn: 5,
      order: ["GE", "FR"],
      te: ["FR"],
      ta: ["GE"],
      neutrals: ["OT"],
    });
    G.phase = "gwWinter";
    G.powers.OT.vp = 9;
    G.powers.FR.vp = 0;
    G.powers.GE.vp = 0;
    const ctx = makeCtx();

    const res = resolveGwWinter(G, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingNeutrals).toBe(true);

    // OT stays neutral, so the turn-limit victory compares neutral VPs.
    const ot = {...makeCtx(), playerID: "5"};
    expect(resolvePending(G, ot, "stay")).toBeUndefined();
    expect(resolvePending(G, ot, "done")).toBeUndefined();
    expect(G.gw!.turn).toBe(6);
    expect(G.phase).toBe("gameOver");
    expect(G.result?.reason).toBe("gwTurnLimit:neutralVp");
    expect(G.result?.winners).toEqual(["OT"]);
  });

  test("rejects winter outside the winter phase", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    const res = resolveGwWinter(G, makeCtx());
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.error).toBe("wrongPhase");
  });
});
