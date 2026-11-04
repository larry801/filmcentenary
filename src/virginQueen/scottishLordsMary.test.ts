import {Ctx} from "boardgame.io";
import {RoyalDef, VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const ensureMary = (G: VQGame): RoyalDef => {
    let mary = G.royals.find((royal) => royal.id === "maryScots");
    if (mary === undefined) {
        mary = {id: "maryScots", name: "Mary", power: "france", gender: "female",
            alive: true, married: false, status: "available"};
        G.royals.push(mary);
    }
    return mary;
};

/** Give card #74 to Spain and rig the Scottish track so `winner` takes the check. */
const prepareScottishWin = (G: VQGame, winner: "england" | "france" | "protestant"): void => {
    G.powers.spain.cards = ["vq-074"];
    G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "scotland");
    for (const power of ["england", "france", "protestant"] as const) G.powers[power].influence.scotland = 0;
    G.powers[winner].influence.scotland = 9;
    for (const space of SPACES.filter((s) => s.area === "scotland")) {
        G.spaces[space.id].land = {};
        G.spaces[space.id].control = "scotland";
    }
};

describe("Scottish Lords Rebel (card #74) Mary status on the winner path", () => {
    it("captures Mary when England wins the Scottish check", () => {
        const G = game();
        const mary = ensureMary(G);
        prepareScottishWin(G, "england");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.espionage?.mary).toBe("captured");
        expect(mary.status).toBe("captured");
    });

    it("captures Mary when the Protestant wins the Scottish check", () => {
        const G = game();
        const mary = ensureMary(G);
        prepareScottishWin(G, "protestant");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.espionage?.mary).toBe("captured");
        expect(mary.status).toBe("captured");
    });

    it("leaves Mary alive in Scotland when France wins the Scottish check", () => {
        const G = game();
        const mary = ensureMary(G);
        mary.alive = true;
        prepareScottishWin(G, "france");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        // A French result never captures Mary: she simply stays where she was.
        expect(G.espionage?.mary).toBe("scotland");
        expect(mary.status).not.toBe("captured");
    });

    it("does not un-capture an already captured Mary when France wins", () => {
        const G = game();
        const mary = ensureMary(G);
        G.espionage!.mary = "captured";
        mary.status = "captured";
        prepareScottishWin(G, "france");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.espionage?.mary).toBe("captured");
        expect(mary.status).toBe("captured");
    });

    it("leaves a dead Mary dead even when England wins", () => {
        const G = game();
        const mary = ensureMary(G);
        G.espionage!.mary = "dead";
        mary.alive = false;
        mary.status = "dead";
        prepareScottishWin(G, "england");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.espionage?.mary).toBe("dead");
        expect(mary.status).toBe("dead");
    });
});
