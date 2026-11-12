import {setupImperialElegy} from "./engine/setup";
import {
  applyTreatyChoice,
  buildTreatyPending,
  treatyOptionsFor,
  treatySpaceOptions,
  type TreatyOptionEntry,
} from "./engine/treatyChoice";
import {classifyVictory, createWarState} from "./engine/limitedWar";
import {PendingDecision, WarState} from "./types";

const makeCtx = (playerID: string | null = "0") =>
  ({
    playerID,
    random: {Die: () => 3},
    events: {setPhase: jest.fn(), setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
    turn: 1,
    phase: "action",
  }) as any;

const fresh = () => setupImperialElegy(makeCtx());

/** GE attacks AU over Bohemia; the attacker occupies it while AU still controls it. */
const baseWar = (G: ReturnType<typeof fresh>, objectives: string[] = ["bohemia"]): WarState => {
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  const war = createWarState(G, "GE", "AU", "conquest", objectives, 2);
  G.war = war;
  return war;
};

/** Base war plus one legal target for every option the attacker may impose. */
const richWar = (G: ReturnType<typeof fresh>) => {
  const war = baseWar(G);
  G.spaces.vienna.occupiedBy = "GE"; // war reparations: GE occupies an AU home
  G.spaces.bavaria.ally = "AU"; // realignment: Bavaria is allied to AU
  G.spaces.canada.control = "AU"; // colonial cession: an AU-held colonial key
  return war;
};

const optionIds = (entries: readonly TreatyOptionEntry[]): string[] => entries.map((entry) => entry.option);

// ---------------------------------------------------------------------------
// Legal option filtering
// ---------------------------------------------------------------------------

test("treatyOptionsFor keeps only legal options and labels the winner", () => {
  const G = fresh();
  const war = baseWar(G);
  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("normal");
  expect(victory.winner).toBe("GE");

  // Bare setup: cession and reparations (GE occupies Bohemia, an AU home).
  // Realignment has no allied minor yet, no AU colony is available and
  // righteous defense is defender-only.
  const base = treatyOptionsFor(G, war, victory);
  expect(optionIds(base)).toEqual(["territorialCession", "warReparations"]);
  expect(base[0].label).toBe("Territorial Cession");
  expect(base[0].winnerLabel).toBe("Germany");
  expect(base[0].beneficiary).toBe("GE");
  expect(base[0].target).toBe("AU");
  expect(base[0].choice).toEqual({
    option: "territorialCession",
    spaces: ["bohemia"],
    beneficiary: "GE",
  });

  // Add a legal target for realignment, reparations and a colonial cession.
  G.spaces.vienna.occupiedBy = "GE";
  G.spaces.bavaria.ally = "AU";
  G.spaces.canada.control = "AU";

  const all = treatyOptionsFor(G, war, victory);
  expect(optionIds(all)).toEqual([
    "territorialCession",
    "realignment",
    "warReparations",
    "colonialCession",
  ]);
  for (const entry of all) {
    expect(entry.winnerLabel).toBe("Germany");
    expect(entry.beneficiary).toBe("GE");
  }
  const realignment = all.find((entry) => entry.option === "realignment")!;
  expect(realignment.minors).toContain("Bavaria");
  expect(realignment.choice.minor).toBe("Bavaria");
  expect(realignment.requiresMinor).toBe(true);

  const colonial = all.find((entry) => entry.option === "colonialCession")!;
  expect(colonial.spaces).toContain("canada");
  expect(colonial.requiresSpace).toBe(true);
  expect(colonial.choice.space).toBeDefined();

  // Righteous defense is defender-only.
  expect(optionIds(all)).not.toContain("righteousDefense");
});

test("treatyOptionsFor returns nothing for a white peace", () => {
  const G = fresh();
  G.spaces.bohemia.control = "AU";
  G.spaces.bohemia.occupiedBy = null;
  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  G.war = war;

  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("whitePeace");
  expect(victory.totalTreatyOptions).toBe(0);
  expect(treatyOptionsFor(G, war, victory)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Pending decision shape
// ---------------------------------------------------------------------------

test("buildTreatyPending produces an openable treatyOption decision", () => {
  const G = fresh();
  const war = richWar(G);
  const victory = classifyVictory(G, war);
  const entries = treatyOptionsFor(G, war, victory);
  const pending = buildTreatyPending(G, "GE", entries, {victory, remaining: 1});

  expect(pending.kind).toBe("treatyOption");
  expect(pending.power).toBe("GE");
  expect(pending.blocking).toBe(true);
  expect(pending.prompt).toBe("Choose a treaty option");
  expect(pending).not.toHaveProperty("id");
  expect(pending).not.toHaveProperty("createdAt");

  expect(pending.options.map((entry) => entry.id)).toEqual(optionIds(entries));
  expect(pending.options.length).toBe(entries.length);

  const territorial = pending.options.find((entry) => entry.id === "territorialCession")!;
  expect(territorial.label).toContain("Germany");
  expect(territorial.data).toMatchObject({
    option: "territorialCession",
    beneficiary: "GE",
    winnerLabel: "Germany",
    target: "AU",
  });
  expect((territorial.data?.choice as {spaces?: string[]}).spaces).toEqual(["bohemia"]);

  const context = pending.context as Record<string, any>;
  expect(context.victory.kind).toBe(victory.kind);
  expect(context.options).toHaveLength(entries.length);
  expect(context.remaining).toBe(1);
  expect(context.winner).toBe("GE");
  expect(context.winnerLabel).toBe("Germany");
  expect(pending.promptArgs).toMatchObject({winner: "GE", winnerLabel: "Germany", remaining: 1});
});

// ---------------------------------------------------------------------------
// Applying the choice
// ---------------------------------------------------------------------------

test("applyTreatyChoice applies the chosen treaty", () => {
  const G = fresh();
  const war = baseWar(G);
  const victory = classifyVictory(G, war);
  const pending = buildTreatyPending(G, "GE", treatyOptionsFor(G, war, victory), {victory});

  const result = applyTreatyChoice(G, pending, "territorialCession");
  expect(result.ok).toBe(true);
  expect(result.error).toBeUndefined();
  expect(result.result?.applied).toBe(true);
  expect(result.result?.option).toBe("territorialCession");

  expect(G.spaces.bohemia.control).toBe("GE");
  expect(G.spaces.bohemia.occupiedBy).toBeNull();
  expect(war.treaties).toContain("territorialCession");
  expect(result.result?.affectedSpaces).toEqual(["bohemia"]);
});

test("applyTreatyChoice applies war reparations to the winner", () => {
  const G = fresh();
  const war = richWar(G);
  const victory = classifyVictory(G, war);
  const pending = buildTreatyPending(G, "GE", treatyOptionsFor(G, war, victory), {victory});

  const beforeGE = G.powers.GE.cardMarkers;
  const beforeAU = G.powers.AU.cardMarkers;
  const result = applyTreatyChoice(G, pending, "warReparations");

  expect(result.ok).toBe(true);
  expect(G.powers.GE.cardMarkers).toBe(beforeGE + 1);
  expect(G.powers.AU.cardMarkers).toBe(beforeAU - 1);
  expect(war.treaties).toContain("warReparations");
});

// ---------------------------------------------------------------------------
// Invalid choices are no-ops
// ---------------------------------------------------------------------------

test("applyTreatyChoice ignores unknown ids and illegal options without mutating", () => {
  const G = fresh();
  const war = baseWar(G);
  const victory = classifyVictory(G, war);
  const pending = buildTreatyPending(G, "GE", treatyOptionsFor(G, war, victory), {victory});

  const snapshot = () =>
    JSON.stringify({
      bohemia: G.spaces.bohemia,
      treaties: war.treaties,
      markers: {GE: G.powers.GE.cardMarkers, AU: G.powers.AU.cardMarkers},
    });
  const before = snapshot();

  const unknown = applyTreatyChoice(G, pending, "not-a-treaty");
  expect(unknown.ok).toBe(false);
  expect(unknown.error).toBe("unknown-option");
  expect(unknown.result).toBeUndefined();
  expect(snapshot()).toBe(before);

  expect(applyTreatyChoice(G, null, "territorialCession").error).toBe("no-pending");
  expect(snapshot()).toBe(before);

  const wrongKind: PendingDecision = {
    id: "d1",
    createdAt: 1,
    kind: "confirm",
    power: "GE",
    prompt: "Confirm",
    options: [{id: "territorialCession", label: "Territorial Cession"}],
  };
  expect(applyTreatyChoice(G, wrongKind, "territorialCession").error).toBe("unsupported-kind");
  expect(snapshot()).toBe(before);

  // The option was legal when the pending was built, but AU no longer controls
  // the objective: applyTreaty rejects it and leaves the state alone.
  G.spaces.bohemia.control = "GE";
  const stale = snapshot();
  const illegal = applyTreatyChoice(G, pending, "territorialCession");
  expect(illegal.ok).toBe(false);
  expect(illegal.error).toBe("invalid-treaty");
  expect(illegal.result?.applied).toBe(false);
  expect(snapshot()).toBe(stale);
});

// ---------------------------------------------------------------------------
// Once-per-option guard
// ---------------------------------------------------------------------------

test("a treaty option can be imposed only once per war", () => {
  const G = fresh();
  const war = baseWar(G);
  const victory = classifyVictory(G, war);
  const pending = buildTreatyPending(G, "GE", treatyOptionsFor(G, war, victory), {victory});

  const first = applyTreatyChoice(G, pending, "territorialCession");
  expect(first.ok).toBe(true);
  const treatiesAfter = [...war.treaties];
  const controlAfter = G.spaces.bohemia.control;

  const second = applyTreatyChoice(G, pending, "territorialCession");
  expect(second.ok).toBe(false);
  expect(second.error).toBe("invalid-treaty");
  expect(second.result?.applied).toBe(false);
  expect(second.issues.join(" ")).toContain("already been chosen");
  expect(war.treaties).toEqual(treatiesAfter);
  expect(G.spaces.bohemia.control).toBe(controlAfter);
  expect(war.treaties.filter((option) => option === "territorialCession")).toHaveLength(1);

  // The builder hides an already-used option even when it would otherwise fit.
  const G2 = fresh();
  const war2 = baseWar(G2);
  war2.treaties.push("territorialCession");
  const victory2 = classifyVictory(G2, war2);
  expect(optionIds(treatyOptionsFor(G2, war2, victory2))).not.toContain("territorialCession");
});

// ---------------------------------------------------------------------------
// Space options
// ---------------------------------------------------------------------------

test("treatySpaceOptions lists legal cession targets", () => {
  const G = fresh();
  const war = baseWar(G);
  G.spaces.canada.control = "AU";
  const victory = classifyVictory(G, war);
  const entries = treatyOptionsFor(G, war, victory);

  const colonial = entries.find((entry) => entry.option === "colonialCession")!;
  expect(colonial.spaces).toContain("canada");

  const colonialOptions = treatySpaceOptions(G, colonial);
  const canada = colonialOptions.find((option) => option.id === "canada");
  expect(canada).toBeDefined();
  expect(canada!.label).toBe("Canada");
  expect(canada!.data).toMatchObject({space: "canada", option: "colonialCession"});

  const territorial = entries.find((entry) => entry.option === "territorialCession")!;
  expect(treatySpaceOptions(G, territorial).map((option) => option.id)).toEqual(["bohemia"]);
  expect(treatySpaceOptions(G, "territorialCession", victory).map((option) => option.id)).toEqual(["bohemia"]);

  // Realignment picks a minor, not a space.
  expect(treatySpaceOptions(G, "realignment")).toEqual([]);

  // A space decision can be applied directly through the same helper.
  const spacePending: PendingDecision = {
    id: "d2",
    createdAt: 2,
    kind: "treatySpace",
    power: "GE",
    prompt: "Choose a space",
    options: colonialOptions,
    context: {
      victory,
      option: "colonialCession",
      choice: {option: "colonialCession", beneficiary: "GE"},
    },
    blocking: true,
  };
  const applied = applyTreatyChoice(G, spacePending, "canada");
  expect(applied.ok).toBe(true);
  expect(applied.result?.applied).toBe(true);
  expect(G.spaces.canada.control).toBe("GE");
  expect(war.treaties).toContain("colonialCession");
});

test("righteous defense is offered to a defending winner and frees a home space", () => {
  const G = fresh();
  const war = baseWar(G);
  G.spaces.berlin.occupiedBy = "AU"; // the defender holds the attacker capital

  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("major");
  expect(victory.victor).toBe("defender");
  expect(victory.winner).toBe("AU");

  // Bohemia is an AU home occupied by GE, so righteous defense may free it.
  const entries = treatyOptionsFor(G, war, victory);
  const righteous = entries.find((entry) => entry.option === "righteousDefense")!;
  expect(righteous.winnerLabel).toBe("Austria-Hungary");
  expect(righteous.spaces).toContain("bohemia");
  expect(righteous.requiresSpace).toBe(true);

  const spaceOptions = treatySpaceOptions(G, righteous);
  expect(spaceOptions.map((option) => option.id)).toContain("bohemia");

  const pending = buildTreatyPending(G, "AU", entries, {victory});
  const applied = applyTreatyChoice(G, pending, "righteousDefense");
  expect(applied.ok).toBe(true);
  expect(G.spaces.bohemia.control).toBe("AU");
  expect(G.spaces.bohemia.occupiedBy).toBeNull();
  expect(war.treaties).toContain("righteousDefense");
});
