/**
 * The printed BOT BOX reaches the card list and the vector card face.  Both are
 * SSR-rendered so the assertions cover the server path as well.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import i18n from "../../constant/i18n";
import ImperialElegyCardTable from "./card-table";
import {CardFace} from "./CardFace";
import {ACTION_CARDS, BOT_BOX} from "../constant/cards.data";

/** React escapes text nodes; compare against the decoded markup. */
const plain = (html: string): string => html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const cardByNumber = (n: number) => ACTION_CARDS.find((card) => card.number === n)!;

describe("Imperial Elegy card table · BOT BOX", () => {
    it("lists the printed box for a card that has one", () => {
        const html = plain(renderToStaticMarkup(<ImperialElegyCardTable/>));
        // #70 Papal Influence prints FR and AU in its bot box.
        expect(html).toContain("机器人格: 法国, 奥匈");
        // #40 British Trade prints UK only.
        expect(html).toContain("机器人格: 英国");
    });

    it("leaves the flags column empty for a card with no box", () => {
        const html = plain(renderToStaticMarkup(<ImperialElegyCardTable/>));
        // #77 Indian Nationalism prints no bot box at all, so no row may list
        // it; the count also pins the transcription to the 32 printed boxes.
        expect(html).not.toContain("机器人格: 俄国 · 77");
        expect(html.match(/机器人格/g)?.length).toBe(Object.keys(BOT_BOX).length);
    });

    it("uses the English label when the locale is English", () => {
        const spy = jest.spyOn(i18n, "getLocaleName").mockReturnValue("en");
        try {
            const html = plain(renderToStaticMarkup(<ImperialElegyCardTable/>));
            expect(html).toContain("BOT BOX: France, Austria-Hungary");
        } finally {
            spy.mockRestore();
        }
    });
});

describe("CardFace · BOT BOX", () => {
    it("draws the six-cell grid on a card that prints one", () => {
        const html = renderToStaticMarkup(<CardFace locale="en" card={cardByNumber(70)}/>);
        expect(html).toContain("ie-card-bot-box");
        expect(html).toContain(">FR<");
        expect(html).toContain(">AU<");
    });

    it("omits the grid on a card with no box", () => {
        const html = renderToStaticMarkup(<CardFace locale="en" card={cardByNumber(77)}/>);
        expect(html).not.toContain("ie-card-bot-box");
    });
});
