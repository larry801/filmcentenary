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
});
