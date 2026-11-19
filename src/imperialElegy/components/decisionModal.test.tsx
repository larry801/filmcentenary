/**
 * A decision this seat owes, as a dialog.
 *
 * Every decision is a blocker, so it is raised over the board instead of taking
 * the Orders body hostage.  Two things make that more than markup: it must not
 * be dismissible (the step cannot continue without an answer), and it must not
 * mount for a seat the reader is not looking at — a hotseat mounts six boards at
 * once, and a hidden dialog would steal the keyboard.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

import {DecisionModal} from "./DecisionModal";
import type {PendingPanelProps} from "./PendingPanel";
import {ieT} from "./i18n";
import {CARD_BY_ID} from "../engine/deck";

const body = (over: Partial<Omit<PendingPanelProps, "dock">> = {}): Omit<PendingPanelProps, "dock"> => ({
  G: {spaces: {}} as never,
  pending: {
    id: "d1",
    kind: "eventTargetSpace",
    power: "GE",
    prompt: "Choose a space",
    options: [{id: "berlin", label: "Berlin"}],
    createdAt: 1,
  },
  canDecide: true,
  pendingKind: "eventTargetSpace",
  pendingPrompt: "Choose a space",
  optionLabel: (option) => option.label,
  canDecline: false,
  pendingSpaceTargets: ["berlin"],
  viewer: "GE",
  locale: "zh_CN",
  t: ieT(),
  jihadDecision: null,
  jihadReason: undefined,
  doAction: () => undefined,
  moves: {},
  ...over,
});

const render = (over: Partial<Omit<PendingPanelProps, "dock">> = {}, open = true): string =>
  renderToStaticMarkup(<DecisionModal open={open} {...body(over)}/>);

describe("the decision dialog", () => {
  test("renders a modal dialog with the decision inside it", () => {
    const html = render();
    expect(html).toContain('data-testid="ie-decision-modal"');
    expect(html).toContain('data-testid="ie-decision-modal-backdrop"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("你的决策");
    // The body is the shared decision body: the same test ids the inline panel
    // rendered, so the suites and the e2e helpers keep their anchors.
    expect(html).toContain('data-testid="ie-pending"');
    expect(html).toContain('data-testid="ie-pending-option-berlin"');
  });

  test("cannot be dismissed: no ✕, no continue button, no backdrop dismiss", () => {
    const html = render();
    expect(html).not.toContain('data-testid="ie-choice-close"');
    expect(html).not.toContain('data-testid="ie-choice-continue"');
    expect(html).toContain('data-testid="ie-decision-required"');
    expect(html).toContain("此项决策为必选。");
    expect(html).toContain('data-dismissible="false"');
  });

  test("does not mount for a seat the reader is not looking at", () => {
    expect(render({}, false)).toBe("");
  });

  test("the hint names the buttons, not the map, because the backdrop covers it", () => {
    const html = render();
    expect(html).toContain("请在上方选项中选择以完成决策。");
    expect(html).not.toContain("对应空间已在地图上高亮。");
  });

  test("a card option keeps its printed face and its own button", () => {
    const card = CARD_BY_ID["IE-A029"];
    const html = render({
      pending: {
        id: "d-card",
        kind: "combatDiscard",
        power: "GE",
        prompt: "Discard a card",
        options: [{id: card.id, label: card.title, data: {card: card.id}}],
        createdAt: 1,
      } as never,
      optionFace: () => ({card}),
      pendingSpaceTargets: [],
    });
    expect(html).toContain(`data-testid="ie-pending-card-${card.id}"`);
    expect(html).toContain(`data-testid="ie-pending-option-${card.id}"`);
  });
});
