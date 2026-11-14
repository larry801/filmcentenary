import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";

const state = (numPlayers = 6) => {
    const G = setupGame({numPlayers, random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards}} as unknown as Ctx);
    G.activePower = "france";
    G.powers.france.cp = 2;
    G.powers.france.cardPlayed = true;
    G.pendingWithdraw = {active: "france", defender: "england", space: "orleans", origin: "paris"};
    return G;
};

const render = (G: ReturnType<typeof state>, playerID: string | null, currentPlayer = "3") =>
    renderToStaticMarkup(<VirginQueenBoard {...{
        G, ctx: {phase: "action", currentPlayer, activePlayers: {[playerID ?? "2"]: "withdrawChoice"}},
        moves: {}, playerID, isActive: playerID !== currentPlayer, hotseat: true,
    } as any}/>);

const button = (html: string, label: string): string | undefined =>
    html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];

describe("hotseat withdrawal controls", () => {
    it("lets the defending seat answer and does not tell it to wait for the attacker", () => {
        const html = render(state(), "2");
        expect(button(html, "退入要塞")).toBeDefined();
        expect(button(html, "退入要塞")).not.toContain("disabled");
        expect(button(html, "出城野战")).not.toContain("disabled");
        expect(html).toContain("需要响应 · 英格兰 · 轮到你选择");
        expect(html).not.toContain("请切换到 P4 标签页");
    });

    it("directs the attacker to the defending seat and disables ending the impulse", () => {
        const html = render(state(), "3");
        expect(html).toContain("请切换到 P3 标签页");
        expect(button(html, "退入要塞")).toBeUndefined();
        expect(button(html, "结束行动轮次")).toContain("disabled");
    });

    it("selects the defending power when its seat owns multiple powers", () => {
        // Two-player campaign: Spain/France belong to P1, England/HRE to P2.
        const html = render(state(2), "1", "0");
        expect(html).toContain("查看 英格兰");
        expect(button(html, "退入要塞")).toBeDefined();
        expect(button(html, "退入要塞")).not.toContain("disabled");
    });

    it("gives spectators no withdrawal controls", () => {
        expect(button(render(state(), null), "退入要塞")).toBeUndefined();
    });
});
