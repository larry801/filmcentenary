import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {VirginQueenBoard} from "./components/board";
import {setupGame} from "./util";

const ctx: Ctx = {
    numPlayers: 6,
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    events: {setActivePlayers: () => {}, endStage: () => {}, endTurn: () => {}},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx;

test("the intel panel renders a VP breakdown table for every player power", () => {
    const G = setupGame(ctx);
    const html = renderToStaticMarkup(
        <VirginQueenBoard {...{
            G, ctx, moves: {}, playerID: "0", isActive: true,
        } as any}/>,
    );
    expect(html).toContain("得分拆解");
    expect(html).toContain("总计");
    expect(html).toContain("vq-vp-breakdown");
    for (const power of ["spain", "england", "france", "hre", "protestant"]) {
        expect(html).toContain(`data-power="${power}"`);
    }
});
