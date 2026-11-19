import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ImperialElegyCardTable from "./card-table";

describe("Imperial Elegy card table", () => {
    it("offers expandable original images for action cards and goals", () => {
        const html = renderToStaticMarkup(<ImperialElegyCardTable/>);
        expect(html).toContain("原图");
        expect(html).toContain("<details");
        expect(html).toContain("/imperial-elegy/cards/action-");
        expect(html).toContain("/imperial-elegy/cards/goal-GE-01.png");
    });
});
