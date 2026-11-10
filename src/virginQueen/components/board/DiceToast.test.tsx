import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {DiceFaces} from "./DiceToast";

describe("DiceFaces", () => {
    it("renders every repeated die face", () => {
        const html = renderToStaticMarkup(<DiceFaces rolls="3, 3, 5"/>);
        expect(html.match(/class="vq-die"/g)).toHaveLength(3);
        expect(html).toContain(">3</span>");
        expect(html).toContain(">5</span>");
    });

    it("shows a localized summary for non-dice roll text", () => {
        const html = renderToStaticMarkup(<DiceFaces rolls="catholic conversions in France: [4, 5, 4]"/>);
        expect(html).not.toContain("catholicconversions");
        expect(html).toContain("天主教在 法国 的转化：[4, 5, 4]");
        expect(html.match(/class="vq-die"/g)).toBeNull();
    });

    it("localizes Protestant conversion summaries after power-name replacement", () => {
        const html = renderToStaticMarkup(<DiceFaces rolls="protestant conversions in France: [3, 2, 2, 2, 5]"/>);
        expect(html).toContain("新教在 法国 的转化：[3, 2, 2, 2, 5]");
        expect(html).not.toContain("conversions in");
    });
});
