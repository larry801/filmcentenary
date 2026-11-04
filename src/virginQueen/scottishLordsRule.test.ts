import {Ctx} from "boardgame.io";
import {landCount, navalCount, Power, VQGame} from "./constant/general";
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

const scottishSpaces = () => SPACES.filter((space) => space.area === "scotland");

const totalLand = (G: VQGame, power: Power): number =>
    SPACES.reduce((total, space) => total + landCount(G.spaces[space.id].land[power]), 0);

const totalNaval = (G: VQGame, power: Power): number =>
    SPACES.reduce((total, space) => total + navalCount(G.spaces[space.id].naval[power]), 0);

/** Give the card to player 1 (Spain) and make France the clear Scottish winner. */
const prepareFrenchWin = (G: VQGame): void => {
    G.powers.spain.cards = ["vq-074"];
    G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "scotland");
    for (const power of ["england", "france", "protestant"] as const) G.powers[power].influence.scotland = 0;
    G.powers.france.influence.scotland = 9;
};

describe("Scottish Lords Rebel (card #74)", () => {
    it("keeps units of the winner and its allies but withdraws all other units", () => {
        const G = game();
        prepareFrenchWin(G);
        G.powers.france.allies = ["spain"];

        for (const space of scottishSpaces()) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].naval = {};
            G.spaces[space.id].control = "scotland";
        }
        G.spaces.edinburgh.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.edinburgh.land.england = {regular: 3, merc: 1, cav: 1};
        G.spaces.edinburgh.naval.england = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
        G.spaces.glasgow.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.glasgow.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.spaces.glasgow.control = "spain";
        G.spaces.berwick.control = "england";
        G.spaces.berwick.land = {};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.naval = {};
        const englishLandBefore = totalLand(G, "england");
        const englishNavalBefore = totalNaval(G, "england");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        // The winner and its ally remain in place.
        expect(G.spaces.edinburgh.land.france?.regular).toBe(2);
        expect(G.spaces.glasgow.land.spain?.regular).toBe(1);
        expect(G.spaces.glasgow.naval.spain?.galley).toBe(1);

        // The non-allied English force withdraws to friendly space and port
        // instead of being destroyed.
        expect(G.spaces.edinburgh.land.england).toBeUndefined();
        expect(G.spaces.edinburgh.naval.england).toBeUndefined();
        expect(totalLand(G, "england")).toBe(englishLandBefore);
        expect(totalNaval(G, "england")).toBe(englishNavalBefore);
    });

    it("removes every Scottish land unit on the map and puts two regulars in Edinburgh", () => {
        const G = game();
        prepareFrenchWin(G);

        for (const space of scottishSpaces()) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].control = "scotland";
        }
        G.spaces.edinburgh.land.scotland = {regular: 3, merc: 1, cav: 0};
        G.spaces.stirling.land.scotland = {regular: 2, merc: 0, cav: 0};
        G.spaces.york.land.scotland = {regular: 1, merc: 0, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.spaces.edinburgh.land.scotland?.regular).toBe(2);
        expect(G.spaces.edinburgh.land.scotland?.merc).toBe(0);
        expect(G.spaces.stirling.land.scotland).toBeUndefined();
        expect(G.spaces.york.land.scotland).toBeUndefined();
        expect(scottishSpaces().every((space) => G.spaces[space.id].control === "france")).toBe(true);
    });

    it("gives every Scottish space to the winner even when diplomacy leaves one behind", () => {
        const G = game();
        G.powers.spain.cards = ["vq-074"];
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "scotland");
        for (const power of ["england", "france", "protestant"] as const) G.powers[power].influence.scotland = 0;
        G.powers.england.influence.scotland = 9;
        G.powers.france.alliedMinors = ["scotland"];
        for (const space of scottishSpaces()) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].control = "france";
        }
        // Spain is not eligible to activate Scotland, so the ordinary status
        // check deliberately leaves this space alone.
        G.spaces.glasgow.control = "spain";

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        expect(G.powers.france.alliedMinors).not.toContain("scotland");
        expect(scottishSpaces().every((space) => G.spaces[space.id].control === "england")).toBe(true);
    });
});
