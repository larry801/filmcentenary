import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {setupGame} from "./util";

/**
 * Run the real game reducer with the diplomacy phase already active, so the
 * temporary dealOffer/dealResponse stages are exercised exactly as they are
 * online rather than only through direct move calls.
 */
const makeGame = () => ({
    ...VirginQueenGameDef,
    seed: "vq-negotiation-stage",
    setup: (ctx: Ctx): VQGame => {
        const G = setupGame(ctx);
        G.powers.france.cards = ["vq-020"];
        G.powers.spain.cards = [];
        return G;
    },
    phases: {
        ...VirginQueenGameDef.phases!,
        cardDraw: {...VirginQueenGameDef.phases!.cardDraw, start: false},
        diplomacy: {...VirginQueenGameDef.phases!.diplomacy, start: true},
    },
});

const clients = () => {
    const game = makeGame();
    const multiplayer = Local();
    return [0, 1, 2, 3, 4, 5].map((id) =>
        Client({game, multiplayer, numPlayers: 6, playerID: String(id)}));
};

describe("negotiation stages in the running game", () => {
    it("lets the target respond out of turn, then resumes the proposer's diplomacy turn", () => {
        const all = clients();
        all.forEach((client) => client.start());
        // Ottoman, Spain, England end their diplomacy turns; France is active.
        all[0].moves.endPhaseTurn();
        all[1].moves.endPhaseTurn();
        all[2].moves.endPhaseTurn();
        const active = all[3].getState()!;
        expect(active.ctx.currentPlayer).toBe("3");
        expect(active.G.activePower).toBe("france");

        all[3].moves.proposeDeal({
            target: "spain",
            terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
            promises: [{from: "france", text: "A private promise"}],
        });

        const open = all[1].getState()!;
        expect(open.G.negotiation!.offer).toMatchObject({id: "deal-1", from: "france", to: "spain"});
        expect(open.ctx.activePlayers).toEqual({"3": "dealOffer", "1": "dealResponse"});
        // Only the two parties are active in their temporary stages.
        expect(open.ctx.currentPlayer).toBe("3");

        all[1].moves.respondDeal({offerId: "deal-1", action: "accept"});

        const closed = all[3].getState()!;
        expect(closed.G.negotiation!.offer).toBeNull();
        expect(closed.G.negotiation!.history).toHaveLength(1);
        // France's own hand is visible; Spain's hand is hidden but its count is public.
        expect(closed.G.powers.france.cards).toEqual([]);
        expect(closed.G.handCounts!.spain).toBe(1);
        expect(closed.ctx.activePlayers).toBeNull();
        expect(closed.ctx.currentPlayer).toBe("3");
        // Move args are redacted for everyone but the actor, so the private
        // terms and promise never reach the other negotiating client.
        const responderLog = JSON.stringify(all[1].getState()!.log);
        expect(responderLog).not.toContain("vq-020");
        expect(responderLog).not.toContain("A private promise");
        // The proposer can continue the same diplomacy turn after the response.
        all[3].moves.proposeDeal({
            target: "hre",
            terms: [{kind: "alliance"}],
        });
        expect(all[3].getState()!.G.negotiation!.offer).toMatchObject({id: "deal-2", to: "hre"});
    });
});
