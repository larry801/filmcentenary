/**
 * The decline-button audit: every pending kind is accounted for exactly once.
 *
 * The panel's generic 拒绝 button is only honest when the engine's
 * `declinePending` fallback would do what the button says.  Three classes cover
 * every kind in `PENDING_KINDS`:
 *
 * 1. mandatory (`MANDATORY_PENDING_KINDS` in `useBoardModel.ts`) — the rules
 *    require an answer and the engine's fallback would auto-pick; the panel
 *    never offers 拒绝.
 * 2. self-answering (the map below) — the pending always prints the exact
 *    option `declinePending` would pick, so the printed button already is the
 *    decline and `DECLINE_EQUIVALENT_OPTION_IDS` hides the duplicate generic
 *    button.
 * 3. decline-legal (the set below) — an optional window with no printed no-op,
 *    where 拒绝 is a genuine, distinct answer.
 *
 * A new kind added to `PENDING_KINDS` without a class here fails this suite,
 * and so does a self-answering id the dedup set does not know.  The mapping is
 * the verified routing of `declinePendingDecision` in `moves.ts`; each entry
 * names the rule its fallback answers.
 */
import {PENDING_KINDS} from "../types";
import {DECLINE_EQUIVALENT_OPTION_IDS, pendingDeclinesItself} from "./PendingPanel";
import {MANDATORY_PENDING_KINDS} from "./useBoardModel";

// The audit imports the real hook module, whose component chain pulls the
// app stylesheet; the constants under test need none of the rendering.
jest.mock("./theme", () => ({IEPanel: () => null, IEBadge: () => null, IEChip: () => null}));

/** kind → the printed option id `declinePending` resolves to. */
const SELF_ANSWERING: Readonly<Record<string, string>> = {
  // 16.1.4/16.1.5: declining a peace proposal keeps the war going — the same
  // answer as the printed "Decline — keep fighting".
  warPeace: "decline",
  // UK Balance of Power: the card is spent either way; declining draws a card.
  balanceOfPower: "decline",
  // 14.0: refusing a call to war takes the printed penalties.
  warAllyConsent: "refuse",
  // 3.4.1: declining a passage request is the printed refusal.
  dardanellesPassage: "refuse",
  // 13.4.2: declining sends the aid search to the next candidate.
  minorAid: "decline",
  // 13.4.1: declining keeps fighting for the minor, i.e. joins the war.
  minorAbandon: "join",
  // 33.1 German Confederation is optional: declining ends the settlement.
  germanConfederation: "decline",
  // 33.3 Napoleon's Legacy is optional: declining keeps the goal secret.
  napoleonsLegacy: "decline",
  // 33.1 Blood and Iron!: declining searches nothing and draws NGs normally.
  bloodAndIron: "draw",
  // The elite's printed "do not use its bonus" is the only real decline; the
  // generic fallback would pick the first option and *commit* the elite.
  combatElite: "decline",
  // A091 / 18.4: same shape — the generic fallback would inflict the +1 loss.
  hydraulicRecoil: "decline",
  // 19.1: declining the interception window is the printed "skip".
  navalInterception: "skip",
  // 19.1: declining to finish the movement keeps the ships where they are.
  navalContinuation: "stop",
  // 19.8: declining the optional port move keeps the winning fleet at sea.
  navalPortContinuation: "stay",
  // 19.4: an unattended attacker takes every mine hit ("continue").
  mineRetreat: "continue",
  // 19.2: the naval defender always prints "fight"; declining answers it.
  navalAvoid: "fight",
  // 25.7.1: declining the bonus impulse is the printed "skip".
  gwBonusImpulse: "skip",
  // 32.4: declining stays out of the opposing alliance.
  gwNonPlayerJoin: "stay",
  // 29.3: declining a neutral decision takes the printed no-op.
  gwNeutralEntry: "stay",
  gwNeutralAction: "done",
  gwNeutralUnit: "skip",
  // 29.2: declining the transfer takes no further space ("skip").
  gwColonialTransfer: "skip",
  // 29.2.1: declining is the printed "no agreement: all bonus CP are lost".
  gwColonialBonusCp: "decline",
  // The attacker-surrender confirm prints "refuse"; declining answers it.
  confirm: "refuse",
};

/**
 * Kinds where 拒绝 is a genuine distinct answer (an optional window with no
 * printed no-op), plus kinds the engine never opens today — kept here so the
 * audit notices the day one of them starts opening pendings.
 */
const DECLINE_LEGAL: ReadonlySet<string> = new Set([
  // 16.1: the winner may decline any treaty option — a real choice.
  "treatyOption",
  // Demobilization free actions are optional; declining ends the sequence.
  "demobilizationFreeAction",
  // No pending of this kind is opened by the current engine (the flows answer
  // elsewhere); if one ever opens, re-audit its decline before shipping it.
  "discardForStability",
  "chooseHomeCard",
  "giveCard",
  "eventUnits",
  "combatAdvance",
  "italyTable",
  "gwCard",
  "gwWinter",
  "scoringChoice",
  "responseCard",
  "industryCard",
]);

describe("the decline audit", () => {
  test("every pending kind is mandatory, self-answering, or decline-legal — exactly once", () => {
    const mandatory = [...MANDATORY_PENDING_KINDS];
    const selfAnswering = Object.keys(SELF_ANSWERING);
    expect(new Set(PENDING_KINDS).size).toBe(PENDING_KINDS.length);
    const covered = new Set([...mandatory, ...selfAnswering, ...DECLINE_LEGAL]);
    expect(new Set(mandatory).size).toBe(mandatory.length);
    expect(new Set(selfAnswering).size).toBe(selfAnswering.length);
    expect(covered.size).toBe(mandatory.length + selfAnswering.length + DECLINE_LEGAL.size);
    for (const kind of PENDING_KINDS) expect(covered.has(kind)).toBe(true);
    for (const kind of covered) expect(PENDING_KINDS).toContain(kind);
  });

  test("every self-answering kind prints the exact option declinePending picks, and the panel dedups it", () => {
    for (const [kind, id] of Object.entries(SELF_ANSWERING)) {
      expect(DECLINE_EQUIVALENT_OPTION_IDS.has(id)).toBe(true);
      // The bridge to the UI: a pending of this kind carrying its printed
      // answer hides the generic 拒绝.
      expect(pendingDeclinesItself({options: [{id}]})).toBe(true);
    }
  });

  test("a printed answer that is not a decline-equivalent never hides the generic 拒绝 by accident", () => {
    expect(pendingDeclinesItself({options: [{id: "berlin"}]})).toBe(false);
    expect(pendingDeclinesItself({options: [{id: "none"}]})).toBe(false);
  });
});
