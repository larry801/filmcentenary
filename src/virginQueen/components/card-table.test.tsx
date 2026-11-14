import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import i18n from "../../constant/i18n";
import {CARD_BY_NUMBER} from "../data/cards";
import VQCardTable from "./card-table";

/** React escapes text nodes; compare against the decoded markup. */
const plain = (html: string): string => html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const render = (): string => plain(renderToStaticMarkup(<VQCardTable/>));

describe("Virgin Queen card table effect text", () => {
    it("shows the Chinese card face by default", () => {
        const html = render();
        expect(html).toContain(CARD_BY_NUMBER[36].textZh);
        expect(html).not.toContain(CARD_BY_NUMBER[36].textEn);
    });

    it("shows the English translation when the locale is English", () => {
        const spy = jest.spyOn(i18n, "getLocaleName").mockReturnValue("en");
        try {
            const html = render();
            expect(html).toContain(CARD_BY_NUMBER[36].textEn);
            expect(html).not.toContain(CARD_BY_NUMBER[36].textZh);
        } finally {
            spy.mockRestore();
        }
    });
});
