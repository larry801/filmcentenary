/**
 * The printed Crisis Table (rulebook 23.0–23.5).
 *
 * Source of truth: the playbook's back page, "CRISIS TABLE" (playbook.txt
 * ~2825–2865), cross-checked with the rulebook §23.0–23.5.  This module is
 * deliberately *pure*: typed, frozen data for every printed row plus the
 * resolution of one die result into a structured outcome.  The live layer
 * (`engine/greatWar.ts`) owns state mutation, pending decisions and random
 * rolls; keeping the table here means the printed cells can be asserted
 * row-by-row in `crisisTable.test.ts` without a game state.
 *
 * Printed footnotes (playbook, right column):
 *  *  International Conference.  The Great War does not start, reset the WTT
 *     to 4.  Can only happen once per game.  If it happens a second time
 *     reroll the die.
 *  ** Special Crisis: see §23.3.
 *  †  Treat as a 1 if player is allied to AU.
 *     Treat any results >6 as an International Conference*.
 *
 * §23.2: every result except "International Conference" causes the outbreak
 * of the Great War; most cells are purely narrative, and only the `**`
 * results (§23.3) change the game state.
 */
import type {Power} from "../types";

/** The ten printed rows, in table order. */
export type CrisisRowId =
  | "assassination"
  | "navalArmsRace"
  | "powderKegStep1"
  | "powderKegStep2"
  | "blackHandStep1"
  | "blackHandStep2"
  | "bosnianCrisis"
  | "moroccanCrisis"
  | "impulsiveLeader"
  | "allianceSystem"
  /** Defensive fallback for an inciting card that has no printed row. */
  | "fallback";

/**
 * Structured result kinds.  These are the printed cells, not free text: the
 * live layer switches on the kind and the label is only for the log.
 */
export type CrisisResultKind =
  | "internationalConference"
  | "minorityNationality"
  | "borderingNation"
  | "firedOnFishingBoats"
  | "colonialProxyWar"
  | "balkanTable"
  | "allyRespondent"
  | "targetPower"
  | "losingPower"
  | "borderIncident"
  | "espionage"
  /** The fallback row's narrative cells (no printed label). */
  | "narrative";

/** One printed cell of one row. */
export interface CrisisCell {
  readonly kind: CrisisResultKind;
  /** Exactly as printed on the table. */
  readonly label: string;
  /** Printed `**` — a special result that draws powers into the GW. */
  readonly special?: boolean;
  /** Printed `†` — "treat as a 1 if player is allied to AU". */
  readonly dagger?: boolean;
  /** `Balkan Table (Roll once|twice)` cells. */
  readonly rolls?: 1 | 2;
  /** `Ally (Russia if no ally)` cells: the printed fallback respondent. */
  readonly fallback?: Power;
  /** `Germany` / `Russia (Unless AU Ally)` cells. */
  readonly target?: Power;
}

export interface CrisisRowDef {
  readonly id: CrisisRowId;
  /** Printed Event column (the inciting event). */
  readonly event: string;
  /** Printed Incident column. */
  readonly incident: string;
  /** Printed "Step 1"/"Step 2" marker, if any. */
  readonly step: 1 | 2 | null;
  /** Results 1..6, in printed order. */
  readonly cells: readonly [CrisisCell, CrisisCell, CrisisCell, CrisisCell, CrisisCell, CrisisCell];
}

const conference: CrisisCell = Object.freeze({
  kind: "internationalConference" as const,
  label: "International Conference",
});
const minority: CrisisCell = Object.freeze({kind: "minorityNationality" as const, label: "Minority Nationality"});
const bordering: CrisisCell = Object.freeze({
  kind: "borderingNation" as const,
  label: "Bordering Nation",
  special: true,
});

const row = (
  id: CrisisRowId,
  event: string,
  incident: string,
  step: 1 | 2 | null,
  cells: readonly CrisisCell[],
): CrisisRowDef =>
  Object.freeze({
    id,
    event,
    incident,
    step,
    cells: Object.freeze(cells.slice(0, 6)) as CrisisRowDef["cells"],
  });

const balkanTwice: CrisisCell = Object.freeze({
  kind: "balkanTable" as const,
  label: "Balkan Table (Roll twice)",
  special: true,
  rolls: 2 as const,
});
const balkanOnce: CrisisCell = Object.freeze({
  kind: "balkanTable" as const,
  label: "Balkan Table (Roll once)",
  special: true,
  rolls: 1 as const,
});
const ally = (fallback: Power): CrisisCell =>
  Object.freeze({
    kind: "allyRespondent" as const,
    label: `Ally (${fallback === "RU" ? "Russia" : fallback === "FR" ? "France" : "Austria"} if no ally)`,
    fallback,
  });
const targetCell = (label: string, target: Power, dagger = false): CrisisCell =>
  Object.freeze({kind: "targetPower" as const, label, target, dagger});
const losingPower: CrisisCell = Object.freeze({kind: "losingPower" as const, label: "Losing Power"});
const borderIncident: CrisisCell = Object.freeze({kind: "borderIncident" as const, label: "Border incident"});
const espionage: CrisisCell = Object.freeze({kind: "espionage" as const, label: "Espionage"});
const firedOnFishingBoats: CrisisCell = Object.freeze({
  kind: "firedOnFishingBoats" as const,
  label: "Fired on fishing boats",
});
const colonialProxyWar: CrisisCell = Object.freeze({kind: "colonialProxyWar" as const, label: "Colonial proxy war"});

/**
 * The printed rows.  `powderKegStep1`/`Step2` are shared by Powder Keg and
 * The Balkan Wars (the playbook prints "Powder Keg/Balkans Wars: Step 1/2");
 * `blackHandStep1/Step2` are The Black Hand's two rolls.
 */
export const PRINTED_CRISIS_ROWS: readonly CrisisRowDef[] = Object.freeze([
  row("assassination", "Assassination", "Blame", null, [
    minority,
    minority,
    bordering,
    bordering,
    conference,
    conference,
  ]),
  row("navalArmsRace", "Naval Arms Race", "Naval Incident", null, [
    firedOnFishingBoats,
    colonialProxyWar,
    colonialProxyWar,
    conference,
    conference,
    conference,
  ]),
  row("powderKegStep1", "Powder Keg/Balkans Wars: Step 1", "Random Balkan state", 1, [
    balkanTwice,
    balkanTwice,
    balkanOnce,
    balkanOnce,
    conference,
    conference,
  ]),
  row("powderKegStep2", "Powder Keg/Balkans Wars: Step 2", "Balkan state appeals to", 2, [
    ally("RU"),
    ally("FR"),
    ally("FR"),
    ally("AU"),
    conference,
    conference,
  ]),
  row("blackHandStep1", "The Black Hand: Step 1", "Target", 1, [
    targetCell("Germany", "GE"),
    targetCell("UK", "UK"),
    targetCell("France", "FR"),
    targetCell("Russia", "RU"),
    targetCell("Austria", "AU"),
    targetCell("Ottomans", "OT"),
  ]),
  row("blackHandStep2", "The Black Hand: Step 2", "Terrorism supported by", 2, [
    minority,
    minority,
    bordering,
    bordering,
    conference,
    conference,
  ]),
  row("bosnianCrisis", "Bosnian Crisis", "Outraged by annexation", null, [
    balkanTwice,
    targetCell("Russia (Unless AU Ally)", "RU", true),
    targetCell("Ottomans (Unless AU Ally)", "OT", true),
    conference,
    conference,
    conference,
  ]),
  row("moroccanCrisis", "Moroccan Crisis/'Urabi Revolt", "Outraged by annexation", null, [
    losingPower,
    losingPower,
    losingPower,
    conference,
    conference,
    conference,
  ]),
  row("impulsiveLeader", "Impulsive Leader", "Rash decision made by", null, [
    targetCell("Germany", "GE"),
    targetCell("UK", "UK"),
    targetCell("France", "FR"),
    targetCell("Russia", "RU"),
    targetCell("Austria", "AU"),
    targetCell("Ottomans", "OT"),
  ]),
  row("allianceSystem", "Alliance System/Shifting Alliances", "Inciting Incident", null, [
    borderIncident,
    borderIncident,
    espionage,
    espionage,
    conference,
    conference,
  ]),
]);

/**
 * Defensive fallback for an inciting event that has no printed row (an
 * unmatched card, or a caller that has no card at all, as in the engine
 * tests).  Results 1–4 are narrative and 5–6 are the printed conference, which
 * is exactly the shape the old hard-coded `roll >= 5` check implemented.
 */
export const FALLBACK_CRISIS_ROW: CrisisRowDef = row("fallback", "Unmatched inciting event", "Narrative", null, [
  Object.freeze({kind: "narrative" as const, label: "Narrative result"}),
  Object.freeze({kind: "narrative" as const, label: "Narrative result"}),
  Object.freeze({kind: "narrative" as const, label: "Narrative result"}),
  Object.freeze({kind: "narrative" as const, label: "Narrative result"}),
  conference,
  conference,
]);

export const CRISIS_ROWS: Readonly<Record<CrisisRowId, CrisisRowDef>> = Object.freeze(
  Object.fromEntries([...PRINTED_CRISIS_ROWS, FALLBACK_CRISIS_ROW].map((r) => [r.id, r])) as Record<
    CrisisRowId,
    CrisisRowDef
  >,
);

/* -------------------------------------------------------------------------- */
/* The Balkan States table                                                     */
/* -------------------------------------------------------------------------- */

/** Printed Balkan States table, result 1..6 (playbook right column). */
export type BalkanMinor = "Bosnia" | "Serbia" | "Bulgaria" | "Romania" | "Greece";

export const BALKAN_MINORS: readonly BalkanMinor[] = Object.freeze([
  "Bosnia",
  "Serbia",
  "Bulgaria",
  "Romania",
  "Greece",
]);

export interface BalkanStateCell {
  readonly roll: 1 | 2 | 3 | 4 | 5 | 6;
  /** Printed "1 Choice" — the player selects an independent Balkan state. */
  readonly choice?: true;
  readonly minor?: BalkanMinor;
}

export const BALKAN_STATE_TABLE: readonly BalkanStateCell[] = Object.freeze([
  Object.freeze({roll: 1 as const, choice: true as const}),
  Object.freeze({roll: 2 as const, minor: "Bosnia" as const}),
  Object.freeze({roll: 3 as const, minor: "Serbia" as const}),
  Object.freeze({roll: 4 as const, minor: "Bulgaria" as const}),
  Object.freeze({roll: 5 as const, minor: "Romania" as const}),
  Object.freeze({roll: 6 as const, minor: "Greece" as const}),
]);

export const balkanCellForRoll = (roll: number): BalkanStateCell =>
  BALKAN_STATE_TABLE[Math.max(0, Math.min(BALKAN_STATE_TABLE.length - 1, Math.trunc(roll) - 1))];

/**
 * Resolve one draw on the Balkan States table (§23.2: "If the result is a
 * Balkan state that is not independent, reroll the die until you get a result
 * for one that is").  Pure: the caller supplies the dice it can see and an
 * independence predicate; `consumed` says how many rolls the draw used, so a
 * live caller can feed one die at a time.
 *
 * A "Choice" result consumes exactly one roll and asks the caller for the
 * player's selection (`choice: true`).
 */
export interface BalkanDraw {
  /** The drawn (independent) minor, or null when no die produced one. */
  readonly drawn: BalkanMinor | null;
  /** Printed "Choice": the player must select an independent Balkan state. */
  readonly choice: boolean;
  readonly consumed: number;
  /** True when the dice ran out on non-independent results. */
  readonly exhausted: boolean;
}

export const drawBalkanState = (
  dice: readonly number[],
  isIndependent: (minor: BalkanMinor) => boolean,
): BalkanDraw => {
  for (let i = 0; i < dice.length; i += 1) {
    const cell = balkanCellForRoll(dice[i]);
    if (cell.choice) return {drawn: null, choice: true, consumed: i + 1, exhausted: false};
    const minor = cell.minor ?? null;
    if (minor !== null && isIndependent(minor)) {
      return {drawn: minor, choice: false, consumed: i + 1, exhausted: false};
    }
  }
  return {drawn: null, choice: false, consumed: dice.length, exhausted: dice.length > 0};
};

/* -------------------------------------------------------------------------- */
/* Inciting events -> rows                                                     */
/* -------------------------------------------------------------------------- */

/** How the incident column is answered for an inciting card. */
export type CrisisIncidentKind =
  /** `Assassination` / "Blame": the targeted player is blamed. */
  | "blame"
  /** `Naval Arms Race` / "Naval Incident". */
  | "navalIncident"
  /** Powder Keg / The Balkan Wars: a random independent Balkan state. */
  | "balkanState"
  /** The Black Hand: step 1 rolls the target. */
  | "blackHandTarget"
  /** Bosnian Crisis / Moroccan Crisis / 'Urabi Revolt: "Outraged by annexation". */
  | "annexation"
  /** Impulsive Leader: the result cell names the power. */
  | "rashDecision"
  /** Alliance System / Shifting Alliances. */
  | "incitingIncident"
  | "unknown";

export interface CrisisIncitingDef {
  /** The printed card id, or null for the fallback. */
  readonly cardId: string | null;
  /** Printed event name. */
  readonly event: string;
  /** Rows rolled, in order: one row, or step 1 then step 2. */
  readonly rows: readonly CrisisRowId[];
  readonly incident: CrisisIncidentKind;
  /** The space whose controller is the "losing power" (annexation rows). */
  readonly losingSpace?: string;
}

const inciting = (
  cardId: string,
  event: string,
  rows: CrisisRowId[],
  incident: CrisisIncidentKind,
  losingSpace?: string,
): CrisisIncitingDef => Object.freeze({cardId, event, rows: Object.freeze(rows), incident, losingSpace});

/** Card id -> printed row(s).  Derived from the printed card faces. */
export const CRISIS_INCITING: Readonly<Record<string, CrisisIncitingDef>> = Object.freeze({
  // A017 Assassination!: "Choose a player..." — the incident is who was blamed.
  "IE-A017": inciting("IE-A017", "Assassination", ["assassination"], "blame"),
  // A092 Naval Arms Race.
  "IE-A092": inciting("IE-A092", "Naval Arms Race", ["navalArmsRace"], "navalIncident"),
  // A053 Powder Keg and A100 The Balkan Wars share the two printed rows.
  // NB: the map's current special handlers do not raise the WTT for each
  // printed branch, so these rows are only incited when the WTT actually
  // reaches 5 (see the module report).
  "IE-A053": inciting("IE-A053", "Powder Keg", ["powderKegStep1", "powderKegStep2"], "balkanState"),
  "IE-A100": inciting("IE-A100", "The Balkan Wars", ["powderKegStep1", "powderKegStep2"], "balkanState"),
  // A101 The Black Hand: step 1 rolls the target, step 2 the terrorism result.
  "IE-A101": inciting("IE-A101", "The Black Hand", ["blackHandStep1", "blackHandStep2"], "blackHandTarget"),
  // A103 Bosnian Crisis.
  "IE-A103": inciting("IE-A103", "Bosnian Crisis", ["bosnianCrisis"], "annexation"),
  // A102 Moroccan Crisis and A071 'Urabi Revolt share the printed row; the
  // "Losing Power" is the controller of the named map space.
  "IE-A102": inciting("IE-A102", "Moroccan Crisis", ["moroccanCrisis"], "annexation", "morocco"),
  "IE-A071": inciting("IE-A071", "'Urabi Revolt", ["moroccanCrisis"], "annexation", "egypt"),
  // A105 Impulsive Ruler is the printed "Impulsive Leader" row.
  "IE-A105": inciting("IE-A105", "Impulsive Leader", ["impulsiveLeader"], "rashDecision"),
  // A015 Shifting Alliances and A111 The Alliance System.
  "IE-A015": inciting("IE-A015", "Shifting Alliances", ["allianceSystem"], "incitingIncident"),
  "IE-A111": inciting("IE-A111", "The Alliance System", ["allianceSystem"], "incitingIncident"),
});

export const FALLBACK_CRISIS_INCITING: CrisisIncitingDef = Object.freeze({
  cardId: null,
  event: FALLBACK_CRISIS_ROW.event,
  rows: Object.freeze(["fallback"]) as readonly CrisisRowId[],
  incident: "unknown" as const,
});

/** The printed (or fallback) definition for one inciting card id. */
export const crisisIncitingFor = (cardId: string | null | undefined): CrisisIncitingDef =>
  (cardId !== null && cardId !== undefined ? CRISIS_INCITING[cardId] : undefined) ?? FALLBACK_CRISIS_INCITING;

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/** The incident column, answered for this roll. */
export interface CrisisIncident {
  readonly rowId: CrisisRowId;
  readonly event: string;
  readonly incident: string;
  readonly step: 1 | 2 | null;
  /** The player the event affected (bordering nation / blame). */
  readonly targetPower: Power | null;
  /** Powder Keg / Balkan Wars: the threatened independent Balkan state. */
  readonly threatenedMinor: BalkanMinor | null;
  /** Annexation rows: the space whose controller is the losing power. */
  readonly losingSpace: string | null;
}

/** What the table still requires after the roll (§23.3/§23.5). */
export type CrisisFollowUp =
  /** "Bordering Nation": the active player selects a bordering power. */
  | {readonly kind: "borderingNation"; readonly targetPower: Power | null}
  /** The Balkan Table: roll once/twice, then (Powder Keg) the step 2 row. */
  | {readonly kind: "balkanTable"; readonly rolls: 1 | 2; readonly threatenedMinor: BalkanMinor | null}
  /** Powder Keg / Balkan Wars step 2: who the threatened state appeals to. */
  | {readonly kind: "respondent"; readonly threatenedMinor: BalkanMinor | null}
  /** Black Hand step 1 / Bosnian Crisis cell: the named power. */
  | {readonly kind: "targetPower"; readonly target: Power}
  /** "Minority Nationality" — narrative (§23.2/§23.3: only `**` is special). */
  | {readonly kind: "minorityNationality"; readonly targetPower: Power | null}
  /** "Losing Power" — the controller of the named space. */
  | {readonly kind: "losingPower"; readonly space: string | null}
  /** Narrative-only (§23.2). */
  | {readonly kind: "narrative"; readonly label: string};

export type CrisisResolution =
  | {
      readonly kind: "conference";
      /** The die total (die + DRM) that produced the conference. */
      readonly roll: number;
      /** Footnote `*`: the conference already happened once, reroll. */
      readonly reroll: boolean;
      readonly rowId: CrisisRowId;
    }
  | {
      readonly kind: "outbreak";
      /** The die total (die + DRM) used for the row, clamped to 1..6. */
      readonly roll: number;
      readonly rowId: CrisisRowId;
      readonly incident: CrisisIncident;
      /** The printed result cell (the `result` of the brief). */
      readonly result: CrisisCell;
      /** Footnote `**`: a special result that changes the game state. */
      readonly special: boolean;
      readonly followUps: readonly CrisisFollowUp[];
    };

export interface CrisisRollInput {
  readonly rowId: CrisisRowId;
  /** The raw die result. */
  readonly roll: number;
  /** Crisis-roll DRM (positive makes a Great War less likely). */
  readonly drm?: number;
  /** `persistent.conferenceUsed` before this roll. */
  readonly conferenceUsed?: boolean;
  /** Powers allied to AU, for the `†` footnote. */
  readonly alliedToAU?: readonly Power[];
  /** Incident column answers already known to the caller. */
  readonly targetPower?: Power | null;
  readonly threatenedMinor?: BalkanMinor | null;
  readonly losingSpace?: string | null;
}

/** True when the cell carries the printed `**` special marker. */
export const isSpecialResult = (cell: CrisisCell): boolean => cell.special === true;

/**
 * Resolve one roll against one printed row.
 *
 * - Total > 6 is an International Conference* (printed footnote).
 * - A `†` cell whose named power is allied to AU is treated as a 1.
 * - A conference cell returns `reroll: true` when the once-per-game conference
 *   has already been used, so the live layer can reroll the die.
 * - Every other cell is an outbreak; §23.2 makes the rest narrative unless the
 *   cell is a `**` special result, and `followUps` says exactly what the table
 *   still requires.
 */
export const resolveCrisisRoll = (input: CrisisRollInput): CrisisResolution => {
  const total = input.roll + (input.drm ?? 0);
  const row = CRISIS_ROWS[input.rowId] ?? FALLBACK_CRISIS_ROW;
  if (total > 6) {
    // "Treat any results >6 as an International Conference*."
    return {kind: "conference", roll: total, reroll: input.conferenceUsed === true, rowId: row.id};
  }
  const effective = Math.max(1, Math.min(6, total));
  let result = row.cells[effective - 1];
  if (result.dagger === true && result.target !== undefined && input.alliedToAU?.includes(result.target)) {
    // "Treat as a 1 if player is allied to AU."
    result = row.cells[0];
  }
  if (result.kind === "internationalConference") {
    return {kind: "conference", roll: total, reroll: input.conferenceUsed === true, rowId: row.id};
  }
  const incident: CrisisIncident = {
    rowId: row.id,
    event: row.event,
    incident: row.incident,
    step: row.step,
    targetPower: input.targetPower ?? null,
    threatenedMinor: input.threatenedMinor ?? null,
    losingSpace: input.losingSpace ?? null,
  };
  return {
    kind: "outbreak",
    roll: effective,
    rowId: row.id,
    incident,
    result,
    special: isSpecialResult(result),
    followUps: followUpsFor(row, result, incident),
  };
};

/** The printed label of one crisis result, for the log: "Event — Incident — Result". */
export const crisisLabel = (incident: CrisisIncident, result: CrisisCell): string =>
  `${incident.event} — ${incident.incident} — ${result.label}`;

const followUpsFor = (
  row: CrisisRowDef,
  result: CrisisCell,
  incident: CrisisIncident,
): readonly CrisisFollowUp[] => {
  switch (result.kind) {
    case "borderingNation":
      return [{kind: "borderingNation", targetPower: incident.targetPower}];
    case "balkanTable": {
      const rolls = result.rolls ?? 1;
      const out: CrisisFollowUp[] = [
        {kind: "balkanTable", rolls, threatenedMinor: incident.threatenedMinor},
      ];
      // §23.3.3: the Powder Keg / Balkan Wars row then rolls the step 2 row.
      if (row.id === "powderKegStep1") {
        out.push({kind: "respondent", threatenedMinor: incident.threatenedMinor});
      }
      return out;
    }
    case "targetPower":
      return result.target !== undefined ? [{kind: "targetPower", target: result.target}] : [{kind: "narrative", label: result.label}];
    case "minorityNationality":
      return [{kind: "minorityNationality", targetPower: incident.targetPower}];
    case "losingPower":
      return [{kind: "losingPower", space: incident.losingSpace}];
    case "allyRespondent":
      return [{kind: "respondent", threatenedMinor: incident.threatenedMinor}];
    default:
      return [{kind: "narrative", label: result.label}];
  }
};
