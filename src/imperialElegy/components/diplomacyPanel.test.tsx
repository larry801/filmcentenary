/**
 * Rules 11.0 / 11.1 — the deals page rendered statically.
 *
 * The panel is the only place a player can open a formal deal (11.1), answer
 * one, counter it, or read what was shown and settled (11.0).  These assertions
 * pin what a reader sees, not how it looks: the target/counts form, a refusal
 * reason, the inbox actions and the public settlement.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {DiplomacyPanel} from "./DiplomacyPanel";
import {setupImperialElegy} from "../engine/setup";
import {negotiationOf} from "../engine/negotiation";
import {ImperialElegyState} from "../types";

const testCtx = {
  random: {Die: () => 2, Number: () => 2, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "diplomacy",
} as unknown as Ctx;

const HAND = ["IE-A018", "IE-A019", "IE-A020"];

const diplomacy = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "diplomacy";
  G.activePower = "GE";
  for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"] as const) {
    G.powers[power].hand = [...HAND];
    G.powers[power].flags.homeChosen = false;
  }
  return G;
};

/** The panel with the model's form state wired to fixed values. */
const html = (
  G: ImperialElegyState,
  overrides: Partial<React.ComponentProps<typeof DiplomacyPanel>> = {},
  locale: "en" | "zh_CN" = "zh_CN",
): string => {
  return renderToStaticMarkup(
    <DiplomacyPanel
      G={G}
      locale={locale}
      viewer="GE"
      me={G.powers.GE}
      phase={G.phase}
      eliminated={false}
      doAction={(fn) => fn()}
      moves={{}}
      deals={G.negotiation ?? {offers: [], history: [], shown: [], nextId: 1}}
      pendingDeals={[]}
      myDealOffers={G.negotiation?.offers ?? []}
      dealTarget="FR"
      setDealTarget={() => undefined}
      dealGive={1}
      setDealGive={() => undefined}
      dealTake={0}
      setDealTake={() => undefined}
      dealPromises=""
      setDealPromises={() => undefined}
      {...overrides}
    />,
  );
};

/** Only the footer hint survived as a stable marker of the form section. */
const formOf = (markup: string): string =>
  markup.slice(markup.indexOf('data-testid="ie-deals-form"'), markup.indexOf('data-testid="ie-deals-inbox"'));

describe("11.1 the offer form", () => {
  test("the counts are the reader's own give and receive", () => {
    const markup = html(diplomacy());
    expect(markup).toContain('data-testid="ie-deals-form"');
    expect(markup).toContain('data-testid="ie-deals-target"');
    expect(markup).toContain('data-testid="ie-deals-give"');
    expect(markup).toContain('data-testid="ie-deals-take"');
    expect(markup).toContain('data-testid="ie-deals-promises"');
    // A count the reader cannot pay is refused with the engine's own reason.
    expect(markup).toContain('data-testid="ie-deals-target"');
    expect(markup).not.toContain('data-testid="ie-deals-problem"');
  });

  test("the terms state plainly that every card is drawn at random", () => {
    const terms = html(diplomacy()).slice(
      (() => {
        const full = html(diplomacy());
        return full.indexOf('data-testid="ie-deals-terms"');
      })(),
    );
    expect(terms).toContain("随机转交");
    expect(terms).toContain("本土牌不参与");
  });

  test("the counts are clamped to what each side actually holds", () => {
    const G = diplomacy();
    G.powers.FR.hand = [];
    // Both inputs clamp to the live hand, so the form can never ask for more
    // than the settlement could pay.  The reader's own hand still allows a give.
    const markup = html(G);
    expect(markup).toContain('data-testid="ie-deals-take" type="number" min="0" max="0"');
    expect(markup).not.toContain('data-testid="ie-deals-problem"');
  });

  test("outside the diplomacy phase the send button is disabled", () => {
    const G = diplomacy();
    G.phase = "action";
    const markup = html(G);
    expect(markup).toContain('data-testid="ie-deals-problem"');
    expect(markup).toContain("交易只能在外交阶段提出");
    expect(formOf(markup)).toContain('disabled=""');
  });

  test("English and Chinese both name 11.1's random draw", () => {
    const en = html(diplomacy(), {}, "en");
    expect(en).toContain("randomly drawn action cards");
    expect(en.toLowerCase()).not.toContain("specific card");
  });
});

describe("11.0 shown cards", () => {
  test("the page lists the cards on the table, public and private", () => {
    const G = diplomacy();
    negotiationOf(G).shown.push(
      {card: "IE-A019", from: "UK", to: null, turn: G.turn},
      {card: "IE-A020", from: "FR", to: "GE", turn: G.turn},
    );
    const markup = html(G);
    expect(markup).toContain('data-testid="ie-deals-shown"');
    expect(markup).toContain('data-testid="ie-deals-shown-IE-A019"');
    expect(markup).toContain('data-testid="ie-deals-shown-IE-A020"');
    expect(markup).toContain("向全桌展示了");
  });

  test("nothing is shown by default", () => {
    expect(html(diplomacy())).not.toContain('data-testid="ie-deals-shown"');
  });
});

describe("11.1 the inbox", () => {
  const offered = (): ImperialElegyState => {
    const G = diplomacy();
    negotiationOf(G).offers.push({
      id: "deal-1", from: "FR", to: "GE", give: 1, take: 0,
      promises: [{from: "FR", text: "keep the fleet in port"}],
      status: "proposed", turn: G.turn, seq: 2,
    });
    return G;
  };

  test("an offer addressed to the reader shows all four answers", () => {
    const markup = html(offered());
    expect(markup).toContain('data-testid="ie-deal-deal-1"');
    expect(markup).toContain('data-testid="ie-deal-deal-1-accept"');
    expect(markup).toContain('data-testid="ie-deal-deal-1-refuse"');
    expect(markup).toContain('data-testid="ie-deal-deal-1-counter"');
    // Promises are visible and marked as unenforceable.
    expect(markup).toContain('data-testid="ie-deal-deal-1-promises"');
    expect(markup).toContain("不强制执行");
  });

  test("the reader's own offer offers a withdraw, not an accept", () => {
    const G = offered();
    G.negotiation!.offers[0].from = "GE";
    G.negotiation!.offers[0].to = "FR";
    const markup = html(G);
    expect(markup).toContain('data-testid="ie-deal-deal-1-withdraw"');
    expect(markup).not.toContain('data-testid="ie-deal-deal-1-accept"');
  });

  test("an accepted deal says it settles at the phase end", () => {
    const G = offered();
    G.negotiation!.offers[0].status = "accepted";
    const markup = html(G);
    expect(markup).toContain("已同意 · 阶段末结算");
    expect(markup).not.toContain('data-testid="ie-deal-deal-1-accept"');
  });

  test("a counter is labelled as one", () => {
    const G = offered();
    G.negotiation!.offers[0].counterOf = "deal-0";
    expect(html(G)).toContain("还价");
  });
});

describe("11.1 settlement display", () => {
  test("the settled cards are listed with their direction", () => {
    const G = diplomacy();
    G.negotiation = {
      offers: [],
      shown: [],
      nextId: 3,
      history: [{
        id: "deal-1", turn: G.turn, from: "GE", to: "FR",
        given: ["IE-A019"], taken: ["IE-A020"], shortfall: false,
      }],
    };
    const markup = html(G);
    expect(markup).toContain('data-testid="ie-settled-deal-1"');
    expect(markup).toContain("德国 → 法国");
    expect(markup).toContain("法国 → 德国");
  });

  test("an empty history explains when the draw happens", () => {
    expect(html(diplomacy())).toContain("外交阶段结束时抽牌");
  });

  test("a short deal is flagged", () => {
    const G = diplomacy();
    G.negotiation = {
      offers: [], shown: [], nextId: 3,
      history: [{id: "deal-1", turn: G.turn, from: "GE", to: "FR", given: [], taken: [], shortfall: true}],
    };
    expect(html(G)).toContain("人手不足");
  });
});

describe("the reader's own hand size", () => {
  test("the panel says how many cards may be offered", () => {
    const markup = html(diplomacy());
    expect(markup).toContain('data-testid="ie-deals-counts"');
    expect(markup).toContain("3 张可交易牌");
    // Home cards are added to the hand (11.2) but never count for a deal.
    expect(markup).toContain("本土牌永不参与转交");
  });
});

describe("6.0/9.1 the home-card step follows the table", () => {
  test("an outstanding home card offers the next step, with a button", () => {
    const markup = html(diplomacy(), {homeChoice: true, onOpenHomeChoice: () => undefined});
    expect(markup).toContain('data-testid="ie-deals-home-step"');
    expect(markup).toContain('data-testid="ie-open-home-card-from-deals"');
    expect(markup).toContain("下一步：选择本土牌");
  });

  test("a chosen home card (or no handler) shows no next step", () => {
    expect(html(diplomacy(), {homeChoice: false, onOpenHomeChoice: () => undefined}))
      .not.toContain('data-testid="ie-deals-home-step"');
    expect(html(diplomacy(), {homeChoice: true}))
      .not.toContain('data-testid="ie-deals-home-step"');
  });
});
