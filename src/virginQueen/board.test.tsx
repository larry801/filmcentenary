import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";

const fakeCtx = (): Ctx => ({
    random: {
        Die: () => 3,
        Shuffle: (a: any[]) => a,
    },
} as unknown as Ctx);

describe("Virgin Queen board", () => {
    it("offers all three religious preferences to HRE in its first Spring", () => {
        const G = setupGame(fakeCtx());
        G.activePower = "hre";
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "spring", currentPlayer: "4"}, moves: {}, playerID: "4", isActive: true,
        } as any}/>);
        expect(html).toContain("秘密宗教倾向");
        expect(html).toContain("天主教");
        expect(html).toContain("新教");
        expect(html).toContain("平衡");
    });

    it("shows potential VP only to HRE until revelation", () => {
        const G = setupGame(fakeCtx());
        G.activePower = "hre";
        G.hreReligiousPreference = "catholic";
        G.hreReligiousPreferenceChosen = true;
        const view = VirginQueenGameDef.playerView! as (G: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        const render = (playerID: string | null): string => renderToStaticMarkup(<VirginQueenBoard {...{
            G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "4"}, moves: {}, playerID, isActive: false,
        } as any}/>);
        expect(render("4")).toContain("秘密：天主教 · 5 VP（未计入）");
        expect(render("1")).toContain("宗教倾向已秘密选择");
        expect(render(null)).not.toContain("秘密：天主教");
        G.hreReligiousPreferenceRevealed = true;
        expect(render(null)).toContain("已公开：天主教 · 5 VP");
    });

    it("renders the map, hand and action panel", () => {
        const G = setupGame(fakeCtx());
        const props: any = {
            G,
            ctx: {phase: "action", currentPlayer: "0", turn: 1, gameover: undefined},
            moves: {},
            playerID: "0",
            isActive: true,
            log: [],
            matchID: "test",
            chatMessages: [],
        };
        const html = renderToStaticMarkup(<VirginQueenBoard {...props}/>);
        expect(html).toContain("Virgin Queen");
        expect(html).toContain("London");
        expect(html).toContain("奥斯曼帝国");
        expect(html).toContain("行动阶段");
    });

    it("renders the diplomacy panel and map for a spectator", () => {
        const G = setupGame(fakeCtx());
        const props: any = {
            G,
            ctx: {phase: "diplomacy", currentPlayer: "1", turn: 1, gameover: undefined},
            moves: {},
            playerID: null,
            isActive: false,
            log: [],
            matchID: "test",
            chatMessages: [],
        };
        const html = renderToStaticMarkup(<VirginQueenBoard {...props}/>);
        expect(html).toContain("外交阶段");
        expect(html).toContain("旁观模式");
    });
});
