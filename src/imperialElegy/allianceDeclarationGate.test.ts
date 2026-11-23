/**
 * Rule 8.1.2 and 8.4 — the alliance track's absolute prohibitions.
 *
 * 8.1.2: "Players in an alliance box: cannot declare war on members of their
 * alliance."  The War panel (`declarationDefenders`) and the engine
 * (`declareWar`) must agree; this suite pins both, including a two-power
 * declaration's second target.
 *
 * 8.4: "Only three player powers can ever be in an alliance."  The cap is
 * enforced by `engine/alliance.ts#shiftAlliance`; this suite pins the A92 Naval
 * Arms Race event shift, which used to write the chit directly and could seat a
 * fourth member.
 *
 * A92 is the printed event, not a synthetic helper: `playCard(..., "event")`
 * opens its target decision and `resolvePending` answers it, so the live card
 * path is what the test exercises.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {allianceMembers} from "./engine/alliance";
import {declarationDefenders, declarationSecondTargets} from "./engine/declarationTargets";
import {warDeclarationEntitlement, BISMARCK_HOME_CARD} from "./engine/rules";
import {declareWar, playCard, resolvePending} from "./moves";

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

/** A quiet action impulse for `power`, ready for a declaration or a card. */
const impulse = (G: ImperialElegyState, power: Power): ImperialElegyState => {
  G.phase = "action";
  G.activePower = power;
  G.turn = 3;
  G.wtt = 1;
  G.cpRemaining = 0;
  return G;
};

const putInAlliance = (G: ImperialElegyState, power: Power, box: "teAligned" | "taAligned"): void => {
  G.powers[power].alliance = box;
};

describe("8.1.2 — an alliance member is not a legal declaration target", () => {
  test("declarationDefenders never offers an allied player", () => {
    const G = impulse(fresh(), "GE");
    putInAlliance(G, "GE", "taAligned");
    putInAlliance(G, "AU", "taAligned");
    putInAlliance(G, "OT", "taCommitted");

    const targets = declarationDefenders(G, "GE", null).map((entry) =>
      typeof entry.target === "string" ? entry.target : entry.target.minor);
    expect(targets).not.toContain("AU");
    expect(targets).not.toContain("OT");
    // A neutral power is still offered.
    expect(targets).toContain("FR");
  });

  test("declareWar refuses an allied player before any state changes", () => {
    const G = impulse(fresh(), "GE");
    putInAlliance(G, "GE", "teAligned");
    putInAlliance(G, "FR", "teAligned");
    const before = JSON.stringify(G);

    const result = declareWar(
      G,
      makeCtx([], seat("GE")),
      "FR",
      "conquest",
      ["paris"],
      1,
    );
    expect(result).toBe("INVALID_MOVE");
    expect(JSON.stringify(G)).toBe(before);
    expect(G.war).toBeNull();
  });

  test("a declaration on a neutral power is still accepted", () => {
    const G = impulse(fresh(), "GE");
    putInAlliance(G, "GE", "teAligned");
    putInAlliance(G, "FR", "teAligned");
    putInAlliance(G, "AU", "neutral");
    G.cpRemaining = 4;

    const result = declareWar(
      G,
      makeCtx([], seat("GE")),
      "AU",
      "conquest",
      ["bohemia"],
      1,
    );
    expect(result).toBeUndefined();
    expect(G.war?.attacker).toBe("GE");
  });

  test("a two-power declaration cannot name an ally as the second target", () => {
    const G = impulse(fresh(), "GE");
    putInAlliance(G, "GE", "taAligned");
    putInAlliance(G, "AU", "taAligned");
    G.powers.GE.hand = [BISMARCK_HOME_CARD];
    G.powers.GE.selectedHomeCard = BISMARCK_HOME_CARD;
    playCard(G, makeCtx([], seat("GE")), BISMARCK_HOME_CARD, "event");

    const entry = declarationDefenders(G, "GE", warDeclarationEntitlement(G, "GE"))[0];
    expect(entry).toBeDefined();
    const seconds = declarationSecondTargets(
      G,
      "GE",
      warDeclarationEntitlement(G, "GE"),
      entry,
      "unification",
    );
    const keys = seconds.map((candidate) => (typeof candidate.target === "string" ? candidate.target : candidate.target.minor));
    expect(keys).not.toContain("AU");
  });
});

describe("8.4 — A92 Naval Arms Race respects the three-player maximum", () => {
  test("cannot shift a fourth player into a full alliance", () => {
    const G = impulse(fresh(), "GE");
    // Triple Entente is full; GE and RU are neutral, and A92 needs a shared
    // naval box (both touch the Baltic Sea).
    putInAlliance(G, "UK", "teAligned");
    putInAlliance(G, "FR", "teAligned");
    putInAlliance(G, "AU", "teAligned");
    expect(allianceMembers(G, "te")).toHaveLength(3);

    G.powers.GE.hand.push("IE-A092");
    // Roll 1 sends the actor toward the Triple Entente in the both-neutral
    // branch; the cap must refuse that step.
    expect(playCard(G, makeCtx([1], seat("GE")), "IE-A092", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetPower");
    const target = G.pending!.options.find((entryOption) => entryOption.id === "RU");
    expect(target).toBeDefined();
    expect(resolvePending(G, makeCtx([1], seat("GE")), "RU")).toBeUndefined();

    expect(allianceMembers(G, "te")).toHaveLength(3);
    expect(G.powers.GE.alliance).toBe("neutral");
    // The printed shift is applied to the direction that is not full.
    expect(G.powers.RU.alliance).not.toBe("teAligned");
  });

  test("still shifts when the target alliance has room", () => {
    const G = impulse(fresh(), "GE");
    putInAlliance(G, "UK", "teAligned");
    putInAlliance(G, "FR", "teAligned");
    // GE neutral, RU neutral: a roll of 1 puts GE into the open Entente.
    G.powers.GE.hand.push("IE-A092");
    expect(playCard(G, makeCtx([1], seat("GE")), "IE-A092", "event")).toBeUndefined();
    expect(resolvePending(G, makeCtx([1], seat("GE")), "RU")).toBeUndefined();
    expect(G.powers.GE.alliance).toBe("teAligned");
    expect(allianceMembers(G, "te")).toHaveLength(3);
  });
});
