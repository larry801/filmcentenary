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

describe("Scottish Lords Rebel (card #74) without a diplomacy winner", () => {
    it("leaves control and non-Scottish units alone but still replaces the Scottish army", () => {
        const G = game();
        G.powers.spain.cards = ["vq-074"];
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "scotland");
        // Block every competing power so resolveMinorDiplomacy has no candidates.
        for (const power of ["england", "france", "protestant"] as const) {
            G.powers[power].influence.scotland = 0;
            G.minorInfluenceBlocked[power] = ["scotland"];
        }

        for (const space of scottishSpaces()) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].naval = {};
            G.spaces[space.id].control = "scotland";
        }
        // Mixed controllers and units: none of these may move without a winner.
        G.spaces.edinburgh.control = "england";
        G.spaces.edinburgh.land.england = {regular: 2, merc: 0, cav: 0};
        G.spaces.edinburgh.land.scotland = {regular: 3, merc: 1, cav: 0};
        G.spaces.edinburgh.naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.spaces.glasgow.control = "spain";
        G.spaces.glasgow.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.glasgow.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.spaces.stirling.control = "france";
        G.spaces.stirling.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.aberdeen.land.scotland = {regular: 2, merc: 0, cav: 0};
        // A Scottish unit outside Scotland is removed as well (the card says
        // "all Scottish land units", not only those in Scotland).
        G.spaces.york.control = "england";
        G.spaces.york.land = {scotland: {regular: 1, merc: 0, cav: 0}, england: {regular: 1, merc: 0, cav: 0}};

        const controlsBefore = Object.fromEntries(scottishSpaces().map((space) => [space.id, G.spaces[space.id].control]));
        const englishLandBefore = totalLand(G, "england");
        const frenchLandBefore = totalLand(G, "france");
        const spanishLandBefore = totalLand(G, "spain");
        const englishNavalBefore = totalNaval(G, "england");
        const spanishNavalBefore = totalNaval(G, "spain");

        expect(playCard(G, context(), {cardId: "vq-074", asEvent: true})).toBeUndefined();

        // No control changes and no displacement of non-Scottish units.
        for (const space of scottishSpaces()) expect(G.spaces[space.id].control).toBe(controlsBefore[space.id]);
        expect(G.spaces.edinburgh.land.england?.regular).toBe(2);
        expect(G.spaces.edinburgh.naval.england?.galley).toBe(1);
        expect(G.spaces.glasgow.land.spain?.regular).toBe(1);
        expect(G.spaces.glasgow.naval.spain?.galley).toBe(1);
        expect(G.spaces.stirling.land.france?.regular).toBe(2);
        expect(totalLand(G, "england")).toBe(englishLandBefore);
        expect(totalLand(G, "france")).toBe(frenchLandBefore);
        expect(totalLand(G, "spain")).toBe(spanishLandBefore);
        expect(totalNaval(G, "england")).toBe(englishNavalBefore);
        expect(totalNaval(G, "spain")).toBe(spanishNavalBefore);

        // Step 4 is unconditional: all Scottish land units are removed and
        // exactly two regulars are placed in Edinburgh.
        expect(totalLand(G, "scotland")).toBe(2);
        expect(G.spaces.edinburgh.land.scotland).toEqual({regular: 2, merc: 0, cav: 0});
        for (const space of SPACES) {
            if (space.id !== "edinburgh") expect(G.spaces[space.id].land.scotland).toBeUndefined();
        }
        expect(G.spaces.york.land.scotland).toBeUndefined();
        expect(G.spaces.york.land.england?.regular).toBe(1);

        // No winner means no English/Protestant alliance, so Mary is not
        // captured and her existing "Alive in Scotland" status is untouched.
        expect(G.espionage?.mary).toBe("scotland");
        expect(G.minorDiplomacyResolved).toContain("scotland");
    });
});
