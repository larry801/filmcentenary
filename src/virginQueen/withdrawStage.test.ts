import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {VirginQueenGameDef} from "./game";
import {POWERS, VQGame} from "./constant/general";
import {setupGame} from "./util";

// Exercise the real clients: calling chooseWithdraw directly misses the
// boardgame.io active-player gate that used to reject the defender's answer.
const clients = (attackerUnits = 2) => {
    const action = VirginQueenGameDef.phases!.action;
    const game = {
        ...VirginQueenGameDef,
        seed: "withdraw-stage",
        setup: (ctx: Ctx): VQGame => {
            const G = setupGame(ctx);
            G.dealtYear = G.year;
            for (const p of POWERS) G.powers[p].cards = [];
            G.powers.france.cards = ["vq-021"];
            G.powers.france.wars.push("england");
            G.powers.england.wars.push("france");
            G.spaces.paris.land = {france: {regular: attackerUnits, merc: 0, cav: 0}};
            G.spaces.paris.leaders = [];
            G.spaces.orleans.control = "england";
            G.spaces.orleans.land = {england: {regular: 3, merc: 0, cav: 0}};
            G.spaces.orleans.leaders = [];
            G.spaces.orleans.unrest = false;
            for (const id of ["bourges", "tours", "blois", "chartres"]) {
                if (!G.spaces[id]) continue;
                G.spaces[id].control = "france";
                G.spaces[id].land = {};
                G.spaces[id].leaders = [];
                G.spaces[id].unrest = false;
            }
            return G;
        },
        phases: {action: {...action, start: true, onBegin: (G: VQGame, ctx: Ctx) => {
            action.onBegin!(G, ctx);
            G.activePower = "france";
        }}},
    };
    const multiplayer = Local();
    return POWERS.map((_power, id) => Client({game, multiplayer, numPlayers: 6, playerID: String(id)}));
};

describe("fortification withdrawal between hotseat clients", () => {
    it.each(["return", "continue", "fight", "siege"])("hands control to the defender and resolves %s", (choice) => {
        const all = clients(choice === "siege" ? 4 : 2);
        all.forEach((client) => client.start());
        try {
            const attacker = all[3];
            const defender = all[2];
            attacker.moves.playCard({cardId: "vq-021"});
            attacker.moves.moveLand({from: "paris", to: "orleans", leaders: []});
            expect(attacker.getState()!.G.pendingWithdraw).toMatchObject({active: "france", defender: "england"});
            expect(defender.getState()!.ctx.currentPlayer).toBe("3");
            expect(defender.getState()!.ctx.activePlayers).toEqual({"2": "withdrawChoice"});
            expect(defender.getState()!.isActive).toBe(true);
            expect(attacker.getState()!.isActive).toBe(false);

            defender.moves.chooseWithdraw({withdraw: choice !== "fight"});
            expect(attacker.getState()!.G.pendingWithdraw).toBeUndefined();
            expect(attacker.getState()!.ctx.activePlayers).toBeNull();
            expect(attacker.getState()!.isActive).toBe(true);
            if (choice === "return" || choice === "continue") {
                expect(attacker.getState()!.G.pendingContinue).toBeDefined();
                if (choice === "return") attacker.moves.stopContinue();
                else attacker.moves.continueMove({to: "bourges"});
                expect(attacker.getState()!.G.pendingContinue).toBeUndefined();
                const destination = choice === "return" ? "paris" : "bourges";
                expect(attacker.getState()!.G.spaces[destination].land.france.regular).toBe(2);
            } else if (choice === "siege") {
                expect(attacker.getState()!.G.spaces.orleans.siege?.by).toBe("france");
            } else {
                expect(attacker.getState()!.G.log.join("\n")).toContain("Field battle");
            }
            attacker.moves.endImpulse();
            expect(attacker.getState()!.ctx.currentPlayer).not.toBe("3");
        } finally {
            all.forEach((client) => client.stop());
        }
    });
});
