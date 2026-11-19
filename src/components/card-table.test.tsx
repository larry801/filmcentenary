import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

// card.tsx imports ESM-only nanoid and plain CSS, neither of which the
// CommonJS Jest runtime can load without transform config.
jest.mock("nanoid", () => ({nanoid: () => "test-id"}));
jest.mock("./card.css", () => ({}));
jest.mock("./card-view-table.css", () => ({}));
jest.mock("./card-table.css", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DenseTable = require("./card-table").default as React.ComponentType;

describe("Film Centenary card table", () => {
    it("offers expandable original images for cards with scans", () => {
        const html = renderToStaticMarkup(<DenseTable/>);
        expect(html).toContain("原图");
        expect(html).toContain("<details");
        expect(html).toContain("/img/B01.png");
        expect(html).toContain("/img/V111.png");
        expect(html).toContain("/img/F");
    });
});
