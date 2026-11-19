/**
 * The home-card war declaration chooser.
 *
 * The board half is statically rendered against the real hook: playing one of
 * the four declaration home cards must put the chooser on screen by itself,
 * with the engine's legal targets grouped by defender.  The dialog itself is
 * also called as a plain function (React hooks stubbed) so the row/close
 * handlers can be invoked, which static markup cannot do.
 */
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  const useState = (initial: unknown) => [
    typeof initial === "function" ? (initial as () => unknown)() : initial,
    () => undefined,
  ];
  const useMemo = (fn: () => unknown) => fn();
  const useCallback = (fn: unknown) => fn;
  const useRef = (initial: unknown) => ({current: initial});
  return {...actual, useState, useMemo, useCallback, useRef, useEffect: () => undefined};
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

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {playCard, resolvePending} from "../moves";
import {AUX_ARMES_HOME_CARD, BISMARCK_HOME_CARD, warDeclarationEntitlement} from "../engine/rules";
import {declarationTargetCandidates, type WarTargetCandidate} from "../engine/declarationTargets";
import {useBoardModel} from "./useBoardModel";
import {BoardLayout} from "./BoardLayout";
import {WarTargetDialog} from "./WarTargetDialog";
import {ieStringsOf, setPanelLocale} from "./panelLocale";

const makeCtx = (playerID: string | null = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 5,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** A power's action impulse after its declaration home card resolved. */
const homeImpulse = (power: Power, card: string): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.turn = 5;
  G.powers[power].hand = [card];
  G.powers[power].selectedHomeCard = card;
  playCard(G, makeCtx(seat(power)), card, "event");
  // Answer any pick the card's other clauses opened (RU-9's Balkan alliance).
  let guard = 0;
  while (G.pending !== null && guard++ < 10) {
    const pending = G.pending;
    resolvePending(G, makeCtx(seat(pending.power)), pending.options[0]?.id);
  }
  return G;
};

const Board = (props: Parameters<typeof useBoardModel>[0]) => {
  setPanelLocale("zh_CN");
  const model = useBoardModel({...props, injectedUi: {i18n: ieStringsOf("zh_CN")}});
  return React.createElement(BoardLayout, {model});
};

const boardHtml = (G: ImperialElegyState, playerID: string | null): string =>
  renderToStaticMarkup(React.createElement(Board, {
    G, ctx: makeCtx(), moves: {}, playerID, handOpen: true,
  }));

const testId = (html: string, id: string): boolean => html.includes(`data-testid="${id}"`);

type Tree = React.ReactElement<any>;

const walk = (node: unknown, visit: (element: Tree) => void): void => {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const element = node as Tree;
  if (element.props !== undefined) visit(element);
  if (element.props?.children !== undefined) walk(element.props.children, visit);
};

const byTestId = (node: unknown, id: string): Tree | null => {
  let found: Tree | null = null;
  walk(node, (element) => {
    if (found === null && element.props?.["data-testid"] === id) found = element;
  });
  return found;
};

const bismarckCandidates = (): WarTargetCandidate[] => {
  const G = homeImpulse("GE", BISMARCK_HOME_CARD);
  return declarationTargetCandidates(G, "GE", warDeclarationEntitlement(G, "GE"));
};

describe("the declaration chooser opens itself", () => {
  test("Bismarck's event lists the unification targets without a map click", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    const html = boardHtml(G, seat("GE"));
    expect(testId(html, "ie-war-target-dialog")).toBe(true);
    expect(html).toContain("选择战争目标 — 奥托·冯·俾斯麦");
    // FR-held Alsace-Lorraine and Danish Schleswig-Holstein are the historic
    // objectives, and the German minors are 13.4 targets.
    expect(testId(html, "ie-war-target-group-FR")).toBe(true);
    expect(testId(html, "ie-war-target-group-minor:Denmark")).toBe(true);
    expect(testId(html, "ie-war-target-alsace-lorraine")).toBe(true);
    expect(testId(html, "ie-war-target-schleswig-holstein")).toBe(true);
    expect(testId(html, "ie-war-target-bavaria")).toBe(true);
    // A fixed-aim card has no aim filter.
    expect(testId(html, "ie-war-target-aims")).toBe(false);
    // The Orders prompt stays available after the dialog is dismissed.
    expect(testId(html, "ie-war-target-prompt")).toBe(true);
    expect(testId(html, "ie-war-target-open")).toBe(true);
    expect(html).toContain("5 个合法宣战");
  });

  test("an open-aim card offers its printed aim filter", () => {
    const G = homeImpulse("FR", AUX_ARMES_HOME_CARD);
    const html = boardHtml(G, seat("FR"));
    expect(testId(html, "ie-war-target-dialog")).toBe(true);
    expect(testId(html, "ie-war-target-aim-conquest")).toBe(true);
    expect(testId(html, "ie-war-target-aim-liberation")).toBe(true);
    expect(testId(html, "ie-war-target-aim-unification")).toBe(false);
  });

  test("another seat and a spectator never see the chooser", () => {
    const G = homeImpulse("GE", BISMARCK_HOME_CARD);
    for (const viewer of [seat("UK"), seat("FR"), null]) {
      const html = boardHtml(G, viewer);
      expect(testId(html, "ie-war-target-dialog")).toBe(false);
      expect(testId(html, "ie-war-target-prompt")).toBe(false);
    }
  });

  test("without an entitlement there is no chooser or prompt", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 3;
    const html = boardHtml(G, seat("GE"));
    expect(testId(html, "ie-war-target-dialog")).toBe(false);
    expect(testId(html, "ie-war-target-prompt")).toBe(false);
  });
});

describe("the chooser's controls", () => {
  const renderDialog = (
    over: Partial<React.ComponentProps<typeof WarTargetDialog>> = {},
    onChoose = jest.fn(),
  ) => {
    const tree = WarTargetDialog({
      open: true,
      candidates: bismarckCandidates(),
      locale: "en",
      t: ieStringsOf("en") as ReturnType<typeof import("./i18n").ieT>,
      cardTitle: "Otto von Bismarck",
      onChoose,
      onClose: jest.fn(),
      ...over,
    }) as Tree;
    return {tree, onChoose};
  };

  test("a target row passes its whole declaration to onChoose", () => {
    const {tree, onChoose} = renderDialog();
    const row = byTestId(tree, "ie-war-target-alsace-lorraine");
    expect(row).not.toBeNull();
    row!.props.onClick();
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0][0]).toMatchObject({
      target: "FR",
      defender: "FR",
      aim: "unification",
      objective: "alsace-lorraine",
    });
  });

  test("the close control dismisses the dialog", () => {
    const onClose = jest.fn();
    const {tree} = renderDialog({onClose});
    const close = byTestId(tree, "ie-war-target-close");
    expect(close).not.toBeNull();
    close!.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a closed or empty chooser renders nothing", () => {
    expect(renderDialog({open: false}).tree).toBeNull();
    expect(renderDialog({candidates: []}).tree).toBeNull();
  });
});
