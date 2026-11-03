import {Ctx} from "boardgame.io";
import {RoyalDef, VQGame} from "./constant/general";
import {playCard} from "./moves";
import {resolveMarriages, setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const royal = (id: string, power: RoyalDef["power"], gender: "male" | "female"): RoyalDef => ({
    id, name: id, power, gender, eligibility: 0, alive: true, married: false, status: "available",
});

describe("Gouvernante de France (card #33)", () => {
    it("places the +2 Wedding Festivities marker and draws a card", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-033")) G.powers.france.cards.push("vq-033");
        const male = royal("henryIII", "france", "male");
        const female = royal("fg", "england", "female");
        G.royals = G.royals.filter((r) => r.id !== male.id && r.id !== female.id);
        G.royals.push(male, female);
        G.betrothals = [{male: male.id, female: female.id}];
        const hand = G.powers.france.cards.length;

        expect(playCard(G, context([6]), {cardId: "vq-033", asEvent: true})).toBeUndefined();

        expect(G.marriageFestivities).toBe("france");
        expect(G.powers.france.cards.length).toBe(hand);
    });

    it("applies +2 to the French marriage roll", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-033")) G.powers.france.cards.push("vq-033");
        const male = royal("henryIII", "france", "male");
        const female = royal("fg2", "england", "female");
        G.royals = G.royals.filter((r) => r.id !== male.id && r.id !== female.id);
        G.royals.push(male, female);
        G.betrothals = [{male: male.id, female: female.id}];
        playCard(G, context([6]), {cardId: "vq-033", asEvent: true});

        resolveMarriages(G, context([4, 3]));

        expect(G.marriageFestivities).toBeUndefined();
        expect(G.lastRolls).toContain("9");
        expect(male.married).toBe(false);
        expect(female.married).toBe(false);
    });
});
