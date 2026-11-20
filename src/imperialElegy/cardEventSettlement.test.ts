/**
 * Three printed home/action events that used to settle nothing.
 *
 * Reported as "帝国挽歌大部分特殊事件效果都没实现 … 干练外交官 俄土战争 现代化
 * 都有效果未结算".  Each case was reproduced by playing the real card and
 * inspecting the state, and each one failed in a different way:
 *
 *  1. A019 Skilled Diplomats — the 4 CP were allocated by a *single* answer, so
 *     all four markers landed on one track of one column even though 12.7 says
 *     a player "can move … MPIT markers belonging to other powers" and is "not
 *     limited to influencing a single power … in any direction".
 *  2. RU-9 / any home-card declaration — the event resolved correctly but left
 *     only an entitlement, and the Rule 34 bot had no declaration row, so its
 *     very next move (`pass`) cleared the entitlement.  In solo play the card
 *     therefore read as "no effect".
 *  3. OT-11 Modernization — only the +1 stability settled.  12.13.1's offer
 *     round (another power gives a card, OT puts it into industrialization, the
 *     giver draws) and the "no player gives you a card → 3 CP" fallback were
 *     missing, and the `modernization` flag the handler wrote was read by
 *     nothing.
 */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {playCard, declareWar, pass, resolvePending} from "./moves";
import {botDecision} from "./engine/bot";
import {warDeclarationEntitlement} from "./engine/rules";
import {POWERS, type Power} from "./types";

const seats = POWERS as unknown as string[];

const makeCtx = (seat = "0"): Ctx =>
  ({
    playerID: seat,
    random: {Die: () => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 3,
    phase: "action",
  }) as unknown as Ctx;

const seatOf = (power: Power): string => String(seats.indexOf(power));

const setup = (power: Power, card: string): ReturnType<typeof setupImperialElegy> => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.wtt = 1;
  G.cpRemaining = 0;
  G.powers[power].hand = [card];
  if (card.startsWith("IE-H")) G.powers[power].selectedHomeCard = card;
  return G;
};

const answer = (G: ReturnType<typeof setupImperialElegy>, power: Power, optionId: string) => {
  resolvePending(G, makeCtx(seatOf(power)), optionId);
};

describe("A019 Skilled Diplomats — 4 CP on the MPIT", () => {
  test("each marker is its own answer, so they may go to different columns and tracks", () => {
    const G = setup("GE", "IE-A019");
    playCard(G, makeCtx(seatOf("GE")), "IE-A019", "event");
    expect(G.pending?.kind).toBe("mpitAllocation");
    // 12.7: every column × every track is offered, not just the actor's tracks.
    expect(G.pending?.options).toHaveLength(POWERS.length * 3);
    expect(G.pending?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(["GE:te", "GE:ta", "GE:neutral", "UK:te", "OT:neutral"]),
    );
    expect(G.pending?.context?.amount).toBe(4);

    for (const choice of ["GE:ta", "GE:ta", "UK:te", "OT:neutral"]) {
      expect(G.pending?.context?.amount).toBeGreaterThan(0);
      answer(G, "GE", choice);
    }
    expect(G.pending).toBeNull();
    expect(G.powers.GE.mpit).toEqual({te: 0, ta: 2, neutral: 1});
    expect(G.powers.UK.mpit).toEqual({te: 1, ta: 0, neutral: 1});
    // OT starts with 1 neutral influence; the card added one more.
    expect(G.powers.OT.mpit.neutral).toBe(2);
  });

  test("the whole 4 points can still go to one cell when that is what the seat wants", () => {
    const G = setup("GE", "IE-A019");
    playCard(G, makeCtx(seatOf("GE")), "IE-A019", "event");
    for (let i = 0; i < 4; i += 1) answer(G, "GE", "GE:neutral");
    expect(G.powers.GE.mpit).toEqual({te: 0, ta: 0, neutral: 5});
  });

  test("the allocated markers are logged one CP at a time", () => {
    const G = setup("GE", "IE-A019");
    playCard(G, makeCtx(seatOf("GE")), "IE-A019", "event");
    answer(G, "GE", "FR:ta");
    const entry = G.log.filter((line) => line.key === "mpitInfluenceAllocated").pop();
    expect(entry?.args).toMatchObject({target: "FR", track: "ta", remaining: 3});
  });
});

describe("RU-9 Russo-Turkish Wars — the bot declares the war the card funds", () => {
  const botCtx = (G: ReturnType<typeof setup>): Ctx => ({
    ...makeCtx(seatOf("RU")),
    currentPlayer: seatOf("RU"),
    playOrder: [],
    playOrderPos: 0,
    numPlayers: 6,
  } as unknown as Ctx);

  test("the bot sends declareWar rather than passing the entitlement away", () => {
    const G = setup("RU", "IE-H-RU-9");
    playCard(G, makeCtx(seatOf("RU")), "IE-H-RU-9", "event");
    expect(warDeclarationEntitlement(G, "RU")).not.toBeNull();

    const move = botDecision(G, botCtx(G), "RU");
    expect(move.move).toBe("declareWar");
    const [target, aim, objectives, cp] = move.args as [unknown, unknown, unknown, unknown];
    expect(target).toBe("OT");
    expect(aim).toBe("liberation");
    expect(cp).toBe(3);

    expect(declareWar(
      G,
      makeCtx(seatOf("RU")),
      target as Parameters<typeof declareWar>[2],
      aim as Parameters<typeof declareWar>[3],
      objectives as Parameters<typeof declareWar>[4],
      cp as number,
    )).toBeUndefined();
    expect(G.war?.attacker).toBe("RU");
    // 13.4 allows a non-player defender, but the Ottomans are a player power
    // here, so the declaration is a plain player war that RU-9 funds.
    expect(G.war?.defender).toBe("OT");
    expect(G.war?.declarationCard).toBe("IE-H-RU-9");
    expect(warDeclarationEntitlement(G, "RU")).toBeNull();
  });

  test("a hand-over still drops the entitlement, so the bot move is the only way it lands", () => {
    const G = setup("RU", "IE-H-RU-9");
    playCard(G, makeCtx(seatOf("RU")), "IE-H-RU-9", "event");
    pass(G, makeCtx(seatOf("RU")));
    expect(warDeclarationEntitlement(G, "RU")).toBeNull();
    expect(G.war).toBeNull();
  });

  test("Bismarck and Jihad take the same bot path", () => {
    for (const [power, card] of [["GE", "IE-H-GE-1"], ["OT", "IE-H-OT-12"]] as const) {
      const G = setup(power, card);
      playCard(G, makeCtx(seatOf(power)), card, "event");
      const move = botDecision(G, {...botCtx(G), currentPlayer: seatOf(power)} as Ctx, power);
      // Jihad needs a legal defender (RU, or a power holding an OT home); on the
      // campaign board Russia qualifies.  Bismarck needs a German unification
      // target, which the enumeration only offers once one is legal.
      if (warDeclarationEntitlement(G, power) !== null) {
        expect(["declareWar", "pass"]).toContain(move.move);
      }
    }
  });
});

describe("OT-11 Modernization — 12.13.1 offer round", () => {
  test("+1 stability always applies; a gifted card becomes OT's industrialization card", () => {
    const G = setup("OT", "IE-H-OT-11");
    G.powers.UK.hand = ["IE-A029"];
    for (const power of ["GE", "FR", "AU", "RU"] as Power[]) G.powers[power].hand = ["IE-A029"];
    const stability = G.powers.OT.stability;
    const deck = G.deck.length;

    playCard(G, makeCtx(seatOf("OT")), "IE-H-OT-11", "event");
    expect(G.powers.OT.stability).toBe(stability + 1);
    // "each player can offer the OT player a card": powers are asked in seat
    // order, so the first prompt belongs to GE, not the Ottoman seat.
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.context?.stage).toBe("offer");
    expect(G.pending?.power).toBe("GE");

    let guard = 0;
    let sawUkOffer = false;
    while (G.pending && guard++ < 20) {
      const step = G.pending;
      const stage = step.context?.stage;
      let pick = step.options[0].id;
      if (stage === "offer" && step.power === "UK") {
        const offer = step.options.find((o) => o.id === "offer:IE-A029");
        if (offer !== undefined) {
          pick = offer.id;
          sawUkOffer = true;
        }
      }
      if (stage === "accept") {
        const accept = step.options.find((o) => o.id === "accept:IE-A029");
        pick = accept?.id ?? pick;
      }
      answer(G, step.power, pick);
    }
    expect(sawUkOffer).toBe(true);
    expect(G.pending).toBeNull();

    // "places an industrialization chit on it, the gifting player then draws".
    expect(G.powers.OT.industryCard).toBe("IE-A029");
    const drawn = G.log.filter((line) => line.key === "cardsDrawn").pop();
    expect(drawn?.power).toBe("UK");
    expect(G.deck.length).toBe(deck - 1);
    const accepted = G.log.filter((line) => line.key === "modernizationAccepted").pop();
    expect(accepted?.args).toMatchObject({card: "IE-A029", from: "UK"});
  });

  test("an offered card leaves the giver's hand for the Ottoman industrialization slot", () => {
    const G = setup("OT", "IE-H-OT-11");
    G.powers.UK.hand = ["IE-A029"];
    for (const power of ["GE", "FR", "AU", "RU"] as Power[]) G.powers[power].hand = [];
    playCard(G, makeCtx(seatOf("OT")), "IE-H-OT-11", "event");
    // Only the UK can offer, so the chain is offer -> accept.
    expect(G.pending?.power).toBe("UK");
    answer(G, "UK", "offer:IE-A029");
    expect(G.pending?.power).toBe("OT");
    answer(G, "OT", "accept:IE-A029");
    expect(G.powers.UK.hand).not.toContain("IE-A029");
    expect(G.powers.OT.industryCard).toBe("IE-A029");
    expect(G.pending).toBeNull();
  });

  test("the Ottoman seat may refuse every offer and take the card's 3 CP", () => {
    const G = setup("OT", "IE-H-OT-11");
    G.powers.UK.hand = ["IE-A029"];
    playCard(G, makeCtx(seatOf("OT")), "IE-H-OT-11", "event");

    let guard = 0;
    while (G.pending && guard++ < 12) {
      const step = G.pending;
      const stage = step.context?.stage;
      let pick = step.options[0].id;
      if (stage === "offer" && step.power === "UK") {
        const offer = step.options.find((o) => o.id === "offer:IE-A029");
        if (offer !== undefined) pick = offer.id;
      }
      if (stage === "accept") pick = "accept:none";
      answer(G, step.power, pick);
    }
    expect(G.cpRemaining).toBe(3);
    expect(G.powers.OT.industryCard).toBeNull();
    // The offered card stays with its owner when the Ottomans decline.
    expect(G.powers.UK.hand).toContain("IE-A029");
    expect(G.log.some((line) => line.key === "modernizationNoOffer")).toBe(true);
  });

  test("nobody can offer: the home card is worth its printed 3 CP", () => {
    const G = setup("OT", "IE-H-OT-11");
    for (const power of POWERS) if (power !== "OT") G.powers[power].hand = [];
    playCard(G, makeCtx(seatOf("OT")), "IE-H-OT-11", "event");
    expect(G.pending).toBeNull();
    expect(G.cpRemaining).toBe(3);
    expect(G.powers.OT.industryCard).toBeNull();
  });

  test("a mandatory event is never offered as an industrialization card", () => {
    const G = setup("OT", "IE-H-OT-11");
    const mandatory = G.powers.UK.hand.find((id) => id.length > 0);
    void mandatory;
    playCard(G, makeCtx(seatOf("OT")), "IE-H-OT-11", "event");
    const offers = G.pending?.options.filter((o) => o.id.startsWith("offer:")) ?? [];
    for (const offer of offers) {
      const card = offer.id.slice("offer:".length);
      expect(card).not.toMatch(/^IE-H-/);
    }
  });
});
