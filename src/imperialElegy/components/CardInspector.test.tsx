/**
 * CardInspector — SSR-rendered with `renderToStaticMarkup`, which also proves
 * the component is safe on the server: no MUI, no DOM access during render,
 * and a closed inspector emits nothing at all.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {CardInspector} from "./CardInspector";
import type {CardInspectorProps} from "./CardInspector";
import type {CardDef} from "../constant/cards";
import type {GoalDef} from "../constant/goals";

const actionCard = (overrides: Partial<CardDef> = {}): CardDef => ({
  id: "IE-A001",
  number: 1,
  kind: "action",
  cp: 3,
  entry: "1850s",
  type: "event",
  title: "The Eastern Question",
  titleZh: "东方问题",
  text: "Gain 1 VP.",
  textZh: "获得 1 VP。",
  effects: [],
  image: "cards/action-001.jpg",
  ...overrides,
});

const goalCard: GoalDef = {
  id: "NG-01",
  number: 1,
  power: "GE",
  title: "European Keys",
  titleZh: "欧洲关键区",
  vp: 3,
  kind: "rankedEuropeanKeys",
  text: "Control the most European keys.",
  textZh: "控制最多的欧洲关键区。",
};

const render = (overrides: Partial<CardInspectorProps> = {}): string =>
  renderToStaticMarkup(React.createElement(CardInspector, {
    open: true,
    onClose: () => undefined,
    locale: "en",
    face: {card: actionCard()},
    mode: "svg",
    actions: React.createElement("button", {type: "button"}, "Play for CP"),
    ...overrides,
  }));

describe("CardInspector", () => {
  test("a closed inspector renders nothing", () => {
    expect(render({open: false})).toBe("");
  });

  test("svg mode shows the dialog, the vector face, actions and unavailable reasons", () => {
    const markup = render({unavailable: ["Already played this impulse", "No CP left"]});

    expect(markup).toContain('data-testid="ie-card-inspector"');
    expect(markup).toContain('data-testid="ie-card-inspector-backdrop"');
    expect(markup).toContain("<svg");
    expect(markup).toContain("The Eastern Question");
    expect(markup).toContain('data-face-mode="svg"');
    expect(markup).toContain("Play for CP");
    expect(markup).toContain('data-testid="ie-card-inspector-actions"');
    expect(markup).toContain(
      "Already played this impulse · No CP left",
    );
    expect(markup).toContain('data-testid="ie-card-inspector-unavailable"');
    expect(markup).toContain('data-testid="ie-card-inspector-close"');
    expect(markup).toContain("Close");
    // The scan is a folded reference, not part of the default reading view.
    expect(markup).toContain('data-testid="ie-card-inspector-original"');
    expect(markup).toContain("Original card image");
    expect(markup).not.toContain("/imperial-elegy/cards/action-001.jpg");
    expect(markup).not.toContain("<img");
  });

  test("the dialog contract is explicit in static markup", () => {
    const markup = render();

    // The focus trap (and screen readers) need a real modal contract even
    // before any DOM effect runs: role, modality, a name, and a named close.
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="The Eastern Question"');
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('type="button"');
    // `useFocusTrap` focuses the first tab stop on open: the close control must
    // precede the card operations, or keyboard focus lands inside the actions.
    expect(markup.indexOf('data-testid="ie-card-inspector-close"'))
      .toBeLessThan(markup.indexOf('data-testid="ie-card-inspector-actions"'));
  });

  test("print mode renders the scanned card image plus the localized event text", () => {
    const markup = render({mode: "print"});

    expect(markup).toContain('data-face-mode="print"');
    expect(markup).toContain("<img");
    expect(markup).toContain('data-testid="ie-card-inspector-image"');
    expect(markup).toContain("/imperial-elegy/cards/action-001.jpg");
    expect(markup).toContain('alt="The Eastern Question"');
    // The scan is printed in English, so the reader's language is repeated.
    expect(markup).toContain('data-testid="ie-card-inspector-text"');
    expect(markup).toContain("Event text");
    expect(markup).toContain("Gain 1 VP.");
    expect(markup).toContain('lang="en"');
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain('data-testid="ie-card-inspector-original"');
  });

  test("print mode prints the event text in the reader's language", () => {
    const markup = render({mode: "print", locale: "zh_CN"});

    expect(markup).toContain('data-testid="ie-card-inspector-text"');
    expect(markup).toContain("事件文本");
    expect(markup).toContain("获得 1 VP。");
    expect(markup).toContain('lang="zh-CN"');
    expect(markup).not.toContain("Gain 1 VP.");
  });

  test("the folded original is labelled in Chinese on a zh_CN board", () => {
    const markup = render({locale: "zh_CN"});

    expect(markup).toContain('data-testid="ie-card-inspector-original"');
    expect(markup).toContain("原图");
    expect(markup).toContain("东方问题");
    expect(markup).not.toContain("<img");
  });

  test("the original disclosure loads its image only after it is opened", () => {
    const source = readFileSync(join(__dirname, "CardInspector.tsx"), "utf8");

    expect(source).toContain("onToggle={event => setOriginalOpen(event.currentTarget.open)}");
    expect(source).toMatch(/\{originalOpen && \(\s*<img/);
  });

  test("print mode falls back to the svg face when the card has no image", () => {
    const markup = render({mode: "print", face: {card: actionCard({image: undefined})}});

    expect(markup).toContain('data-face-mode="print"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<img");
    // The vector face already carries the localized text; no duplicate panel.
    expect(markup).not.toContain('data-testid="ie-card-inspector-text"');
  });

  test("print mode always uses the svg face for a National Goal", () => {
    const markup = render({mode: "print", face: {goal: goalCard}, locale: "zh_CN"});

    expect(markup).toContain('data-face-mode="print"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("欧洲关键区");
    expect(markup).toContain("1 · 3 VP");
    expect(markup).toContain("关闭");
    expect(markup).not.toContain('data-testid="ie-card-inspector-original"');
  });

  // jsdom is not installed (Jest runs with `testEnvironment: "node"`), so the
  // trap's runtime behaviour cannot be exercised here.  Assert the wiring
  // statically instead: the dialog's ref is the shared trap's, and the trap is
  // active exactly while the inspector is open, with Escape routed to close.
  test("the dialog is wired to the shared focus trap", () => {
    const source = readFileSync(join(__dirname, "CardInspector.tsx"), "utf8");

    expect(source).toContain('import {useFocusTrap} from "./useFocusTrap"');
    expect(source).toMatch(/useFocusTrap<[^(]+>\(\{[^}]*active: open[^}]*onEscape: handleEscape[^}]*\}\)/);
    expect(source).toContain("ref={dialogRef}");
  });
});
