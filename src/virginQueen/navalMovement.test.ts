import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {battleOptions} from "./combat";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {moveNaval, respondAction} from "./moves";
import {ownerOf} from "./ownership";
import {legalTargets, setupGame} from "./util";

const ctx = (): Ctx => ({numPlayers: 2, phase: "action", currentPlayer: "0", playerID: "0",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards}} as unknown as Ctx);
const fleet = (galley = 1) => ({galley, galleon: 0, racebuilt: 0, corsair: 0});
const position = (context = ctx()): VQGame => {
    const G = setupGame(context, {scenario: "tutorial"});
    for (const state of [...Object.values(G.spaces), ...Object.values(G.seaZones)]) {
        state.naval = {};
        state.leaders = [];
    }
    G.dealtYear = G.year;
    G.powers.ottoman.cards = ["vq-001"];
    G.powers.spain.cards = [];
    G.powers.ottoman.cp = 5;
    G.spaces.istanbul.naval.ottoman = fleet(3);
    G.spaces.algiers.naval.ottoman = fleet(2);
    return G;
};

describe("Naval Move actions (16.1)", () => {
    it("charges a CP for each successive adjacent step of the same fleet", () => {
        const G = position();
        expect(moveNaval(G, ctx(), {from: "istanbul", to: "aegean"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(4);
        expect(moveNaval(G, ctx(), {from: "aegean", to: "easternMediterranean"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(3);
    });

    it("moves several declared fleets simultaneously for one CP", () => {
        const G = position();
        G.powers.ottoman.cp = 1;
        G.seaZones.aegean.naval.ottoman = fleet(1);
        expect(moveNaval(G, ctx(), {fleets: [
            {from: "istanbul", to: "aegean"},
            {from: "aegean", to: "easternMediterranean"},
            {from: "algiers", to: "barbaryCoast"},
        ]})).toBeUndefined();
        // The newly arriving three galleys must not move through the second origin.
        expect(G.seaZones.aegean.naval.ottoman?.galley).toBe(3);
        expect(G.seaZones.easternMediterranean.naval.ottoman?.galley).toBe(1);
        expect(G.seaZones.barbaryCoast.naval.ottoman?.galley).toBe(2);
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.pendingNavalMoves).toBeUndefined();
        expect(legalTargets(G, "ottoman", "moveNaval").size).toBe(0);
        const before = JSON.stringify(G);
        expect(moveNaval(G, ctx(), {from: "aegean", to: "easternMediterranean"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
    });

    it.each([
        [{from: "istanbul", to: "aegean"}, {from: "aegean", to: "easternMediterranean"}],
        [{from: "istanbul", to: "aegean"}, {from: "istanbul", to: "easternMediterranean"}],
        [{from: "istanbul", to: "aegean"}, {from: "algiers", to: "northSea"}],
    ])("rejects an invalid batch without moving or charging any fleet", (...fleets) => {
        const G = position();
        const before = JSON.stringify(G);
        expect(moveNaval(G, ctx(), {fleets})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
    });

    it.each(["continue", "storms"])("charges once when a response chooses %s", (choice) => {
        const G = position();
        G.powers.spain.cards = ["vq-015"];
        moveNaval(G, ctx(), {fleets: [{from: "istanbul", to: "aegean"}, {from: "algiers", to: "barbaryCoast"}]});
        expect(G.pendingAction).toBeDefined();
        expect(G.powers.ottoman.cp).toBe(5);
        expect(G.spaces.istanbul.naval.ottoman?.galley).toBe(3);
        expect(respondAction(G, {...ctx(), playerID: "1"}, {choice})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(4);
        expect(G.pendingAction).toBeUndefined();
        expect(G.seaZones.aegean.naval.ottoman?.galley ?? 0).toBe(choice === "continue" ? 3 : 0);
        expect(G.seaZones.barbaryCoast.naval.ottoman?.galley ?? 0).toBe(choice === "continue" ? 2 : 0);
    });

    it.each([["vq-001", 4], ["vq-010", 0]] as const)("resumes every destination after battle using %s, with %i CP remaining", (card, remainingCp) => {
        const game = {...VirginQueenGameDef, seed: "two-naval-battles", setup: (context: Ctx) => {
            const G = position(context);
            G.powers.ottoman.cards = [card];
            G.seaZones.aegean.naval.spain = fleet(1);
            G.seaZones.barbaryCoast.naval.spain = fleet(1);
            return G;
        }};
        const multiplayer = Local();
        const clients = ["0", "1"].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        clients.forEach((client) => client.start());
        try {
            for (let i = 0; i < 4; i++) clients[Number(clients[0].getState()!.ctx.currentPlayer)].moves.endPhaseTurn();
            clients[0].moves.playCard({cardId: card});
            clients[0].moves.moveNaval({fleets: [{from: "istanbul", to: "aegean"}, {from: "algiers", to: "barbaryCoast"}]});
            const locations = new Set<string>();
            for (let i = 0; i < 50; i++) {
                const {G} = clients[0].getState()!;
                if (!G.pendingBattle && !G.pendingIntercept && !G.pendingNavalMoves) break;
                expect(G.powers.ottoman.cp).toBe(remainingCp);
                if (G.pendingIntercept) {
                    clients[Number(ownerOf(G, G.pendingIntercept.defender))].moves.chooseInterception({choice: "done"});
                } else if (G.pendingBattle) {
                    locations.add(G.pendingBattle.location);
                    const client = clients[Number(ownerOf(G, G.pendingBattle.responding))];
                    const options = battleOptions(client.getState()!.G);
                    const option = options.find((entry) => entry.id === "fight" || entry.id === "done") ?? options[0];
                    expect(option).toBeDefined();
                    client.moves.chooseBattle({choice: option.id});
                } else throw new Error("Naval arrival queue stalled without a responder");
            }
            expect([...locations]).toEqual(["aegean", "barbaryCoast"]);
            const {G} = clients[0].getState()!;
            expect(G.pendingBattle).toBeUndefined();
            expect(G.pendingNavalMoves).toBeUndefined();
            expect(G.powers.ottoman.cp).toBe(remainingCp);
            clients[0].moves.endImpulse();
            expect(clients[0].getState()!.ctx.currentPlayer).toBe("1");
        } finally {
            clients.forEach((client) => client.stop());
        }
    });
});
