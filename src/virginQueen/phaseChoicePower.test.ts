import {phaseChoicePower} from "./components/board/helpers";
import {VQGame} from "./constant/general";

const game = (patch: Partial<VQGame>): VQGame => patch as VQGame;

describe("phase-locked mandatory choices", () => {
    it("names the HRE replacement only while the Diplomacy phase accepts it", () => {
        const G = game({pendingHreReplacement: {canRegular: true, canMercs: true, canMarker: true}});
        expect(phaseChoicePower(G, "diplomacy")).toBe("hre");
        expect(phaseChoicePower(G, "cardDraw")).toBeUndefined();
        expect(phaseChoicePower(G, "spring")).toBeUndefined();
        expect(phaseChoicePower(G, "action")).toBeUndefined();
    });

    it("names the Catholic League placement only in Diplomacy", () => {
        const G = game({pendingCatholicLeague: {power: "spain"} as VQGame["pendingCatholicLeague"]});
        expect(phaseChoicePower(G, "diplomacy")).toBe("spain");
        expect(phaseChoicePower(G, "cardDraw")).toBeUndefined();
    });

    it("names the Spring choices only in Spring", () => {
        const orange = game({orangeArrivalPending: true});
        expect(phaseChoicePower(orange, "spring")).toBe("protestant");
        expect(phaseChoicePower(orange, "cardDraw")).toBeUndefined();
        const arrival = game({navalLeaderArrivals: [{power: "spain", leader: "alba", ports: ["cadiz"]}]} as Partial<VQGame>);
        expect(phaseChoicePower(arrival, "spring")).toBe("spain");
        expect(phaseChoicePower(arrival, "diplomacy")).toBeUndefined();
    });

    it("names nothing when no phase-locked choice is pending", () => {
        expect(phaseChoicePower(game({}), "diplomacy")).toBeUndefined();
        expect(phaseChoicePower(game({}), "spring")).toBeUndefined();
    });
});
