/**
 * The letter marks on card names.
 *
 * A mandatory event prints 【M】, a combat card prints 【C】, and everything
 * else (including National Goals, which have no card type) keeps its bare
 * title.  The mark is part of the *display* name, never of the underlying
 * `title` / `titleZh` data, so the engine and the logs keep using ids.
 */
import {ALL_CARDS, CARD_BY_ID} from "../engine/deck";
import {GOALS} from "../constant/goals";
import {cardDisplayName, cardDisplayNameById, cardTypeMark, pinHomeCards} from "./cardDisplay";

const ofType = (type: "mandatory" | "combat" | "event" | "response") =>
  ALL_CARDS.find((card) => card.kind === "action" && card.type === type)!;

describe("cardTypeMark", () => {
  test("marks mandatory events with M and combat cards with C", () => {
    expect(cardTypeMark(ofType("mandatory"))).toBe("【M】");
    expect(cardTypeMark(ofType("combat"))).toBe("【C】");
  });

  test("leaves every other card type and a National Goal unmarked", () => {
    expect(cardTypeMark(ofType("event"))).toBe("");
    expect(cardTypeMark(ofType("response"))).toBe("");
    expect(cardTypeMark(CARD_BY_ID["IE-A105"])).toBe(""); // mandatoryResponse
    expect(cardTypeMark(GOALS[0])).toBe("");
  });
});

describe("cardDisplayName", () => {
  test("prefixes both locale titles with the printed-type mark", () => {
    for (const type of ["mandatory", "combat"] as const) {
      const card = ofType(type);
      const mark = cardTypeMark(card);
      expect(cardDisplayName(card, "zh_CN")).toBe(`${mark}${card.titleZh}`);
      expect(cardDisplayName(card, "en")).toBe(`${mark}${card.title}`);
    }
  });

  test("keeps a plain card and a goal exactly as printed", () => {
    const card = ofType("event");
    expect(cardDisplayName(card, "zh_CN")).toBe(card.titleZh);
    expect(cardDisplayName(card, "en")).toBe(card.title);
    expect(cardDisplayName(GOALS[0], "zh_CN")).toBe(GOALS[0].titleZh);
  });
});

describe("cardDisplayNameById", () => {
  test("resolves cards, goals and unknown ids", () => {
    const mandatory = ofType("mandatory");
    expect(cardDisplayNameById(mandatory.id, "zh_CN")).toBe(`【M】${mandatory.titleZh}`);
    expect(cardDisplayNameById(GOALS[0].id, "zh_CN")).toBe(GOALS[0].titleZh);
    expect(cardDisplayNameById("IE-NOPE", "en")).toBe("IE-NOPE");
  });
});

describe("pinHomeCards", () => {
  const home = ALL_CARDS.filter((card) => card.kind === "home").map((card) => card.id);
  const action = ofType("event").id;

  test("moves every home card to the front, keeping the order within each group", () => {
    const hand = [action, home[0], "IE-A029", home[1]];
    expect(pinHomeCards(hand)).toEqual([home[0], home[1], action, "IE-A029"]);
  });

  test("is a no-op when the home card is already first", () => {
    const hand = [home[0], action, "IE-A029"];
    expect(pinHomeCards(hand)).toEqual(hand);
  });

  test("leaves a hand with no home card in the order it is held", () => {
    const hand = ["IE-A029", "IE-A104", "IE-A041"];
    expect(pinHomeCards(hand)).toEqual(hand);
  });

  test("never drops or duplicates a card", () => {
    const hand = [action, home[0], "IE-A029", home[1], "IE-A104"];
    const pinned = pinHomeCards(hand);
    expect(pinned).toHaveLength(hand.length);
    expect([...pinned].sort()).toEqual([...hand].sort());
  });

  test("keeps an unknown id where it is instead of guessing", () => {
    // A card the deck does not know cannot be proven to be a home card, so it
    // stays in the group it was dealt into.
    expect(pinHomeCards(["IE-NOPE", home[0]])).toEqual([home[0], "IE-NOPE"]);
  });
});
