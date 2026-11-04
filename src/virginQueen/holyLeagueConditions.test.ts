import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (numPlayers = 6, currentPlayer = "3"): Ctx => ({
    currentPlayer,
    playerID: currentPlayer,
    phase: "action",
    numPlayers,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const campaign = (numPlayers = 6, currentPlayer = "3"): VQGame =>
    setupGame(context(numPlayers, currentPlayer));

/** The Campaign scenario starts the Ottoman at 11 VP; #24 requires 13+. */
const raiseOttomanVp = (G: VQGame): void => {
    G.powers.ottoman.bonusVp += 2;
};

const eventArgs = (target?: string) => ({
    cardId: "vq-024",
    asEvent: true as const,
    ...(target !== undefined ? {target} : {}),
});

describe("Holy League (card #24) play conditions", () => {
    it("rejects the event while the Ottoman has fewer than 13 VP", () => {
        const G = campaign();
        G.powers.france.cards = ["vq-024"];
        G.powers.ottoman.bonusVp += 1; // 12 VP

        expect(playCard(G, context(), eventArgs("papacy"))).toBe(INVALID_MOVE);

        expect(G.powers.france.cards).toContain("vq-024");
        expect(G.powers.france.cardPlayed).toBe(false);
    });

    it("allows the event when the Ottoman has exactly 13 VP", () => {
        const G = campaign();
        G.powers.france.cards = ["vq-024"];
        G.powers.france.influence.papacy = 0;
        raiseOttomanVp(G);

        expect(playCard(G, context(), eventArgs("papacy"))).toBeUndefined();

        expect(G.powers.france.cardPlayed).toBe(true);
        expect(G.powers.france.influence.papacy).toBeGreaterThanOrEqual(4);
        expect(G.minorDiplomacyResolved).toContain("papacy");
    });

    it("rejects a power that cannot influence any of the three tracks", () => {
        // In a six-player game there is no non-player HRE track, and England
        // is not listed on either the Papacy or Venice influence track.
        const G = campaign(6, "2");
        G.powers.england.cards = ["vq-024"];
        raiseOttomanVp(G);

        expect(playCard(G, context(6, "2"), eventArgs("venice"))).toBe(INVALID_MOVE);

        expect(G.powers.england.cards).toContain("vq-024");
        expect(G.powers.england.cardPlayed).toBe(false);
    });

    it("rejects the event when every available track was already resolved", () => {
        const G = campaign();
        G.powers.france.cards = ["vq-024"];
        raiseOttomanVp(G);
        G.minorDiplomacyResolved = ["papacy", "venice"];

        expect(playCard(G, context(), eventArgs("papacy"))).toBe(INVALID_MOVE);
    });

    it("allows the event while at least one available track is unresolved", () => {
        const G = campaign();
        G.powers.france.cards = ["vq-024"];
        G.powers.france.influence.venice = 0;
        raiseOttomanVp(G);
        G.minorDiplomacyResolved = ["papacy"];

        expect(playCard(G, context(), eventArgs("venice"))).toBeUndefined();

        expect(G.powers.france.influence.venice).toBeGreaterThanOrEqual(4);
        expect(G.minorDiplomacyResolved).toContain("venice");
    });

    it("counts an unresolved non-player HRE track as potential influence", () => {
        const G = campaign(2, "0");
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-024"];
        G.powers.spain.influence.papacy = 0;
        G.powers.spain.influence.venice = 0;
        G.majorInfluence!.hre!.spain = 0;
        G.majorDiplomacyResolved = [];
        raiseOttomanVp(G);
        G.minorDiplomacyResolved = ["papacy", "venice"];

        expect(playCard(G, context(2, "0"), eventArgs("hre"))).toBeUndefined();

        expect(G.majorInfluence!.hre!.spain).toBe(4);
        expect(G.majorDiplomacyResolved).toContain("hre");
    });

    it("does not count the HRE track while the HRE is player-controlled", () => {
        const G = campaign(2, "0");
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-024"];
        G.playerPowers!["0"].push("hre");
        raiseOttomanVp(G);
        G.minorDiplomacyResolved = ["papacy", "venice"];

        expect(playCard(G, context(2, "0"), eventArgs("hre"))).toBe(INVALID_MOVE);
    });

    it("does not count an already-resolved non-player HRE track", () => {
        const G = campaign(2, "0");
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-024"];
        raiseOttomanVp(G);
        G.minorDiplomacyResolved = ["papacy", "venice"];
        G.majorDiplomacyResolved = ["hre"];

        expect(playCard(G, context(2, "0"), eventArgs("hre"))).toBe(INVALID_MOVE);
    });

    it("uses the Ottoman's Venice eligibility but not the Papacy", () => {
        const withPapacyResolved = campaign(6, "0");
        withPapacyResolved.powers.ottoman.cards = ["vq-024"];
        raiseOttomanVp(withPapacyResolved);
        withPapacyResolved.minorDiplomacyResolved = ["papacy"];

        expect(playCard(withPapacyResolved, context(6, "0"), eventArgs("venice"))).toBeUndefined();

        const withVeniceResolved = campaign(6, "0");
        withVeniceResolved.powers.ottoman.cards = ["vq-024"];
        raiseOttomanVp(withVeniceResolved);
        withVeniceResolved.minorDiplomacyResolved = ["venice"];

        expect(playCard(withVeniceResolved, context(6, "0"), eventArgs("papacy"))).toBe(INVALID_MOVE);
    });

    it("still allows the card to be played for command points under the same state", () => {
        const G = campaign(6, "2");
        G.powers.england.cards = ["vq-024"];
        // Ottoman remains at 11 VP and England has no potential influence.
        expect(playCard(G, context(6, "2"), {cardId: "vq-024"})).toBeUndefined();

        expect(G.powers.england.cp).toBe(5);
        expect(G.powers.england.cards).not.toContain("vq-024");
    });
});
