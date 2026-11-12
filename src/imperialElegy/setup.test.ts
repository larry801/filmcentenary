import fs from "fs";
import path from "path";
import {CAMPAIGN_SETUP} from "./constant/setup";
import {CARDS} from "./constant/cards.data";
import {MANIFEST} from "./testManifest";
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {cardsToDraw} from "./engine/rules";
import {POWERS} from "./types";

const saved = JSON.parse(fs.readFileSync(path.join(__dirname, "data/generated/campaign-setup.json"), "utf8"));
const main = saved.pieces.filter((p: any) => p.board === "Main Map");

const countImage = (image: string) => main.filter((p: any) => p.image === image).length;

test("module saved setup cross-checks the playbook unit counts", () => {
  expect(countImage("Army GE.png")).toBe(2);
  expect(countImage("FR Elite Corps.png")).toBe(1);
  expect(countImage("Army France.png")).toBe(4);
  expect(countImage("Army RU.png")).toBe(5);
  expect(countImage("Army AU.png")).toBeGreaterThanOrEqual(3);
  expect(countImage("Army 1st UK.png")).toBe(1);
  expect(countImage("Army UK IND.png")).toBe(1);
  expect(countImage("OT Army.png")).toBe(3);
  expect(countImage("OT Arab Army.png")).toBe(1);
  expect(countImage("FR Zouave.png")).toBe(1);
});

test("saved deck placement contains the 58 campaign 1850s cards", () => {
  const actionDeck = saved.pieces.filter((p: any) => p.board === "Play Decks" && p.y === 790 && p.name);
  expect(actionDeck).toHaveLength(61); // 58 campaign cards + P1-P3 promos
  const promoNames = new Set(["P1 At Any Cost/", "P2 Teddy Roosevelt/", "P3 Important Secondary Power/"]);
  const campaign = actionDeck.filter((p: any) => !promoNames.has(p.name));
  expect(campaign).toHaveLength(58);
});

test("module version and UK display match the extraction", () => {
  expect(saved.file).toBe("campaign-setup.vsav");
  expect(MANIFEST.module.version).toBe("1.1.0-beta.4");
  expect(MANIFEST.module.vassalVersion).toBe("3.7.26");
  const uk = MANIFEST.assets.find((a: any) => a.published === "displays/UK.png");
  expect(uk).toBeTruthy();
  expect(uk.original).toBe("images/Playerboard UK.png");
});

test("playbook setup quantities are represented in the card data", () => {
  expect(CARDS.actions.filter((c) => c.number! >= 13 && c.number! <= 70)).toHaveLength(58);
  expect(CAMPAIGN_SETUP.units.filter((u) => u.owner === "RU")).toHaveLength(10);
  expect(CAMPAIGN_SETUP.units.filter((u) => u.kind === "eliteCorps")).toHaveLength(2);
});

// 10.2: "Deal cards to each player based on their current industry level,
// their domination of flashpoints, any plus or minus card markers, their
// current stability level, and certain conditions such as India being stable."
// The initial deal must use the same formula as every later prep deal.
test("the initial deal uses the printed 10.2 card-draw formula", () => {
  const ctx = {
    playerID: "0",
    random: {Die: () => 1},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "prep",
  } as unknown as Ctx;
  const G = setupImperialElegy(ctx);
  for (const power of POWERS) {
    expect(G.powers[power].hand).toHaveLength(cardsToDraw(G, power));
  }
  // The flashpoint dominations make the printed deal differ from the old
  // industry-only table for the UK (Power Projection) and the Ottomans
  // (Balkans).
  expect(G.powers.UK.hand).toHaveLength(5);
  expect(G.powers.OT.hand).toHaveLength(4);
});
