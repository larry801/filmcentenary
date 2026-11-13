import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {ownerOf} from "./ownership";
import {scenarioOptionLabel, seatLabels} from "./configuration";

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

const renderBoard = (G: VQGame, phase: string, playerID: string | null, currentPlayer = "1", numPlayers = 6,
                     clearLog = true): string => {
    if (clearLog) G.log = [];
    return renderToStaticMarkup(<VirginQueenBoard {...{
        G,
        ctx: {...fakeCtx(), numPlayers, phase, currentPlayer, playOrder: Array.from({length: numPlayers}, (_, index) => String(index))},
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



    it("renders the setup log in English", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "spain";
        const html = renderBoard(G, "action", "1", "1", 6, false);
        expectEnglish(html, "setup log");
        expect(html).toContain("The Siege of La Rochelle");
        expect(html).toContain("Starting VP");
        expect(html).toContain("Scenario note");
    });

    it("localizes lobby scenario and seat options", () => {
        expect(scenarioOptionLabel("campaign", "en")).toBe("Campaign · The Siege of La Rochelle");
        expect(scenarioOptionLabel("tutorial", "en")).toBe("Tutorial · The Battle of Lepanto");
        expect(scenarioOptionLabel("tutorial", "zh_CN")).toBe("教学 · 勒班陀海战");
        expect(seatLabels("campaign", 6, "en")[0]).toBe("Ottoman Empire");
        expect(seatLabels("campaign", 2, "en")).toEqual(["Spain / France", "England / Protestants"]);
        expect(seatLabels("tutorial", 2, "en")).toEqual(["Ottoman Empire", "Spain"]);
        expect(seatLabels("campaign", 6, "zh_CN")[0]).toBe("奥斯曼帝国");
    });

    it("renders the pending battle window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2});
        G.activePower = "england";
        G.powers.england.cards = ["vq-036"];
        G.powers.spain.cards = [];
        G.discard = ["vq-008", "vq-005", "vq-009"];
        G.pendingBattle = {phase: "field", location: "belgrade", from: "sofia", attacker: "england",
            attackers: ["england"], defenders: ["spain"], defender: "spain", responding: "spain",
            step: "defend", cards: {}};
        G.cardWindow = {kind: "combat", phase: "field", location: "belgrade", attacker: "england"};
        expectEnglish(renderBoard(G, "action", "1", "1"), "pending battle");
    });

    it("renders the espionage window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3;
        G.activePower = "spain";
        G.pendingEspionage = {kind: "intelligence", power: "spain", targetPower: "france", responding: "spain",
            step: "offense", cp: 2, remaining: 1, used: []};
        G.espionage = {...(G.espionage ?? {}), inspections: []} as NonNullable<VQGame["espionage"]>;
        expectEnglish(renderBoard(G, "action", "1", "1"), "pending espionage");
    });

    it("renders the Act of Abjuration offers without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 4;
        G.activePower = "england";
        G.pendingAbjuration = {offers: [
            {power: "england", space: "amsterdam"},
            {power: "france", space: "brussels"},
            {power: "hre", space: "rotterdam"},
        ]};
        for (const def of SPACES) {
            if (def.home !== "england" && def.home !== "france" && def.home !== "hre") continue;
            G.spaces[def.id].land[def.home] = {regular: 0, merc: 0, cav: 0};
            G.spaces[def.id].leaders = [];
        }
        for (const id of ["amsterdam", "brussels", "rotterdam"]) {
            G.spaces[id].control = "protestant";
            G.spaces[id].land = {};
        }
        G.spaces.london.land.england = {regular: 5, merc: 0, cav: 0};
        G.spaces.london.leaders = ["leicester"];
        expectEnglish(renderBoard(G, "action", "5", "5"), "pending abjuration");
    });

    it("renders the Grand Vizier window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.pendingCardEvent = {kind: "grandVizier", cardId: "vq-001", responding: "ottoman", step: "effect", remaining: 4};
        expectEnglish(renderBoard(G, "action", "0", "0"), "pending grand vizier");
    });



    it("renders the intercept window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "england";
        G.pendingIntercept = {power: "england", defender: "spain", from: "london", to: "englishChannel",
            phase: "naval", attackers: ["england"], attempted: [], succeeded: false};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "spain") ?? "1", "1"), "pending intercept");
    });

    it("renders the interception-order window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "england";
        G.pendingInterceptionOrder = {power: "england", defender: "spain", moveFrom: "london",
            to: "englishChannel", destinationHadEnemy: false};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "spain") ?? "1", "1"), "pending interception order");
    });

    it("renders the action-response window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "spain";
        G.pendingAction = {power: "spain", responder: "england", responders: ["england"],
            move: "impulse", args: {}};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "england") ?? "2", "1"), "pending action response");
    });

    it("renders the piracy window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "spain";
        G.pendingPiracy = {power: "spain", target: "england", zone: "englishChannel",
            step: "rewards", remaining: 1, rewards: {}};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "england") ?? "2", "1"), "pending piracy");
    });

    it("renders the tutorial event window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingTutorialEvent = {cardId: "vq-003", power: "spain", responding: "spain", step: "roadFormation",
            remaining: 1, tracks: [], roadFormation: {units: {}, leaders: []}} as NonNullable<VQGame["pendingTutorialEvent"]>;
        expectEnglish(renderBoard(G, "action", "1", "1", 2), "pending tutorial event");
    });

    it("renders the city-rebels window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "spain";
        G.pendingCityRebels = {power: "spain", controller: "spain", space: "brussels", remaining: 2, values: [5, 5, 4, 3, 2]};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "spain") ?? "1", "1"), "pending city rebels");
    });

    it("renders the tribute window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "ottoman";
        G.pendingTribute = {target: "spain", choices: ["pay_card", "refuse"]};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "spain") ?? "1", "1"), "pending tribute");
    });

    it("renders the mutiny window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "ottoman";
        G.spaces.brussels.land.spain = {regular: 5, merc: 0, cav: 0};
        G.powers.spain.cards = ["vq-020", "vq-022"];
        G.pendingMutiny = {space: "brussels", owner: "spain"};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "spain") ?? "1", "1"), "pending mutiny");
    });

    it("renders the Gregorian response window without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "spain";
        G.gregorianResponse = {after: "spain", responder: "england"};
        expectEnglish(renderBoard(G, "action", ownerOf(G, "england") ?? "2", "1"), "pending gregorian");
    });

    it("renders the tutorial guide without CJK", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.activePower = "ottoman";
        for (const phase of ["cardDraw", "spring", "action"]) {
            expectEnglish(renderBoard(G, phase, "0", "0", 2), `tutorial ${phase}`);
        }
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
