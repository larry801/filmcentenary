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
import {POWERS, type Power} from "../types";
import type {RovingTabProps} from "./useRovingTabs";

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

/** The seats that are in the tab order (`tabindex="0"`) in the rendered strip. */
const tabStops = (html: string): Power[] =>
  POWERS.filter((power) => tabTag(html, power).includes('tabindex="0"'));

type TabButton = React.ReactElement<
  RovingTabProps & {
    "aria-selected"?: boolean;
    onClick?: () => void;
  }
>;

/**
 * The seat buttons SeatStrip actually renders, without a DOM: a probe calls
 * the component during server rendering (so its hooks run for real) and keeps
 * the returned element tree, whose `children` are the tab buttons.  That lets
 * the test exercise the exact `onKeyDown`/`onClick`/`tabIndex` props the strip
 * spreads onto each seat.
 */
const probeSeatStrip = (props: React.ComponentProps<typeof SeatStrip>): React.ReactElement => {
  const box: {tree: React.ReactElement | null} = {tree: null};
  const Probe: React.FC = () => {
    box.tree = SeatStrip(props) as React.ReactElement;
    return null;
  };
  renderToStaticMarkup(<Probe />);
  if (box.tree === null) throw new Error("SeatStrip did not render");
  return box.tree;
};

const seatButtons = (tree: React.ReactElement): TabButton[] =>
  React.Children.toArray(tree.props.children) as TabButton[];

/** Fire one keydown at a seat tab and report whether preventDefault was called. */
const press = (handler: ((event: React.KeyboardEvent<HTMLElement>) => void) | undefined, key: string): jest.Mock => {
  if (!handler) throw new Error("seat tab has no onKeyDown");
  const preventDefault = jest.fn();
  handler({key, preventDefault} as unknown as React.KeyboardEvent<HTMLElement>);
  return preventDefault;
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

describe("SeatStrip roving tabindex", () => {
  const previousWindow = (globalThis as unknown as {window?: unknown}).window;

  beforeEach(() => {
    // useRovingTabs moves focus with window.setTimeout; the node test
    // environment has no window, so supply the one call it makes.
    (globalThis as unknown as {window?: unknown}).window = {
      setTimeout: (fn: () => void) => fn(),
    };
  });

  afterEach(() => {
    (globalThis as unknown as {window?: unknown}).window = previousWindow;
  });

  test("exactly one seat is tabbable, the others are -1, and it is the selected seat", () => {
    for (const viewer of POWERS) {
      const html = stripFor({viewer});
      expect(tabStops(html)).toEqual([viewer]);
      // Every tab carries an explicit tabindex, so there is no implicit 0.
      expect((html.match(/tabindex="/g) ?? []).length).toBe(6);
      for (const power of POWERS) {
        const selected = power === viewer;
        const tag = tabTag(html, power);
        expect(tag).toContain(selected ? 'tabindex="0"' : 'tabindex="-1"');
        expect(tag).toContain(selected ? 'aria-selected="true"' : 'aria-selected="false"');
      }
    }
  });

  test("the single tab stop follows the current seat", () => {
    const seats = deriveSeatStatuses(input({viewer: "RU"}));
    const buttons = seatButtons(probeSeatStrip({seats, onSelect: () => undefined, locale: "en"}));
    expect(buttons.map((button) => button.props.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1]);
  });

  test("arrows, Home and End move to the next/previous/first/last seat and select it", () => {
    const onSelect = jest.fn();
    const seats = deriveSeatStatuses(input({viewer: "GE"}));
    const buttons = seatButtons(probeSeatStrip({seats, onSelect, locale: "en"}));
    expect(buttons).toHaveLength(6);
    expect(buttons.map((button) => button.props.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);

    // The handler is the one SeatStrip spreads onto each tab; switching seats
    // goes through `onSelect`, exactly like a click.
    expect(press(buttons[0].props.onKeyDown, "ArrowRight")).toHaveBeenCalled();
    expect(onSelect).toHaveBeenLastCalledWith("UK");
    press(buttons[1].props.onKeyDown, "ArrowDown");
    expect(onSelect).toHaveBeenLastCalledWith("FR");
    press(buttons[2].props.onKeyDown, "ArrowLeft");
    expect(onSelect).toHaveBeenLastCalledWith("UK");
    // Both ends wrap: Up from the first seat lands on the last one.
    press(buttons[0].props.onKeyDown, "ArrowUp");
    expect(onSelect).toHaveBeenLastCalledWith("OT");
    press(buttons[3].props.onKeyDown, "Home");
    expect(onSelect).toHaveBeenLastCalledWith("GE");
    press(buttons[0].props.onKeyDown, "End");
    expect(onSelect).toHaveBeenLastCalledWith("OT");
    expect(onSelect).toHaveBeenCalledTimes(6);

    // Unrelated keys neither select nor swallow the event.
    const preventDefault = press(buttons[0].props.onKeyDown, "Tab");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(6);
  });

  test("clicking a seat still selects that seat", () => {
    const onSelect = jest.fn();
    const seats = deriveSeatStatuses(input({viewer: "GE"}));
    const buttons = seatButtons(probeSeatStrip({seats, onSelect, locale: "zh_CN"}));
    buttons[2].props.onClick?.();
    expect(onSelect).toHaveBeenCalledWith("FR");
    expect(onSelect).toHaveBeenCalledTimes(1);
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
