import {Ctx} from "boardgame.io";
import {RoyalDef, VQGame} from "./constant/general";
import {playCard, rebellion} from "./moves";
import {resolveMarriages, setWar, setupGame} from "./util";

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

    it("can retrieve Grand Tour instead of drawing", () => {
        const G = game();
        if (!G.powers.france.cards.includes("vq-033")) G.powers.france.cards.push("vq-033");
        const male = royal("henryIII", "france", "male");
        const female = royal("fg3", "england", "female");
        G.royals = G.royals.filter((r) => r.id !== male.id && r.id !== female.id);
        G.royals.push(male, female);
        G.betroths = undefined;
        G.betrothals = [{male: male.id, female: female.id}];
        G.discard = ["vq-053"];

        expect(playCard(G, context([6]), {cardId: "vq-033", asEvent: true, target: "retrieve"})).toBeUndefined();

        expect(G.marriageFestivities).toBe("france");
        expect(G.powers.france.cards).toContain("vq-053");
    });

    it("uses option 2 when France is at war with the Protestant and short on cards", () => {
        const G = game();
        setWar(G, "france", "protestant");
        G.powers.france.cards = ["vq-033", "vq-020"];
        G.spaces.orleans.control = "protestant";
        G.spaces.orleans.religion = "protestant";
        G.spaces.bourges.control = "protestant";
        G.spaces.bourges.religion = "protestant";

        expect(playCard(G, context([6]), {cardId: "vq-033", asEvent: true})).toBeUndefined();

        expect(G.protestantRebellionBlockedTurn).toBe(G.year);
        expect(G.spaces.orleans.control).toBe("france");
        expect(G.spaces.orleans.religion).toBe("catholic");
        expect(rebellion(G, {currentPlayer: "5", playerID: "5", phase: "action", numPlayers: 6,
            random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards}} as never, {space: "orleans", cp: 2})).toBeDefined();
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
