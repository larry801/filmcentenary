/**
 * The log's card chips: `logSegments` splits a sentence, `LogList` draws it.
 *
 * Jest here is the static-markup environment (no jsdom), so these tests pin the
 * markup a browser receives: every visible card in a log line is its own
 * `<button>` carrying the printed CP and the title, and the sentence around it
 * still reads exactly as `logText` says.  The click itself (opening the
 * inspector) is covered by the controls e2e suite.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

jest.mock("./imperial-elegy.css", () => ({}));

import {LogList} from "./LogList";
import {logSegments, logText} from "./logText";
import {cardDisplayName} from "./cardDisplay";
import {CARD_BY_ID} from "../engine/deck";
import type {ImperialElegyState, LogEntry} from "../types";
import {setupImperialElegy} from "../engine/setup";

// The deck begins at A013: cards A001–A012 are the module's slot numbers, not
// printed ids, so the first real action card is the one every log test uses.
const CARD_ID = "IE-A013";
const CARD = CARD_BY_ID[CARD_ID];

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: 1,
  turn: 3,
  phase: "action",
  power: "GE",
  key: "cardPlayed",
  args: {card: CARD_ID, mode: "cp"},
  ...over,
});

const render = (entries: LogEntry[], locale: "en" | "zh_CN" = "zh_CN"): string =>
  renderToStaticMarkup(<LogList entries={entries} locale={locale}/>);

const plain = (value: string): string => value.replace(/<[^>]*>/g, "");

describe("logSegments", () => {
  test("keeps the sentence readable and the card resolvable", () => {
    const segments = logSegments({key: "cardPlayed", power: "GE", args: {card: CARD_ID, mode: "cp"}}, "zh_CN");
    expect(segments.filter((s) => s.kind === "card")).toEqual([{kind: "card", id: CARD_ID}]);
    // The visible text is what `logText` returns, with the card's title in place.
    const joined = segments.map((s) => (s.kind === "card" ? cardDisplayName(CARD, "zh_CN") : s.text)).join("");
    expect(joined).toBe(logText({key: "cardPlayed", power: "GE", args: {card: CARD_ID, mode: "cp"}}, "zh_CN"));
    expect(joined).toContain(CARD.titleZh);
  });

  test("never marks a hidden or unknown card", () => {
    const hidden = logSegments({key: "cardRemoved", power: "FR", args: {card: "hidden"}}, "zh_CN");
    expect(hidden.every((s) => s.kind === "text")).toBe(true);
    expect(logText({key: "cardRemoved", power: "FR", args: {card: "hidden"}}, "zh_CN")).toContain("隐藏卡牌");

    const unknown = logSegments({key: "cardRemoved", power: "FR", args: {card: "IE-NOPE"}}, "en");
    expect(unknown.every((s) => s.kind === "text")).toBe(true);
  });

  test("marks every card an entry names, including a list", () => {
    const segments = logSegments({key: "auctionCardsRevealed", args: {auction: "morocco", cards: `${CARD_ID},IE-A014`}}, "en");
    const ids = segments.filter((s) => s.kind === "card").map((s) => (s.kind === "card" ? s.id : ""));
    expect(ids).toEqual([CARD_ID, "IE-A014"]);
  });

  test("an unknown key stays a plain sentence", () => {
    const segments = logSegments({key: "brandNewThing", args: {card: CARD_ID}}, "en");
    expect(segments).toEqual([{kind: "text", text: "Untranslated log entry: Brand new thing"}]);
  });
});

describe("LogList", () => {
  test("draws each named card as a chip with its CP and title", () => {
    const html = render([entry()]);

    expect(html).toContain('data-testid="ie-log"');
    const chip = html.match(new RegExp(`<button[^>]*data-testid="ie-log-card-${CARD_ID}"[\\s\\S]*?</button>`));
    expect(chip).not.toBeNull();
    expect(chip![0]).toContain('type="button"');
    expect(chip![0]).toContain('aria-haspopup="dialog"');
    expect(plain(chip![0])).toBe(`${CARD.cp}${cardDisplayName(CARD, "zh_CN")}`);
    expect(chip![0]).toContain('class="ie-log-card-cp"');
    expect(chip![0]).toContain('class="ie-log-card-name"');
  });

  test("the head keeps the turn marker and the sentence around the card", () => {
    const html = render([entry()], "zh_CN");
    const line = html.match(/<div[^>]*data-testid="ie-log-entry-1"[^>]*>[\s\S]*?<\/div>/);
    expect(line).not.toBeNull();
    expect(line![0]).toContain('<span class="t">T3</span>');
    expect(plain(line![0])).toContain(`T3德国将 ${CARD.cp}${cardDisplayName(CARD, "zh_CN")} 作为 CP 打出。`);
  });

  test("a Great War entry reads GW n instead of the frozen campaign turn", () => {
    // 27.0: `G.turn` stops at the outbreak, so every GW line used to read the
    // same `T7`; the entry's own GW turn is what the marker prints.
    const html = render([entry({phase: "gwManeuver", turn: 7, gwTurn: 2, key: "gwCardPlayed", args: {card: CARD_ID, mode: "bonus"}})], "zh_CN");
    const line = html.match(/<div[^>]*data-testid="ie-log-entry-1"[^>]*>[\s\S]*?<\/div>/);
    expect(line).not.toBeNull();
    expect(line![0]).toContain('<span class="t" data-gw-turn="true">GW 2</span>');
    expect(line![0]).not.toContain("T7");
    expect(line![0]).toContain(`data-testid="ie-log-card-${CARD_ID}"`);
    expect(plain(line![0])).toContain(`GW 2德国将 ${CARD.cp}${cardDisplayName(CARD, "zh_CN")} 作为大战奖励行动打出。`);
  });

  test("a campaign entry keeps T n", () => {
    const html = render([entry({turn: 4})], "en");
    expect(html).toContain('<span class="t">T4</span>');
    expect(html).not.toContain("data-gw-turn");
  });

  test("a closed list shows no inspector, so the dialog only exists after a click", () => {
    const html = render([entry()]);
    expect(html).not.toContain('data-testid="ie-card-inspector"');
  });

  test("an entry with no card is plain text with no chip", () => {
    const html = render([entry({key: "passed", power: "UK", args: {}})]);
    expect(html).not.toContain("ie-log-card-");
    expect(plain(html)).toContain("英国停牌。");
  });

  test("the drawer's copy carries its own container id", () => {
    const html = renderToStaticMarkup(
      <LogList entries={[entry()]} locale="en" testId="ie-ref-log-entries"/>,
    );
    expect(html).toContain('data-testid="ie-ref-log-entries"');
    expect(html).not.toContain('data-testid="ie-log"');
  });
});

describe("the log's card argument covers the engine's keys", () => {
  const game = (): ImperialElegyState => setupImperialElegy({
    random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
    turn: 1,
    phase: "prep",
  } as unknown as Parameters<typeof setupImperialElegy>[0]);

  test("a real game's log names cards the viewer may see", () => {
    const G = game();
    G.log.push({id: 1, turn: 1, phase: "action", power: "GE", key: "cardPlayed", args: {card: CARD_ID, mode: "event"}});
    const chips = G.log.flatMap((e) => logSegments(e, "zh_CN")).filter((s) => s.kind === "card");
    expect(chips).toEqual([{kind: "card", id: CARD_ID}]);
  });
});
