import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (numPlayers: number, playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** Two-player campaign: the HRE is a non-player major power with an influence track. */
const twoPlayerGame = (): VQGame => {
    const G = setupGame(context(2, "0"));
    G.activePower = "spain";
    G.powers.spain.cards = ["vq-024"];
    G.powers.spain.cardPlayed = false;
    G.majorInfluence!.hre!.spain = 0;
    G.majorDiplomacyResolved = [];
    G.minorDiplomacyResolved = [];
    return G;
};

describe("Holy League with the non-player HRE (card #24)", () => {
    it("gives all four influence to the non-player HRE and resolves its diplomacy", () => {
        const G = twoPlayerGame();
        const papacy = G.powers.spain.influence.papacy ?? 0;
        const venice = G.powers.spain.influence.venice ?? 0;

        expect(playCard(G, context(2, "0"), {cardId: "vq-024", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.majorInfluence!.hre!.spain).toBe(4);
        expect(G.powers.spain.influence.papacy ?? 0).toBe(papacy);
        expect(G.powers.spain.influence.venice ?? 0).toBe(venice);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(G.minorDiplomacyResolved).not.toContain("papacy");
        expect(G.minorDiplomacyResolved).not.toContain("venice");
        expect(G.log.join("\n")).toContain("Holy Roman Empire diplomacy");
    });

    it("splits two and two between the non-player HRE and the Papacy", () => {
        const G = twoPlayerGame();
        G.powers.spain.influence.papacy = 0;

        expect(playCard(G, context(2, "0"), {cardId: "vq-024", asEvent: true, target: "hre:papacy"})).toBeUndefined();

        expect(G.majorInfluence!.hre!.spain).toBe(2);
        expect(G.powers.spain.influence.papacy).toBe(2);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.minorDiplomacyResolved).not.toContain("venice");
    });

    it("does not resolve HRE diplomacy a second time", () => {
        const G = twoPlayerGame();
        G.majorDiplomacyResolved = ["hre"];

        expect(playCard(G, context(2, "0"), {cardId: "vq-024", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.majorInfluence!.hre!.spain).toBe(4);
        expect(G.majorDiplomacyResolved).toEqual(["hre"]);
        expect(G.log.join("\n")).not.toContain("Holy Roman Empire diplomacy");
    });

    it("falls back to the Papacy and Venice when the HRE is player-controlled", () => {
        const G = twoPlayerGame();
        G.playerPowers!["0"].push("hre");
        G.powers.spain.influence.papacy = 0;
        G.powers.spain.influence.venice = 0;

        expect(playCard(G, context(2, "0"), {cardId: "vq-024", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.majorInfluence!.hre!.spain).toBe(0);
        expect(G.majorDiplomacyResolved).not.toContain("hre");
        expect(G.powers.spain.influence.papacy).toBe(2);
        expect(G.powers.spain.influence.venice).toBe(2);
        expect(G.minorDiplomacyResolved).toEqual(expect.arrayContaining(["papacy", "venice"]));
    });

    it("falls back to the Papacy and Venice in a six-player game with an HRE player", () => {
        const G = setupGame(context(6, "1"));
        G.powers.spain.cards = ["vq-024"];
        G.powers.spain.influence.papacy = 0;
        G.powers.spain.influence.venice = 0;
        G.minorDiplomacyResolved = [];

        expect(playCard(G, context(6, "1"), {cardId: "vq-024", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.majorInfluence).toBeUndefined();
        expect(G.powers.spain.influence.papacy).toBe(2);
        expect(G.powers.spain.influence.venice).toBe(2);
        expect(G.minorDiplomacyResolved).toEqual(expect.arrayContaining(["papacy", "venice"]));
    });
});
