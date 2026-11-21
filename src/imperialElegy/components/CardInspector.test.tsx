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
    // The scan is one tap away, behind a button; it is not part of the reading
    // view and nothing is fetched until that button is pressed.
    expect(markup).toContain('data-testid="ie-card-inspector-original"');
    expect(markup).toContain("Original card image");
    expect(markup).toContain('aria-pressed="false"');
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

  test("print mode preference still opens on the localized face, one language at a time", () => {
    // A reader who prefers printed faces in the hand must not get the English
    // scan stacked over the Chinese transcription inside the panel.
    const markup = render({mode: "print", locale: "zh_CN"});

    expect(markup).toContain('data-face-mode="print"');
    expect(markup).toContain("<svg");
    expect(markup).toContain("东方问题");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("/imperial-elegy/cards/action-001.jpg");
    // Nothing at all prints the other language: neither the old "事件文本"
    // panel under the scan nor the face's own "English text" disclosure.
    expect(markup).not.toContain('data-testid="ie-card-inspector-text"');
    expect(markup).not.toContain("事件文本");
    expect(markup).not.toContain('lang="en"');
  });

  test("the panel prints no text in the other language", () => {
    const zh = render({locale: "zh_CN"});

    expect(zh).not.toContain("ie-card-translation");
    expect(zh).not.toContain('lang="en"');
    expect(zh).not.toContain("Gain 1 VP.");

    const en = render();
    expect(en).not.toContain("ie-card-translation");
    expect(en).not.toContain('lang="zh-CN"');
    expect(en).not.toContain("获得 1 VP。");
  });

  test("the original is labelled in the reader's language", () => {
    const zh = render({locale: "zh_CN"});

    expect(zh).toContain('data-testid="ie-card-inspector-original"');
    expect(zh).toContain("英文原图");
    expect(zh).toContain("东方问题");
    expect(zh).not.toContain("<img");

    expect(render()).toContain("Original card image");
  });

  test("the original button toggles the body between the face and the scan", () => {
    const source = readFileSync(join(__dirname, "CardInspector.tsx"), "utf8");

    // The scan replaces the face in the body while the toggle is pressed, so
    // the header, the close control and the operations stay in place.
    expect(source).toMatch(/showingScan && originalImage !== null \? \(\s*<img/);
    expect(source).toContain("onClick={() => setShowingScan((shown) => !shown)}");
    expect(source).toContain('aria-pressed={showingScan}');
    // The scan is offered after the operations, not above them.
    expect(source.indexOf('data-testid="ie-card-inspector-actions"'))
      .toBeLessThan(source.indexOf('data-testid="ie-card-inspector-original"'));
  });

  test("print mode falls back to the svg face when the card has no image", () => {
    const markup = render({mode: "print", face: {card: actionCard({image: undefined})}});

    expect(markup).toContain('data-face-mode="print"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain('data-testid="ie-card-inspector-original"');
  });

  test("a National Goal never offers the printed scan", () => {
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
