/**
 * ConfirmButton — the static (server-rendered) contract.
 *
 * The button is a two-step control: the first click arms it, the second fires.
 * Jest here runs in the `node` environment (no jsdom, no testing-library), so
 * the click path itself cannot be exercised.  What is worth locking is the
 * markup a real browser — and Playwright — receives before any interaction:
 * it stays a single inline `<button>` (never a modal), it is never armed on
 * first paint, it forwards the caller's attributes, and the armed label is not
 * in the document while disarmed, so a static reader cannot mistake it for the
 * button's name.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ARM_MS, ConfirmButton} from "./ConfirmButton";

/** The opening `<button>` tag, so assertions do not depend on attribute order. */
const buttonTag = (html: string): string => {
  const match = html.match(/<button[^>]*>/);
  expect(match).not.toBeNull();
  return match![0];
};

const render = (props: Partial<React.ComponentProps<typeof ConfirmButton>> = {}): string =>
  renderToStaticMarkup(
    <ConfirmButton confirm onConfirm={() => undefined} {...props}>
      Play for 3 CP
    </ConfirmButton>,
  );

test("ARM_MS is the five-second arm window", () => {
  expect(ARM_MS).toBe(5000);
  expect(typeof ARM_MS).toBe("number");
});

test("renders one plain button, unarmed, with the plain label", () => {
  const html = render();

  // A single inline button: no wrapper, no dialog, no overlay.
  expect(html.startsWith("<button")).toBe(true);
  expect(html.endsWith("</button>")).toBe(true);
  expect((html.match(/<button/g) ?? []).length).toBe(1);

  const tag = buttonTag(html);
  expect(tag).toContain('type="button"');
  expect(tag).toContain('data-armed="false"');
  // An unarmed button is not a live region.
  expect(tag).not.toContain("aria-live");

  // The button's only child is the plain label, with no "Confirm:" prefix.
  expect(html.slice(tag.length, html.length - "</button>".length)).toBe("Play for 3 CP");
  expect(html).not.toContain("Confirm:");
});

test("an explicit button type is forwarded, and the default stays 'button'", () => {
  expect(buttonTag(render())).toContain('type="button"');
  expect(buttonTag(render({type: "submit"}))).toContain('type="submit"');
});

test("forwards the caller's testid, class and other attributes", () => {
  const tag = buttonTag(
    render({
      "data-testid": "ie-confirm-attack",
      className: "ie-btn danger",
      disabled: true,
      title: "Attack",
      "aria-label": "Attack the space",
    }),
  );
  expect(tag).toContain('data-testid="ie-confirm-attack"');
  expect(tag).toContain('class="ie-btn danger"');
  expect(tag).toContain("disabled");
  expect(tag).toContain('title="Attack"');
  expect(tag).toContain('aria-label="Attack the space"');
});

test("confirm={false} renders exactly the same markup as confirm", () => {
  // The preference is on/off but the disarmed button is indistinguishable; the
  // difference only exists after a click, which SSR never performs.
  expect(render({confirm: false})).toBe(render({confirm: true}));
});

test("confirmLabel is absent while disarmed — SSR cannot arm the button", () => {
  const html = render({confirmLabel: "Really play it?"});
  expect(html).not.toContain("Really play it?");
  expect(html).toContain(">Play for 3 CP</button>");
  // The default armed label ("Confirm: <label>") is not in the document either.
  expect(html).not.toContain("Confirm:");
  expect(buttonTag(html)).toContain('data-armed="false"');
});

test("confirmAriaLabel is not applied while disarmed", () => {
  const html = render({confirmAriaLabel: "Confirm attack"});
  expect(html).not.toContain("Confirm attack");
});
