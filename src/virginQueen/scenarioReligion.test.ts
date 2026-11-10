import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SCENARIOS} from "./data/scenarios";
import {SPACES, SPACE_BY_ID} from "./mapData";
import {mapProtestantSpaceCount, protestantSpaceCount, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/**
 * The Scenario Book prints control markers in upper case (Catholic side) and
 * lower case (Protestant side).  The data must carry that side as the starting
 * religion; otherwise London, Augsburg and the Huguenot strongholds all begin
 * Catholic and the map disagrees with the scenario book.
 */
describe("scenario control-marker sides", () => {
    it("starts the Campaign's lower-case markers Protestant", () => {
        const G: VQGame = setupGame(context(), {scenario: "campaign"});
        expect(G.spaces.london.religion).toBe("protestant");
        expect(G.spaces.bristol.religion).toBe("protestant");
        expect(G.spaces.york.religion).toBe("protestant");
        expect(G.spaces.ghent.religion).toBe("protestant");
        expect(G.spaces.rouen.religion).toBe("protestant");
        expect(G.spaces.laRochelle.religion).toBe("protestant");
        expect(G.spaces.nantes.religion).toBe("protestant");
        expect(G.spaces.amboise.religion).toBe("protestant");
        expect(G.spaces.perth.religion).toBe("protestant");
        expect(G.spaces.augsburg.religion).toBe("protestant");
        expect(G.spaces.frankfurt.religion).toBe("protestant");
        // Upper-case markers stay Catholic.
        expect(G.spaces.paris.religion).toBe("catholic");
        expect(G.spaces.madrid.religion).toBe("catholic");
        expect(G.spaces.edinburgh.religion).toBe("catholic");
        // The printed Protestant Spaces track is independent of the map count.
        expect(protestantSpaceCount(G)).toBe(18);
    });

    it("places the Campaign's Orleans regular", () => {
        const G: VQGame = setupGame(context(), {scenario: "campaign"});
        expect(G.spaces.orleans.land.france?.regular).toBe(1);
    });

    it("treats every French home space and Metz as part of the France religious area", () => {
        // Rule 18.5's worked example converts Paris and Dijon; the French home
        // spaces are also the area used by the Catholic League (20.10).
        for (const id of ["paris", "rouen", "amiens", "dijon", "marseille", "bordeaux", "nantes", "brest", "calais", "metz"]) {
            expect(SPACE_BY_ID[id]?.area).toBe("france");
        }
        for (const space of SPACES) {
            if (space.home === "france" || space.id === "metz") {
                expect(space.area).toBe("france");
            }
        }
        const G: VQGame = setupGame(context(), {scenario: "campaign"});
        expect(mapProtestantSpaceCount(G)).toBe(9);
        expect(protestantSpaceCount(G)).toBe(18);
        const T: VQGame = setupGame(context(), {scenario: "tournament"});
        expect(mapProtestantSpaceCount(T)).toBe(21);
        expect(protestantSpaceCount(T)).toBe(30);
    });

    it("keeps a Chinese variant for every setup note", () => {
        for (const scenario of Object.values(SCENARIOS)) {
            if (scenario.notes === undefined) continue;
            expect(scenario.notesZh).toHaveLength(scenario.notes.length);
        }
    });

    it("starts the Tournament's lower-case markers Protestant", () => {
        const G: VQGame = setupGame(context(), {scenario: "tournament"});
        expect(G.spaces.amsterdam.religion).toBe("protestant");
        expect(G.spaces.alkmaar.religion).toBe("protestant");
        expect(G.spaces.brielle.religion).toBe("protestant");
        expect(G.spaces.flushing.religion).toBe("protestant");
        expect(G.spaces.london.religion).toBe("protestant");
        expect(G.spaces.rennes.religion).toBe("protestant");
        expect(G.spaces.poitiers.religion).toBe("protestant");
        expect(G.spaces.avignon.religion).toBe("protestant");
        expect(G.spaces.augsburg.religion).toBe("protestant");
        expect(G.spaces.frankfurt.religion).toBe("protestant");
        // Huguenot-controlled spaces keep Protestant control and religion.
        expect(G.spaces.laRochelle.control).toBe("protestant");
        expect(G.spaces.laRochelle.religion).toBe("protestant");
        expect(G.spaces.cognac.religion).toBe("protestant");
        expect(G.spaces.toulouse.religion).toBe("protestant");
        expect(G.spaces.edinburgh.religion).toBe("protestant");
        expect(G.spaces.stirling.religion).toBe("protestant");
        // Upper-case markers stay Catholic.
        expect(G.spaces.haarlem.religion).toBe("catholic");
        expect(G.spaces.ghent.religion).toBe("catholic");
        expect(G.spaces.glasgow.religion).toBe("catholic");
        expect(protestantSpaceCount(G)).toBe(30);
    });
});
