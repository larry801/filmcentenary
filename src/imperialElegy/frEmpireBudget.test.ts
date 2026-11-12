/**
 * 33.3 Second French Empire: "After FR calculates their CP war budget
 * (including during the GW) they automatically increase it by 1."
 *
 * The GW half is `greatWarFlow.ts#beginGwTurn`; this suite pins the limited-war
 * half (`limitedWar.ts#warBudgetFor`) through both the pure budget helper and a
 * real `declareWar`/`startWarManeuver` flow.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState, warBudgetFor} from "./engine/limitedWar";
import {governmentBenefits} from "./engine/characteristics";
import {declareWar, startWarManeuver} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("33.3 Second French Empire war budget", () => {
  test("governmentBenefits reports the printed +1 for the Second Empire only", () => {
    const G = fresh();
    G.powers.FR.government = "secondEmpire";
    expect(governmentBenefits(G, "FR").warBudgetBonus).toBe(1);
    G.powers.FR.government = "thirdRepublic";
    expect(governmentBenefits(G, "FR").warBudgetBonus).toBe(0);
    expect(governmentBenefits(G, "GE").warBudgetBonus).toBe(0);
  });

  test("the limited-war budget adds the +1 after card CP plus industry", () => {
    const G = fresh();
    G.powers.FR.government = "secondEmpire";
    G.powers.FR.industry = 2;
    expect(warBudgetFor(G, "FR", 3)).toBe(3 + 2 + 1);

    G.powers.FR.government = "thirdRepublic";
    expect(warBudgetFor(G, "FR", 3)).toBe(3 + 2);

    // Another power's budget never changes.
    expect(warBudgetFor(G, "GE", 3)).toBe(3 + G.powers.GE.industry);
  });

  test("createWarState gives the Second Empire the bonus and the Republic none", () => {
    const G = fresh();
    G.powers.FR.industry = 1;
    G.powers.FR.government = "secondEmpire";
    const war = createWarState(G, "FR", "GE", "conquest", ["champagne"], 2);
    expect(war.budgets.FR).toBe(2 + 1 + 1);
    G.powers.FR.government = "thirdRepublic";
    const republic = createWarState(G, "FR", "GE", "conquest", ["champagne"], 2);
    expect(republic.budgets.FR).toBe(2 + 1);
  });

  test("a live FR declaration spends the Second Empire budget", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.cpRemaining = 4;
    G.powers.FR.government = "secondEmpire";
    G.powers.FR.industry = 2;
    G.spaces.champagne.control = "GE";
    const ctx = makeCtx([3], seat("FR"));

    expect(declareWar(G, ctx, "GE", "conquest", ["champagne"], 2)).toBeUndefined();
    expect(G.war?.budgets.FR).toBe(2 + 2 + 1);
    expect(startWarManeuver(G, ctx)).toBeUndefined();
    expect(G.war?.status).toBe("maneuver");
    // The typed budget is what wartime CP spends from.
    expect(G.war?.budgets.FR).toBe(5);
  });
});
