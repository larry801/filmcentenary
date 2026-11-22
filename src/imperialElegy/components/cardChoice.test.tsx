/**
 * A card choice prints one language.
 *
 * The card face carries an optional "English text" disclosure for the
 * inspector, but a choice modal is already the reader's card; the disclosure
 * there mixed an English control into the Chinese UI.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {CardChoice} from "./CardChoice";
import {cardById} from "../engine/deck";

describe("the card choice face", () => {
  test("does not add the English-text disclosure in a Chinese choice", () => {
    const html = renderToStaticMarkup(
      <CardChoice
        locale="zh_CN"
        face={{card: cardById("IE-H-OT-11")}}
        testId="ie-card-choice-test"
        actions={[{label: "选择", testId: "ie-card-choice-test-pick", onChoose: () => undefined}]}
      />,
    );
    expect(html).toContain("现代化");
    expect(html).not.toContain("English text");
  });
});
