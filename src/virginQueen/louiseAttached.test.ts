import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {acceptBetroth, playCard, proposeBetroth, rejectBetroth} from "./moves";
import {resolveMarriages, setupGame, winter} from "./util";

/** Dice are returned in order; the default keeps other rolls deterministic. */
const context = (currentPlayer = "3", phase = "action", dice: number[] = []): Ctx => ({
    currentPlayer,
    playerID: currentPlayer,
    phase,
    numPlayers: 6,
    random: {Die: () => dice.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context("3", "action") as Ctx);

const franceDiplomacy = (dice: number[] = []): Ctx => context("3", "diplomacy", dice);
const spainDiplomacy = (): Ctx => context("1", "diplomacy");

const playLouise = (G: VQGame): void => {
    G.powers.france.cards = ["vq-095"];
    G.royals = G.royals.filter((royal) => royal.id !== "louiseLorraine");
    expect(playCard(G, franceDiplomacy(), {cardId: "vq-095", asEvent: true})).toBeUndefined();
};

describe("Louise of Lorraine attached marriage (#95)", () => {
    it("records Louise as attached to the playing power during diplomacy", () => {
        const G = game();

        playLouise(G);

        const louise = G.royals.find((royal) => royal.id === "louiseLorraine");
        expect(G.louiseAttachment).toEqual({power: "france", available: true});
        expect(louise?.power).toBe("france");
        expect(louise?.status).toBe("available");
        expect(G.removed).toContain("vq-095");
    });

    it("lets another power marry Louise and consumes the attachment on confirmation", () => {
        const G = game();
        playLouise(G);

        // Spain controls the male royal; the card-playing power (France) confirms.
        expect(proposeBetroth(G, spainDiplomacy(), {male: "donCarlos", female: "louiseLorraine"})).toBeUndefined();
        expect(G.pendingBetrothal).toMatchObject({
            male: "donCarlos", female: "louiseLorraine", proposer: "spain", target: "france", louiseAttached: true,
        });
        expect(G.louiseAttachment).toEqual({power: "france", available: true});

        // A rejected proposal leaves Louise available for another attempt.
        expect(rejectBetroth(G, franceDiplomacy())).toBeUndefined();
        expect(G.louiseAttachment).toEqual({power: "france", available: true});

        expect(proposeBetroth(G, spainDiplomacy(), {male: "donCarlos", female: "louiseLorraine"})).toBeUndefined();
        expect(acceptBetroth(G, franceDiplomacy())).toBeUndefined();

        expect(G.betrothals).toEqual([{male: "donCarlos", female: "louiseLorraine", louiseAttached: true}]);
        expect(G.pendingBetrothal).toBeNull();
        expect(G.louiseAttachment).toEqual({power: "france", available: false});
    });

    it("uses the playing power as Louise's royal in the wedding roll", () => {
        const G = game();
        playLouise(G);
        proposeBetroth(G, spainDiplomacy(), {male: "donCarlos", female: "louiseLorraine"});
        acceptBetroth(G, franceDiplomacy());

        // Don Carlos rerolls the highest die (5 -> 5).  Louise counts as the
        // card-playing power's royal, so the higher eligibility (2) is used:
        // 5 + 5 + 2 = 12 -> a +1 Card marker for both powers involved.
        resolveMarriages(G, context("1", "action", [5, 5, 5]));

        expect(G.lastRolls).toBe("Marriage roll: 5+5+2=12");
        expect(G.powers.france.marriageCardModifier).toBe(1);
        expect(G.powers.spain.marriageCardModifier).toBe(1);
        expect(G.royals.find((royal) => royal.id === "louiseLorraine")?.married).toBe(true);
    });

    it("clears an unused attachment at the winter reset", () => {
        const G = game();
        playLouise(G);
        expect(G.louiseAttachment).toEqual({power: "france", available: true});

        winter(G, context("3", "action", [3, 3, 3, 3]));

        expect(G.louiseAttachment).toBeUndefined();
        expect(G.removed).toContain("vq-095");
    });
});
