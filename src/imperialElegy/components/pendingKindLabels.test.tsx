/**
 * Agent 2 round 7 — every `PendingKind` in `types.ts` must have its own
 * bilingual label in the generic pending-decision panel.  The exhaustive
 * `Record<PendingKind, true>` below is checked by `tsc`: adding a new kind to
 * the union without adding it here (and without a label) fails the build.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";

let mockLocale = "en";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

jest.mock("./map", () => {
  const React = require("react");
  return {IEMap: () => React.createElement("svg", {"data-testid": "ie-map"})};
});

jest.mock("../../constant/i18n", () => ({
  __esModule: true,
  default: {use: () => undefined, getLocaleName: () => mockLocale, locale: async () => undefined},
}));

import {ImperialElegyBoard} from "./board";
import {setupImperialElegy} from "../engine/setup";
import {ieStringsFor} from "./i18n";
import type {ImperialElegyState, PendingKind} from "../types";

/** Compile-time exhaustive list: a new `PendingKind` breaks `tsc` here. */
const ALL_PENDING_KINDS: Record<PendingKind, true> = {
  discardForStability: true,
  chooseHomeCard: true,
  giveCard: true,
  eventTargetSpace: true,
  eventTargetPower: true,
  eventChoice: true,
  eventUnits: true,
  combatSupport: true,
  navalInterception: true,
  navalPortBox: true,
  navalAvoid: true,
  navalContinuation: true,
  navalPortContinuation: true,
  mineRetreat: true,
  combatElite: true,
  combatCard: true,
  combatDiscard: true,
  combatLosses: true,
  decisiveBattle: true,
  combatRetreat: true,
  combatAdvance: true,
  movementDestination: true,
  warAim: true,
  warAlly: true,
  warInitiative: true,
  warAllyConsent: true,
  minorAbandon: true,
  minorAid: true,
  balanceOfPower: true,
  treatyOption: true,
  treatySpace: true,
  demobilizationFreeAction: true,
  goalChoice: true,
  industryCard: true,
  mpitAllocation: true,
  italyTable: true,
  crisis: true,
  crisisIncident: true,
  crisisAlliance: true,
  gwDraft: true,
  gwCard: true,
  gwWinter: true,
  scoringChoice: true,
  responseCard: true,
  confirm: true,
  impulseLoss: true,
  militarism: true,
  manpowerExcess: true,
  allianceTie: true,
  gwNeutralEntry: true,
  gwNeutralAction: true,
  gwNeutralUnit: true,
  gwNeutralDestination: true,
  gwNeutralDeploy: true,
  gwColonialTransfer: true,
  gwColonialBonusCp: true,
  bloodAndIron: true,
  germanConfederation: true,
  napoleonsLegacy: true,
  dardanellesPassage: true,
};

const KINDS = Object.keys(ALL_PENDING_KINDS) as PendingKind[];

const testCtx = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
} as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(testCtx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 2;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const withPending = (kind: PendingKind): ImperialElegyState => {
  const G = fresh();
  G.pending = {
    id: `pending-${kind}`,
    kind,
    power: "GE",
    prompt: "Choose",
    options: [{id: "option-a", label: "Option A"}],
    createdAt: 0,
  };
  return G;
};

const html = (G: ImperialElegyState): string =>
  renderToStaticMarkup(React.createElement(ImperialElegyBoard, {
    G,
    ctx: testCtx,
    moves: {},
    playerID: "0",
  }));

/** Inner text of the pending-kind readout (it contains no nested element). */
const pendingKindText = (markup: string): string => {
  const needle = 'data-testid="ie-pending-kind"';
  const start = markup.indexOf(needle);
  if (start === -1) return "";
  const openEnd = markup.indexOf(">", start);
  const close = markup.indexOf("</div>", openEnd);
  const text = close === -1 ? markup.slice(openEnd + 1) : markup.slice(openEnd + 1, close);
  // renderToStaticMarkup escapes apostrophes and ampersands in label text.
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
};

afterEach(() => {
  mockLocale = "en";
});

describe("pending-kind bilingual labels", () => {
  test("the label map covers exactly the PendingKind union", () => {
    const en = ieStringsFor("en").pendingKind as Record<string, string>;
    const zh = ieStringsFor("zh_CN").pendingKind as Record<string, string>;
    expect(Object.keys(en).sort()).toEqual([...KINDS].sort());
    expect(Object.keys(zh).sort()).toEqual([...KINDS].sort());
  });

  test("every kind has a distinct non-empty label in both languages", () => {
    const en = ieStringsFor("en");
    const zh = ieStringsFor("zh_CN");
    for (const kind of KINDS) {
      const enLabel = (en.pendingKind as Record<string, string>)[kind];
      const zhLabel = (zh.pendingKind as Record<string, string>)[kind];
      expect([kind, enLabel.length > 0]).toEqual([kind, true]);
      expect([kind, zhLabel.length > 0]).toEqual([kind, true]);
      expect([kind, enLabel === en.pendingDecision]).toEqual([kind, false]);
      expect([kind, zhLabel === zh.pendingDecision]).toEqual([kind, false]);
    }
  });

  test.each(KINDS)("%s renders its own label in both languages", (kind) => {
    const enLabel = (ieStringsFor("en").pendingKind as Record<string, string>)[kind];
    const zhLabel = (ieStringsFor("zh_CN").pendingKind as Record<string, string>)[kind];

    mockLocale = "en";
    const enText = pendingKindText(html(withPending(kind)));
    expect(enText).toContain(enLabel);
    expect(enText).not.toContain(ieStringsFor("en").pendingDecision);

    mockLocale = "zh_CN";
    const zhText = pendingKindText(html(withPending(kind)));
    expect(zhText).toContain(zhLabel);
    expect(zhText).not.toContain(ieStringsFor("zh_CN").pendingDecision);
  });
});
