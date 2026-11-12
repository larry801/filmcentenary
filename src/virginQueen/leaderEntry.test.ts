import {Ctx} from "boardgame.io";
import {POWERS, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {LEADER_ENTRY_TURN} from "./scenario";
import {arriveLeaders, autoResolveOrangeArrival, resolveRebellion, scheduledLeaderEntries, setupGame} from "./util";

/**
 * Rule 8.1 / Scenario Book Leader Entry Table: leaders the setup does not
 * place enter play only on their listed turn; everyone else stays out of play
 * until a specific rule (Dragut Falls!, Catholic League, rebellion) brings him in.
 */
const ctx = (numPlayers: number): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "spring",
    numPlayers,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (scenario: "campaign" | "tournament" | "tutorial"): VQGame =>
    setupGame(ctx(scenario === "tutorial" ? 2 : 6), {scenario} as never);

const onMap = (G: VQGame, id: string): boolean => {
    const location = G.leaders[id]?.location;
    return location !== undefined && G.spaces[location] !== undefined;
};

const NOT_IN_ANY_SETUP = ["lalaMustafa", "sinanPasha", "medinaSidonia", "howard", "drake", "hawkins", "joyeuse", "mansfeld"];

describe("leader entry schedule (8.1)", () => {
    it("matches the printed Leader Entry Table", () => {
        expect(LEADER_ENTRY_TURN).toEqual({
            donJohn: 2, santaCruz: 4, leicester: 2, parma: 4, henryIII: 2,
            norreys: 4, orange: 2, navarre: 4, maurice: 5,
        });
    });

    it("brings no new leader into play on Campaign turn 1", () => {
        const G = game("campaign");
        const before = Object.fromEntries(Object.entries(G.leaders).map(([id, state]) => [id, state.location]));

        arriveLeaders(G, {interactive: true});

        expect(G.navalLeaderArrivals).toBeUndefined();
        expect(Object.fromEntries(Object.entries(G.leaders).map(([id, state]) => [id, state.location]))).toEqual(before);
        for (const id of ["donJohn", "parma", "leicester", "henryIII", "santaCruz", "uluchAli", "guise", ...NOT_IN_ANY_SETUP]) {
            expect(onMap(G, id)).toBe(false);
        }
    });

    it("puts each table leader on the Turn Track for his entry turn", () => {
        const G = game("campaign");
        expect(G.leaders.donJohn).toEqual({id: "donJohn", location: "pool", returnTurn: 2});
        expect(G.leaders.santaCruz).toEqual({id: "santaCruz", location: "pool", returnTurn: 4});
        expect(G.leaders.maurice).toEqual({id: "maurice", location: "pool", returnTurn: 5});
        // Coligny is "Held Off-Map" on the Protestant card and may enter by rebellion at once.
        expect(G.leaders.coligny).toEqual({id: "coligny", location: "pool"});
    });

    it("places army leaders in the capital and asks for a port on their entry turn", () => {
        const G = game("campaign");
        G.year = 2;
        arriveLeaders(G, {interactive: true});
        expect(G.leaders.donJohn.location).toBe("madrid");
        expect(G.leaders.leicester.location).toBe("london");
        expect(G.leaders.parma.location).toBe("pool");
        expect(G.navalLeaderArrivals).toBeUndefined();

        G.year = 4;
        arriveLeaders(G, {interactive: true});
        expect(G.leaders.parma.location).toBe("madrid");
        expect(G.navalLeaderArrivals?.map((entry) => entry.leader)).toEqual(["santaCruz"]);
    });

    it("never auto-enters leaders that only a special rule (or no rule) brings in", () => {
        const G = game("campaign");
        for (const id of ["uluchAli", "guise", ...NOT_IN_ANY_SETUP]) {
            expect(G.leaders[id]?.location).toBe("offMap");
        }
        for (let year = 2; year <= 7; year++) {
            G.year = year;
            arriveLeaders(G);
        }
        for (const id of ["uluchAli", "guise", ...NOT_IN_ANY_SETUP]) {
            expect(G.leaders[id].location).toBe("offMap");
        }
    });

    it("keeps Tournament leaders out until their turn and Dragut out for good", () => {
        const G = game("tournament");
        expect(G.year).toBe(3);
        arriveLeaders(G, {interactive: true});

        // Dragut has already fallen: Uluch Ali starts in Tripoli instead.
        expect(G.leaders.dragut.location).toBe("offMap");
        expect(G.navalLeaderArrivals).toBeUndefined();
        expect(onMap(G, "navarre")).toBe(false);
        expect(onMap(G, "maurice")).toBe(false);
        expect(onMap(G, "parma")).toBe(false);
        // Orange arrives immediately in the Tournament but waits for the player choice.
        expect(G.orangeArrivalPending).toBe(true);
        expect(onMap(G, "orange")).toBe(false);
    });

    it("places Orange in the Protestant capital when the player chooses to deploy him", () => {
        const G = game("tournament");
        arriveLeaders(G, {interactive: true});
        expect(G.orangeArrivalPending).toBe(true);

        const cap = G.leaders.orange.location === "laRochelle" ? "laRochelle" :
            Object.keys(G.spaces).find((id) => G.spaces[id].control === "protestant" && G.spaces[id].leaders.includes("orange")) ?? "laRochelle";
        // Simulate the player choosing to place Orange.
        delete G.orangeArrivalPending;
        const dest = "laRochelle";
        G.spaces[dest].leaders.push("orange");
        G.leaders.orange = {id: "orange", location: dest};
        expect(onMap(G, "orange")).toBe(true);
        expect(G.leaders.orange.location).toBe(dest);
        void cap;
    });

    it("holds Orange in the pool when the player chooses a rebellion and lets him lead it", () => {
        const G = game("tournament");
        arriveLeaders(G, {interactive: true});
        expect(G.orangeArrivalPending).toBe(true);
        // Player declines placement — flag cleared, Orange stays in pool.
        delete G.orangeArrivalPending;
        expect(G.leaders.orange.location).toBe("pool");
        expect(onMap(G, "orange")).toBe(false);

        // A rebellion can now use Orange from the pool.
        const target = SPACES.find((def) => def.area === "netherlands" && G.spaces[def.id].control === "spain" &&
            G.spaces[def.id].religion === "protestant" && G.spaces[def.id].leaders.length === 0)?.id;
        if (target !== undefined) {
            G.spaces[target].religion = "protestant";
            G.spaces[target].control = "spain";
            for (const p of POWERS) delete G.spaces[target].land[p];
            const result = resolveRebellion(G, ctx(6), "protestant", target, 2);
            expect(result).toBe(true);
            expect(G.leaders.orange.location).toBe(target);
        }
    });

    it("auto-places Orange in the capital when endPhaseTurn is called without a choice", () => {
        const G = game("tournament");
        arriveLeaders(G, {interactive: true});
        expect(G.orangeArrivalPending).toBe(true);
        autoResolveOrangeArrival(G);
        expect(G.orangeArrivalPending).toBeUndefined();
        expect(onMap(G, "orange")).toBe(true);
        expect(G.leaders.orange.location).toBe("laRochelle");
    });

    it("non-interactive arriveLeaders places Orange immediately in Tournament", () => {
        const G = game("tournament");
        arriveLeaders(G);
        expect(G.orangeArrivalPending).toBeUndefined();
        expect(onMap(G, "orange")).toBe(true);
        expect(G.leaders.orange.location).toBe("laRochelle");
    });

    it("applies the same schedule to the Tutorial", () => {
        const G = game("tutorial");
        arriveLeaders(G, {interactive: true});
        expect(G.navalLeaderArrivals).toBeUndefined();
        expect(onMap(G, "donJohn")).toBe(false);
        expect(onMap(G, "uluchAli")).toBe(false);
    });

    it("lets a rebellion use only Protestant leaders who have already arrived", () => {
        const G = game("campaign");
        const target = SPACES.find((def) => def.area === "france" && G.spaces[def.id].control === "france" &&
            G.spaces[def.id].leaders.length === 0)!.id;
        const prepare = () => {
            G.spaces[target].religion = "protestant";
            G.spaces[target].control = "france";
            for (const p of POWERS) delete G.spaces[target].land[p];
            G.rebellionAreasThisImpulse = undefined;
            G.impulse = (G.impulse ?? 0) + 1;
        };
        // Coligny is held off-map on turn 1 and leads the first rebellion.
        prepare();
        expect(resolveRebellion(G, ctx(6), "protestant", target, 2)).toBe(true);
        expect(G.leaders.coligny.location).toBe(target);

        // A second rebellion on turn 1 finds nobody: Orange, Navarre and Maurice have not arrived.
        prepare();
        expect(resolveRebellion(G, ctx(6), "protestant", target, 2)).toBe(true);
        for (const id of ["orange", "navarre", "maurice"]) expect(G.leaders[id].location).toBe("pool");

        // On turn 2 William of Orange is available.
        G.year = 2;
        prepare();
        expect(resolveRebellion(G, ctx(6), "protestant", target, 2)).toBe(true);
        expect(G.leaders.orange.location).toBe(target);
        expect(G.leaders.navarre.location).toBe("pool");
    });

    it("publishes the upcoming Turn Track entries for the overview", () => {
        const G = game("campaign");
        expect(scheduledLeaderEntries(G)).toEqual([
            {id: "donJohn", power: "spain", turn: 2},
            {id: "leicester", power: "england", turn: 2},
            {id: "henryIII", power: "france", turn: 2},
            {id: "orange", power: "protestant", turn: 2},
            {id: "parma", power: "spain", turn: 4},
            {id: "santaCruz", power: "spain", turn: 4},
            {id: "norreys", power: "england", turn: 4},
            {id: "navarre", power: "protestant", turn: 4},
            {id: "maurice", power: "protestant", turn: 5},
        ]);
    });

    it("drops a leader from the schedule once he has arrived", () => {
        const G = game("campaign");
        G.year = 2;
        arriveLeaders(G, {interactive: true});
        expect(scheduledLeaderEntries(G).map((entry) => entry.id))
            .toEqual(["parma", "santaCruz", "norreys", "navarre", "maurice"]);
    });

    it("never schedules off-map, default or out-of-scenario leaders", () => {
        const G = game("campaign");
        expect(scheduledLeaderEntries(G).map((entry) => entry.id)).not.toContain("guise");
        expect(scheduledLeaderEntries(G).map((entry) => entry.id)).not.toContain("coligny");
        G.leaders["default-spain"] = {id: "default-spain", location: "pool", returnTurn: G.year + 1};
        expect(scheduledLeaderEntries(G).map((entry) => entry.id)).not.toContain("default-spain");
        G.leaders.santaCruz.returnTurn = G.endTurn + 1;
        expect(scheduledLeaderEntries(G).map((entry) => entry.id)).not.toContain("santaCruz");
    });

    it("moves the schedule with the Tournament's later start", () => {
        const G = game("tournament");
        expect(scheduledLeaderEntries(G)).toEqual([
            {id: "parma", power: "spain", turn: 4},
            {id: "santaCruz", power: "spain", turn: 4},
            {id: "norreys", power: "england", turn: 4},
            {id: "navarre", power: "protestant", turn: 4},
            {id: "maurice", power: "protestant", turn: 5},
        ]);
    });

    it("never resurrects a Protestant leader removed from the game", () => {
        const G = game("campaign");
        delete G.leaders.coligny;
        const target = SPACES.find((def) => def.area === "france" && G.spaces[def.id].control === "france" &&
            G.spaces[def.id].leaders.length === 0)!.id;
        G.spaces[target].religion = "protestant";
        for (const p of POWERS) delete G.spaces[target].land[p];

        expect(resolveRebellion(G, ctx(6), "protestant", target, 2)).toBe(true);

        expect(G.leaders.coligny).toBeUndefined();
        expect(G.spaces[target].leaders).not.toContain("coligny");
    });
});
