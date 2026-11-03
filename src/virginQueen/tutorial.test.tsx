import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {Power, VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {tutorialLesson} from "./tutorial";
import {setupGame} from "./util";
import {TutorialGuide} from "./components/tutorial-guide";
import LocalVirginQueen from "./components/local";

const context = (phase = "cardDraw"): Ctx => ({
    numPlayers: 2,
    phase,
    currentPlayer: "0",
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const tutorialGame = (): VQGame => setupGame(context(), {scenario: "tutorial"});

describe("two-player teaching lessons", () => {
    it("does not change formal scenarios", () => {
        for (const scenario of ["campaign", "tournament"] as const) {
            expect(tutorialLesson(setupGame(context(), {scenario}), "cardDraw")).toBeUndefined();
        }
    });

    test.each([
        ["cardDraw", "第 1 步：确认手牌"],
        ["spring", "第 2 步：春季部署"],
        ["action", "第 3 步：先打出一张牌"],
    ])("guides the active power during %s", (phase, title) => {
        const G = tutorialGame();
        expect(tutorialLesson(G, phase)).toMatchObject({title, power: "ottoman"});
        G.activePower = "spain";
        expect(tutorialLesson(G, phase)?.power).toBe("spain");
    });

    it("moves from playing a card to spending CP and ending the impulse without mutating state", () => {
        const G = tutorialGame();
        G.powers.ottoman.cardPlayed = true;
        G.powers.ottoman.cp = 3;
        const before = JSON.stringify(G);
        expect(tutorialLesson(G, "action")?.title).toBe("第 3 步：使用行动点");
        expect(JSON.stringify(G)).toBe(before);
        G.powers.ottoman.cp = 0;
        expect(tutorialLesson(G, "action")?.title).toBe("第 3 步：交给另一位玩家");
        expect(tutorialLesson(G, "action")?.instruction).toContain("结束行动轮次");
    });

    const responses: [string, Partial<VQGame>, Power][] = [
        ["选择是否拦截", {pendingIntercept: {
            power: "ottoman", defender: "spain", from: "istanbul", to: "edirne", phase: "field",
            attackers: ["ottoman"], attempted: [], succeeded: false,
        }}, "spain"],
        ["使用响应牌或放行", {pendingAction: {power: "ottoman", move: "moveLand", args: {}}}, "spain"],
        ["使用响应牌或放行", {pendingAction: {power: "spain", move: "moveNaval", args: {}}}, "ottoman"],
        ["结算海盗行动", {pendingPiracy: {
            power: "ottoman", target: "spain", zone: "aegean", step: "losses", remaining: 1, rewards: {},
        }}, "ottoman"],
        ["结算海盗行动", {pendingPiracy: {
            power: "ottoman", target: "spain", zone: "aegean", step: "rewards", remaining: 1, rewards: {},
        }}, "spain"],
        ["完成事件选择", {pendingTutorialEvent: {
            cardId: "vq-008", power: "ottoman", responding: "spain", step: "target", remaining: 1, tracks: [],
        }}, "spain"],
        ["完成战斗选择", {pendingBattle: {
            phase: "field", location: "belgrade", from: "sofia", attacker: "ottoman", attackers: ["ottoman"],
            defenders: ["spain"], defender: "spain", responding: "spain", step: "defend", cards: {},
        }}, "spain"],
    ];

    test.each(responses)("prioritizes %s and identifies its responder", (title, pending, power) => {
        const G = Object.assign(tutorialGame(), pending);
        expect(tutorialLesson(G, "action")).toMatchObject({title: `响应：${title}`, power});
    });
});

describe("two-player teaching UI", () => {
    const renderGuide = (G: VQGame, ctx: Ctx, playerID: string | null): string =>
        renderToStaticMarkup(<TutorialGuide G={G} ctx={ctx} playerID={playerID}/>);

    it("starts the local shortcut with exactly the Ottoman and Spanish seats", () => {
        const html = renderToStaticMarkup(<LocalVirginQueen initialScenario="tutorial"/>);
        expect(html).toContain('value="tutorial-2"');
        expect(html).toContain("P1 奥斯曼帝国");
        expect(html).toContain("P2 西班牙");
        expect(html).not.toContain("P3 ");
        expect(html).toContain("请按教学提示切换玩家标签页");
    });

    it("distinguishes the acting seat, waiting seat and spectator", () => {
        const G = tutorialGame();
        expect(renderGuide(G, context(), "0")).toContain("轮到你操作。");
        expect(renderGuide(G, context(), "1")).toContain("本地热座请切换到 P1 标签页。");
        expect(renderGuide(G, context(), null)).toContain("旁观教学：仅查看公开提示。");
    });

    it("directs a response to P2 rather than the current impulse owner", () => {
        const G = tutorialGame();
        G.pendingAction = {power: "ottoman", move: "moveLand", args: {}};
        const html = renderGuide(G, context("action"), "1");
        expect(html).toContain("当前操作：P2 · 西班牙。");
        expect(html).toContain("轮到你操作。");
        expect(html).toContain("响应：使用响应牌或放行");
    });

    it("does not display card identities or read hidden hands to choose a lesson", () => {
        const G = tutorialGame();
        G.powers.ottoman.cards = ["vq-001", "vq-008"];
        G.powers.spain.cards = ["vq-003", "vq-015"];
        const view = VirginQueenGameDef.playerView! as (state: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        for (const playerID of ["0", "1", null]) {
            const visible = view(G, context("action"), playerID);
            expect(tutorialLesson(visible, "action")).toEqual(tutorialLesson(G, "action"));
            expect(renderGuide(visible, context("action"), playerID)).not.toMatch(/vq-\d{3}/);
        }
    });

    it("replaces action instructions with a review after game over", () => {
        const ctx = {...context("action"), gameover: {winner: "1", power: "spain", reason: "timeLimit"}};
        const html = renderGuide(tutorialGame(), ctx, "0");
        expect(html).toContain("教学结束：回顾本局");
        expect(html).not.toContain("当前操作：");
        expect(html).not.toContain("第 3 步：先打出一张牌");
    });

    it("leaves the teaching panel out of formal games", () => {
        expect(renderGuide(setupGame(context()), context(), "0")).toBe("");
    });
});
