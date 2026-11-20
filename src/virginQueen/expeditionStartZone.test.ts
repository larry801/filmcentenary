import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {buildExpedition} from "./moves";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

/**
 * Rule 17.4: "English, French, Holy Roman or Protestant sea captain: Place the
 * sea captain in the North Atlantic or Guinea Coast ocean zone on its Undamaged
 * (front) side."  The Ottoman has no choice: it always enters at the Indian
 * Ocean (Damaged until the Suez Canal is built).
 */
describe("expedition departure zone (rule 17.4)", () => {
    it("lets England launch from the Guinea Coast", () => {
        const G = game();
        G.powers.england.seaCaptains = ["hawkins"];
        G.powers.england.cp = 3;

        expect(buildExpedition(G, context("2"), {captain: "hawkins", zone: "guineaCoast"})).toBeUndefined();
        expect(G.worldCaptains.hawkins.location).toBe("guineaCoast");
        expect(G.worldCaptains.hawkins.route).toEqual(["guineaCoast"]);
    });

    it("defaults to the North Atlantic when no zone is supplied", () => {
        const G = game();
        G.powers.england.seaCaptains = ["hawkins"];
        G.powers.england.cp = 3;

        expect(buildExpedition(G, context("2"), {captain: "hawkins"})).toBeUndefined();
        expect(G.worldCaptains.hawkins.location).toBe("northAtlantic");
    });

    it("ignores a zone outside the printed pair", () => {
        const G = game();
        G.powers.england.seaCaptains = ["hawkins"];
        G.powers.england.cp = 3;

        expect(buildExpedition(G, context("2"), {captain: "hawkins", zone: "indianOcean"})).toBeUndefined();
        expect(G.worldCaptains.hawkins.location).toBe("northAtlantic");
    });

    it("keeps the Ottoman pinned to the Indian Ocean", () => {
        const G = game();
        G.powers.ottoman.seaCaptains = ["muratReis"];
        G.powers.ottoman.cp = 3;

        expect(buildExpedition(G, context("0"), {captain: "muratReis", zone: "guineaCoast"})).toBeUndefined();
        expect(G.worldCaptains.muratReis.location).toBe("indianOcean");
        // Ottoman expeditions start on the Damaged side until Suez is built.
        expect(G.worldCaptains.muratReis.damaged).toBe(true);
    });
});
