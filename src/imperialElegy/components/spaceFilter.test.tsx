import {renderToStaticMarkup} from "react-dom/server";
import React from "react";
import {filterSpaces, orderSpaces} from "./spaceFilter";
import {SpacePicker} from "./SpacePicker";
import {ieT} from "./i18n";
import {createSpaceStates} from "../constant/spaces";
import {ImperialElegyState} from "../types";

const base = {search: "", region: "all" as const, onlyTargets: false, targets: [] as string[]};

describe("space filtering", () => {
  test("an empty search lists the whole catalogue", () => {
    expect(filterSpaces(base, "zh_CN")).toHaveLength(145);
  });

  test("finds a space by its Chinese name", () => {
    expect(filterSpaces({...base, search: "柏林"}, "zh_CN")).toContain("berlin");
  });

  test("finds a space by its English name while the UI is Chinese", () => {
    expect(filterSpaces({...base, search: "berlin"}, "zh_CN")).toContain("berlin");
  });

  test("is case-insensitive", () => {
    expect(filterSpaces({...base, search: "BERLIN"}, "en")).toContain("berlin");
  });

  test("finds a space by its id fragment", () => {
    expect(filterSpaces({...base, search: "saxo"}, "en")).toContain("saxony");
  });

  test("returns nothing for a miss, so the UI can say so", () => {
    expect(filterSpaces({...base, search: "zzzzzz"}, "en")).toHaveLength(0);
  });

  test("the region filter narrows to one region", () => {
    const africa = filterSpaces({...base, region: "africa"}, "en");
    expect(africa).toContain("morocco");
    expect(africa).not.toContain("berlin");
  });

  test("the naval filter lists the nine sea boxes", () => {
    expect(filterSpaces({...base, region: "naval"}, "en")).toHaveLength(9);
  });

  test("the target filter keeps only the legal spaces", () => {
    const shown = filterSpaces({...base, onlyTargets: true, targets: ["berlin", "paris"]}, "en");
    expect(shown.sort()).toEqual(["berlin", "paris"]);
  });

  test("targets are ordered first but the rest is kept", () => {
    const shown = filterSpaces({...base, targets: ["berlin"]}, "en");
    expect(shown[0]).toBe("berlin");
    expect(shown).toHaveLength(145);
  });

  test("ordering is stable for spaces with equal standing", () => {
    const ids = ["paris", "berlin", "saxony"];
    expect(orderSpaces(ids, new Set(["saxony"]))).toEqual(["saxony", "paris", "berlin"]);
  });

  test("search and region combine", () => {
    const shown = filterSpaces({...base, search: "a", region: "africa"}, "en");
    expect(shown).toContain("madagascar");
    expect(shown).not.toContain("berlin");
  });
});

describe("space picker markup", () => {
  const G = {spaces: createSpaceStates()} as unknown as ImperialElegyState;
  const props = {
    G,
    locale: "zh_CN" as const,
    t: ieT(),
    selected: null,
    targets: [],
    search: "",
    setSearch: () => {},
    onChoose: () => {},
    onFocus: () => {},
  };

  test("stays collapsed until asked, so the map keeps its space", () => {
    const html = renderToStaticMarkup(<SpacePicker {...props} />);
    expect(html).toContain("ie-picker-toggle");
    // The list markup (search box, region chips) is absent until expanded.
    expect(html).not.toContain("ie-picker-search");
    expect(html).not.toContain("ie-picker-list");
  });

  test("shows the selected space on the closed control", () => {
    const html = renderToStaticMarkup(<SpacePicker {...props} selected="berlin" />);
    expect(html).toContain("柏林");
  });

  test("offers a targets filter only when a decision offers targets", () => {
    expect(renderToStaticMarkup(<SpacePicker {...props} />)).not.toContain("ie-picker-targets-only");
    expect(renderToStaticMarkup(<SpacePicker {...props} targets={["berlin"]} />))
      .toContain("ie-picker-targets-only");
  });
});
