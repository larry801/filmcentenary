import React from "react";
import {Ctx} from "boardgame.io";
import {renderToStaticMarkup} from "react-dom/server";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenBoard} from "./components/board";
import {setupGame, winter} from "./util";

const context = (player = "0", phase = "action", numPlayers = 6): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/**
 * A tournament game whose only land and naval unit is the Morisco stack in
 * Granada, played through Winter so rule 20.1 records the unrest choice.
 */
const winterGame = (numPlayers = 6): VQGame => {
    const G = setupGame(context("0", "action", numPlayers), {scenario: "tournament"});
    for (const space of SPACES) {
        G.spaces[space.id].land = {};
        G.spaces[space.id].naval = {};
    }
    for (const zone of Object.values(G.seaZones)) {
        zone.naval = {};
    }
    G.spaces.granada.land.ottoman = {regular: 2, merc: 0, cav: 0};
    winter(G, context("0", "action", numPlayers));
    return G;
};

const render = (G: VQGame, playerID: string, currentPlayer = "0"): string => renderToStaticMarkup(
    <VirginQueenBoard {...{
        G, ctx: {phase: "cardDraw", currentPlayer, numPlayers: 6}, moves: {}, playerID,
        isActive: playerID === currentPlayer,
    } as any}/>,
);

describe("rule 20.1 Morisco unrest panel", () => {
    it("offers the choice to the seat that controls the Ottoman", () => {
        const G = winterGame();

        const html = render(G, "0");

        expect(html).toContain("摩尔人起义：选择冬季骚动地点");
        expect(html).toContain("在此放置骚动");
    });

    it("does not offer it to another seat", () => {
        const G = winterGame();

        expect(render(G, "1")).not.toContain("摩尔人起义：选择冬季骚动地点");
    });

    it("follows the Ottoman to the English seat in a four-player game", () => {
        const G = winterGame(4);

        expect(render(G, "1", "1")).toContain("摩尔人起义：选择冬季骚动地点");
        expect(render(G, "0", "1")).not.toContain("摩尔人起义：选择冬季骚动地点");
    });
});
