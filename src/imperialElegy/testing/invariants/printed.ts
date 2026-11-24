/**
 * B group — printed-rule state.
 *
 * These are the printed rules that a *single state* can adjudicate: a pool it
 * names, a budget it holds, a war it describes, a marker only one power may
 * carry.  Anything that needs the previous state (a deal, a transfer, a
 * resolution) belongs to the `C` group, and anything a card effect may legally
 * override is documented as a known limit in `docs/imperial-elegy/INVARIANTS.md`
 * rather than shipped as an error.
 */
import type {ImperialElegyState, Power, SpaceId, WarState} from "../../types";
import {POWERS} from "../../types";
import {endPhaseOrder} from "../../engine/economy";
import {maxIndustryOf, printedMaxIndustry} from "../../engine/greatWarFlow";
import {violationAt} from "./types";
import type {Invariant, Violation} from "./types";

const at = violationAt;

// ---------------------------------------------------------------------------
// B02 — home-card pools
// ---------------------------------------------------------------------------

export const B02: Invariant = {
  code: "B02",
  rule: "10.4 / 11.1 / 11.2",
  level: "cheap",
  severity: "error",
  title: "a selected home card belongs to its own seat's home-card pool",
  check: (G) => {
    const bad = at(B02);
    const out: Violation[] = [];
    const owner = new Map<string, Power>();
    for (const p of POWERS) {
      const pool: string[] = G.powers[p].homeCards ?? [];
      const seen = new Set<string>();
      pool.forEach((card, index) => {
        if (seen.has(card)) {
          out.push(bad(`powers.${p}.homeCards[${index}]`, card, "each home card once", `${p} lists home card ${card} twice`));
        }
        seen.add(card);
        const previous = owner.get(card);
        if (previous !== undefined && previous !== p) {
          out.push(bad(`powers.${p}.homeCards[${index}]`, card, "one seat's pool", `home card ${card} is in both ${previous} and ${p}`));
        } else {
          owner.set(card, p);
        }
      });
      const selected: string | null = G.powers[p].selectedHomeCard ?? null;
      if (selected !== null && !pool.includes(selected)) {
        out.push(bad(`powers.${p}.selectedHomeCard`, selected, `one of ${p}'s home cards`, `${p} selected home card ${selected}, which is not in its pool`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// B04 — war and Great War budgets
// ---------------------------------------------------------------------------

export const B04: Invariant = {
  code: "B04",
  rule: "12.1 / 14.3 / 26.2",
  level: "cheap",
  severity: "error",
  title: "war and Great War budgets are non-negative whole CP",
  check: (G) => {
    const bad = at(B04);
    const out: Violation[] = [];
    const check = (value: number | undefined, path: string) => {
      if (value === undefined) return;
      if (!Number.isInteger(value) || value < 0) out.push(bad(path, value, "a whole number >= 0", `${path} is ${String(value)}`));
    };
    for (const p of POWERS) {
      check(G.powers[p].warBudget, `powers.${p}.warBudget`);
      check(G.powers[p].gwBudget, `powers.${p}.gwBudget`);
    }
    const budgets = (war: WarState | null | undefined, path: string) => {
      for (const [power, value] of Object.entries(war?.budgets ?? {})) check(value, `${path}.budgets.${power}`);
    };
    budgets(G.war, "war");
    (G.wars ?? []).forEach((war, index) => budgets(war, `wars[${index}]`));
    return out;
  },
};

// ---------------------------------------------------------------------------
// B07 — a war describes two legal, disjoint sides
// ---------------------------------------------------------------------------

const warViolations = (G: ImperialElegyState, war: WarState, path: string, out: Violation[]): void => {
  const bad = at(B07);
  const isPower = (value: string): value is Power => (POWERS as readonly string[]).includes(value);
  // 15.4.2: `defender` may be a non-player control id ("Serbia", "IT"), so only
  // its allies are checked against the player list.
  for (const side of ["attackerAllies", "defenderAllies"] as const) {
    const seen = new Set<string>();
    (war[side] ?? []).forEach((power, index) => {
      if (!isPower(power)) out.push(bad(`${path}.${side}[${index}]`, power, "a player power", `${path}.${side} lists ${String(power)}`));
      if (seen.has(power)) out.push(bad(`${path}.${side}[${index}]`, power, "each ally once", `${path}.${side} lists ${power} twice`));
      seen.add(power);
    });
  }
  const attackerAllies = new Set(war.attackerAllies ?? []);
  const defenderAllies = new Set(war.defenderAllies ?? []);
  for (const power of attackerAllies) {
    if (defenderAllies.has(power)) out.push(bad(`${path}.attackerAllies`, power, "one side only", `${power} fights on both sides of this war`));
  }
  if (attackerAllies.has(war.attacker)) out.push(bad(`${path}.attackerAllies`, war.attacker, "the attacker is not its own ally", `${war.attacker} is listed among its own allies`));
  if (defenderAllies.has(war.attacker)) out.push(bad(`${path}.defenderAllies`, war.attacker, "the two sides are disjoint", `the attacker ${war.attacker} is also a defender ally`));
  if (isPower(war.defender) && attackerAllies.has(war.defender)) {
    out.push(bad(`${path}.attackerAllies`, war.defender, "the two sides are disjoint", `the defender ${war.defender} is also an attacker ally`));
  }
  const objectives = new Set<string>();
  (war.objectives ?? []).forEach((space: SpaceId, index: number) => {
    if (!G.spaces[space]) out.push(bad(`${path}.objectives[${index}]`, space, "an existing space", `${path} names objective ${String(space)}, which is not on the board`));
    if (objectives.has(space)) out.push(bad(`${path}.objectives[${index}]`, space, "each objective once", `${path} names ${space} twice`));
    objectives.add(space);
  });
  if (war.warAim !== null && !["liberation", "unification", "conquest"].includes(war.warAim)) {
    out.push(bad(`${path}.warAim`, war.warAim, "liberation, unification, conquest or null", `${path}.warAim is ${String(war.warAim)}`));
  }
};

export const B07: Invariant = {
  code: "B07",
  rule: "13.x / 14.x",
  level: "cheap",
  severity: "error",
  title: "a war's sides are legal and disjoint, and its objectives exist",
  check: (G) => {
    const out: Violation[] = [];
    if (G.war) warViolations(G, G.war, "war", out);
    (G.wars ?? []).forEach((war, index) => warViolations(G, war, `wars[${index}]`, out));
    return out;
  },
};

// ---------------------------------------------------------------------------
// B10 — the end phase walks its printed steps once
// ---------------------------------------------------------------------------

export const B10: Invariant = {
  code: "B10",
  rule: "20.1–20.12",
  level: "cheap",
  severity: "error",
  title: "end-phase progress is a cursor into the twelve printed steps",
  check: (G) => {
    const bad = at(B10);
    const out: Violation[] = [];
    const progress = G.endPhase;
    if (!progress) return out;
    const steps = endPhaseOrder().length;
    if (G.phase !== "end") {
      out.push(bad("endPhase", G.phase, "the end phase", `end-phase progress survives outside the end phase (phase ${G.phase})`));
    }
    if (!Number.isInteger(progress.step) || progress.step < 0 || progress.step > steps) {
      out.push(bad("endPhase.step", progress.step, `0..${steps}`, `end-phase step ${String(progress.step)} is outside the printed list`));
    }
    const settled = new Set<string>();
    for (const power of progress.militarismSettled ?? []) {
      if (!(POWERS as readonly string[]).includes(power)) out.push(bad("endPhase.militarismSettled", power, "a player power", `20.1 settled ${String(power)}`));
      if (settled.has(power)) out.push(bad("endPhase.militarismSettled", power, "each power once", `20.1 settled ${power} twice`));
      settled.add(power);
    }
    if (progress.ngDraw && (!Number.isInteger(progress.ngDraw.index) || progress.ngDraw.index < 0 || progress.ngDraw.index > POWERS.length)) {
      out.push(bad("endPhase.ngDraw.index", progress.ngDraw.index, `0..${POWERS.length}`, `20.11 cursor ${String(progress.ngDraw.index)} is out of range`));
    }
    if (progress.alliance) {
      const order = progress.alliance.order ?? [];
      for (const power of order) {
        if (!(POWERS as readonly string[]).includes(power)) out.push(bad("endPhase.alliance.order", power, "a player power", `20.9 resolves ${String(power)}`));
      }
      if (!Number.isInteger(progress.alliance.index) || progress.alliance.index < 0 || progress.alliance.index > order.length) {
        out.push(bad("endPhase.alliance.index", progress.alliance.index, `0..${order.length}`, `20.9 cursor ${String(progress.alliance.index)} is past its order`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// B18 — 29.1 blockade caps industry
// ---------------------------------------------------------------------------

export const B18: Invariant = {
  code: "B18",
  rule: "29.1",
  level: "cheap",
  severity: "error",
  title: "industry never exceeds its blockade maximum, and that maximum never falls below 3",
  check: (G) => {
    const bad = at(B18);
    const out: Violation[] = [];
    for (const p of POWERS) {
      const ps = G.powers[p];
      const printed = printedMaxIndustry(p);
      // `maxIndustryOf` clamps the stored value (29.1's floor of 3 and the
      // printed display maximum), so a bad stored maximum has to be read
      // directly; the clamped value is what industry is compared against.
      const stored = ps.maxIndustry;
      if (stored !== undefined) {
        if (!Number.isInteger(stored) || stored < 3) {
          out.push(bad(`powers.${p}.maxIndustry`, stored, "a whole number >= 3 (29.1's floor)", `${p} industry maximum ${String(stored)} is below the printed floor`));
        } else if (stored > printed) {
          out.push(bad(`powers.${p}.maxIndustry`, stored, `<= ${printed}`, `${p} industry maximum ${stored} exceeds its printed display maximum ${printed}`));
        }
      }
      const cap = maxIndustryOf(G, p);
      if (ps.industry > cap) {
        out.push(bad(`powers.${p}.industry`, ps.industry, `<= ${cap}`, `${p} industry ${ps.industry} is above its blockade maximum ${cap}`));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// B22 — national characteristic markers stay with their power
// ---------------------------------------------------------------------------

const CHARACTERISTIC_MARKERS: {field: string; power: Power; numeric?: boolean}[] = [
  {field: "unified", power: "GE"},
  {field: "tsrr", power: "RU"},
  {field: "scorchedEarth", power: "RU"},
  {field: "jihad", power: "OT", numeric: true},
  {field: "indiaStable", power: "UK"},
  {field: "indiaIndependent", power: "UK"},
  {field: "cityOfLight", power: "FR", numeric: true},
  {field: "government", power: "FR"},
];

export const B22: Invariant = {
  code: "B22",
  rule: "33.x",
  level: "cheap",
  severity: "error",
  title: "national-characteristic markers are held only by the power that owns them",
  check: (G) => {
    const bad = at(B22);
    const out: Violation[] = [];
    for (const p of POWERS) {
      const ps = G.powers[p] as unknown as Record<string, unknown>;
      for (const marker of CHARACTERISTIC_MARKERS) {
        const value = ps[marker.field];
        const present = marker.numeric ? typeof value === "number" && value > 0 : value !== undefined && value !== null && value !== false;
        if (present && marker.power !== p) {
          out.push(bad(`powers.${p}.${marker.field}`, value, `only ${marker.power} carries this marker`, `${p} holds ${marker.field} (${String(value)}), a ${marker.power} characteristic`));
        }
      }
    }
    return out;
  },
};

export const PRINTED: readonly Invariant[] = [B02, B04, B07, B10, B18, B22];
