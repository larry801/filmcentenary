/**
 * Great War integration tests.
 *
 * These exercise the live `game.ts` phase hooks and the `moves.ts` entry
 * points, not the `engine/greatWarFlow.ts` helpers in isolation (those are
 * covered by `greatWarFlow.test.ts`).  They use direct moves + direct phase
 * hooks so the tests stay deterministic and do not need a boardgame.io server.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {faceupCombatCards} from "./engine/greatWarFlow";
import {ImperialElegyGameDef} from "./game";
import {
  endGwPlanningMove,
  gwDeploy,
  gwDraft,
  gwEndTurn,
  gwPass,
  gwRevealCombat,
  gwTransferBudget,
  landBattle,
  playGwCardMove,
  resolvePending,
} from "./moves";

const makeCtx = (playerID: string | null = "0", phaseCalls?: string[]): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: (phase: string) => {
        phaseCalls?.push(phase);
      },
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

/** Run a phase `onBegin` hook directly, the same way boardgame.io would. */
type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
const onBegin = (phase: "gwPlanning" | "gwManeuver" | "gwWinter"): PhaseOnBegin => {
  const phases = ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>;
  return phases[phase].onBegin;
};

describe("Great War phase hook integration", () => {
  test("planning deals/budgets, then the maneuver hook starts the order", () => {
    const G = baseGw();
    G.powers.GE.industry = 4;
    G.phase = "prep";
    const ctx = makeCtx("0");

    onBegin("gwPlanning")(G, ctx);
    expect(G.phase).toBe("gwPlanning");
    expect(G.powers.GE.gwBudget).toBe(4);
    expect(G.powers.GE.gwCard).toBeTruthy();
    expect(G.powers.GE.warBudget).toBe(0);

    onBegin("gwManeuver")(G, ctx);
    expect(G.phase).toBe("gwManeuver");
    expect(G.activePower).toBe("GE");
    expect(G.turnIndex).toBe(0);
    expect(G.flags.gwBonusImpulse).toBe(false);

    // Re-entering the maneuver hook must not move the cursor or spend budget.
    const budget = G.powers.GE.gwBudget;
    onBegin("gwManeuver")(G, ctx);
    expect(G.activePower).toBe("GE");
    expect(G.turnIndex).toBe(0);
    expect(G.powers.GE.gwBudget).toBe(budget);
  });

  test("endGwPlanningMove starts the maneuver at the first living order slot", () => {
    const G = baseGw({order: [null, "FR", "GE"]});
    const ctx = makeCtx("0");

    expect(endGwPlanningMove(G, ctx)).toBeUndefined();
    expect(G.phase).toBe("gwManeuver");
    expect(G.activePower).toBe("FR");
    expect(G.turnIndex).toBe(1);
  });
});

describe("Great War move integration", () => {
  test("deploy and draft each spend exactly one GW budget", () => {
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
    G.powers.GE.gwBudget = 5;
    G.spaces.berlin.control = "GE";
    const ctx = makeCtx("0");
    const reserve = G.powers.GE.reserves[0];
    expect(reserve).toBeTruthy();

    expect(gwDeploy(G, ctx, "berlin")).toBeUndefined();
    expect(G.powers.GE.gwBudget).toBe(4);
    expect(G.powers.GE.reserves).not.toContain(reserve);
    expect(G.units[reserve].space).toBe("berlin");

    const berlinBefore = G.spaces.berlin.units.length;
    expect(gwDraft(G, ctx, "berlin")).toBeUndefined();
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.powers.GE.manpower).toBe(1);
    // 27.5.2: one reduced army per space; the second is a separate choice.
    expect(G.spaces.berlin.units.length).toBe(berlinBefore + 1);
    expect(G.pending?.kind).toBe("gwDraft");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((entry) => entry.id)).not.toContain("berlin");
    const second = G.pending!.options[0].id;
    expect(resolvePending(G, ctx, second)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces[second].units.some((id) => G.units[id].owner === "GE" && G.units[id].steps === 1)).toBe(true);

    // An empty budget is rejected without spending twice or mutating state.
    G.powers.GE.gwBudget = 0;
    const before = JSON.stringify(G);
    expect(gwDraft(G, ctx, "berlin")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("GW budget transfer is planning-only, allied and once per donor", () => {
    const G = baseGw({
      order: ["GE", "FR", "UK"],
      te: ["FR", "UK"],
      ta: ["GE"],
      belligerents: ["GE", "FR", "UK"],
      neutrals: ["AU", "RU", "OT"],
    });
    G.powers.FR.gwBudget = 3;
    G.powers.UK.gwBudget = 2;
    const fr = makeCtx("2");
    const ge = makeCtx("0");

    expect(gwTransferBudget(G, fr, "UK", 2)).toBeUndefined();
    expect(G.powers.FR.gwBudget).toBe(1);
    expect(G.powers.UK.gwBudget).toBe(4);
    expect(G.powers.FR.flags.gwCpTransferDone).toBe(true);

    expect(gwTransferBudget(G, fr, "UK", 1)).toBe(INVALID_MOVE);
    expect(gwTransferBudget(G, ge, "FR", 1)).toBe(INVALID_MOVE);
    expect(G.powers.UK.gwBudget).toBe(4);

    G.phase = "gwManeuver";
    expect(gwTransferBudget(G, fr, "UK", 1)).toBe(INVALID_MOVE);
  });

  test("passing every impulse ends in winter and the winter hook starts the next turn", () => {
    const phaseCalls: string[] = [];
    // No neutrals: 29.3's player choice is covered by gwNeutralEntry.test.ts.
    const G = baseGw({neutrals: []});
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    const ge = makeCtx("0", phaseCalls);
    const fr = makeCtx("2", phaseCalls);

    expect(gwPass(G, ge)).toBeUndefined();
    expect(G.powers.GE.flags.passedGw).toBe(true);
    expect(G.activePower).toBe("FR");
    expect(G.turnIndex).toBe(1);

    expect(gwPass(G, fr)).toBeUndefined();
    expect(G.phase).toBe("gwWinter");
    expect(phaseCalls).toContain("gwWinter");

    const turnBefore = G.gw!.turn;
    onBegin("gwWinter")(G, fr);
    expect(G.gw!.turn).toBe(turnBefore + 1);
    expect(G.phase).toBe("gwPlanning");
    expect(phaseCalls).toContain("gwPlanning");
    // The next planning step has already recalculated budgets / dealt cards.
    expect(G.powers.GE.gwBudget).toBeGreaterThanOrEqual(2);
    expect(G.powers.GE.gwCard).toBeTruthy();

    // A second winter hook call is a no-op (the turn must not advance twice).
    const turnAfter = G.gw!.turn;
    onBegin("gwWinter")(G, fr);
    expect(G.gw!.turn).toBe(turnAfter);
  });

  test("passing a smaller alliance's slot grants the flow's bonus impulse", () => {
    const G = baseGw({
      order: ["GE", "bonus", "FR", "UK"],
      te: ["FR", "UK"],
      ta: ["GE"],
      belligerents: ["GE", "FR", "UK"],
      neutrals: ["AU", "RU", "OT"],
    });
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.gwBudget = 2;
    const ge = makeCtx("0");

    // GE passes, then receives the bonus slot instead of the old code's skip.
    expect(gwPass(G, ge)).toBeUndefined();
    expect(G.activePower).toBe("GE");
    expect(G.turnIndex).toBe(1);
    expect(G.flags.gwBonusImpulse).toBe(true);
    expect(G.gw!.bonusImpulses).toContain("GE");

    // The bonus is a real impulse: passing it hands control to FR, not back to
    // GE's first order slot.
    expect(gwPass(G, ge)).toBeUndefined();
    expect(G.activePower).toBe("FR");
    expect(G.turnIndex).toBe(2);
    expect(G.flags.gwBonusImpulse).toBe(false);
  });

  test("land battle spends the GW budget exactly once", () => {
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
    G.powers.GE.gwBudget = 3;
    G.cpRemaining = 0;
    placeUnit(G, "FR", "army", "saxony", 2);
    const ctx = makeCtx("0");

    expect(landBattle(G, ctx, "berlin", "saxony")).toBeUndefined();
    // Exactly one charge: the old path charged in requireCp *and* the helper.
    expect(G.powers.GE.gwBudget).toBe(2);
    expect(G.cpRemaining).toBe(0);
    expect(G.battle).not.toBeNull();
    expect(G.pending).not.toBeNull();

    // A second attack is blocked by the battle in progress and spends nothing.
    expect(landBattle(G, ctx, "berlin", "saxony")).toBe(INVALID_MOVE);
    expect(G.powers.GE.gwBudget).toBe(2);
  });

  test("gwEndTurn moves to winter without spending budget", () => {
    const phaseCalls: string[] = [];
    const G = baseGw();
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.powers.GE.gwBudget = 3;
    const ctx = makeCtx("0", phaseCalls);

    expect(gwEndTurn(G, ctx)).toBeUndefined();
    expect(G.phase).toBe("gwWinter");
    expect(phaseCalls).toContain("gwWinter");
    expect(G.powers.GE.gwBudget).toBe(3);
  });

  test("playing a GW card clears that power's stale faceup combat entry", () => {
    const G = baseGw();
    G.phase = "gwPlanning";
    G.powers.GE.gwCard = "IE-GW-03"; // combat card
    G.powers.FR.gwCard = "IE-GW-04"; // combat card
    G.powers.GE.gwBudget = 2;
    const ge = makeCtx("0");
    const fr = makeCtx("2");

    expect(gwRevealCombat(G, ge)).toBeUndefined();
    expect(gwRevealCombat(G, fr)).toBeUndefined();
    expect(faceupCombatCards(G)).toMatchObject({GE: "IE-GW-03", FR: "IE-GW-04"});

    expect(playGwCardMove(G, ge, "cp")).toBeUndefined();
    expect(G.powers.GE.gwCard).toBeNull();
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(faceupCombatCards(G).GE).toBeUndefined();
    expect(faceupCombatCards(G).FR).toBe("IE-GW-04");
    expect(String(G.flags.gwFaceupCombat)).not.toContain("GE:");

    // Faceup combat cards are public in playerView.
    const view = ImperialElegyGameDef.playerView!(G, fr, "2") as ImperialElegyState & {
      faceupCombat?: Partial<Record<Power, string>>;
    };
    expect(view.faceupCombat).toMatchObject({FR: "IE-GW-04"});
    expect(view.faceupCombat?.GE).toBeUndefined();
  });
});
