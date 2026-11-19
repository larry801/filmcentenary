import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {CardOriginalImage} from "./game-card-table";

describe("CardOriginalImage", () => {
    it("renders a 原图 disclosure with a thumbnail and the full-size image", () => {
        const html = renderToStaticMarkup(
            <CardOriginalImage src="/img/F1103.png" alt="测试卡牌"/>
        );
        expect(html).toContain("<details");
        expect(html).toContain("<summary");
        expect(html).toContain("原图");
        expect(html).toContain('src="/img/F1103.png"');
        expect(html).toContain('alt="测试卡牌"');
        // The thumbnail is decorative; only the expanded image carries the name.
        expect(html).toContain('alt=""');
    });

    it("keeps the alt text and src on the expanded image only", () => {
        const html = renderToStaticMarkup(
            <CardOriginalImage src="/vq-cards/vq_1.webp" alt="Card 1"/>
        );
        const fullImage = html.match(/<img[^>]*alt="Card 1"[^>]*>/);
        expect(fullImage).not.toBeNull();
        expect(fullImage![0]).toContain('src="/vq-cards/vq_1.webp"');
    });
});
