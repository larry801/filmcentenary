/**
 * The local entrance's saved setup, and the solo page built on top of it.
 *
 * A solo match *is* a hotseat match whose five other seats are bots, so these
 * tests pin the wiring the solo page relies on: which seats become bots, the
 * "No GW" modifier's availability per scenario, and the hand-over URL that
 * makes the shell deal a fresh match instead of resuming the old one.
 */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";

jest.mock("./theme", () => {
  const React = require("react");
  return {
    IESurface: ({children, className}: any) => React.createElement("div", {className}, children),
    IEPanel: ({title, children, actions}: any) => React.createElement("section", null, React.createElement("h3", null, title), actions, children),
    IEBadge: ({children}: any) => React.createElement("span", null, children),
    IEChip: ({children}: any) => React.createElement("span", null, children),
  };
});

import LocalImperialElegySolo from "./solo";
import {POWERS, type Power} from "../types";
import {ieStringsFor} from "./i18n";
import {
  BOT_SEATS_KEY,
  SCENARIO_KEY,
  NO_GW_KEY,
  SOLO_POWER_KEY,
  loadBotSeats,
  loadFreshNonce,
  loadNoGw,
  loadScenario,
  loadSoloPower,
  readLocalSetup,
  saveSoloSetup,
  scenarioAllowsNoGw,
  scenarioSummary,
  soloBotSeats,
  soloMatchPath,
  wantsSeatSetup,
} from "./localSetup";

/** A minimal in-memory `localStorage` for the node test environment. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe("solo seat setup", () => {
  test("the five other powers are the bots, in printed seat order", () => {
    for (const power of POWERS) {
      const bots = soloBotSeats(power);
      expect(bots.size).toBe(POWERS.length - 1);
      expect(bots.has(power)).toBe(false);
      expect([...bots]).toEqual(POWERS.filter((candidate) => candidate !== power));
    }
  });

  test("saving a solo choice stores the bot seats, the power, the scenario and No GW", () => {
    saveSoloSetup("FR", "s1870", true);
    expect([...loadBotSeats()]).toEqual(["GE", "UK", "AU", "RU", "OT"]);
    expect(loadSoloPower()).toBe<Power>("FR");
    expect(loadScenario()).toBe("s1870");
    expect(loadNoGw()).toBe(true);
  });

  test("a garbage saved power and bot list read as the defaults", () => {
    localStorage.setItem(SOLO_POWER_KEY, "IT");
    localStorage.setItem(BOT_SEATS_KEY, JSON.stringify(["GE", "nope", 7]));
    localStorage.setItem(SCENARIO_KEY, "not-a-scenario");
    expect(loadSoloPower()).toBeNull();
    expect([...loadBotSeats()]).toEqual(["GE"]);
    expect(loadScenario()).toBe("campaign");
    expect(loadNoGw()).toBe(false);
  });
});

describe("the hand-over to the hotseat shell", () => {
  test("a fresh match is announced by the URL, so the master cannot resume the old one", () => {
    expect(soloMatchPath(1234)).toBe("/localIE?fresh=1234");
    expect(loadFreshNonce("?fresh=1234")).toBe(1234);
    // A plain hotseat visit (or a junk stamp) is not a solo hand-over.
    expect(loadFreshNonce("")).toBe(0);
    expect(loadFreshNonce("?fresh=nope")).toBe(0);
    expect(loadFreshNonce("?fresh=-4")).toBe(0);
  });

  test("`?solo=1` still opens the multi-seat setup screen", () => {
    expect(wantsSeatSetup("?solo=1")).toBe(true);
    expect(wantsSeatSetup("?fresh=99")).toBe(false);
    expect(wantsSeatSetup("")).toBe(false);
  });
});

describe("reading the whole local setup", () => {
  test("a solo hand-over opens on the picked seat with the other five as bots", () => {
    saveSoloSetup("RU", "s1880", false);
    const setup = readLocalSetup("?fresh=42");
    expect(setup.fresh).toBe(42);
    expect(setup.showSetup).toBe(false);
    expect(setup.tabIndex).toBe(POWERS.indexOf("RU"));
    expect([...setup.botSeats]).toEqual(["GE", "UK", "FR", "AU", "OT"]);
    expect(setup.scenario).toBe("s1880");
    expect(setup.noGw).toBe(false);
  });

  test("a plain hotseat visit keeps P1 and six humans", () => {
    const setup = readLocalSetup("");
    expect(setup.tabIndex).toBe(0);
    expect(setup.botSeats.size).toBe(0);
    expect(setup.showSetup).toBe(false);
    expect(setup.fresh).toBe(0);
  });

  test("`?solo=1` still offers the multi-seat setup with P2-P6 pre-ticked", () => {
    const setup = readLocalSetup("?solo=1");
    expect(setup.showSetup).toBe(true);
    expect([...setup.botSeats]).toEqual(["UK", "FR", "AU", "RU", "OT"]);
    expect(setup.tabIndex).toBe(0);
  });

  test("a saved setup whose P1 is a bot opens on the first human seat", () => {
    localStorage.setItem(BOT_SEATS_KEY, JSON.stringify(["GE", "UK"]));
    expect(readLocalSetup("").tabIndex).toBe(POWERS.indexOf("FR"));
    // A solo hand-over still prefers the power the player explicitly picked.
    saveSoloSetup("GE", "campaign", false);
    expect(readLocalSetup("?fresh=7").tabIndex).toBe(POWERS.indexOf("GE"));
  });
});

describe("the scenario line", () => {
  test("names the printed turns, the No-GW modifier and whether VPs count", () => {
    const t = ieStringsFor("zh_CN");
    const campaign = scenarioSummary("campaign", false, "zh_CN", t);
    expect(campaign).toContain("1-7");
    expect(campaign).toContain(t.scenarioCountsVp);
    expect(campaign).not.toContain("无大战");
    expect(scenarioSummary("campaign", true, "zh_CN", t)).toContain("无大战（剧本 4）");
    // The tutorial prints "do not count VPs".
    expect(scenarioSummary("tutorial1850", false, "zh_CN", t)).toContain(t.scenarioNoVp);
  });

  test("Scenario 4's No GW modifier is offered only where the playbook allows it", () => {
    expect(scenarioAllowsNoGw("campaign")).toBe(true);
    expect(scenarioAllowsNoGw("s1870")).toBe(true);
    // The tutorials print their own victory checks.
    expect(scenarioAllowsNoGw("tutorial1850")).toBe(false);
    expect(scenarioAllowsNoGw("gwTutorial")).toBe(false);
  });
});

describe("the solo page", () => {
  const render = (): string => renderToStaticMarkup(
    <MemoryRouter initialEntries={["/localIE/solo"]}>
      <LocalImperialElegySolo/>
    </MemoryRouter>,
  );

  test("offers one radial choice per great power and starts on GE", () => {
    const html = render();
    for (const power of POWERS) {
      expect(html).toContain(`data-testid="ie-solo-power-${power}"`);
    }
    expect((html.match(/type="radio"/g) ?? []).length).toBe(POWERS.length);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
    // The button that hands over to the match is present, and the summary names
    // the five bot seats.
    expect(html).toContain('data-testid="ie-solo-start"');
    expect(html).toContain('data-testid="ie-solo-summary"');
    expect(html).toContain('data-testid="ie-solo-scenario"');
  });
});

// Imported last: the page imports `i18n`, which must be initialised the same
// way the client does before rendering.
import LocalImperialElegySolo from "./solo";
