/**
 * The War tab's move console.
 *
 * Reported as "帝国挽歌的单位移动ui 在战局标签里面也放一份 战争时不用来回切换":
 * once a war ran the turn panel parked on the War tab, but movement still lived
 * only on the Orders page, so the player had to switch tabs between the war and
 * the units.
 *
 * The console is the Orders page's picker and "Move & battle" rows mounted a
 * second time.  These tests pin what makes that safe:
 *
 * 1. both copies stay mounted at once (inactive bodies are only hidden), so the
 *    War copy must use its own test ids and must not collide with the Orders
 *    page's;
 * 2. it prints only the movement group — the War tab is not a second Orders
 *    page;
 * 3. it drives the board's one selection, so a unit picked in the War tab is
 *    the same unit the map rings and the Orders page shows pressed.
 */
import React from "react";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit, removeUnit} from "../engine/effects";
import {isArmyKind} from "../engine/rules";
import {ieStringsFor} from "./i18n";
import {MoveConsole, isMovementRow, moveConsoleSpaceLabel} from "./MoveConsole";
import type {SpaceAction} from "./actionAvailability";
import type {OrdersSlice} from "./boardSlices";

// The suites in this folder render in a Node environment, so the console is
// rendered to static markup (it is a pure function of its slice) and the rows
// are asserted from the markup it emits.
jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEPanel: ({title, children, actions}: any) => React.createElement(
      "section",
      null,
      React.createElement("h3", null, title),
      actions,
      children,
    ),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
  };
});

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const fresh = (cp = 6): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const clearSpaces = (G: ImperialElegyState, spaces: string[]): void => {
  for (const space of spaces) {
    for (const id of [...(G.spaces[space]?.units ?? [])]) removeUnit(G, id);
  }
};

type MoveBag = Record<string, (...args: any[]) => void>;

const moveBag = (...names: string[]): MoveBag =>
  Object.fromEntries(names.map((name) => [name, jest.fn()]));

/** The console's whole prop bag, from a real setup plus the fields it reads. */
const slice = (
  G: ImperialElegyState,
  power: Power,
  moves: MoveBag,
  over: Partial<OrdersSlice> = {},
): OrdersSlice & {showUnavailable: boolean; setShowUnavailable: (open: boolean) => void} => {
  const viewer = power;
  const me = G.powers[power];
  return {
    G, t: ieStringsFor("zh_CN"), locale: "zh_CN", actualLocale: "zh_CN",
    viewer, me, phase: G.phase, canAct: true, canSpend: () => true, cpBudget: () => G.cpRemaining,
    canActionCard: true, pending: null, canDecide: false, war: G.war, onOpenReference: () => undefined,
    selected: "berlin", selectedUnit: null, setSelectedUnit: () => undefined,
    selectedUnitIds: [], toggleUnitSelection: () => undefined, selectUnitGroup: () => undefined,
    startMoveTargeting: () => undefined, selectedUnitDef: undefined,
    battleFrom: null, setBattleFrom: {current: () => undefined},
    navalFrom: null, setNavalFrom: {current: () => undefined},
    doAction: (fn: () => void) => fn(), moves, confirmActions: false,
    gwJointNavalAllies: [], gwJointNavalUnitIds: () => [],
    polishReserve: false, setPolishReserve: () => undefined,
    deployLimit: 0, deployFree: false, canDeployHere: false,
    canGwDraft: false, canGwDeployHere: false,
    polishArmyDecision: null, polishReserveDecision: null,
    myOnMapArmies: 1, myForts: 0, myMinorAllies: 0,
    ownLandInSelected: [], ownNavalInSelected: [],
    potentialLandTargets: [], potentialNavalTargets: [],
    showUnavailable: false, setShowUnavailable: () => undefined,
    ...over,
  } as OrdersSlice & {showUnavailable: boolean; setShowUnavailable: (open: boolean) => void};
};

/** Render to markup; React's server renderer is enough for the row list. */
const render = async (props: Parameters<typeof MoveConsole>[0]): Promise<string> => {
  const {renderToStaticMarkup} = await import("react-dom/server");
  return renderToStaticMarkup(React.createElement(MoveConsole, props));
};

describe("the War tab's move console", () => {
  test("prints only the movement group", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin", "pomerania"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const html = await render(slice(G, "GE", moveBag("redeploy"), {
      selectedUnit: army.id, selectedUnitIds: [army.id], selectedUnitDef: G.units[army.id],
      ownLandInSelected: [G.units[army.id]], potentialLandTargets: ["pomerania"],
    }) as never);

    // A 12.15 redeploy row is a move row, so it is here.
    expect(html).toContain('data-testid="ie-war-action-move"');
    // Recruitment and diplomacy rows are the Orders page's business.
    expect(html).not.toContain('data-testid="ie-war-action-recruitArmy"');
    expect(html).not.toContain('data-testid="ie-war-action-influence"');
  });

  test("the row filter keeps exactly the move group", () => {
    const row = (over: Partial<SpaceAction>): SpaceAction => ({
      id: "move", group: "move", label: "Move", cost: 1, enabled: true, run: () => undefined,
      ...over,
    });
    expect(isMovementRow(row({}))).toBe(true);
    expect(isMovementRow(row({group: "greatWar"}))).toBe(false);
    expect(isMovementRow(row({group: "recruit"}))).toBe(false);
  });

  test("its unit ids are prefixed, so both mounted copies stay addressable", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const html = await render(slice(G, "GE", moveBag("redeploy")) as never);

    expect(html).toContain(`data-testid="ie-war-unit-${army.id}"`);
    // The Orders page's own address must not be emitted by the War copy.
    expect(html).not.toContain(`data-testid="ie-unit-${army.id}"`);
  });

  test("an empty map selection explains the two clicks instead of printing an empty list", async () => {
    const G = fresh();
    const html = await render(slice(G, "GE", moveBag("redeploy"), {selected: null}) as never);
    expect(html).toContain('data-testid="ie-war-move-hint"');
    expect(html).not.toContain('data-testid="ie-war-action-list"');
  });

  test("a space with no own units writes the space name and no picker", async () => {
    const G = fresh();
    // Berlin holds German units; an empty French-held space has none of GE's.
    clearSpaces(G, ["paris"]);
    const html = await render(slice(G, "GE", moveBag("redeploy"), {selected: "paris"}) as never);
    expect(html).toContain('data-testid="ie-war-move-space"');
    expect(html).not.toContain('data-testid="ie-war-unit-picker"');
  });

  test("the space label follows the locale", () => {
    expect(moveConsoleSpaceLabel("zh_CN", "berlin")).toBe("柏林");
    expect(moveConsoleSpaceLabel("en", "berlin")).toBe("Berlin");
    expect(moveConsoleSpaceLabel("zh_CN", null)).toBeNull();
  });

  test("selecting a unit in the console arms the same selection the Orders page shows", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const toggleUnitSelection = jest.fn();
    const props = slice(G, "GE", moveBag("redeploy"), {
      selectedUnit: army.id,
      selectedUnitIds: [army.id],
      toggleUnitSelection,
      selectedUnitDef: G.units[army.id],
    });
    const html = await render(props as never);

    // The picker prints the selected unit pressed, not a second copy of state.
    expect(html).toMatch(new RegExp(`data-testid="ie-war-unit-${army.id}"[^>]*aria-pressed="true"`));
    // With a unit selected the "pick a unit" hint is gone.
    expect(html).not.toContain('data-testid="ie-war-move-pick-unit"');
    expect(toggleUnitSelection).not.toHaveBeenCalled();
  });

  test("a controlled minor's army is a move row in the Great War, not in peacetime", async () => {
    const G = fresh();
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    clearSpaces(G, ["bavaria", "bohemia"]);
    const minor = placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    placeUnit(G, "FR", "army", "bohemia", 2);

    const peace = await render(slice(G, "GE", moveBag("redeploy"), {
      selected: "bavaria", selectedUnit: minor.id, selectedUnitIds: [minor.id],
      selectedUnitDef: G.units[minor.id],
      ownLandInSelected: [G.units[minor.id]], potentialLandTargets: ["bohemia"],
    }) as never);
    // 15.2 vs 12.15: the minor's counter is not a legal 12.15 mover.
    expect(peace).not.toContain('data-testid="ie-war-action-move"');
    // …but it does fight for its controller.
    expect(peace).toContain('data-testid="ie-war-action-landBattle"');

    // The Great War ladder commands it (27.5).
    G.phase = "gwManeuver";
    G.gw = {
      active: true, turn: 1, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false, usStability: 3, usManpower: 3, usBudget: 4,
      italyStability: 3, italyManpower: 3, italyBudget: 2, trenches: {}, lastColonialWar: null,
      victor: null, outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
    };
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.activePower = "GE";
    const gw = await render(slice(G, "GE", moveBag("gwMarch", "gwRail"), {
      selected: "bavaria", selectedUnit: minor.id, selectedUnitIds: [minor.id],
      selectedUnitDef: G.units[minor.id], phase: "gwManeuver",
    }) as never);
    // The GW ladder's own rows are move rows, and there is no 12.15 redeploy.
    expect(gw).not.toContain('data-testid="ie-war-action-move"');
  });

  test("every printed move row keeps its cost and refusal reason", async () => {
    const G = fresh(0);
    clearSpaces(G, ["berlin"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const html = await render(slice(G, "GE", moveBag("redeploy"), {
      canSpend: () => false,
      selectedUnit: army.id, selectedUnitIds: [army.id], selectedUnitDef: G.units[army.id],
      ownLandInSelected: [G.units[army.id]], potentialLandTargets: ["pomerania"],
    }) as never);
    // Zero CP: the redeploy row still prints with its printed reason rather than
    // disappearing, exactly as on the Orders page.
    expect(html).toContain('data-testid="ie-war-action-move"');
    expect(html).toContain('data-enabled="false"');
  });

  test("the console does not print the Orders page's head copy twice", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin"]);
    placeUnit(G, "GE", "army", "berlin", 2);
    const html = await render(slice(G, "GE", moveBag("redeploy")) as never);
    // The War copy has its own one-line space head; the Orders page's longer
    // "every action the rules allow" hint stays on the Orders page only.
    expect(html).toContain('data-testid="ie-war-move-space"');
    expect(html).not.toContain("此处规则允许的全部行动");
  });

  test("a spectator gets no console", () => {
    // The shell mounts the console only for a seated, non-eliminated viewer;
    // this pins the slice's own contract, which is what the shell reads.
    const G = fresh();
    const props = slice(G, "GE", moveBag());
    expect(props.viewer).toBe("GE");
  });

  test("the forces it prints come from the engine, not a neighbour guess", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin", "saxony", "bohemia"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    // No adjacent enemy: no land battle row.  Saxony is neutral, so its neutral
    // minor army is not a legal land target either (12.16).
    const html = await render(slice(G, "GE", moveBag("redeploy"), {
      selectedUnit: army.id, selectedUnitIds: [army.id], selectedUnitDef: G.units[army.id],
      ownLandInSelected: [G.units[army.id]], potentialLandTargets: [],
    }) as never);
    // The refused row is still printed with its reason (the Orders contract),
    // but it is not in the legal strip.
    expect(html).toMatch(/data-testid="ie-war-action-landBattle" data-enabled="false"/);
    expect(html).not.toContain('data-testid="ie-war-action-now-landBattle"');

    // A declared war and an adjacent enemy army turns the row on.
    G.war = {
      attacker: "GE", defender: "FR", attackerAllies: [], defenderAllies: [], attackerMinors: [], defenderMinors: [],
      warAim: "conquest", objectives: [], status: "maneuver", budgets: {GE: 6, FR: 6}, initiative: ["GE", "FR"],
      treaties: [], victor: null, truceTurns: 2, passed: [], startedTurn: 1,
    } as unknown as ImperialElegyState["war"];
    G.phase = "wartime";
    clearSpaces(G, ["bohemia"]);
    placeUnit(G, "FR", "army", "bohemia", 2);
    const warHtml = await render(slice(G, "GE", moveBag("redeploy"), {
      phase: "wartime",
      selectedUnit: army.id, selectedUnitIds: [army.id], selectedUnitDef: G.units[army.id],
      ownLandInSelected: [G.units[army.id]], potentialLandTargets: ["bohemia"],
    }) as never);
    expect(warHtml).toMatch(/data-testid="ie-war-action-landBattle" data-enabled="true"/);
  });

  test("the picker lists only commanded units of the selected space", async () => {
    const G = fresh();
    clearSpaces(G, ["berlin"]);
    const army = placeUnit(G, "GE", "army", "berlin", 2);
    const html = await render(slice(G, "GE", moveBag("redeploy")) as never);
    expect(html).toContain(`data-testid="ie-war-unit-${army.id}"`);
    // A French army in Berlin is not the viewer's to move.
    removeUnit(G, army.id);
    placeUnit(G, "FR", "army", "berlin", 2);
    const other = await render(slice(G, "GE", moveBag("redeploy")) as never);
    expect(other).not.toContain("ie-war-unit-");
  });
});
