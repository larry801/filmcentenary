/**
 * The required card choice as a dialog.
 *
 * Two things make this more than markup: the home card must not be dismissible
 * (the diplomacy step cannot continue without it), and the Goal pick must be
 * (continuing keeps the first Goal).  Both cases are checked here, plus the
 * fact that a blocker takes no focus away when it is not open — a hotseat mounts
 * six boards, and five of them must never pull the keyboard.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {CardChoiceModal} from "./CardChoiceModal";

const render = (over: Partial<React.ComponentProps<typeof CardChoiceModal>> = {}): string =>
  renderToStaticMarkup(
    <CardChoiceModal
      open
      dismissible={false}
      locale="en"
      title="Choose your home card"
      onClose={() => undefined}
      {...over}
    >
      <p data-testid="choice-body">cards</p>
    </CardChoiceModal>,
  );

describe("a required choice", () => {
  test("renders a modal dialog with the choice inside it", () => {
    const html = render();
    expect(html).toContain('data-testid="ie-choice-modal"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Choose your home card");
    expect(html).toContain('data-testid="choice-body"');
  });

  test("cannot be closed: no ✕, no continue button, no backdrop dismiss", () => {
    const html = render({dismissible: false});
    expect(html).not.toContain('data-testid="ie-choice-close"');
    expect(html).not.toContain('data-testid="ie-choice-continue"');
    expect(html).toContain('data-testid="ie-choice-required"');
    expect(html).toContain('data-dismissible="false"');
  });

  test("closes nothing when it is not open", () => {
    expect(render({open: false})).toBe("");
  });
});

describe("a dismissible Goal pick", () => {
  test("offers a close button and a labelled way to keep the first Goal", () => {
    const html = render({dismissible: true, title: "Keep one National Goal"});
    expect(html).toContain('data-testid="ie-choice-close"');
    expect(html).toContain('data-testid="ie-choice-continue"');
    expect(html).toContain("Continue with the first Goal");
    expect(html).toContain('data-dismissible="true"');
    expect(html).not.toContain('data-testid="ie-choice-required"');
  });

  test("the body is the same choice form, with its own test ids", () => {
    const html = render({dismissible: true});
    expect(html).toContain('data-testid="choice-body"');
  });
});
