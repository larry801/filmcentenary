/**
 * Rules 16.1.6 / 16.2 — independent-minor treaty beneficiaries.
 *
 * "Spaces and war reparations may be awarded to any of the victorious player's
 * allies, including independent minor powers."  A beneficiary may therefore be
 * a player power (as before) or an independent minor power allied to the
 * imposing side; the choice is typed as `PowerOrMinor`, validated against the
 * live alliance markers and applied to the space or the minor's marker record.
 * The other treaty options stay with the primary belligerent (16.2), and a
 * minor that is not independent or not allied is rejected without mutating the
 * board.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS, type PowerOrMinor} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyTreaty,
  canApplyTreaty,
  classifyVictory,
  createWarState,
} from "./engine/limitedWar";
import {treatyOptionsFor, type TreatyOptionEntry} from "./engine/treatyChoice";
import {declinePending, resolvePending, resolveWar} from "./moves";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const entryIds = (entries: readonly TreatyOptionEntry[]): string[] => entries.map((entry) => entry.id);
const optionIds = (G: ImperialElegyState): string[] => (G.pending?.options ?? []).map((entry) => entry.id);

const finishSettlement = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.pending?.kind === "demobilizationFreeAction") {
    expect(declinePending(G, ctx)).toBeUndefined();
  }
};

/**
 * GE wins a major victory over AU.  Saxony is an independent minor allied to
 * GE, Tuscany is allied to GE but its home is player-controlled (not
 * independent), Bavaria is an independent minor allied to the loser, and FR is
 * a player ally of GE.
 */
const buildWar = (G: ImperialElegyState): WarState => {
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  G.spaces.vienna.occupiedBy = "GE";
  G.spaces.canada.control = "AU";
  // Independent minor ally of the winning side.
  G.spaces.saxony.control = "Saxony";
  G.spaces.saxony.ally = "GE";
  // Allied to GE but not independent (player-controlled home).
  G.spaces.tuscany.control = "AU";
  G.spaces.tuscany.ally = "GE";
  // Independent minor allied to the loser: never a winner-side beneficiary.
  G.spaces.bavaria.control = "Bavaria";
  G.spaces.bavaria.ally = "AU";
  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  war.attackerAllies = ["FR"];
  war.budgets.FR = 3;
  G.war = war;
  return war;
};

const beneficiaryOf = (entries: readonly TreatyOptionEntry[], id: string): PowerOrMinor => {
  const entry = entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`missing treaty entry ${id}`);
  return entry.beneficiary;
};

describe("16.2 independent-minor beneficiary candidates", () => {
  test("spaces and reparations are offered to the primary, player allies and independent minor allies", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("major");

    const ids = entryIds(treatyOptionsFor(G, war, victory));
    expect(ids).toEqual(
      expect.arrayContaining([
        "territorialCession",
        "territorialCession@FR",
        "territorialCession@Saxony",
        "warReparations",
        "warReparations@FR",
        "warReparations@Saxony",
      ]),
    );
    // Rule 16.2 keeps realignment and colonial cession with the primary.
    expect(ids).toContain("realignment");
    expect(ids).not.toContain("realignment@Saxony");
    expect(ids).toContain("colonialCession");
    expect(ids).not.toContain("colonialCession@Saxony");
    // The non-independent Tuscany and the loser's ally Bavaria are never
    // offered to the winning side.
    expect(ids).not.toContain("territorialCession@Tuscany");
    expect(ids).not.toContain("warReparations@Tuscany");
    expect(ids).not.toContain("territorialCession@Bavaria");

    expect(beneficiaryOf(treatyOptionsFor(G, war, victory), "territorialCession@Saxony")).toBe("Saxony");
  });

  test("validation accepts an independent minor ally and rejects everything else", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);

    const ok = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "Saxony",
    });
    expect(ok.ok).toBe(true);
    expect(ok.beneficiary).toBe("Saxony");

    const notAlly = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "Bavaria",
    });
    expect(notAlly.ok).toBe(false);
    expect(notAlly.issues.map((issue) => issue.code)).toContain("beneficiary-minor-not-ally");

    const notIndependent = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "Tuscany",
    });
    expect(notIndependent.ok).toBe(false);
    expect(notIndependent.issues.map((issue) => issue.code)).toContain("beneficiary-minor-not-independent");

    const notVictorious = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "RU",
    });
    expect(notVictorious.ok).toBe(false);
    expect(notVictorious.issues.map((issue) => issue.code)).toContain("beneficiary-not-victorious");

    const wrongOption = canApplyTreaty(G, war, victory, {
      option: "realignment",
      minor: "Bavaria",
      beneficiary: "Saxony",
    });
    expect(wrongOption.ok).toBe(false);
    expect(wrongOption.issues.map((issue) => issue.code)).toContain("beneficiary-must-be-primary");
  });

  test("a rejected beneficiary does not mutate the board", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    const before = JSON.stringify({bohemia: G.spaces.bohemia, markers: G.minorCardMarkers, treaties: war.treaties});
    expect(
      applyTreaty(G, war, victory, {option: "territorialCession", spaces: ["bohemia"], beneficiary: "Tuscany"}).applied,
    ).toBe(false);
    expect(JSON.stringify({bohemia: G.spaces.bohemia, markers: G.minorCardMarkers, treaties: war.treaties})).toBe(before);
  });
});

describe("16.2 applying a minor-power concession", () => {
  test("a territorial cession can be awarded to an independent minor", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);

    const result = applyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "Saxony",
    });
    expect(result.applied).toBe(true);
    expect(G.spaces.bohemia.control).toBe("Saxony");
    expect(G.spaces.bohemia.occupiedBy).toBeNull();
    expect(G.powers.GE.cardMarkers).toBe(0);
    expect(war.treaties).toContain("territorialCession");
    expect(G.log.at(-1)?.args).toMatchObject({
      option: "territorialCession",
      beneficiary: "Saxony",
      allocatedTo: "ally",
      spaces: "bohemia",
    });
  });

  test("war reparations awarded to a minor move the loser's marker and record the minor's award", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    const auBefore = G.powers.AU.cardMarkers;

    const result = applyTreaty(G, war, victory, {option: "warReparations", beneficiary: "Saxony"});
    expect(result.applied).toBe(true);
    expect(G.powers.AU.cardMarkers).toBe(auBefore - 1);
    expect(G.powers.GE.cardMarkers).toBe(0);
    // Minors have no hand, so the awarded +1 marker is typed public
    // bookkeeping instead of being silently dropped.
    expect(G.minorCardMarkers).toEqual({Saxony: 1});
  });

  test("player-power beneficiaries keep working", () => {
    const G = fresh();
    const war = buildWar(G);
    const victory = classifyVictory(G, war);
    const result = applyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces: ["bohemia"],
      beneficiary: "FR",
    });
    expect(result.applied).toBe(true);
    expect(G.spaces.bohemia.control).toBe("FR");
    expect(G.log.at(-1)?.args).toMatchObject({beneficiary: "FR", allocatedTo: "ally"});
  });
});

describe("16.2 live minor-beneficiary chooser", () => {
  test("the live chooser offers and applies a cession to the minor", () => {
    const G = fresh();
    buildWar(G);
    const ctx = makeCtx(seat("GE"));

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(optionIds(G)).toEqual(expect.arrayContaining(["territorialCession@Saxony", "warReparations@Saxony"]));
    // The non-independent/opposing minors are not offered at all.
    expect(optionIds(G).some((id) => id.endsWith("@Tuscany"))).toBe(false);
    expect(optionIds(G).some((id) => id.endsWith("@Bavaria"))).toBe(false);

    expect(resolvePending(G, ctx, "territorialCession@Saxony")).toBeUndefined();
    expect(G.spaces.bohemia.control).toBe("Saxony");
    // 16.2: the option is spent once per war, so no beneficiary variant
    // survives into the next pick.
    expect(optionIds(G).some((id) => id.startsWith("territorialCession"))).toBe(false);

    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    finishSettlement(G, ctx);
    expect(G.war).toBeNull();
  });

  test("an unknown beneficiary id is rejected by the live move", () => {
    const G = fresh();
    buildWar(G);
    const ctx = makeCtx(seat("GE"));
    resolveWar(G, ctx);
    expect(resolvePending(G, ctx, "territorialCession@Nowhere")).toBe(INVALID_MOVE);
    expect(G.spaces.bohemia.control).toBe("AU");
  });
});
