import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import {VQGame} from "./constant/general";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";

const context = (): Ctx => ({
    numPlayers: 6,
    currentPlayer: "1",
    playerID: "1",
    phase: "diplomacy",
    activePlayers: {"1": "dealResponse", "3": "dealOffer"},
    playOrder: ["0", "1", "2", "3", "4", "5"],
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const offerGame = (): VQGame => {
    const G = setupGame({...context(), phase: "action"} as Ctx);
    G.log = [];
    G.year = 3;
    G.activePower = "france";
    G.negotiation = {
        offer: {
            id: "deal-1",
            from: "france",
            to: "spain",
            terms: [
                {kind: "peace"},
                {kind: "cards", from: "france", to: "spain", count: 2},
                {kind: "yieldSpace", from: "france", to: "spain", space: "bordeaux"},
            ],
            promises: [{from: "france", text: "I will keep my galleys in port."}],
            year: 3,
            turn: 1,
        },
        history: [{
            id: "deal-0",
            proposer: "spain",
            confirmer: "france",
            terms: [{kind: "alliance"}],
            promises: [],
            year: 3,
            turn: 1,
        }],
        nextId: 2,
    };
    return G;
};

const render = (G: VQGame, playerID: string | null): string => renderToStaticMarkup(<VirginQueenBoard {...{
    G,
    ctx: {...context(), playerID},
    moves: {},
    playerID,
    isActive: playerID === "1",
} as any}/>);

describe("negotiation panel", () => {
    it("shows the private offer and the response controls to the recipient", () => {
        const html = render(offerGame(), "1");
        expect(html).toContain(i18n.chain.vq.negotiationUi.title);
        expect(html).toContain(i18n.chain.vq.negotiationUi.incomingFrom);
        expect(html).toContain(i18n.chain.vq.negotiationUi.accept);
        expect(html).toContain(i18n.chain.vq.negotiationUi.counter);
        expect(html).toContain("波尔多");
        // The non-binding promise is visibly separated from the binding clauses.
        expect(html).toContain(i18n.chain.vq.negotiationUi.nonBinding);
        expect(html).toContain("I will keep my galleys in port.");
        // The public record of a concluded deal is visible as well.
        expect(html).toContain(i18n.chain.vq.negotiationUi.history);
    });

    it("offers the builder to the proposer during their diplomacy turn", () => {
        const G = offerGame();
        G.negotiation!.offer = null;
        G.negotiation!.history = [];
        G.activePower = "france";
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G,
            ctx: {...context(), currentPlayer: "3", playerID: "3", activePlayers: null, phase: "diplomacy"},
            moves: {},
            playerID: "3",
            isActive: true,
        } as any}/>);
        expect(html).toContain(i18n.chain.vq.negotiationUi.builder);
        expect(html).toContain(i18n.chain.vq.negotiationUi.send);
    });
});
