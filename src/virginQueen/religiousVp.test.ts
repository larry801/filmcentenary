import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACE_BY_ID} from "./mapData";
import {religiousSpecialVp, setupGame} from "./util";

const fakeCtx = (): Ctx => ({
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (a: any[]) => a},
} as unknown as Ctx);

const gameAt = (spaces: number): VQGame => {
    const G = setupGame(fakeCtx());
    G.protestantSpacesStart = spaces;
    G.protestantSpacesMapAtStart = 0;
    // Keep mapProtestantSpaceCount at zero so the printed track value is exact.
    for (const space of Object.values(G.spaces)) space.religion = "catholic";
    return G;
};

describe("Protestant Spaces special VP (2024 PAC)", () => {
    it("matches the printed Special VP by Power rows", () => {
        const cases: [number, number, number, number][] = [
            // spaces, Spain, England, Protestant
            [18, 6, 0, 1],
            [22, 5, 1, 2],
            [30, 3, 2, 4],
            [38, 2, 2, 5],
            [45, 0, 3, 7],
            [50, 0, 3, 7],
        ];
        for (const [spaces, spain, england, protestant] of cases) {
            const G = gameAt(spaces);
            expect([religiousSpecialVp(G, "spain"), religiousSpecialVp(G, "england"),
                religiousSpecialVp(G, "protestant")]).toEqual([spain, england, protestant]);
        }
    });
});

describe("Scenario Book key classification", () => {
    it("treats every printed square-control space as a key", () => {
        // Campaign/Tournament setup lines that print SCM/scm.
        for (const id of ["barcelona", "seville", "malta", "calais", "rouen", "marseille",
            "bristol", "augsburg", "frankfurt", "athens", "algiers"]) {
            expect(SPACE_BY_ID[id]?.kind).toBe("key");
        }
    });

    it("does not count reconstruction-only Edirne as a key", () => {
        expect(SPACE_BY_ID.edirne?.kind).toBe("fortress");
    });
});
