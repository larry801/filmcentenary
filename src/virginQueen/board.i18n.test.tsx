import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";
import {VQGame} from "./constant/general";

/**
 * English-mode UI guard.
 *
 * Every user-visible string on the board must come from i18n: when the active
 * locale is `en` the rendered markup may not contain a single CJK character.
 * Data that is deliberately bilingual (card text, log entries) is excluded by
 * clearing the log and by only rendering the chrome surfaces here.
 */

const CJK = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

const fakeCtx = (): Ctx => ({
    random: {
        Die: () => 3,
        Shuffle: (a: any[]) => a,
    },
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

const cjkSamples = (html: string): string[] => {
    const samples: string[] = [];
    const text = html.replace(/<[^>]+>/g, " ");
    for (const part of text.split(/\s+/)) {
        if (part !== "" && CJK.test(part) && !samples.includes(part)) samples.push(part);
    }
    return samples.slice(0, 40);
};

const expectEnglish = (html: string, label: string): void => {
    const samples = cjkSamples(html);
    if (samples.length > 0) {
        throw new Error(`${label} still renders CJK in en: ${samples.join(" | ")}`);
    }
};

const actionGame = (): VQGame => {
    const G = setupGame({...fakeCtx(), numPlayers: 6});
    G.year = 3;
    G.activePower = "spain";
    G.powers.spain.cp = 3;
    G.powers.spain.cards = ["vq-020", "vq-home-spanish-armada"];
    G.spaces.madrid.land.spain = {regular: 3, merc: 1, cav: 0};
    G.seaZones.englishChannel.naval.spain = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
    return G;
};

describe("Virgin Queen board in English", () => {
    beforeEach(async () => {
        await i18n.locale("en");
    });

    afterEach(async () => {
        await i18n.locale("zh_CN");
    });

    it("renders every shell surface without CJK", () => {
        const G = actionGame();
        const html = renderBoard(G, "action", "1", "1");
        expectEnglish(html, "action phase headless board");
        // Sanity check that we are really looking at English chrome.
        expect(html).toContain("Map");
        expect(html).toContain("Hand");
    });

    it("renders the action phase for the active power without CJK", () => {
        const html = renderBoard(actionGame(), "action", "1", "1");
        expectEnglish(html, "action phase");
    });

    it("renders the spectator view without CJK", () => {
        const G = actionGame();
        const html = renderBoard(G, "action", null, "1");
        expectEnglish(html, "spectator action phase");
    });

    it("renders the diplomacy phase without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3;
        G.activePower = "france";
        G.powers.france.cp = 4;
        G.powers.france.cards = ["vq-022"];
        G.powers.france.treasures = [2];
        const html = renderBoard(G, "diplomacy", "1", "1");
        expectEnglish(html, "diplomacy phase");
    });

    it("renders the spring deployment phase without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3;
        G.activePower = "england";
        G.powers.england.cp = 2;
        G.powers.england.cards = ["vq-home-virgin-queen"];
        const html = renderBoard(G, "spring", "1", "1");
        expectEnglish(html, "spring phase");
    });
});
