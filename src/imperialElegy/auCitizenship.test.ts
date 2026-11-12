import {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {citizenshipMatchesSpace, matchedAuCitizenshipCount} from "./engine/nationality";

const makeCtx = () => ({
  playerID: "0",
  random: {Die: (_sides: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("matchedAuCitizenshipCount", () => {
  test("is zero when Austria has no citizenship entries", () => {
    const G = fresh();
    G.powers.AU.citizenship = [];
    expect(matchedAuCitizenshipCount(G)).toBe(0);
  });

  test("counts three citizenships backed by AU-controlled spaces", () => {
    const G = fresh();
    // Bohemia prints Czechs, Hungary prints Hungarians and Galicia prints
    // Poles; all three start under AU control.
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles"];
    expect(matchedAuCitizenshipCount(G)).toBe(3);
  });

  test("counts four citizenships backed by AU-controlled spaces", () => {
    const G = fresh();
    // Croatia prints Croats and also starts under AU control.
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    expect(matchedAuCitizenshipCount(G)).toBe(4);
  });

  test("counts a duplicated citizenship entry only once", () => {
    const G = fresh();
    G.powers.AU.citizenship = [
      "Czechs",
      "Czechs",
      "Hungarians",
      "Hungarians",
      "Poles",
      "Poles",
    ];
    expect(matchedAuCitizenshipCount(G)).toBe(3);
  });

  test("stops counting a citizenship when its space leaves AU control", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    expect(matchedAuCitizenshipCount(G)).toBe(4);

    // Bohemia falls to Russia: Czechs no longer have an AU-controlled space.
    G.spaces.bohemia.control = "RU";
    expect(matchedAuCitizenshipCount(G)).toBe(3);

    // Croatia falls to the Ottomans too.
    G.spaces.croatia.control = "OT";
    expect(matchedAuCitizenshipCount(G)).toBe(2);

    // Restoring control restores the matches.
    G.spaces.bohemia.control = "AU";
    G.spaces.croatia.control = "AU";
    expect(matchedAuCitizenshipCount(G)).toBe(4);
  });

  test("does not count core-only entries with no matching AU space", () => {
    const G = fresh();
    // Core flags of other powers: none is an AU citizenship nationality, so
    // even four entries never satisfy the achievement.
    G.powers.AU.citizenship = ["Germans", "French", "Russians", "British"];
    expect(matchedAuCitizenshipCount(G)).toBe(0);

    // Berlin printing Germans under AU control still does not match: Germans
    // are not one of the eight AU nationalities.
    G.spaces.berlin.control = "AU";
    expect(citizenshipMatchesSpace("AU", "Germans", "berlin")).toBe(false);
    expect(matchedAuCitizenshipCount(G)).toBe(0);
  });
});
