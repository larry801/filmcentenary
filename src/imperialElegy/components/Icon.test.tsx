import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Icon, isIconName, type IconName} from "./Icon";

const INVENTORY: IconName[] = [
  "chevron-down", "chevron-up", "chevron-left", "chevron-right",
  "close", "menu", "check", "plus", "minus", "search",
  "book-reference", "chart", "printer", "download", "crosshair",
  "anchor", "crossed-sabres", "seal-decision", "star", "laurel-goal",
  "fort", "trench", "rail", "arrow-right", "bot", "lock",
  "warning-triangle", "info-circle",
];

describe("Imperial Elegy icon set", () => {
  test("renders every inventory icon on the shared grid", () => {
    for (const name of INVENTORY) {
      const markup = renderToStaticMarkup(<Icon name={name} />);
      expect(markup).toContain(`data-icon="${name}"`);
      expect(markup).toContain('viewBox="0 0 16 16"');
      expect(markup).toContain('stroke="currentColor"');
      expect(markup).toContain('stroke-width="1.5"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
    }
  });

  test("accepts only published names", () => {
    expect(INVENTORY).toHaveLength(28);
    expect(isIconName("bot")).toBe(true);
    expect(isIconName("gear")).toBe(false);
  });

  test("sizes are the four allowed values", () => {
    for (const size of [14, 16, 20, 24] as const) {
      expect(renderToStaticMarkup(<Icon name="check" size={size} />)).toContain(
        `width="${size}"`,
      );
    }
  });
});
