/**
 * Seat strip tests — pure derivation rules plus SSR markup.
 *
 * The strip replaces the MUI Tabs on the local hotseat screen, so the markup
 * contract matters: Playwright locates seats with `getByRole("tab", ...)` and
 * expects `P1` in the accessible name, while the board panel keeps the
 * `data-testid="ie-seat-<POWER>"` ids, which the strip must not reuse.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {
  SeatAlert,
  SeatStrip,
  deriveSeatStatuses,
  type SeatState,
  type SeatStatus,
} from "./SeatStrip";
import type {Power} from "../types";

type DeriveInput = Parameters<typeof deriveSeatStatuses>[0];

const input = (over: Partial<DeriveInput> = {}): DeriveInput => ({
  pendingPower: null,
  activePower: "GE",
  botSeats: new Set<Power>(),
  eliminated: new Set<Power>(),
  viewer: "GE",
  locale: "en",
  ...over,
});

const stateOf = (seats: SeatStatus[], power: Power): SeatState => {
  const seat = seats.find((s) => s.power === power);
  if (!seat) throw new Error(`no seat ${power}`);
  return seat.state;
};

const render = (ui: React.ReactElement): string => renderToStaticMarkup(ui);

/** The opening `<button>` tag for one seat, so attribute order does not matter. */
const tabTag = (html: string, power: Power): string => {
  const match = html.match(new RegExp(`<button[^>]*data-testid="ie-seat-status-${power}"[^>]*>`));
  expect(match).not.toBeNull();
  return match![0];
};

const stripFor = (over: Partial<DeriveInput> = {}): string => {
  const seatInput = input(over);
  return render(
    <SeatStrip seats={deriveSeatStatuses(seatInput)} onSelect={() => undefined} locale={seatInput.locale} />,
  );
};

describe("deriveSeatStatuses", () => {
  test("returns all six powers in rulebook order with 0-based indexes", () => {
    const seats = deriveSeatStatuses(input());
    expect(seats.map((s) => s.power)).toEqual(["GE", "UK", "FR", "AU", "RU", "OT"]);
    expect(seats.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("eliminated beats pending, even for a stale pending on that power", () => {
    const seats = deriveSeatStatuses(
      input({pendingPower: "GE", viewer: "GE", eliminated: new Set<Power>(["GE"])}),
    );
    expect(stateOf(seats, "GE")).toBe("eliminated");
    expect(seats.find((s) => s.power === "GE")!.label).toBe("Eliminated");
  });

  test("a pending power is 'decide' for the viewer and 'pending' for anyone else", () => {
    const mine = deriveSeatStatuses(input({pendingPower: "GE", viewer: "GE"}));
    expect(stateOf(mine, "GE")).toBe("decide");
    expect(mine.find((s) => s.power === "GE")!.label).toBe("Your decision");

    const theirs = deriveSeatStatuses(input({pendingPower: "GE", viewer: "UK"}));
    expect(stateOf(theirs, "GE")).toBe("pending");
    expect(theirs.find((s) => s.power === "GE")!.label).toBe("Decision waiting");
    // `current` still tracks the view, not the pending seat.
    expect(theirs.find((s) => s.power === "GE")!.current).toBe(false);
    expect(theirs.find((s) => s.power === "UK")!.current).toBe(true);
  });

  test("bot beats active when a bot seat is also the active power", () => {
    const seats = deriveSeatStatuses(
      input({activePower: "GE", botSeats: new Set<Power>(["GE"])}),
    );
    expect(stateOf(seats, "GE")).toBe("bot");
    expect(seats.find((s) => s.power === "GE")!.label).toBe("Bot");
  });

  test("active beats waiting, and pending wins over bot", () => {
    const seats = deriveSeatStatuses(
      input({activePower: "UK", pendingPower: "FR", botSeats: new Set<Power>(["FR"])}),
    );
    expect(stateOf(seats, "UK")).toBe("active");
    expect(stateOf(seats, "AU")).toBe("waiting");
    expect(stateOf(seats, "FR")).toBe("pending");
  });

  test("localized labels for all six states, zh and en", () => {
    // pendingPower = GE, viewer = UK gives "pending"; a second input gives
    // "decide".  Together the two cover every state.
    const zh = deriveSeatStatuses(
      input({
        pendingPower: "GE",
        viewer: "UK",
        activePower: "AU",
        botSeats: new Set<Power>(["FR"]),
        eliminated: new Set<Power>(["OT"]),
        locale: "zh_CN",
      }),
    );
    const zhLabels = Object.fromEntries(zh.map((s) => [s.power, s.label]));
    expect(zhLabels).toEqual({
      GE: "待决",
      UK: "等待",
      FR: "机器人",
      AU: "行动中",
      RU: "等待",
      OT: "已淘汰",
    });
    const zhDecide = deriveSeatStatuses(input({pendingPower: "GE", viewer: "GE", locale: "zh_CN"}));
    expect(zhDecide.find((s) => s.power === "GE")!.label).toBe("待你决策");

    const en = deriveSeatStatuses(
      input({
        pendingPower: "GE",
        viewer: "GE",
        activePower: "UK",
        botSeats: new Set<Power>(["FR"]),
        eliminated: new Set<Power>(["OT"]),
      }),
    );
    expect(en.map((s) => s.label)).toEqual([
      "Your decision",
      "Acting",
      "Bot",
      "Waiting",
      "Waiting",
      "Eliminated",
    ]);
  });
});

describe("SeatStrip markup", () => {
  test("is a tablist with six seat tabs, the first labelled P1, no board-panel id reuse", () => {
    const html = stripFor({pendingPower: "GE", viewer: "GE"});
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Seats"');
    expect(html).toContain('data-testid="ie-seat-strip"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(6);

    // Visible text carries the accessible name — no aria-label on the tab.
    expect(html).toContain("P1 · GE");
    expect(html).toContain("Germany");
    expect(html).toContain("Your decision");
    expect(tabTag(html, "GE")).not.toContain("aria-label");
    // The board panel owns ie-seat-<POWER>; the strip must not take it.
    expect(html).not.toContain('data-testid="ie-seat-GE"');
  });

  test("the current (viewer) seat is the selected tab and the only one in the tab order", () => {
    const html = stripFor({pendingPower: "UK", viewer: "UK"});
    expect(tabTag(html, "UK")).toContain('aria-selected="true"');
    expect(tabTag(html, "UK")).toContain('tabindex="0"');
    expect(tabTag(html, "GE")).toContain('aria-selected="false"');
    expect(tabTag(html, "GE")).toContain('tabindex="-1"');
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
  });

  test("each tab carries its state class and data-state", () => {
    const html = stripFor({
      pendingPower: "GE",
      viewer: "GE",
      activePower: "UK",
      botSeats: new Set<Power>(["FR"]),
      eliminated: new Set<Power>(["OT"]),
    });
    expect(tabTag(html, "GE")).toContain("ie-seat-tab-decide");
    expect(tabTag(html, "UK")).toContain("ie-seat-tab-active");
    expect(tabTag(html, "FR")).toContain("ie-seat-tab-bot");
    expect(tabTag(html, "RU")).toContain("ie-seat-tab-waiting");
    expect(tabTag(html, "OT")).toContain("ie-seat-tab-eliminated");
    expect(tabTag(html, "OT")).toContain('data-state="eliminated"');
    expect(html).toContain("✕");
    expect(html).toContain('class="ie-seat-dot" aria-hidden="true"');
  });

  test("renders Chinese labels and the Chinese tablist name", () => {
    const html = stripFor({
      pendingPower: "GE",
      viewer: "GE",
      activePower: "UK",
      botSeats: new Set<Power>(["FR"]),
      eliminated: new Set<Power>(["OT"]),
      locale: "zh_CN",
    });
    expect(html).toContain('aria-label="席位"');
    expect(html).toContain("待你决策");
    expect(html).toContain("行动中");
    expect(html).toContain("机器人");
    expect(html).toContain("等待");
    expect(html).toContain("已淘汰");
    expect(html).toContain("德国");
  });
});

describe("SeatAlert", () => {
  test("names the seat and kind and offers a jump button (en)", () => {
    const html = render(
      <SeatAlert pendingPower="GE" pendingKind="Peace deal" locale="en" onGo={() => undefined} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-testid="ie-seat-alert"');
    expect(html).toContain("Germany needs a decision: Peace deal");
    expect(html).toContain('data-testid="ie-seat-alert-go"');
    expect(html).toContain("Go to seat");
  });

  test("falls back to a generic kind and speaks Chinese", () => {
    const html = render(
      <SeatAlert pendingPower="OT" pendingKind={null} locale="zh_CN" onGo={() => undefined} />,
    );
    expect(html).toContain("奥斯曼帝国 需要决策：待决事项");
    expect(html).toContain("前往");
  });
});
