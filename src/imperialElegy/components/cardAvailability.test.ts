/**
 * The hand's data model: may this card be played for CP / its event / as a
 * response, may it industrialize, chain or be saved, and why not.
 *
 * The fixture is a real campaign setup, so `G.cpRemaining`, the seat and the
 * printed window are the ones the engine checks.  `CARDS` is the
 * `{actions, home, greatWar}` bag of printed arrays, not one flat list: the
 * action cards live in `CARDS.actions`, home cards in `CARDS.home` (their
 * `kind` is `"home"`, which the save rule keys on; the selected home card may
 * industrialize).
 */
import type {Ctx} from "boardgame.io";

import {cardAvailability, type CardAvailabilityInput} from "./cardAvailability";
import {ALL_CARDS, cardById} from "../engine/deck";
import {CARDS} from "../constant/cards.data";
import type {CardType} from "../constant/cards";
import {setupImperialElegy} from "../engine/setup";
import type {ImperialElegyState} from "../types";

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
} as unknown as Ctx;

/** A fresh campaign with Germany on the clock; `cpRemaining` is the impulse's. */
const game = (cpRemaining = 0): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = cpRemaining;
  return G;
};

const withCp = (G: ImperialElegyState, cpRemaining: number): ImperialElegyState => ({...G, cpRemaining});

const bi = (en: string, _zh: string): string => en;

const input = (
  G: ImperialElegyState,
  cardId: string,
  over: Partial<CardAvailabilityInput> = {},
): CardAvailabilityInput => ({
  G,
  power: "GE",
  cardId,
  phase: "action",
  isActive: true,
  isBelligerent: false,
  war: null,
  canActionCard: true,
  saveList: [],
  forcedCardIds: [],
  industryCard: null,
  cpChainLength: 0,
  homeCards: [],
  playBlock: {},
  responseBlock: {},
  bi,
  ...over,
});

const actionCardsOfType = (type: CardType): string[] =>
  CARDS.actions.filter((card) => card.type === type).map((card) => card.id);

const normalActionCard = (): string => actionCardsOfType("event")[0];
const mandatoryCard = (): string => [...actionCardsOfType("mandatory"), ...actionCardsOfType("mandatoryResponse")][0];

/** A41 ("Prussian Military Tradition") is the response printed for Germany. */
const germanResponseCard = (): string => {
  const id = "IE-A041";
  expect(cardById(id).type).toBe("response");
  return id;
};

/** The first printed event whose own gates are open in the fresh setup. */
const eventOpenNow = (): string => {
  const G = game(0);
  const id = actionCardsOfType("event").find((candidate) => cardAvailability(input(G, candidate)).eventBlockKey === undefined);
  expect(id).toBeDefined();
  return id as string;
};

describe("cardAvailability", () => {
  test("the fixture draws from the three printed card arrays", () => {
    // CARDS is `{actions, home, greatWar}` of arrays; ALL_CARDS is the flat deck.
    expect(Array.isArray(CARDS)).toBe(false);
    expect(ALL_CARDS).toHaveLength(CARDS.actions.length + CARDS.home.length + CARDS.greatWar.length);
    for (const id of [normalActionCard(), mandatoryCard(), germanResponseCard()]) {
      expect(cardById(id).id).toBe(id);
      expect(actionCardsOfType(cardById(id).type)).toContain(id);
    }
  });

  test("a normal action card may be played for CP exactly when the impulse can pay", () => {
    const G = game(0);
    const id = normalActionCard();

    const free = cardAvailability(input(G, id));
    expect(free.cpAllowed).toBe(true);
    expect(free.cpModeOk).toBe(true);
    expect(free.showCp).toBe(true);
    expect(free.isMandatory).toBe(false);

    // 11.x: a card is a CP substitute only on an impulse that has no CP left.
    const midImpulse = cardAvailability(input(G, id, {G: withCp(G, 3)}));
    expect(midImpulse.cpAllowed).toBe(true);
    expect(midImpulse.cpModeOk).toBe(false);
    expect(midImpulse.reasons).toContain("Finish the current impulse first");
    expect(midImpulse.firstReason).toBe(midImpulse.reasons[0]);
    expect(new Set(midImpulse.reasons).size).toBe(midImpulse.reasons.length);

    // Printing a card for its event is equally an empty-pool move.
    const eventCard = eventOpenNow();
    expect(cardAvailability(input(G, eventCard)).eventModeOk).toBe(true);
    const lateEvent = cardAvailability(input(G, eventCard, {G: withCp(G, 3)}));
    expect(lateEvent.eventModeOk).toBe(false);
    expect(lateEvent.reasons).toContain("Events are played before spending CP");
  });

  test("every card may be spent for CP, mandatory events included", () => {
    // 12.0: "All cards except Mandatory Event cards can be played for CP."  A
    // mandatory card has no plain CP mode — playing it for CP resolves its
    // event and grants the printed CP — so the move accepts it but the button
    // is still the one that plays the event.
    const G = game(0);
    const id = mandatoryCard();
    const a = cardAvailability(input(G, id));
    expect(a.isMandatory).toBe(true);
    expect(a.cpAllowed).toBe(true);
    expect(a.cpModeOk).toBe(true);
    // The tray still folds the CP/event pair into the one event control: a
    // mandatory event has no CP-only play, so offering both is a false choice.
    expect(a.showCp).toBe(false);

    // Nothing about the impulse's CP pool refuses it either.
    expect(cardAvailability(input(game(3), id)).cpModeOk).toBe(false);

    // `forcedCardIds` grants no extra slot: a used impulse can be handed over,
    // so the printed no-pass card never needs a second card play.  Here the
    // impulse is still unused, so the card is playable like any other.
    const forced = cardAvailability(input(G, id, {forcedCardIds: [id]}));
    expect(forced.cpModeOk).toBe(true);

    // Spending the impulse (even down to zero CP) shuts the mandatory play too:
    // its 2 CP are that impulse's budget, not a second impulse.
    const spent = { ...G, cpRemaining: 0 } as typeof G;
    spent.powers.GE.flags.actionCpSpentThisImpulse = true;
    const after = cardAvailability(input(spent, id));
    expect(after.cpModeOk).toBe(false);
    expect(after.reasons).toContain("One card per impulse; finish this impulse first");

    // A105 Impulsive Ruler is the one printed CP clause: 3 or fewer cards.
    const crowded = game(0);
    crowded.powers.GE.hand = ["IE-A105", "IE-A018", "IE-A019", "IE-A020"];
    const impulsive = cardAvailability(input(crowded, "IE-A105"));
    expect(impulsive.cpAllowed).toBe(false);
    expect(impulsive.cpModeOk).toBe(false);
    // A105 is a mandatory *response*, not a mandatory event: "If played for CP
    // the event does not trigger", so the tray keeps its separate CP control.
    expect(impulsive.showCp).toBe(true);
  });

  test("response and combat cards are CP cards outside their window", () => {
    // 12.0 / the printed card types: a response or combat card played for CP is
    // a normal discard play; only its *event* mode is window-bound.
    const G = game(0);
    const id = germanResponseCard();
    const open = cardAvailability(input(G, id));
    expect(open.cpAllowed).toBe(true);
    expect(open.cpModeOk).toBe(true);
    expect(open.showResponse).toBe(true);
    // Active German impulse, nothing spent yet: the window is open.
    expect(open.responseOk).toBe(true);

    // A41 is the one printed response that is also a standard event ("during
    // your impulse"); every other response card has no event mode at all.
    expect(open.eventAllowed).toBe(true);
    expect(open.eventModeOk).toBe(true);
    const battleOnly = actionCardsOfType("response").find((candidate) => candidate !== id) as string;
    const plain = cardAvailability(input(G, battleOnly));
    expect(plain.cpAllowed).toBe(true);
    expect(plain.eventAllowed).toBe(false);
    expect(plain.eventModeOk).toBe(false);
    expect(plain.reasons).toContain("This card has no printed event");

    // A combat card is a CP card too, with no event mode outside a battle.
    const combatId = actionCardsOfType("combat")[0];
    const combat = cardAvailability(input(G, combatId));
    expect(combat.cpAllowed).toBe(true);
    expect(combat.cpModeOk).toBe(true);
    expect(combat.eventAllowed).toBe(false);
    expect(combat.showResponse).toBe(false);

    // Spending the impulse's CP shuts the response window but not the tray's
    // slot: the card is still a response card, it just cannot be answered yet.
    const spent = cardAvailability(input(G, id, {G: withCp(G, 3)}));
    expect(spent.showResponse).toBe(true);
    expect(spent.responseOk).toBe(false);

    // A seat that is not on the clock has no response slot at all.
    const idle = cardAvailability(input(G, id, {isActive: false}));
    expect(idle.showResponse).toBe(false);

    // The same card is a German wartime response, not a neutral spectator's.
    expect(cardAvailability(input(G, id, {phase: "wartime", isBelligerent: false})).showResponse).toBe(false);
    expect(cardAvailability(input(G, id, {phase: "wartime", isBelligerent: true})).showResponse).toBe(true);
  });

  test("a closed card window blocks every mode", () => {
    const G = game(0);
    const id = normalActionCard();
    const shut = cardAvailability(input(G, id, {canActionCard: false}));
    expect(shut.cpModeOk).toBe(false);
    expect(shut.eventModeOk).toBe(false);
    expect(shut.industOk).toBe(false);
    expect(shut.chainOk).toBe(false);
    expect(shut.firstReason).toBeDefined();
    expect(shut.reasons).toContain("Only during your Action-phase impulse");
    expect(shut.reasons.every((reason) => reason.length > 0)).toBe(true);
    expect(new Set(shut.reasons).size).toBe(shut.reasons.length);
  });

  test("save state is reported to the tray and only legal in the Action or End phase", () => {
    const G = game(0);
    const id = normalActionCard();

    const unsaved = cardAvailability(input(G, id));
    expect(unsaved.saved).toBe(false);
    expect(unsaved.saveOk).toBe(true);

    const saved = cardAvailability(input(G, id, {saveList: [id]}));
    expect(saved.saved).toBe(true);
    // Marking a card as kept does not close the save slot: the phase does.
    expect(saved.saveOk).toBe(true);
    expect(saved.reasons).not.toContain("Save only in the Action or End phase");

    const outsideAction = cardAvailability(input(G, id, {phase: "prep"}));
    expect(outsideAction.saveOk).toBe(false);
    expect(outsideAction.reasons).toContain("Save only in the Action or End phase");
    expect(cardAvailability(input(G, id, {phase: "end"})).saveOk).toBe(true);

    // Home cards and mandatory events are never saved, whatever the phase.
    const homeId = CARDS.home[0].id;
    expect(cardById(homeId).kind).toBe("home");
    const home = cardAvailability(input(G, homeId, {saveList: [homeId]}));
    expect(home.saved).toBe(true);
    expect(home.saveOk).toBe(false);

    const mandatoryId = mandatoryCard();
    expect(cardAvailability(input(G, mandatoryId, {saveList: [mandatoryId]})).saveOk).toBe(false);
  });

  test("the Industry Card slot decides what may industrialize", () => {
    const G = game(0);
    const id = normalActionCard();

    const open = cardAvailability(input(G, id));
    expect(open.industOk).toBe(true);

    const used = cardAvailability(input(G, id, {industryCard: "IE-A002"}));
    expect(used.industOk).toBe(false);
    expect(used.reasons).toContain("A card is already industrializing");

    // No impulse, no industry.
    const closed = cardAvailability(input(G, id, {canActionCard: false}));
    expect(closed.industOk).toBe(false);
    expect(closed.reasons).toContain("Industrialize only during your Action impulse");

    // A mandatory event is not an Industry Card, and the rules say so with the
    // card-type line rather than an industry reason.
    const mandatoryId = mandatoryCard();
    const mandatory = cardAvailability(input(G, mandatoryId));
    expect(mandatory.industOk).toBe(false);
    expect(mandatory.reasons).not.toContain("Industrialize only during your Action impulse");
    expect(mandatory.reasons).not.toContain("A card is already industrializing");

    // 12.13: the home card selected in Diplomacy may industrialize.  An
    // unselected home card is not in play and keeps the home-card reason.
    const homeId = CARDS.home[0].id;
    const selectedHome = cardAvailability(input(G, homeId, {homeCards: [homeId]}));
    expect(selectedHome.industOk).toBe(true);
    expect(selectedHome.reasons).not.toContain("Industrialize only during your Action impulse");

    const unselectedHome = cardAvailability(input(G, homeId));
    expect(unselectedHome.industOk).toBe(false);
    expect(unselectedHome.reasons).toContain("Set it as your home card during Diplomacy first");

    const homeAlreadyIndustrializing = cardAvailability(input(G, homeId, {
      homeCards: [homeId],
      industryCard: "IE-A002",
    }));
    expect(homeAlreadyIndustrializing.industOk).toBe(false);
    expect(homeAlreadyIndustrializing.reasons).toContain("A card is already industrializing");
  });

  test("the CP chain accepts two cards and refuses a third", () => {
    const G = game(0);
    const id = normalActionCard();
    expect(cardAvailability(input(G, id, {cpChainLength: 1})).chainOk).toBe(true);
    const full = cardAvailability(input(G, id, {cpChainLength: 2}));
    expect(full.chainOk).toBe(false);
    expect(full.reasons).toContain("CP chain is full");
  });
});
