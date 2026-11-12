/**
 * Board controls added in round 3 (agent 4):
 *  - 19.10 amphibious assault: origin box/port, up to two loaded armies, enemy
 *    coastal port, legality reasons (2:1 escort, naval presence, army cap);
 *  - 19.1 naval interception: the defender's reactive control keyed to the last
 *    naval move, gated to the legal defender with a printed reason;
 *  - per-kind bilingual labels for every `PendingKind`.
 *
 * Jest runs in a Node environment (no jsdom), so this suite renders the
 * component with the two React hooks it uses stubbed, walks the element tree,
 * and invokes `onClick` against a mocked move bag — the same technique as
 * `boardActions.test.tsx`.
 */
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => [
    typeof initial === "function" ? (initial as () => unknown)() : initial,
    () => undefined,
  ];
  return {...actual, useState, useEffect: () => undefined};
});

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("./map", () => {
  const React = require("react");
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

jest.mock("../../constant/i18n", () => ({
  __esModule: true,
  default: {use: () => undefined, getLocaleName: () => "en", locale: async () => undefined},
}));

import React from "react";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, PendingKind, Power, WarState} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit, removeUnit} from "../engine/effects";
import {isArmyKind} from "../engine/rules";
import {amphibiousAssaultCheck, navalInterceptCheck, navalMove} from "../moves";
import {ieStringsFor} from "./i18n";
import {ImperialElegyBoard} from "./board";

const testCtx = {
  playerID: "0",
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (active: Power, cp = 6): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const warState = (attacker: Power, defender: Power): WarState => ({
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
} as unknown as WarState);

/** Remove every unit currently in the given spaces (land + naval). */
const clearSpaces = (G: ImperialElegyState, spaces: string[]): void => {
  for (const space of spaces) {
    for (const id of [...(G.spaces[space]?.units ?? [])]) removeUnit(G, id);
  }
};

/** Remove all of a power's land armies so the selector has one origin. */
const clearArmies = (G: ImperialElegyState, power: Power): void => {
  for (const unit of Object.values(G.units)) {
    if (unit.owner === power && !unit.naval && isArmyKind(unit.kind)) removeUnit(G, unit.id);
  }
};

type MoveBag = Record<string, (...args: any[]) => void>;

const moveBag = (...names: string[]): MoveBag =>
  Object.fromEntries(names.map((name) => [name, jest.fn()]));

const renderTree = (G: ImperialElegyState, power: Power, moves: MoveBag): React.ReactElement =>
  (ImperialElegyBoard as unknown as (props: unknown) => React.ReactElement)({
    G,
    ctx: testCtx,
    moves,
    playerID: seat(power),
  });

const walk = (node: unknown, visit: (element: React.ReactElement<any>) => void): void => {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!React.isValidElement(node)) return;
  visit(node as React.ReactElement<any>);
  walk((node as React.ReactElement<any>).props?.children, visit);
};

const byTestId = (tree: React.ReactElement, testId: string): React.ReactElement<any> | undefined => {
  let found: React.ReactElement<any> | undefined;
  walk(tree, (element) => {
    if (element.props?.["data-testid"] === testId) found = element;
  });
  return found;
};

const textOf = (node: unknown): string => {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node as React.ReactElement<any>).props?.children);
  return "";
};

const click = (tree: React.ReactElement, testId: string): void => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  const onClick = element.props?.onClick;
  if (typeof onClick !== "function") throw new Error(`${testId} has no onClick`);
  onClick();
};

const isDisabled = (tree: React.ReactElement, testId: string): boolean => {
  const element = byTestId(tree, testId);
  if (element === undefined) throw new Error(`no element ${testId}`);
  return element.props?.disabled === true;
};

const titleOf = (tree: React.ReactElement, testId: string): string | undefined => byTestId(tree, testId)?.props?.title;

// ---------------------------------------------------------------------------
// 19.10 amphibious assault
// ---------------------------------------------------------------------------
describe("19.10 amphibious assault control", () => {
  /** A UK army group in the North Atlantic with Brittany as the first target. */
  const assaultSetup = (): ImperialElegyState => {
    const G = fresh("UK", 6);
    // hostileOwner follows `atWar`, so declare the limited war the assault
    // belongs to (Carthaginian peace is not a thing here).
    G.war = warState("UK", "FR");
    clearSpaces(G, ["north-atlantic", "brittany", "picardy", "aquitaine"]);
    clearArmies(G, "UK");
    // Earlier North Atlantic ports are friendly, so Brittany is the default
    // enemy target for the selector.
    for (const id of ["the-south", "mexico", "belgium", "netherlands"]) G.spaces[id].control = "UK";
    return G;
  };

  test("a loaded army group calls the move with the box, enemy port and up to two armies", () => {
    const G = assaultSetup();
    const first = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const second = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const third = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    placeUnit(G, "FR", "army", "brittany", 2);

    const moves = moveBag("amphibiousAssault");
    const tree = renderTree(G, "UK", moves);
    expect(byTestId(tree, "ie-amphibious")).toBeDefined();
    expect(byTestId(tree, "ie-amphibious-from")?.props?.value).toBe("north-atlantic");
    expect(byTestId(tree, "ie-amphibious-to")?.props?.value).toBe("brittany");
    expect(isDisabled(tree, "ie-amphibious-go")).toBe(false);

    click(tree, "ie-amphibious-go");
    // 19.10 caps a landing at two armies; the third is never passed.
    expect(moves.amphibiousAssault).toHaveBeenCalledWith("north-atlantic", "brittany", [first, second]);
    expect(moves.amphibiousAssault).not.toHaveBeenCalledWith("north-atlantic", "brittany", [first, second, third]);
  });

  test("a friendly port can load the armies into the adjacent box", () => {
    const G = assaultSetup();
    // The army starts in London (a friendly port on the North Atlantic).
    const army = placeUnit(G, "UK", "army", "london", 2).id;
    const moves = moveBag("amphibiousAssault");
    const tree = renderTree(G, "UK", moves);
    expect(byTestId(tree, "ie-amphibious-from")?.props?.value).toBe("london");
    expect(byTestId(tree, "ie-amphibious-to")?.props?.value).toBe("brittany");
    expect(isDisabled(tree, "ie-amphibious-go")).toBe(false);
    click(tree, "ie-amphibious-go");
    expect(moves.amphibiousAssault).toHaveBeenCalledWith("london", "brittany", [army]);
    // The engine resolves the loading box itself.
    expect(amphibiousAssaultCheck(G, "UK", "london", "brittany", [army]).box).toBe("north-atlantic");
  });

  test("an enemy fleet in the port requires a 2:1 escort and the reason is printed", () => {
    const G = assaultSetup();
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    placeUnit(G, "FR", "squadron", "brittany", 2);

    const tree = renderTree(G, "UK", moveBag("amphibiousAssault"));
    expect(isDisabled(tree, "ie-amphibious-go")).toBe(true);
    expect(textOf(byTestId(tree, "ie-amphibious-reason"))).toContain("2:1");
    expect(textOf(byTestId(tree, "ie-amphibious-reason"))).toContain("you have 0");
    expect(textOf(byTestId(tree, "ie-amphibious-escort"))).toContain("Enemy naval presence: 1 ships");

    // One enemy ship needs a 2:1 escort: two UK ships satisfy the ratio.
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    const withEscort = renderTree(G, "UK", moveBag("amphibiousAssault"));
    expect(isDisabled(withEscort, "ie-amphibious-go")).toBe(false);
    expect(amphibiousAssaultCheck(G, "UK", "north-atlantic", "brittany", [army]).ok).toBe(true);
  });

  test("an undefended port still needs landing room and the army cap is explained", () => {
    const G = assaultSetup();
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    expect(amphibiousAssaultCheck(G, "UK", "north-atlantic", "brittany", []).reason).toBe("unit-count");
    expect(amphibiousAssaultCheck(G, "UK", "north-atlantic", "brittany", [army]).ok).toBe(true);
    expect(amphibiousAssaultCheck(G, "UK", "north-atlantic", "london", [army]).reason).toBe("target-friendly");
    G.cpRemaining = 0;
    expect(amphibiousAssaultCheck(G, "UK", "north-atlantic", "brittany", [army]).reason).toBe("no-cp");
  });

  test("a non-active power sees the control disabled with the reason", () => {
    const G = assaultSetup();
    G.activePower = "FR";
    placeUnit(G, "UK", "army", "north-atlantic", 2);
    const tree = renderTree(G, "UK", moveBag("amphibiousAssault"));
    expect(isDisabled(tree, "ie-amphibious-go")).toBe(true);
    expect(textOf(byTestId(tree, "ie-amphibious-reason"))).toContain("active power");
  });
});

// ---------------------------------------------------------------------------
// 19.1 naval interception
// ---------------------------------------------------------------------------
describe("19.1 naval interception control", () => {
  /** UK (active) has just moved a ship into the North Atlantic; FR defends. */
  const staged = (): ImperialElegyState => {
    const G = fresh("UK", 6);
    G.war = warState("UK", "FR");
    clearSpaces(G, ["north-atlantic", "brittany"]);
    const ship = G.spaces.london.units.map((id) => G.units[id]).find((unit) => unit.owner === "UK" && unit.naval);
    if (ship === undefined) throw new Error("the setup has no UK ship in London");
    expect(navalMove(G, {...testCtx, playerID: seat("UK")} as Ctx, [ship.id], "north-atlantic")).toBeUndefined();
    return G;
  };

  test("the legal defender can intercept the last naval move", () => {
    const G = staged();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const moves = moveBag("navalIntercept");
    const tree = renderTree(G, "FR", moves);
    expect(byTestId(tree, "ie-naval-intercept")).toBeDefined();
    expect(byTestId(tree, "ie-intercept-port")?.props?.value).toBe("brittany");
    expect(isDisabled(tree, "ie-intercept-go")).toBe(false);
    click(tree, "ie-intercept-go");
    expect(moves.navalIntercept).toHaveBeenCalledWith("brittany", "north-atlantic");
    expect(navalInterceptCheck(G, "FR", "brittany", "north-atlantic").ok).toBe(true);
  });

  test("the mover cannot intercept their own naval move", () => {
    const G = staged();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const tree = renderTree(G, "UK", moveBag("navalIntercept"));
    expect(byTestId(tree, "ie-naval-intercept")).toBeDefined();
    expect(isDisabled(tree, "ie-intercept-go")).toBe(true);
    expect(textOf(byTestId(tree, "ie-intercept-reason"))).toContain("Only the defender");
  });

  test("a port with no ships cannot intercept", () => {
    const G = staged();
    const tree = renderTree(G, "FR", moveBag("navalIntercept"));
    expect(isDisabled(tree, "ie-intercept-go")).toBe(true);
    expect(textOf(byTestId(tree, "ie-intercept-reason"))).toContain("No naval units");
    expect(navalInterceptCheck(G, "FR", "brittany", "north-atlantic").reason).toBe("no-ships");
  });

  test("no recent naval move means no interception control", () => {
    const G = fresh("UK", 6);
    G.war = warState("UK", "FR");
    const tree = renderTree(G, "FR", moveBag("navalIntercept"));
    expect(byTestId(tree, "ie-naval-intercept")).toBeUndefined();
  });

  test("interception needs a war with the mover", () => {
    const G = staged();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    G.war = null;
    expect(navalInterceptCheck(G, "FR", "brittany", "north-atlantic").reason).toBe("not-at-war");
  });
});

// ---------------------------------------------------------------------------
// Pending-kind labels
// ---------------------------------------------------------------------------
const PENDING_KINDS: PendingKind[] = [
  "discardForStability", "chooseHomeCard", "giveCard", "eventTargetSpace", "eventTargetPower",
  "eventChoice", "eventUnits", "combatSupport", "navalAvoid", "combatElite", "combatCard",
  "combatDiscard", "combatLosses", "decisiveBattle", "combatRetreat", "combatAdvance",
  "movementDestination", "warAim", "warAlly", "warInitiative", "warAllyConsent", "treatyOption",
  "treatySpace", "demobilizationFreeAction", "goalChoice", "industryCard", "mpitAllocation",
  "italyTable", "crisis", "crisisIncident", "crisisAlliance", "gwDraft", "gwCard", "gwWinter",
  "scoringChoice", "responseCard", "confirm", "impulseLoss", "militarism", "manpowerExcess",
  "allianceTie", "gwNeutralEntry", "gwNeutralAction", "gwNeutralUnit", "gwNeutralDestination",
  "gwNeutralDeploy",
];

describe("pending-kind i18n", () => {
  test("every pending kind has a distinct bilingual label", () => {
    const en = ieStringsFor("en").pendingKind as Record<string, string>;
    const zh = ieStringsFor("zh_CN").pendingKind as Record<string, string>;
    for (const kind of PENDING_KINDS) {
      expect(en[kind]).toBeDefined();
      expect(zh[kind]).toBeDefined();
      expect(en[kind].length).toBeGreaterThan(0);
      expect(zh[kind].length).toBeGreaterThan(0);
      expect(en[kind]).not.toBe(ieStringsFor("en").pendingDecision);
      expect(zh[kind]).not.toBe(ieStringsFor("zh_CN").pendingDecision);
    }
  });

  test.each(PENDING_KINDS)("%s renders its own label in the pending panel", (kind) => {
    const G = fresh("GE", 2);
    G.pending = {
      id: `pending-${kind}`,
      kind,
      power: "GE",
      prompt: "Choose",
      options: [{id: "option-a", label: "Option A"}],
      createdAt: 0,
    };
    const tree = renderTree(G, "GE", moveBag("resolvePending"));
    const label = ieStringsFor("en").pendingKind[kind];
    const rendered = textOf(byTestId(tree, "ie-pending-kind"));
    expect(rendered).toContain(label);
    expect(rendered).not.toContain(ieStringsFor("en").pendingDecision);
  });

  test("the two remaining round-1/2 moves have board controls with bilingual labels", () => {
    const en = ieStringsFor("en");
    const zh = ieStringsFor("zh_CN");
    expect(en.amphibiousAssault).toBe("Amphibious assault");
    expect(zh.amphibiousAssault).toBe("两栖突击");
    expect(en.navalIntercept).toBe("Naval interception");
    expect(zh.navalIntercept).toBe("海上拦截");
  });
});
