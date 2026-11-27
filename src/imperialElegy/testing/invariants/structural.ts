/**
 * A group — structural conservation.
 *
 * Every check here is a statement about one state in isolation: it holds after
 * *every* dispatched action, whatever the phase.  Checks that need the previous
 * state are in the `C` group instead.
 */
import type {CardId, ImperialElegyState, Power, SpaceId} from "../../types";
import {PENDING_KINDS, POWERS} from "../../types";
import {SPACES, isNavalBox} from "../../constant/spaces";
import {
  COUNTER_CHART_POWERS,
  counterPool,
  countersOwned,
  countersUsed,
  type CounterKind,
} from "../../engine/counters";
import {
  PORT_NAVAL_LIMIT,
  armyCountIn,
  isArmyKind,
  isEliteKind,
  isNavalKind,
  landStackingLimit,
  minorAlliesOf,
  navalUnitsIn,
  recomputeTracks,
} from "../../engine/rules";
import {ALLIANCE_MAX_PLAYERS, allianceMembers} from "../../engine/alliance";
import {MINOR_ALLY_CAP} from "../../engine/effects";
import {cpChainResolution} from "../../engine/economy";
import {violationAt} from "./types";
import type {CheckContext, Invariant, Severity, Violation} from "./types";

const PHASES = [
  "prep",
  "diplomacy",
  "action",
  "wartime",
  "end",
  "gwOutbreak",
  "gwPlanning",
  "gwManeuver",
  "gwWinter",
  "gameOver",
] as const;

const BATTLE_STAGES = [
  "support",
  "cards",
  "roll",
  "lossesAttack",
  "lossesDefense",
  "retreat",
  "advance",
  "done",
] as const;

const at = violationAt;

/**
 * A home card is not a zone: it lives in `homeCards` permanently and is also in
 * `hand` while it is the turn's selected card (10.4).  Tracking it as a zone
 * would report every normal turn as a double-placement.
 */
const isHomeCard = (G: ImperialElegyState, card: CardId): boolean =>
  POWERS.some((p) => (G.powers[p].homeCards ?? []).includes(card));

interface Zone {
  where: string;
  cards: CardId[];
}

/** Every real card zone, with a report path for each. */
const cardZones = (G: ImperialElegyState): Zone[] => {
  const zones: Zone[] = [
    {where: "deck", cards: G.deck ?? []},
    {where: "discard", cards: G.discard ?? []},
    {where: "removed", cards: G.removed ?? []},
  ];
  for (const [decade, cards] of Object.entries(G.delayedCards ?? {})) {
    zones.push({where: `delayedCards.${decade}`, cards: cards ?? []});
  }
  for (const p of POWERS) {
    const ps = G.powers[p];
    zones.push({where: `powers.${p}.hand`, cards: ps.hand ?? []});
    zones.push({where: `powers.${p}.cpChain`, cards: ps.cpChain ?? []});
    if (ps.industryCard) zones.push({where: `powers.${p}.industryCard`, cards: [ps.industryCard]});
    if (ps.gwCard) zones.push({where: `powers.${p}.gwCard`, cards: [ps.gwCard]});
  }
  return zones;
};

// ---------------------------------------------------------------------------
// A01 — one physical copy, one zone
// ---------------------------------------------------------------------------

export const A01: Invariant = {
  code: "A01",
  rule: "9.x / 10.x",
  level: "cheap",
  severity: "error",
  title: "a card is in at most one zone",
  check: (G) => {
    const bad = at(A01);
    const seen = new Map<CardId, string>();
    const out: Violation[] = [];
    for (const zone of cardZones(G)) {
      for (const card of zone.cards) {
        if (isHomeCard(G, card)) continue;
        const prev = seen.get(card);
        if (prev === undefined) {
          seen.set(card, zone.where);
          continue;
        }
        out.push(
          bad(
            `${zone.where}`,
            card,
            "the card is in exactly one of deck/discard/removed/delayed/hand/cpChain/industryCard/gwCard",
            `card ${card} is in both ${prev} and ${zone.where}`,
          ),
        );
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A02 — no duplicate inside a zone, and no duplicate decision id
// ---------------------------------------------------------------------------

export const A02: Invariant = {
  code: "A02",
  rule: "9.x",
  level: "cheap",
  severity: "error",
  title: "no zone lists the same entry twice; pending ids are unique",
  check: (G) => {
    const bad = at(A02);
    const out: Violation[] = [];
    for (const zone of cardZones(G)) {
      const seen = new Set<CardId>();
      zone.cards.forEach((card, index) => {
        if (seen.has(card)) {
          out.push(bad(`${zone.where}[${index}]`, card, "each card appears once in a zone", `${card} appears twice in ${zone.where}`));
        }
        seen.add(card);
      });
    }
    const ids = new Map<string, string>();
    const note = (id: string, where: string) => {
      const prev = ids.get(id);
      if (prev !== undefined) out.push(bad(where, id, "each decision id is unique", `decision id ${id} is in both ${prev} and ${where}`));
      else ids.set(id, where);
    };
    if (G.pending) note(G.pending.id, "pending");
    (G.pendingStack ?? []).forEach((decision, index) => note(decision.id, `pendingStack[${index}]`));
    return out;
  },
};

// ---------------------------------------------------------------------------
// A03 — unit bookkeeping is a bijection
// ---------------------------------------------------------------------------

export const A03: Invariant = {
  code: "A03",
  rule: "5.x",
  level: "cheap",
  severity: "error",
  title: "a unit is in G.units and in exactly one space's units list",
  check: (G) => {
    const bad = at(A03);
    const out: Violation[] = [];
    const listed = new Map<string, SpaceId>();
    for (const [spaceId, space] of Object.entries(G.spaces)) {
      (space.units ?? []).forEach((uid, index) => {
        const prev = listed.get(uid);
        if (prev !== undefined) {
          out.push(bad(`spaces.${spaceId}.units[${index}]`, uid, "each unit is listed once", `unit ${uid} is listed in both ${prev} and ${spaceId}`));
        } else {
          listed.set(uid, spaceId);
        }
        const unit = G.units[uid];
        if (!unit) {
          out.push(bad(`spaces.${spaceId}.units[${index}]`, uid, "the unit exists in G.units", `space ${spaceId} references missing unit ${uid}`));
          return;
        }
        if (unit.space !== spaceId) {
          out.push(bad(`units.${uid}.space`, unit.space ?? null, spaceId, `unit ${uid} sits in ${spaceId}.units but unit.space=${String(unit.space)}`));
        }
      });
    }
    for (const [uid, unit] of Object.entries(G.units)) {
      if (unit.space === null || unit.space === undefined) {
        if (listed.has(uid)) {
          out.push(bad(`units.${uid}.space`, null, `listed in ${listed.get(uid)}`, `unit ${uid} has no space but is listed in ${listed.get(uid)}`));
        }
        continue;
      }
      if (!G.spaces[unit.space]) {
        out.push(bad(`units.${uid}.space`, unit.space, "the space exists", `unit ${uid} points at unknown space ${unit.space}`));
      } else if (listed.get(uid) !== unit.space) {
        out.push(bad(`units.${uid}.space`, unit.space, "the unit is listed in that space", `unit ${uid} has space ${unit.space} but is not in its units list`));
      }
    }
    for (const p of POWERS) {
      (G.powers[p].reserves ?? []).forEach((uid, index) => {
        const unit = G.units[uid];
        if (!unit) {
          out.push(bad(`powers.${p}.reserves[${index}]`, uid, "the reserve counter exists in G.units", `${p} reserves reference missing unit ${uid}`));
        } else if (unit.owner !== p) {
          out.push(bad(`powers.${p}.reserves[${index}]`, unit.owner, p, `${uid} is in ${p} reserves but owned by ${unit.owner}`));
        } else if (unit.space !== null && unit.space !== undefined) {
          out.push(bad(`units.${uid}.space`, unit.space, null, `reserve unit ${uid} is on the board at ${unit.space}`));
        }
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A04 — counter shape: steps, elite, naval
// ---------------------------------------------------------------------------

export const A04: Invariant = {
  code: "A04",
  rule: "5.1 / 5.3 / 5.4",
  level: "cheap",
  severity: "error",
  title: "step counts, elite counters and naval placement match the counter type",
  check: (G) => {
    const bad = at(A04);
    const out: Violation[] = [];
    for (const [uid, unit] of Object.entries(G.units)) {
      if (!Number.isInteger(unit.steps) || unit.steps < 1 || unit.steps > 2) {
        out.push(bad(`units.${uid}.steps`, unit.steps, "1 or 2", `unit ${uid} (${unit.kind}) has steps ${String(unit.steps)}`));
      }
      if (isEliteKind(unit.kind) && unit.steps !== 1) {
        out.push(bad(`units.${uid}.steps`, unit.steps, "1 (elite counters have one step)", `elite counter ${uid} (${unit.kind}) has steps ${unit.steps}`));
      }
      const navalKind = isNavalKind(unit.kind);
      if (navalKind !== (unit.naval === true)) {
        out.push(bad(`units.${uid}.naval`, unit.naval ?? null, navalKind ? "true for a squadron/dreadnought" : "absent for a land counter", `${unit.kind} ${uid} has naval=${String(unit.naval)}`));
      }
      if (unit.space === null || unit.space === undefined) continue;
      const space = SPACES[unit.space];
      if (!space) continue; // A03 reports the unknown space.
      if (navalKind) {
        if (space.type !== "navalBox" && !(space.ports ?? []).length) {
          out.push(bad(`units.${uid}.space`, unit.space, "a naval box or a port", `${unit.kind} ${uid} is in ${unit.space}, which is neither`));
        }
      }
      // An army may sit in a naval box: 12.3 transport and 19.10 embark it
      // there, so "land counter on the water" is a legal staging state, not a
      // break.
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A05 — 4.2 counter pools
// ---------------------------------------------------------------------------

const COUNTER_KINDS: readonly CounterKind[] = ["army", "reserveArmy", "eliteCorps", "expeditionary", "squadron", "dreadnought"];

export const A05: Invariant = {
  code: "A05",
  rule: "4.2",
  level: "full",
  severity: "error",
  title: "no power holds more counters of a kind than its pool",
  check: (G) => {
    const bad = at(A05);
    const out: Violation[] = [];
    for (const p of COUNTER_CHART_POWERS) {
      const pool = counterPool(G, p);
      for (const kind of COUNTER_KINDS) {
        const cap = pool[kind];
        if (cap === null || cap === undefined) continue;
        const used = countersUsed(G, p, kind);
        if (used > cap) {
          out.push(bad(`powers.${p}`, {kind, used, cap}, `at most ${cap}`, `${p} holds ${used} ${kind} counters, pool is ${cap}`));
        }
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A06 — track bounds
// ---------------------------------------------------------------------------

export const A06: Invariant = {
  code: "A06",
  rule: "7.1 / 7.2 / 7.4 / 3.7",
  level: "cheap",
  severity: "error",
  title: "stability, manpower, industry and world tension stay on their tracks",
  check: (G) => {
    const bad = at(A06);
    const out: Violation[] = [];
    for (const p of POWERS) {
      const ps = G.powers[p];
      if (!Number.isInteger(ps.stability) || ps.stability < 0 || ps.stability > 6) {
        out.push(bad(`powers.${p}.stability`, ps.stability, "0..6", `${p} stability ${String(ps.stability)} is off the track`));
      }
      if (!Number.isInteger(ps.manpower) || ps.manpower < 0) {
        out.push(bad(`powers.${p}.manpower`, ps.manpower, ">= 0", `${p} manpower ${String(ps.manpower)}`));
      }
      if (ps.secondaryManpower !== undefined && (!Number.isInteger(ps.secondaryManpower) || ps.secondaryManpower < 0)) {
        out.push(bad(`powers.${p}.secondaryManpower`, ps.secondaryManpower, ">= 0", `${p} secondary manpower ${String(ps.secondaryManpower)}`));
      }
      if (!Number.isInteger(ps.industry) || ps.industry < 0) {
        out.push(bad(`powers.${p}.industry`, ps.industry, ">= 0", `${p} industry ${String(ps.industry)}`));
      }
      if (ps.territorialKeys < 0 || ps.colonialKeys < 0 || (ps.arabKeys ?? 0) < 0) {
        out.push(bad(`powers.${p}`, {territorialKeys: ps.territorialKeys, colonialKeys: ps.colonialKeys, arabKeys: ps.arabKeys ?? 0}, ">= 0", `${p} holds a negative key count`));
      }
    }
    const max = G.worldTensionMax ?? 5;
    if (!Number.isInteger(G.wtt) || G.wtt < 0 || G.wtt > max) {
      out.push(bad("wtt", G.wtt, `0..${max}`, `world tension ${String(G.wtt)} is outside 0..${max}`));
    }
    if (!Number.isInteger(G.cpRemaining) || G.cpRemaining < 0) {
      out.push(bad("cpRemaining", G.cpRemaining, ">= 0", `cpRemaining ${String(G.cpRemaining)}`));
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A07 — key tracks agree with the board
// ---------------------------------------------------------------------------

export const A07: Invariant = {
  code: "A07",
  rule: "4.7 / 7.2",
  level: "full",
  severity: "error",
  title: "key tracks equal the board at the start of a campaign turn",
  check: (G) => {
    // 7.2 recomputes keys in the end phase, and several in-turn effects change
    // the board before that point, so a mid-turn lag is the printed sequence,
    // not a break.  The turn's first phase is where the tracks must be fresh.
    if (G.phase !== "prep") return [];
    const bad = at(A07);
    const out: Violation[] = [];
    let fresh: ImperialElegyState;
    const trace = {
      territorial: new Map(POWERS.map((p) => [p, [] as SpaceId[]])),
      colonial: new Map(POWERS.map((p) => [p, [] as SpaceId[]])),
    };
    try {
      fresh = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
      recomputeTracks(fresh, trace);
    } catch (err) {
      return [bad("G", String(err), "recomputeTracks runs on the state", `recomputeTracks threw: ${String(err)}`)];
    }
    for (const p of POWERS) {
      const live = G.powers[p];
      const want = fresh.powers[p];
      for (const field of ["territorialKeys", "colonialKeys", "arabKeys"] as const) {
        if (field === "arabKeys" && p !== "OT") continue;
        const have = live[field];
        const expect = want[field] ?? 0;
        if ((have ?? 0) !== expect) {
          // Name the spaces the board feeds this track, so the census sample
          // points at the divergent writes instead of just the counts.
          const spaces = (field === "colonialKeys" ? trace.colonial.get(p) : trace.territorial.get(p)) ?? [];
          out.push(bad(`powers.${p}.${field}`, have ?? 0, String(expect), `${p} ${field}=${String(have ?? 0)} but the board recomputes ${expect} [${spaces.join(" ")}] (track refreshed turn ${String(G.flags.lastRecomputeTurn)} phase ${String(G.flags.lastRecomputePhase)}, now turn ${G.turn} phase ${G.phase})`));
        }
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A08 — stacking limits (warn: 5.5.3 permits a transient overstack)
// ---------------------------------------------------------------------------

export const A08: Invariant = {
  code: "A08",
  rule: "5.5 / 19.9",
  level: "cheap",
  severity: "warn",
  title: "land stacks and port fleets are within their printed limits",
  check: (G) => {
    const bad = at(A08);
    const out: Violation[] = [];
    for (const space of Object.keys(G.spaces)) {
      if (isNavalBox(space)) continue;
      const armies = armyCountIn(G, space);
      const landLimit = landStackingLimit(space);
      if (armies > landLimit) {
        out.push(bad(`spaces.${space}.units`, armies, `<= ${landLimit}`, `${space} holds ${armies} armies, limit ${landLimit} (legal only until its owner's next impulse, 5.5.3)`));
      }
      const ships = navalUnitsIn(G, space).length;
      if (ships > PORT_NAVAL_LIMIT) {
        out.push(bad(`spaces.${space}.units`, ships, `<= ${PORT_NAVAL_LIMIT}`, `port ${space} holds ${ships} ships, limit ${PORT_NAVAL_LIMIT}`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A09 — 12.12 forts
// ---------------------------------------------------------------------------

export const A09: Invariant = {
  code: "A09",
  rule: "12.12",
  level: "cheap",
  severity: "error",
  title: "forts are level 1..3 and sit on the main map",
  check: (G) => {
    const bad = at(A09);
    const out: Violation[] = [];
    for (const [space, state] of Object.entries(G.spaces)) {
      const fort = state.fort;
      if (!fort) continue;
      if (fort.level !== 1 && fort.level !== 2 && fort.level !== 3) {
        out.push(bad(`spaces.${space}.fort.level`, fort.level, "1, 2 or 3", `fort in ${space} has level ${String(fort.level)}`));
      }
      const def = SPACES[space];
      if (def && def.submap !== "main" && fort.indian !== true) {
        out.push(bad(`spaces.${space}.fort`, def.submap, "main map (12.12)", `fort in ${space} sits on the ${def.submap} submap`));
      }
    }
    // 12.12's three-fort cap is deliberately not asserted here: it bounds the
    // Construct Fort action (`buildFort`), while a card effect may place a fort
    // regardless (`effects.ts`), and the state records no provenance for a fort.
    // See docs/imperial-elegy/INVARIANTS.md.
    return out;
  },
};

// ---------------------------------------------------------------------------
// A10 — 12.14 CP chain
// ---------------------------------------------------------------------------

export const A10: Invariant = {
  code: "A10",
  rule: "12.14",
  level: "cheap",
  severity: "error",
  title: "a CP chain holds at most two cards and no industry card",
  check: (G) => {
    const bad = at(A10);
    const out: Violation[] = [];
    for (const p of POWERS) {
      const chain = cpChainResolution(G, p);
      if (chain.overLimit) {
        out.push(bad(`powers.${p}.cpChain`, chain.cardCount, `<= ${chain.maxCards}`, `${p} chained ${chain.cardCount} cards, 12.14 allows ${chain.maxCards}`));
      }
      const industry = G.powers[p].industryCard;
      if (industry && (G.powers[p].cpChain ?? []).includes(industry)) {
        out.push(bad(`powers.${p}.cpChain`, industry, "no industry card (12.14)", `${p} put its industry card ${industry} into the CP chain`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A11 — 4.2.1 minor ally cap
// ---------------------------------------------------------------------------

/**
 * 4.2.1 caps a player at five minor allies, and every construction path enforces
 * it (`canGainMinorAlly`).  Errata 13.4.5 is the printed exception: Bismarck's
 * declaration allies the unaligned minor "even if that player already has five
 * minor power allies", and the state does not record that the sixth came from
 * that errata.  So the count is a warn, like 5.5.3's overstack (A08) and 8.3's
 * forced alliance shift (A12).
 */
export const A11: Invariant = {
  code: "A11",
  rule: "4.2.1",
  level: "cheap",
  severity: "warn",
  title: "a player has at most five minor allies",
  check: (G) => {
    const bad = at(A11);
    const out: Violation[] = [];
    for (const p of POWERS) {
      const allies = minorAlliesOf(G, p);
      if (allies.length > MINOR_ALLY_CAP) {
        out.push(bad(`powers.${p}.allies`, allies, `<= ${MINOR_ALLY_CAP}`, `${p} has ${allies.length} minor allies (${allies.join(", ")})`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A12 — 8.4 alliance cap
// ---------------------------------------------------------------------------

export const A12: Invariant = {
  code: "A12",
  rule: "8.4",
  level: "cheap",
  severity: "warn",
  title: "an alliance holds at most three player powers",
  check: (G) => {
    const bad = at(A12);
    const out: Violation[] = [];
    for (const side of ["te", "ta"] as const) {
      const members = allianceMembers(G, side);
      if (members.length > ALLIANCE_MAX_PLAYERS) {
        out.push(bad(`alliance.${side}`, members, `<= ${ALLIANCE_MAX_PLAYERS}`, `${side} holds ${members.length} players (${members.join(", ")}), 8.4 allows ${ALLIANCE_MAX_PLAYERS}`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A13 — pending decisions are answerable
// ---------------------------------------------------------------------------

export const A13: Invariant = {
  code: "A13",
  rule: "pending.ts",
  level: "cheap",
  severity: "error",
  title: "every pending decision has a legal owner, a known kind and unique non-empty options",
  check: (G) => {
    const bad = at(A13);
    const out: Violation[] = [];
    const inspect = (decision: NonNullable<ImperialElegyState["pending"]>, where: string) => {
      if (!POWERS.includes(decision.power)) {
        out.push(bad(`${where}.power`, decision.power, "a player power", `decision ${decision.id} is owned by ${String(decision.power)}`));
      }
      if (!(PENDING_KINDS as readonly string[]).includes(decision.kind)) {
        out.push(bad(`${where}.kind`, decision.kind, "a known PendingKind", `decision ${decision.id} has kind ${String(decision.kind)}`));
      }
      const options = decision.options ?? [];
      if (!Array.isArray(options) || options.length === 0) {
        out.push(bad(`${where}.options`, options.length, "at least one option", `decision ${decision.id} (${decision.kind}) has no options`));
        return;
      }
      const ids = new Set<string>();
      options.forEach((option, index) => {
        if (typeof option.id !== "string" || option.id.length === 0) {
          out.push(bad(`${where}.options[${index}].id`, option.id, "a non-empty string", `decision ${decision.id} has an option without an id`));
        } else if (ids.has(option.id)) {
          out.push(bad(`${where}.options[${index}].id`, option.id, "unique within the decision", `decision ${decision.id} offers ${option.id} twice`));
        }
        ids.add(option.id);
      });
    };
    if (G.pending) inspect(G.pending, "pending");
    (G.pendingStack ?? []).forEach((decision, index) => inspect(decision, `pendingStack[${index}]`));
    return out;
  },
};

// ---------------------------------------------------------------------------
// A14 — flow fields
// ---------------------------------------------------------------------------

export const A14: Invariant = {
  code: "A14",
  rule: "2.1 / 24.1",
  level: "cheap",
  severity: "error",
  title: "phase, turn, active power and turn index are in range",
  check: (G) => {
    const bad = at(A14);
    const out: Violation[] = [];
    if (!(PHASES as readonly string[]).includes(G.phase)) {
      out.push(bad("phase", G.phase, "a GamePhase", `phase ${String(G.phase)} is not in the enum`));
    }
    // 20.12 advances the turn counter before the game ends, so a finished
    // campaign sits on turn 8; the Great War then runs on `gw.turn`.
    if (!Number.isInteger(G.turn) || G.turn < 1 || G.turn > 8) {
      out.push(bad("turn", G.turn, "1..8", `turn ${String(G.turn)} is outside 1..8`));
    }
    // 24.1's Great War runs turns 0..5, but the winter step advances the
    // counter before 2.2.2 scores, so the terminal state sits on 6.
    if (G.gw && (!Number.isInteger(G.gw.turn) || G.gw.turn < 0 || G.gw.turn > 6)) {
      out.push(bad("gw.turn", G.gw.turn, "0..6", `Great War turn ${String(G.gw.turn)} is outside 0..6`));
    }
    if (!POWERS.includes(G.activePower)) {
      out.push(bad("activePower", G.activePower, "a player power", `activePower ${String(G.activePower)} is not a power`));
    }
    // It indexes the six seats in a campaign phase, the Great War's impulse
    // order (25.7, bonus slots included) or 27.4's neutral-impulse order after
    // that, and the engine keeps the last used index after an order clears — so
    // only the lower bound is a state invariant.
    if (!Number.isInteger(G.turnIndex) || G.turnIndex < 0) {
      out.push(bad("turnIndex", G.turnIndex, "a non-negative integer", `turnIndex ${String(G.turnIndex)} is not an index`));
    }
    const passed = G.passed ?? [];
    if (new Set(passed).size !== passed.length) {
      out.push(bad("passed", passed, "no duplicates", `passed lists a power twice: ${passed.join(", ")}`));
    }
    for (const p of passed) {
      if (!POWERS.includes(p)) out.push(bad("passed", p, "a player power", `passed lists ${String(p)}`));
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A15 — battle / Great War coherence (partial, see INVARIANTS.md)
// ---------------------------------------------------------------------------

export const A15: Invariant = {
  code: "A15",
  rule: "15 / 24 / 25",
  level: "cheap",
  severity: "error",
  title: "a battle names real spaces and powers; a Great War is in range",
  check: (G) => {
    const bad = at(A15);
    const out: Violation[] = [];
    if (G.battle) {
      const battle = G.battle;
      for (const field of ["from", "to"] as const) {
        if (!G.spaces[battle[field]]) {
          out.push(bad(`battle.${field}`, battle[field], "an existing space", `battle ${field} ${String(battle[field])} does not exist`));
        }
      }
      // 15.4.2: a lone non-player defender has no seat, so `defender` may hold
      // a control id ("Japan", "Serbia") and only the attacker must be a player.
      if (!POWERS.includes(battle.attacker)) {
        out.push(bad("battle.attacker", battle.attacker, "a player power", `battle attacker ${String(battle.attacker)} is not a power`));
      }
      if (!(BATTLE_STAGES as readonly string[]).includes(battle.stage)) {
        out.push(bad("battle.stage", battle.stage, "a battle stage", `battle stage ${String(battle.stage)} is unknown`));
      }
    }
    if (G.gw && G.gw.active) {
      for (const field of ["belligerents", "neutrals", "te", "ta"] as const) {
        for (const power of G.gw[field] ?? []) {
          if (!POWERS.includes(power)) out.push(bad(`gw.${field}`, power, "a player power", `gw.${field} lists ${String(power)}`));
        }
      }
      const belligerent = new Set(G.gw.belligerents ?? []);
      const neutral = new Set(G.gw.neutrals ?? []);
      for (const power of belligerent) {
        if (neutral.has(power)) out.push(bad("gw.neutrals", power, "a belligerent is not also neutral", `${power} is both belligerent and neutral`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// A16 — the state is plain JSON
// ---------------------------------------------------------------------------

/**
 * One structural walk, reporting exactly the values a JSON round trip would
 * change: a non-finite number (it arrives as `null`), a function/symbol/bigint
 * (dropped or refused), a `Map`/`Set` or class instance (it arrives as `{}` or
 * through `toJSON`), and an `undefined` array entry (it arrives as `null`).
 * A property explicitly set to `undefined` is dropped by transport and reads
 * the same as an absent optional field, so it is not a break here.
 *
 * The path is only built when something is reported, so the common case pays
 * one prototype check and one key loop per node.  `A16.check` still runs the
 * real serialize/parse/serialize at a phase boundary, which is what catches a
 * `toJSON` or a cycle; this walk is what the cadence steps pay for.
 */
const isPlainJson = (G: ImperialElegyState, limit = 8): Violation[] => {
  const bad = at(A16);
  const out: Violation[] = [];
  const seen = new WeakSet<object>();
  /** Keys from `G` to the node being visited, rendered into a path on report. */
  const trail: (string | number)[] = ["G"];
  const path = (): string => {
    let text = "G";
    for (let i = 1; i < trail.length; i += 1) {
      const segment = trail[i];
      text += typeof segment === "number" ? `[${segment}]` : `.${segment}`;
    }
    return text;
  };
  const walk = (value: unknown, depth: number, inArray: boolean): void => {
    if (out.length >= limit || depth > 14) return;
    if (value === undefined) {
      if (inArray) out.push(bad(path(), "undefined", "a JSON value", `undefined array entry at ${path()} arrives as null`));
      return;
    }
    const kind = typeof value;
    if (kind === "number") {
      if (!Number.isFinite(value as number)) out.push(bad(path(), value, "a finite number", `${String(value)} at ${path()}`));
      return;
    }
    if (kind === "function" || kind === "symbol" || kind === "bigint") {
      out.push(bad(path(), kind, "JSON-serializable", `${kind} at ${path()}`));
      return;
    }
    if (kind !== "object" || value === null) return;
    const array = Array.isArray(value);
    // A plain object can never be a `Map`/`Set`, so the `instanceof` pair is
    // only paid for the rare non-plain object, where it names the class.
    if (!array) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        const name = value instanceof Map || value instanceof Set ? value.constructor.name : value.constructor?.name ?? "class instance";
        out.push(bad(path(), name, "a plain object or array", `${name} at ${path()}`));
        return;
      }
    }
    if (seen.has(value)) return;
    seen.add(value);
    if (array) {
      const items = value as unknown[];
      for (let index = 0; index < items.length; index += 1) {
        // A hole is not a JSON value either, but `forEach` (the walk this
        // replaces) never visited it, so it is not reported here.
        if (!(index in items)) continue;
        trail.push(index);
        walk(items[index], depth + 1, true);
        trail.pop();
        if (out.length >= limit) return;
      }
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      trail.push(key);
      walk(record[key], depth + 1, false);
      trail.pop();
      if (out.length >= limit) return;
    }
  };
  walk(G, 0, false);
  return out;
};

export const A16: Invariant = {
  code: "A16",
  rule: "sync",
  level: "full",
  severity: "error",
  title: "the state round-trips through JSON unchanged",
  check: (G, ctx) => {
    const bad = at(A16);
    const out = isPlainJson(G);
    // The round trip serializes the whole state twice: 2.2 ms of the full
    // tier's 6.0 ms on the 215 KB end state, so the harness only pays it where
    // a `toJSON` or a cycle could first appear.
    if (!ctx.phaseBoundary) return out;
    const serialized = JSON.stringify(G);
    const roundTripped = JSON.stringify(JSON.parse(serialized));
    if (serialized !== roundTripped) {
      out.push(bad("G", "round-trip differs", "JSON.parse(JSON.stringify(G)) loses nothing", "state does not survive a JSON round trip (dropped undefined/NaN or a custom toJSON)"));
    }
    return out;
  },
};

export const STRUCTURAL: readonly Invariant[] = [
  A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13, A14, A15, A16,
];

export type {CheckContext, Severity};
