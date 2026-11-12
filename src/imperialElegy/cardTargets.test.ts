import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";
import {SPACES} from "./constant/spaces";
import type {Power} from "./types";
import {POWERS} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

/** Put a card in `power`'s hand and play it as an event; returns the matching ctx. */
const playEvent = (G: ReturnType<typeof fresh>, cardId: string, power: Power = "GE") => {
  G.phase = "action";
  G.activePower = power;
  if (!G.powers[power].hand.includes(cardId)) G.powers[power].hand.push(cardId);
  const ctx = makeCtx(String(POWERS.indexOf(power)));
  expect(playCard(G, ctx, cardId, "event")).toBeUndefined();
  return ctx;
};

const optionIds = (G: ReturnType<typeof fresh>): string[] =>
  (G.pending?.options ?? []).map((o) => o.id);

const unitByOwner = (G: ReturnType<typeof fresh>, space: string, owner: string) =>
  G.spaces[space].units.map((id) => G.units[id]).find((u) => u.owner === owner);

test("Diplomatic Incident offers every minor alliance and removes the chosen one", () => {
  const G = fresh();
  G.spaces["qajar-persia"].ally = "RU";
  G.spaces["qajar-persia"].diplomacy = "RU";
  G.spaces.tripoli.ally = "OT";
  G.spaces.tripoli.diplomacy = "OT";
  const ctx = playEvent(G, "IE-A020");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(optionIds(G)).toEqual(["tripoli", "qajar-persia"]);

  resolvePending(G, ctx, "qajar-persia");
  expect(G.pending).toBeNull();
  expect(G.spaces["qajar-persia"].ally).toBeNull();
  expect(G.spaces["qajar-persia"].diplomacy).toBeNull();
  expect(G.spaces.tripoli.ally).toBe("OT");
});

test("Chinese Intervention lets the player choose the Qing China space for the Qing army", () => {
  const G = fresh();
  G.spaces.shanghai.control = "GE";
  G.spaces.guangzhou.control = "Japan";
  const ctx = playEvent(G, "IE-A026");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(optionIds(G)).toEqual(["shanghai", "guangzhou"]);

  resolvePending(G, ctx, "guangzhou");
  expect(G.spaces.guangzhou.rebellion?.minor).toBe("Qing");
  expect(unitByOwner(G, "guangzhou", "REBEL:Qing")?.steps).toBe(1);
  expect(G.flags["qingIntervention_guangzhou"]).toBe(G.turn);
  expect(G.spaces.shanghai.rebellion).toBeNull();
});

test("Decline of the Qing lets the player choose which Qing-controlled space to take", () => {
  const G = fresh();
  // A34 is printed "Germany only after unification".
  G.powers.GE.unified = true;
  const ctx = playEvent(G, "IE-A034");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(optionIds(G)).toEqual(["manchuria", "shanghai", "shandong-peninsula", "guangzhou"]);

  resolvePending(G, ctx, "guangzhou");
  expect(G.spaces.guangzhou.control).toBe("GE");
  expect(G.spaces.manchuria.control).toBe("Qing China");
});

test("The Great Game lets the player choose one of the five great-game spaces", () => {
  const G = fresh();
  // A37 is printed "Playable by UK, Ottomans, France or Russia".
  const ctx = playEvent(G, "IE-A037", "UK");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(optionIds(G)).toEqual(["qajar-persia", "kuwait", "balochistan", "central-asia", "afghanistan"]);

  resolvePending(G, ctx, "central-asia");
  expect(G.spaces["central-asia"].influence).toBe("UK");
  expect(unitByOwner(G, "central-asia", "UK")?.kind).toBe("expeditionary");
  expect(G.spaces["central-asia"].pacification).toBe(1);
  expect(G.spaces["qajar-persia"].influence).toBeNull();
});

test("French Intervention lets the player choose the uncontrolled destination", () => {
  const G = fresh();
  const ctx = playEvent(G, "IE-A046");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  const ids = optionIds(G);
  expect(ids[0]).toBe("indochina");
  expect(ids).toContain("mexico");

  resolvePending(G, ctx, "mexico");
  expect(G.spaces.mexico.influence).toBe("FR");
  expect(unitByOwner(G, "mexico", "FR")?.kind).toBe("expeditionary");
  expect(G.spaces.mexico.pacification).toBe(1);
  expect(G.spaces.mexico.control).toBe("Mexico");
});

test("Loose Grip takes every Ottoman-named space without a choice", () => {
  const G = fresh();
  // A79 is printed "Germany only after unification".
  G.powers.GE.unified = true;
  for (const id of ["tripoli", "benghazi", "tunisia"]) G.spaces[id].control = "OT";
  playEvent(G, "IE-A079");

  expect(G.pending).toBeNull();
  for (const id of ["tripoli", "benghazi", "tunisia"]) {
    expect(G.spaces[id].control).toBe("GE");
  }
  expect(G.discard).toContain("IE-A079");
});

test("Nationalist Uprising lets the player choose the minority-nationality space", () => {
  // The campaign data now prints nationalities on many spaces, so isolate the
  // two spaces under test while the event builds its candidate list.  The
  // printed data is restored afterwards for the rest of the file.
  const saved = new Map<string, string[] | undefined>();
  for (const space of Object.values(SPACES)) {
    saved.set(space.id, space.nationalities);
    if (space.id !== "serbia" && space.id !== "poland") delete space.nationalities;
  }
  const serbia = SPACES.serbia as unknown as {nationalities?: string[]};
  const poland = SPACES.poland as unknown as {nationalities?: string[]};
  serbia.nationalities = ["Serbians"];
  poland.nationalities = ["Poles"];
  try {
    const G = fresh();
    const ctx = playEvent(G, "IE-A084");

    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect(optionIds(G)).toEqual(["serbia", "poland"]);

    resolvePending(G, ctx, "poland");
    expect(G.spaces.poland.rebellion?.minor).toBe("Rebels");
    expect(unitByOwner(G, "poland", "REBEL:Poles")?.steps).toBe(2);
    expect(G.spaces.serbia.rebellion).toBeNull();
  } finally {
    for (const [id, nationalities] of saved) {
      if (nationalities === undefined) delete SPACES[id].nationalities;
      else SPACES[id].nationalities = nationalities;
    }
  }
});

test("Mahdist War lets the player choose the African space for the Mahdi army", () => {
  const G = fresh();
  const markersBefore = G.powers.FR.cardMarkers;
  const ctx = playEvent(G, "IE-A087");

  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(optionIds(G)).toEqual([
    "south-africa",
    "benghazi",
    "tripoli",
    "tunisia",
    "algeria",
    "west-africa",
  ]);

  resolvePending(G, ctx, "algeria");
  expect(unitByOwner(G, "algeria", "REBEL:Mahdi")?.steps).toBe(1);
  expect(G.spaces.algeria.pacification).toBe(1);
  expect(G.powers.FR.cardMarkers).toBe(markersBefore - 1);
});
