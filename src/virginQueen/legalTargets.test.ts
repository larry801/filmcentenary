import {Ctx} from "boardgame.io";
import {landCount, navalCount, spaceHomes, VQGame} from "./constant/general";
import {isInlandPort, SPACE_BY_ID} from "./mapData";
import {
    canControlSpace,
    friendlyControlled,
    isPort,
    landNeighbors,
    legalTargets,
    navalAdjacent,
    rebellionTargets,
    setupGame,
    spaceHasEnemyLand,
} from "./util";

const fakeCtx = (): Ctx => ({
    random: {
        Die: () => 3,
        Shuffle: (a: any[]) => a,
    },
} as unknown as Ctx);

/** Six-player campaign; Spain is made the acting power for the tests. */
const campaign = (): VQGame => setupGame({...fakeCtx(), numPlayers: 6});

const activeSpain = (cp = 0): VQGame => {
    const G = campaign();
    G.activePower = "spain";
    G.powers.spain.cp = cp;
    return G;
};

describe("legalTargets", () => {
    it("returns nothing for inspect, an undefined power, or a non-active power", () => {
        const G = activeSpain(10);
        expect(legalTargets(G, "spain", "inspect")).toEqual(new Set());
        expect(legalTargets(G, undefined, "recruitRegular")).toEqual(new Set());
        expect(legalTargets(G, "england", "recruitRegular")).toEqual(new Set());
        expect(legalTargets(G, "spain", "notAMode")).toEqual(new Set());
    });

    it("recruitRegular highlights only legal home spaces for the active power", () => {
        const G = activeSpain(5);
        const targets = legalTargets(G, "spain", "recruitRegular");

        // Rule 17.2: Madrid is a controlled Spanish home space.
        expect(targets).toContain("madrid");
        // Rule 17.2 exceptions: Spain may not recruit in Oran or Malta.
        expect(targets).not.toContain("oran");
        expect(targets).not.toContain("malta");

        // Every highlighted space is an uncontested home space (own or an
        // allied minor's) with no enemy land units.
        expect([...targets].every((id) => {
            const s = G.spaces[id];
            const homes = spaceHomes(SPACE_BY_ID[id]);
            const ownOrAllyHome = homes.includes("spain") ||
                homes.some((home) => G.powers.spain.alliedMinors.includes(home as never));
            return ownOrAllyHome && !s.unrest && !spaceHasEnemyLand(G, "spain", id);
        })).toBe(true);

        // Valencia is a controlled, empty Spanish home space: legal before the
        // controller changes (control is what matters, not the garrison).
        expect(targets).toContain("valencia");
        G.spaces.valencia.control = "ottoman";
        expect(legalTargets(G, "spain", "recruitRegular")).not.toContain("valencia");

        // Pamplona is also a Spanish home; a besieging Ottoman army (Spain is
        // at war with the Ottomans) blocks recruitment there.
        expect(targets).toContain("pamplona");
        G.spaces.pamplona.land.ottoman = {regular: 1, merc: 0, cav: 0};
        G.spaces.pamplona.siege = {by: "ottoman", sinceImpulse: G.impulse};
        const afterSiege = legalTargets(G, "spain", "recruitRegular");
        expect(afterSiege).not.toContain("pamplona");
        expect(afterSiege).toContain("madrid");
    });

    it("moveLand returns origins without from and only legal destinations with from", () => {
        const G = activeSpain(1);
        G.spaces.barcelona.land.spain = {regular: 1, merc: 0, cav: 0};

        // Origins: spaces where Spain (or an ally) has land units.
        const origins = legalTargets(G, "spain", "moveLand");
        expect(origins).toContain("barcelona");
        expect(origins).toContain("madrid");
        expect([...origins].every((id) =>
            Object.entries(G.spaces[id].land).some(([owner, stack]) =>
                (owner === "spain" || friendlyControlled(G, "spain", id)) && landCount(stack) > 0))).toBe(true);

        // Destinations from Barcelona.  Madrid and Valencia are normal
        // neighbours at 1 CP; the Pamplona link is an Alpine-style pass and
        // costs 2 CP, so it is excluded while Spain has only 1 CP.
        const neighbours = landNeighbors("barcelona").map((n) => n.id);
        const oneCp = legalTargets(G, "spain", "moveLand", "barcelona");
        expect(oneCp).toContain("madrid");
        expect(oneCp).toContain("valencia");
        expect([...oneCp].every((id) => neighbours.includes(id))).toBe(true);
        expect([...oneCp].every((id) =>
            landNeighbors("barcelona").some((n) => n.id === id && !n.pass))).toBe(true);

        // With 2 CP the pass link becomes a legal destination.
        G.powers.spain.cp = 2;
        expect(legalTargets(G, "spain", "moveLand", "barcelona")).toContain("pamplona");

        // A space with no friendly land units is not a legal origin.
        expect(legalTargets(G, "spain", "moveLand", "london")).toEqual(new Set());
    });

    it("control agrees with canControlSpace for every space", () => {
        const G = activeSpain(10);
        const targets = legalTargets(G, "spain", "control");
        const expected = Object.keys(G.spaces).filter((id) => canControlSpace(G, "spain", id).ok);
        expect([...targets].sort()).toEqual(expected.sort());
    });

    it("buildGalley only returns home ports", () => {
        const G = activeSpain(10);
        const targets = legalTargets(G, "spain", "buildGalley");
        expect(targets.size).toBeGreaterThan(0);
        expect(targets).toContain("barcelona");
        expect([...targets].every((id) => isPort(id) && !isInlandPort(id))).toBe(true);
        // Enemy-controlled ports are excluded even though they are ports.
        expect(targets).not.toContain("london");
        expect(targets).not.toContain("calais");
    });

    it("buildGalleon requires an Atlantic/Channel/North Sea port", () => {
        const G = activeSpain(10);
        const targets = legalTargets(G, "spain", "buildGalleon");
        expect(targets).toContain("seville"); // atlanticOcean
        expect(targets).not.toContain("barcelona"); // gulfOfLyon only
    });

    it("recruitMerc follows the cheaper cost and recruitCav is Ottoman-only", () => {
        const G = activeSpain(1);
        expect(legalTargets(G, "spain", "recruitMerc")).toContain("madrid");
        expect(legalTargets(G, "spain", "recruitCav")).toEqual(new Set());
        // A mercenary costs 1 CP; with none left nothing is highlighted.
        G.powers.spain.cp = 0;
        expect(legalTargets(G, "spain", "recruitMerc")).toEqual(new Set());
    });

    it("buildFortress only targets open controlled home spaces without a fortress", () => {
        const G = activeSpain(2);
        const targets = legalTargets(G, "spain", "buildFortress");
        expect(targets).toContain("valencia");
        expect([...targets].every((id) =>
            SPACE_BY_ID[id].kind === "open" && !G.spaces[id].fortress &&
            G.spaces[id].control === "spain" && !G.spaces[id].unrest)).toBe(true);
    });

    it("assault only targets besieged spaces the power is besieging", () => {
        const G = activeSpain(5);
        expect(legalTargets(G, "spain", "assault").has("valencia")).toBe(false);
        // Valencia is besieged by Spain since the previous impulse.
        G.spaces.valencia.control = "ottoman";
        G.spaces.valencia.land.spain = {regular: 2, merc: 0, cav: 0};
        G.spaces.valencia.siege = {by: "spain", sinceImpulse: G.impulse - 1};
        expect(legalTargets(G, "spain", "assault")).toContain("valencia");
        // A siege begun this impulse may not be assaulted yet.
        G.spaces.valencia.siege = {by: "spain", sinceImpulse: G.impulse};
        expect(legalTargets(G, "spain", "assault")).not.toContain("valencia");
    });

    it("navalTransport returns land-unit ports as origins and adjacent sea zones as destinations", () => {
        const G = activeSpain(5);
        // Spain needs naval units in the sea zone, not just in a port.
        G.seaZones.gulfOfLyon.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        const origins = legalTargets(G, "spain", "navalTransport");
        expect(origins).toContain("barcelona");
        expect([...origins].every((id) => isPort(id) && G.spaces[id] !== undefined &&
            (G.spaces[id].land.spain?.regular ?? 0) + (G.spaces[id].land.spain?.merc ?? 0) +
                (G.spaces[id].land.spain?.cav ?? 0) > 0)).toBe(true);
        expect(legalTargets(G, "spain", "navalTransport", "barcelona")).toEqual(new Set(["gulfOfLyon"]));
        // No Spanish naval unit in the Tyrrhenian: Naples has no first leg.
        expect(legalTargets(G, "spain", "navalTransport", "naples")).toEqual(new Set());
    });

    it("moveNaval returns naval origins and adjacent sea zones as destinations", () => {
        const G = activeSpain(5);
        const origins = legalTargets(G, "spain", "moveNaval");
        expect(origins).toContain("seville");
        expect([...origins].every((id) =>
            G.spaces[id] === undefined || navalCount(G.spaces[id].naval.spain) > 0)).toBe(true);

        const destinations = legalTargets(G, "spain", "moveNaval", "seville");
        expect(destinations).toContain("atlanticOcean");
        expect([...destinations].every((id) => navalAdjacent("seville", id))).toBe(true);
        // A port without Spanish naval control is not a legal naval target.
        expect(destinations).not.toContain("london");
    });

    it("spring returns every legal capital as origin and reachable friendly spaces as destinations", () => {
        const G = activeSpain(0); // Spring Deployment is free.
        const origins = legalTargets(G, "spain", "spring");
        // Spain may deploy from either Madrid or Milan (rule 10.6).
        expect([...origins]).toEqual(["madrid", "milan"]);

        const destinations = legalTargets(G, "spain", "spring", "madrid");
        expect(destinations.has("madrid")).toBe(false);
        expect(destinations).toContain("barcelona");
        expect(destinations).toContain("valencia");
        expect([...destinations].every((id) =>
            friendlyControlled(G, "spain", id) && !G.spaces[id].unrest)).toBe(true);

        // Milan is a real second origin, not just a decorative label.
        const fromMilan = legalTargets(G, "spain", "spring", "milan");
        expect(fromMilan.size).toBeGreaterThan(0);
        expect(fromMilan).toContain("genoa");
    });

    it("spring follows a relocated HRE capital", () => {
        const G = campaign();
        G.activePower = "hre";
        G.hreCapital = "prague";
        const origins = legalTargets(G, "hre", "spring");
        expect(origins).toContain("prague");
        expect(origins).toContain("vienna");
    });

    it("rebellion accepts the Protestant targets from rebellionTargets", () => {
        const G = campaign();
        G.activePower = "protestant";
        G.powers.protestant.cp = 3;
        const targets = legalTargets(G, "protestant", "rebellion");
        expect(targets.size).toBeGreaterThan(0);
        expect(targets).toEqual(new Set(rebellionTargets(G)));
        // Without enough CP no rebellion target is highlighted.
        G.powers.protestant.cp = 1;
        expect(legalTargets(G, "protestant", "rebellion")).toEqual(new Set());
    });
});
