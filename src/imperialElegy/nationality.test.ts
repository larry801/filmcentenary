import {SPACES} from "./constant/spaces";
import {ImperialElegyState, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  CORE_NATIONALITIES,
  citizenshipMatchesSpace,
  coreNationalitiesOf,
  eligibleNationalistUprisingSpaces,
  isCoreNationality,
  isMinorityNationalitySpace,
  minorityNationalities,
} from "./engine/nationality";

const makeCtx = () => ({
  playerID: "0",
  random: {Die: (_sides: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

describe("core nationalities", () => {
  test("every player power has a non-empty core nationality list", () => {
    expect(Object.keys(CORE_NATIONALITIES).sort()).toEqual([...POWERS].sort());
    for (const power of POWERS) expect(CORE_NATIONALITIES[power].length).toBeGreaterThan(0);
  });

  test("coreNationalitiesOf reports the empire's own flags", () => {
    expect(coreNationalitiesOf("GE")).toEqual(["Germans"]);
    expect(coreNationalitiesOf("FR")).toEqual(["French"]);
    expect(coreNationalitiesOf("RU")).toEqual(["Russians"]);
    expect(coreNationalitiesOf("AU")).toEqual(["Austrians", "Hungarians"]);
    expect(coreNationalitiesOf("OT")).toEqual(["Turks", "Arabs"]);
  });

  test("coreNationalitiesOf returns a copy rather than the shared table", () => {
    const ge = coreNationalitiesOf("GE");
    ge.push("Poles");
    expect(coreNationalitiesOf("GE")).toEqual(["Germans"]);
  });

  test("isCoreNationality separates metropole flags from subject flags", () => {
    expect(isCoreNationality("GE", "Germans")).toBe(true);
    expect(isCoreNationality("GE", "Poles")).toBe(false);
    expect(isCoreNationality("FR", "French")).toBe(true);
    expect(isCoreNationality("RU", "Russians")).toBe(true);
    expect(isCoreNationality("AU", "Hungarians")).toBe(true);
    expect(isCoreNationality("OT", "Arabs")).toBe(true);
    expect(isCoreNationality("UK", "British")).toBe(true);
    expect(isCoreNationality("UK", "English")).toBe(true);
    // Ireland and Wales must remain minority-nationality spaces for the UK.
    expect(isCoreNationality("UK", "Irish")).toBe(false);
    expect(isCoreNationality("UK", "Welsh")).toBe(false);
  });
});

describe("minorityNationalities", () => {
  test("returns the printed flags that are not core to the controller", () => {
    expect(minorityNationalities("berlin", "GE")).toEqual([]);
    expect(minorityNationalities("ireland", "UK")).toEqual(["Irish"]);
    expect(minorityNationalities("wales", "UK")).toEqual(["Welsh"]);
    expect(minorityNationalities("poland", "RU")).toEqual(["Poles"]);
    expect(minorityNationalities("alsace-lorraine", "FR")).toEqual(["Germans"]);
    expect(minorityNationalities("alsace-lorraine", "GE")).toEqual(["French"]);
    expect(minorityNationalities("hungary", "AU")).toEqual([]);
  });

  test("a minor power or no controller sees every printed nationality", () => {
    expect(minorityNationalities("poland", null)).toEqual(["Poles"]);
    expect(minorityNationalities("poland", undefined)).toEqual(["Poles"]);
    expect(minorityNationalities("poland", "Poland")).toEqual(["Poles"]);
    expect(minorityNationalities("berlin", "Bavaria")).toEqual(["Germans"]);
  });

  test("spaces without a printed flag have no minority nationalities", () => {
    expect(minorityNationalities("north-atlantic", "UK")).toEqual([]);
    expect(minorityNationalities("london", "UK")).toEqual([]);
  });

  test("isMinorityNationalitySpace mirrors the list", () => {
    expect(isMinorityNationalitySpace("berlin", "GE")).toBe(false);
    expect(isMinorityNationalitySpace("ireland", "UK")).toBe(true);
    expect(isMinorityNationalitySpace("poland", null)).toBe(true);
  });
});

describe("eligibleNationalistUprisingSpaces", () => {
  test("excludes Berlin and the German core from GE", () => {
    const G = fresh();
    expect(G.spaces.berlin.control).toBe("GE");
    const spaces = eligibleNationalistUprisingSpaces(G);
    expect(spaces).not.toContain("berlin");
    for (const id of ["westphalia", "silesia", "pomerania", "prussia"]) {
      expect(spaces).not.toContain(id);
    }
  });

  test("includes Ireland and Wales for the UK", () => {
    const G = fresh();
    const spaces = eligibleNationalistUprisingSpaces(G);
    expect(spaces).toEqual(expect.arrayContaining(["ireland", "wales"]));
  });

  test("includes Bosnia-Herzegovina for the Ottomans and for Austria-Hungary", () => {
    const G = fresh();
    expect(G.spaces["bosnia-herzegovina"].control).toBe("OT");
    expect(eligibleNationalistUprisingSpaces(G)).toContain("bosnia-herzegovina");

    G.spaces["bosnia-herzegovina"].control = "AU";
    expect(eligibleNationalistUprisingSpaces(G)).toContain("bosnia-herzegovina");
  });

  test("includes Poland for Russia and for a German-controlled Poland", () => {
    const G = fresh();
    expect(G.spaces.poland.control).toBe("RU");
    expect(eligibleNationalistUprisingSpaces(G)).toContain("poland");

    G.spaces.poland.control = "GE";
    expect(eligibleNationalistUprisingSpaces(G)).toContain("poland");
  });

  test("requires direct player control, not a minor-power ally", () => {
    const G = fresh();
    expect(G.spaces.romania.control).toBe("Romania");
    expect(eligibleNationalistUprisingSpaces(G)).not.toContain("romania");

    G.spaces.romania.control = "GE";
    expect(eligibleNationalistUprisingSpaces(G)).toContain("romania");
  });

  test("never includes naval boxes", () => {
    const G = fresh();
    const box = SPACES["north-atlantic"];
    const saved = box.nationalities;
    try {
      // Force a nationality onto a box: the type check alone must exclude it.
      box.nationalities = ["Irish"];
      G.spaces["north-atlantic"].control = "UK";
      expect(isMinorityNationalitySpace("north-atlantic", "UK")).toBe(true);
      expect(eligibleNationalistUprisingSpaces(G)).not.toContain("north-atlantic");
    } finally {
      if (saved === undefined) delete box.nationalities;
      else box.nationalities = saved;
    }

    expect(eligibleNationalistUprisingSpaces(G).some((id) => SPACES[id].type === "navalBox")).toBe(false);
  });
});

describe("citizenshipMatchesSpace", () => {
  test("matches AU nationality citizenships in spaces that print them", () => {
    expect(citizenshipMatchesSpace("AU", "Hungarians", "hungary")).toBe(true);
    expect(citizenshipMatchesSpace("AU", "Hungarians", "transylvania")).toBe(true);
    expect(citizenshipMatchesSpace("AU", "Czechs", "bohemia")).toBe(true);
    expect(citizenshipMatchesSpace("AU", "Poles", "galicia")).toBe(true);
    expect(citizenshipMatchesSpace("AU", "Croats", "croatia")).toBe(true);
  });

  test("does not match Germans or other non-AU nationalities", () => {
    expect(citizenshipMatchesSpace("AU", "Germans", "berlin")).toBe(false);
    expect(citizenshipMatchesSpace("AU", "Germans", "alsace-lorraine")).toBe(false);
    expect(citizenshipMatchesSpace("AU", "French", "alsace-lorraine")).toBe(false);
  });

  test("requires the nationality to be printed in that space", () => {
    expect(citizenshipMatchesSpace("AU", "Czechs", "hungary")).toBe(false);
    expect(citizenshipMatchesSpace("GE", "Germans", "berlin")).toBe(true);
    expect(citizenshipMatchesSpace("GE", "Poles", "berlin")).toBe(false);
  });

  test("counts only citizenships backed by an AU-controlled space", () => {
    const G = fresh();
    G.powers.AU.citizenship = ["Czechs", "Hungarians", "Poles", "Croats"];
    const matching = () =>
      G.powers.AU.citizenship.filter((nationality) =>
        Object.values(SPACES).some(
          (space) =>
            G.spaces[space.id].control === "AU" &&
            citizenshipMatchesSpace("AU", nationality, space.id),
        ),
      ).length;

    // Bohemia (Czechs), Hungary (Hungarians), Galicia (Poles) and Croatia
    // (Croats) all start under AU control.
    expect(matching()).toBe(4);

    G.spaces.bohemia.control = "RU";
    expect(matching()).toBe(3);
  });
});
