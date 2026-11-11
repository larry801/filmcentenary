import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import {VirginQueenBoard, blockingPendingReason, foreignWarEnemyName, holyLeagueTargetOptions} from "./components/board";
import {ActionGroup} from "./components/theme";
import {setupGame} from "./util";
import {VQGame} from "./constant/general";

const CJK = /[㐀-䶿一-鿿]/;

const fakeCtx = (): Ctx => ({
    random: {Die: () => 3, Shuffle: (a: any[]) => a},
} as unknown as Ctx);

const renderBoard = (G: VQGame, phase: string, playerID: string | null, currentPlayer = "1"): string => {
    G.log = [];
    return renderToStaticMarkup(<VirginQueenBoard {...{
        G,
        ctx: {...fakeCtx(), numPlayers: 6, phase, currentPlayer, playOrder: ["0", "1", "2", "3", "4", "5"]},
        moves: {},
        playerID,
        isActive: playerID === currentPlayer,
    } as any}/>);
};

const actionGame = (): VQGame => {
    const G = setupGame({...fakeCtx(), numPlayers: 6});
    G.year = 3;
    G.activePower = "spain";
    G.powers.spain.cp = 3;
    G.powers.spain.cards = ["vq-020"];
    return G;
};

describe("Virgin Queen board usability", () => {
    it("floats the collapsible game status over the map instead of above it", () => {
        const html = renderBoard(actionGame(), "action", "1");
        const map = html.indexOf("vq-map-panel");
        const status = html.indexOf('class="vq-status');
        const sidebar = html.indexOf("vq-sidebar");
        expect(map).toBeGreaterThan(-1);
        expect(status).toBeGreaterThan(map);
        expect(status).toBeLessThan(sidebar);
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain(i18n.chain.vq.header.collapseStatus);
    });

    it("frames the board for the seat that has to act and dims it while waiting", () => {
        expect(renderBoard(actionGame(), "action", "1")).toContain("vq-board--my-turn");
        expect(renderBoard(actionGame(), "action", "0")).toContain("vq-board--waiting");
    });

    it("replaces the disabled action grid with a waiting notice off-turn", () => {
        const waiting = renderBoard(actionGame(), "action", "0");
        expect(waiting).toContain("vq-waiting");
        expect(waiting).not.toContain('class="vq-action-picker"');
        const acting = renderBoard(actionGame(), "action", "1");
        expect(acting).toContain('class="vq-action-picker"');
        expect(acting).not.toContain("vq-waiting");
    });

    it("names the pending resolution that blocks action modes", () => {
        const G = actionGame();
        expect(blockingPendingReason(G)).toBeUndefined();
        G.pendingBattle = {} as VQGame["pendingBattle"];
        expect(blockingPendingReason(G)).toContain(i18n.chain.vq.turn.blocked.battle);
    });

    it("shows a badge only on action groups that have something available", () => {
        const withCount = renderToStaticMarkup(<ActionGroup title="Influence" available={2} availableLabel="2 available"/>);
        expect(withCount).toContain("vq-disclosure--available");
        expect(withCount).toContain('aria-label="2 available"');
        const empty = renderToStaticMarkup(<ActionGroup title="Influence" available={0}/>);
        expect(empty).not.toContain("vq-disclosure-badge");
        expect(renderBoard(actionGame(), "action", "1")).toContain("vq-disclosure-badge");
    });

    it("labels a minor-power controller by name in space details", () => {
        const G = actionGame();
        G.spaces.london.control = "scotland";
        const html = renderBoard(G, "action", "1");
        expect(html).toContain("<b>苏格兰</b>");
        expect(html).not.toContain("<b>scotland</b>");
    });

    describe("in English", () => {
        beforeEach(async () => {
            await i18n.locale("en");
        });
        afterEach(async () => {
            await i18n.locale("zh_CN");
        });

        it("names Holy League tracks and foreign war enemies in the active locale", () => {
            const labels = holyLeagueTargetOptions(setupGame({...fakeCtx(), numPlayers: 6})).map((option) => option.label);
            expect(labels.length).toBeGreaterThan(0);
            for (const label of labels) expect(label).not.toMatch(CJK);
            expect(labels.join(" ")).toContain("Papacy");
            expect(foreignWarEnemyName("Persia")).toBe("Persia");
        });
    });

    it("names foreign war enemies in Chinese by default", () => {
        expect(foreignWarEnemyName("Persia")).toBe("波斯");
        expect(foreignWarEnemyName("Poland")).toBe("波兰");
        expect(foreignWarEnemyName(undefined)).toBe("");
    });
});
