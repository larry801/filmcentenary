import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {cardById} from "./constant/cards";

const fakeCtx = (): Ctx => ({
    random: {
        Die: () => 3,
        Shuffle: (a: any[]) => a,
    },
} as unknown as Ctx);

describe("Virgin Queen board", () => {
    it("exposes espionage result choices and private hand snapshots only to their owning seat", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3;
        G.activePower = "spain";
        G.pendingEspionage = {kind: "intelligence", power: "spain", targetPower: "france", responding: "spain",
            step: "offense", cp: 2, remaining: 1, used: []};
        G.espionage!.inspections = [{viewer: "spain", target: "france", cards: ["vq-020"]}];
        const view = VirginQueenGameDef.playerView as any;
        for (const playerID of ["1", "2", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "1", numPlayers: 6},
                moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("谍报结算");
            expect(html.includes(">秘密查看目标手牌<")).toBe(playerID === "1");
            expect(html.includes("秘密情报 · 法国手牌快照")).toBe(playerID === "1");
            expect(html).not.toContain(">获取情报 (2 CP)<");
        }
    });

    it("shows Jesuits on the map and the official rebellion action in Spain's action panel", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3; G.activePower = "spain"; G.espionage!.jesuits = ["york"];
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 6}, moves: {}, playerID: "1", isActive: true,
        } as any}/>);
        expect(html).toContain("官方 Espionage Table");
        expect(html).toContain(">英格兰天主教叛乱<");
        expect(html).toContain("York · 控制：england · 天主教 · 陆军 0 / 海军 0 / 将领 0 · 耶稣会士");
        expect(html).not.toContain("可玩近似");
    });

    it.each([2, 6])("shows Grand Vizier effects only to Ottoman and limits the canal by player count (%s)", (numPlayers) => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.pendingCardEvent = {kind: "grandVizier", cardId: "vq-001", responding: "ottoman", step: "effect", remaining: 4};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0", numPlayers}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html.includes(">增募 4 个正规军／桨帆船<")).toBe(playerID === "0");
            expect(html.includes(">尝试建造苏伊士运河<")).toBe(playerID === "0" && numPlayers === 6);
            expect(html).toContain("需要响应 · 奥斯曼帝国");
        }
    });

    it("shows recruitment counts and exposes cancellation only to the Ottoman responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.powers.ottoman.cards = ["vq-001"];
        G.pendingCardEvent = {kind: "grandVizier", cardId: "vq-001", responding: "ottoman", step: "recruit", remaining: 3};
        const render = (playerID: string | null) => renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 2}, moves: {}, playerID, isActive: playerID === "0",
        } as any}/>);
        expect(render("0")).toContain("还可增加 3 个单位");
        G.pendingCardEvent = {kind: "cancelEvent", cardId: "vq-021", power: "spain", responding: "ottoman"};
        for (const playerID of ["0", "1", null]) {
            const html = render(playerID);
            expect(html).toContain("Foreign Volunteers");
            expect(html.includes(">打出大维齐尔，取消事件<")).toBe(playerID === "0");
            expect(html.includes(">允许事件结算<")).toBe(playerID === "0");
            expect(html).toContain("响应：完成大维齐尔选择");
        }
    });

    it("shows Spanish Road formation controls only to the Spanish responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingTutorialEvent = {cardId: "vq-003", power: "spain", responding: "spain", step: "roadFormation",
            remaining: 1, tracks: [], roadFormation: {units: {}, leaders: []}};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "1"}, moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("先选择米兰的部队与随军将领");
            expect(html.includes(">不进行米兰部署<")).toBe(playerID === "1");
        }
    });

    it("shows remaining rebel hits and naval loss choices to the targeted controller", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.spaces.tunis.control = "spain";
        G.spaces.tunis.naval = {spain: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};
        G.pendingTutorialEvent = {cardId: "vq-018", power: "ottoman", responding: "spain", step: "rebelLosses",
            remaining: 2, tracks: [], space: "tunis"};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("还需分配 2 次损失");
            expect(html.includes(">移除 西班牙 桨帆船<")).toBe(playerID === "1");
        }
    });

    it("prioritizes a battle response and exposes choices only to its responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingBattle = {phase: "field", location: "belgrade", from: "sofia", attacker: "ottoman", attackers: ["ottoman"],
            defenders: ["spain"], defender: "spain", responding: "spain", step: "defend", cards: {}};
        for (const playerID of ["0", "1"]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: true,
            } as any}/>);
            expect(html).toContain("需要响应 · 西班牙");
            expect(html).toContain("响应与结算");
            expect(html).toContain("响应：完成战斗选择");
            expect(html.includes(">迎战<")).toBe(playerID === "1");
        }
    });

    it("only renders the viewing seat's hand summaries and leaves playing to card details", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.powers.ottoman.cards = ["vq-001"];
        G.powers.spain.cards = ["vq-003"];
        const view = VirginQueenGameDef.playerView! as (state: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html.includes(`查看卡牌 ${cardById("vq-001").name}`)).toBe(playerID === "0");
            expect(html.includes(`查看卡牌 ${cardById("vq-003").name}`)).toBe(playerID === "1");
            expect(html).not.toContain(">作为 CP<");
        }
    });

    it("replaces playable actions with the result after game over", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", gameover: {winner: "1", power: "spain", reason: "timeLimit"}},
            moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("对局结束 · 胜者：P2 西班牙");
        expect(html).not.toContain(">结束冲动<");
        expect(html).toContain("教学结束：回顾本局");
    });

    it("shows teaching guidance and opens the tutorial at each player's capital", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        for (const [playerID, capital] of [["0", "Istanbul"], ["1", "Madrid"]]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "cardDraw", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html).toContain("双人教学模式 · 勒班陀海战");
            expect(html).toContain("第 1 步：确认手牌");
            expect(html).toMatch(new RegExp(`<h6[^>]*>${capital}</h6>`));
            expect(html).not.toMatch(/<h6[^>]*>London<\/h6>/);
        }
    });

    it("identifies the seat and power still confirming a two-player tournament draw", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tournament"});
        G.activePower = "spain";
        const render = (playerID: string): string => renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "cardDraw", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
        } as any}/>);
        expect(render("0")).toContain("请确认 P1 · 西班牙 完成抽牌（2/5）。");
        expect(render("1")).toContain("等待 P1 · 西班牙 完成抽牌（2/5）。");
        expect(render("0")).toContain("确认西班牙抽牌完成");
        expect(render("0")).toContain("各参战强国依次确认后进入外交阶段");
    });

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
