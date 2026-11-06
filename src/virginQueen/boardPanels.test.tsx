import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {LogPanel} from "./components/board/LogPanel";

describe("board side panels", () => {
    it("groups log entries by turn and phase and caps the list", () => {
        const log = ["first entry", "second entry", "third entry", "fourth entry"];
        const html = renderToStaticMarkup(<LogPanel log={log} pageSize={2}
            marks={[{at: 0, turn: 2, phase: "action", year: 1560}]}/>);
        expect(html).toContain("回合 2");
        expect(html).toContain("行动阶段");
        // Newest first, capped at pageSize.
        expect(html).toContain("fourth entry");
        expect(html).toContain("third entry");
        expect(html).not.toContain("first entry");
        expect(html).toContain("显示全部");
    });

    it("turns space names in the log into clickable buttons", () => {
        const html = renderToStaticMarkup(<LogPanel log={["Spain moves into Paris"]} onSelectSpace={() => undefined}/>);
        expect(html).toContain('class="vq-log-space"');
        expect(html).toContain(">Paris<");
    });

    it("highlights entries about the viewer's power", () => {
        const html = renderToStaticMarkup(<LogPanel log={["England wins a battle"]} myName="England"/>);
        expect(html).toContain("vq-log-mine");
    });

});
