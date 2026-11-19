/**
 * The map key.
 *
 * The legend follows the printed key: a ring's *shape and colour* say what a
 * click would do, before any text does.  The defect this pins is that "attack"
 * and "rail only" both fell through to the same default brass swatch, so two
 * different targets were drawn identically in the key.
 *
 * The colours themselves live in the stylesheet, so the assertions here are the
 * stable contract: every style carries its own `ie-key-<style>` class (the
 * selector the CSS colours), and no two entries share one.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MapLegend} from "./MapLegend";

const render = (counts: Record<string, number> = {}): string =>
  renderToStaticMarkup(<MapLegend locale="zh_CN" counts={counts as never}/>);

/** The classes on every key entry, in DOM order. */
const keyClasses = (html: string): string[] =>
  [...html.matchAll(/class="ie-key ([a-z]+)"/g)].map((match) => match[1]);

describe("the map key", () => {
  test("lists the three base targets when nothing is highlighted", () => {
    // With no rings drawn the key still teaches the vocabulary the map uses.
    expect(keyClasses(render())).toEqual(["move", "attack", "rail"]);
  });

  test("gives every style its own class, so no two entries share a colour", () => {
    const counts = {move: 1, attack: 1, rail: 1, choice: 1, pending: 1};
    const classes = keyClasses(render(counts));
    expect(classes).toEqual(["move", "attack", "rail", "choice", "pending"]);
    expect(new Set(classes).size).toBe(classes.length);
  });

  test("attack and rail are different entries, not one shared default", () => {
    const html = render({attack: 2, rail: 1});
    // Both are drawn (the counts are non-zero), each with its own selector.
    expect(html).toContain('data-testid="ie-key-attack"');
    expect(html).toContain('data-testid="ie-key-rail"');
    expect(html).toContain('class="ie-key attack"');
    expect(html).toContain('class="ie-key rail"');
    expect(html).not.toContain('class="ie-key legal"');
    expect(html).not.toContain('class="ie-key battle"');
  });

  test("prints the count of each style that is on the map", () => {
    const html = render({attack: 3, rail: 1});
    const attack = html.slice(html.indexOf('data-testid="ie-key-attack"'));
    expect(attack.slice(0, attack.indexOf("</span>"))).toContain(">3<");
    const rail = html.slice(html.indexOf('data-testid="ie-key-rail"'));
    expect(rail.slice(0, rail.indexOf("</span>"))).toContain(">1<");
  });

  test("names each style in the active language", () => {
    const zh = render({move: 1, attack: 1, rail: 1, choice: 1, pending: 1});
    for (const label of ["移动", "进攻", "仅铁路", "选择", "待决"]) expect(zh).toContain(label);
    const en = renderToStaticMarkup(
      <MapLegend locale="en" counts={{move: 1, attack: 1, rail: 1, choice: 1, pending: 1} as never}/>,
    );
    for (const label of ["Move", "Attack", "Rail only", "Choice", "Decision"]) expect(en).toContain(label);
  });

  test("hides a style that is not on the map", () => {
    // Only the styles actually drawn are listed, so the key never promises a
    // highlight the board does not show.
    const html = render({attack: 1});
    expect(html).toContain('data-testid="ie-key-attack"');
    expect(html).not.toContain('data-testid="ie-key-rail"');
    expect(html).not.toContain('data-testid="ie-key-pending"');
  });
});
