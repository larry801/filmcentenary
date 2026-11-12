import {SPACES} from "./constant/spaces";
import {POWERS} from "./types";

const nationalitiesOf = (spaceId: string): string[] => SPACES[spaceId]?.nationalities ?? [];

const landSpacesWithNationalities = () =>
  Object.values(SPACES).filter(
    (space) => space.type !== "navalBox" && (space.nationalities?.length ?? 0) > 0,
  );

/**
 * Rule 3.2.6 and the nationality-driven cards.  `arrayContaining` keeps the
 * checks on the printed names while allowing the extra flag a space may carry
 * (for example Transylvania prints both a Hungarian and a Romanian flag).
 */
const REQUIRED_NATIONALITIES: Record<string, readonly string[]> = {
  // Poland and the Polish Revolt.
  poland: ["Poles"],

  // The eight AU nationalities of rule 33.4.1.
  bohemia: ["Czechs"],
  hungary: ["Hungarians"],
  transylvania: ["Romanians"],
  banat: ["Hungarians", "Serbians", "Romanians"],
  croatia: ["Croats"],
  serbia: ["Serbians"],
  galicia: ["Poles", "Ukrainians"],
  "bosnia-herzegovina": ["Bosnians"],
  lombardy: ["Italians"],
  tyrol: ["Italians"],

  // Other Italian unification spaces.
  piedmont: ["Italians"],
  tuscany: ["Italians"],
  naples: ["Italians"],

  // Russian borderlands.
  finland: ["Finns"],
  "baltic-states": ["Latvians", "Lithuanians", "Estonians"],
  "west-ukraine": ["Ukrainians"],
  belorussia: ["Belarusians"],

  // Ottoman Arab and Egyptian spaces.
  egypt: ["Egyptians", "Arabs"],
  arabia: ["Arabs"],
  mecca: ["Arabs"],
  syria: ["Syrians", "Arabs"],
  palestine: ["Palestinians", "Arabs"],

  // Armenian spaces.
  van: ["Armenians"],
  erzurum: ["Armenians"],
  kayseri: ["Armenians"],

  // British Isles.
  ireland: ["Irish"],
  scotland: ["Scots"],
  wales: ["Welsh"],

  // Contested borderlands.
  "alsace-lorraine": ["French", "Germans"],
  "schleswig-holstein": ["Danes"],

  // Balkans.
  romania: ["Romanians"],
  bulgaria: ["Bulgarians"],
  greece: ["Greeks"],
  macedonia: ["Macedonians", "Bulgarians"],
};

describe("space nationalities", () => {
  test("every power with a home space has at least one home nationality", () => {
    const powersWithout = POWERS.filter((power) => {
      const homes = Object.values(SPACES).filter((space) => space.home === power);
      return homes.length > 0 && !homes.some((space) => (space.nationalities?.length ?? 0) > 0);
    });
    expect(powersWithout).toEqual([]);
  });

  test("the card-relevant spaces carry their printed nationalities", () => {
    const missing = Object.entries(REQUIRED_NATIONALITIES).filter(([spaceId, expected]) => {
      const actual = nationalitiesOf(spaceId);
      return !expected.every((nationality) => actual.includes(nationality));
    });
    expect(missing).toEqual([]);
  });

  test("Nationalist Uprising has legal minority-nationality targets", () => {
    // The handler keeps spaces with a nationality that are controlled by a
    // player.  At setup each major power controls at least one such space, so
    // the event can never be stranded without a legal target.
    const targets = landSpacesWithNationalities().filter(
      (space) => space.control !== null && (POWERS as readonly string[]).includes(space.control as string),
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.map((space) => space.id)).toEqual(
      expect.arrayContaining(["poland", "serbia", "bosnia-herzegovina", "bulgaria"]),
    );

    const powersWithTargets = new Set(targets.map((space) => space.control));
    for (const power of POWERS) expect(powersWithTargets.has(power)).toBe(true);
  });

  test("Polish Revolt has Polish-nationality spaces to target", () => {
    const polish = Object.values(SPACES)
      .filter((space) => space.nationalities?.includes("Poles"))
      .map((space) => space.id);
    expect(polish).toEqual(expect.arrayContaining(["poland", "galicia"]));
  });

  test("rebellion-card spaces carry nationalities", () => {
    const rebellionSpaces = [
      "ireland", // Uprising in Ireland
      "poland", // Polish Revolt and Nationalist Uprising
      "galicia", // Polish Revolt (Polish minority)
      "serbia",
      "bosnia-herzegovina",
      "bulgaria",
      "macedonia",
      "greece",
      "romania",
    ];
    const missing = rebellionSpaces.filter((spaceId) => nationalitiesOf(spaceId).length === 0);
    expect(missing).toEqual([]);
  });

  test("no space lists a nationality twice", () => {
    const duplicated = Object.values(SPACES).filter((space) => {
      const list = space.nationalities ?? [];
      return new Set(list).size !== list.length;
    });
    expect(duplicated.map((space) => space.id)).toEqual([]);
  });

  test("nationalities never appear on naval boxes", () => {
    const navalWithNationalities = Object.values(SPACES).filter(
      (space) => space.type === "navalBox" && (space.nationalities?.length ?? 0) > 0,
    );
    expect(navalWithNationalities.map((space) => space.id)).toEqual([]);
    expect(landSpacesWithNationalities().length).toBeGreaterThan(0);
  });
});
