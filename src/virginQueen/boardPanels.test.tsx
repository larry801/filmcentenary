import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {LogPanel} from "./components/board/LogPanel";

describe("board side panels", () => {
    it("groups log entries by turn and phase and caps the list", () => {
        const log = ["first entry", "second entry", "third entry", "fourth entry"];
        const html = renderToStaticMarkup(<LogPanel log={log} pageSize={2}
            marks={[{at: 0, turn: 46, phase: "action", year: 2}]}/>);
        expect(html).toContain("回合 2");
        expect(html).not.toContain("回合 46");
        expect(html).toContain("行动阶段");
        // Newest first, capped at pageSize.
        expect(html).toContain("fourth entry");
        expect(html).toContain("third entry");
        expect(html).not.toContain("first entry");
        expect(html).toContain("显示全部");
    });

    it("labels winter entries separately from the preceding action phase", () => {
        const html = renderToStaticMarkup(<LogPanel log={["Winter ends. Turn 2 begins."]}
            marks={[{at: 0, turn: 9, phase: "winter", year: 1}]}/>);
        expect(html).toContain("回合 1");
        expect(html).toContain("冬季结算");
        expect(html).not.toContain("回合 9");
    });

    it("turns space names in the log into clickable buttons", () => {
        const html = renderToStaticMarkup(<LogPanel log={["Spain moves into Paris"]} onSelectSpace={() => undefined}/>);
        expect(html).toContain('class="vq-log-space"');
        expect(html).toContain(">巴黎<");
    });

    it("highlights entries about the viewer's power", () => {
        const html = renderToStaticMarkup(<LogPanel log={["England wins a battle"]} myName="英格兰"/>);
        expect(html).toContain("vq-log-mine");
    });

});
