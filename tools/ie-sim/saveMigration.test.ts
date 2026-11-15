/**
 * Old-save robustness.
 *
 * `ensureStateDefaults` claims every round-1–7 field is additive, so a save from
 * an earlier build keeps working.  The claim is easy to state and easy to
 * break: one new field read without a `??=` turns a resumed match into a crash
 * for whoever loaded it.
 *
 * This deletes state — one top-level field at a time, then the newer optional
 * fields as a group — and then drives the game forward through real moves.  A
 * save that only survives *loading* is not enough; it has to survive playing.
 */
import {ImperialElegyState, POWERS} from "../../src/imperialElegy/types";
import {setupImperialElegy} from "../../src/imperialElegy/engine/setup";
import {ensureStateDefaults} from "../../src/imperialElegy/engine/migrations";
import {checkInvariants} from "./harness";
import {makeCtx, playAndSettle} from "./cardSweep";
import {finishPrep} from "../../src/imperialElegy/moves";

jest.setTimeout(1800000);

/** Fields the migration documents as "added by a later round". */
// Only fields that a fresh state really carries: `persistentlyEliminatedMinors`
// and `endPhase` are conditional records the migration creates on demand, so
// deleting them proves nothing.  `italyMpit` is deliberately left out too — the
// migration deletes it as a lazy default, so its absence is the normal shape.
const OPTIONAL_FIELDS = [
  "minorDeclarations",
  "minorCardMarkers",
  "revealedGoals",
  "navalTransit",
  "navalContinuation",
  "dardanellesPassage",
  "dardanellesPassages",
  "delayedCards",
];

/** Drive a few real moves so a crash shows up in play, not just on load. */
const playOn = (G: ImperialElegyState): string | null => {
  for (const power of POWERS) {
    try {
      finishPrep(G, makeCtx(String(POWERS.indexOf(power))));
    } catch (error) {
      return `finishPrep threw: ${(error as Error).message}`;
    }
  }
  // The phase hook may have moved us to the action phase; play one card there.
  if (G.phase === "action") {
    for (const power of POWERS) {
      const outcome = playAndSettle(G, power, "IE-A013");
      if (outcome.failure !== null && !outcome.refused) return `playCard: ${outcome.failure}`;
      if (outcome.refused) continue;
      break;
    }
  }
  const problems = checkInvariants(G);
  return problems.length > 0 ? `invariant: ${problems[0]}` : null;
};

test("a save missing any single optional field still plays", () => {
  const failures: string[] = [];
  let advanced = 0;
  for (const field of OPTIONAL_FIELDS) {
    const G = setupImperialElegy(makeCtx("0"));
    delete (G as unknown as Record<string, unknown>)[field];
    try {
      ensureStateDefaults(G);
      const before = `${G.phase}|${G.turn}`;
      const failure = playOn(G);
      if (`${G.phase}|${G.turn}` !== before) advanced += 1;
      if (failure !== null) failures.push(`missing ${field}: ${failure}`);
    } catch (error) {
      failures.push(`missing ${field}: threw ${(error as Error).message}`);
    }
  }
  if (failures.length > 0) for (const failure of failures) console.log(`  ${failure}`);
  // Guard against a vacuous pass: every scenario must have actually moved.
  expect(advanced).toBe(OPTIONAL_FIELDS.length);
  expect(failures).toEqual([]);
});

test("a save missing every optional field at once still plays", () => {
  const G = setupImperialElegy(makeCtx("0"));
  for (const field of OPTIONAL_FIELDS) delete (G as unknown as Record<string, unknown>)[field];
  // Also drop the container records, which an early build did not have.
  for (const field of ["wars", "pendingStack", "delayedCards", "minorCardMarkers"]) {
    delete (G as unknown as Record<string, unknown>)[field];
  }
  (G as unknown as Record<string, unknown>).version = 0;

  expect(() => ensureStateDefaults(G)).not.toThrow();
  const failure = playOn(G);
  if (failure !== null) console.log(`  all-missing: ${failure}`);
  expect(failure).toBeNull();
});

test("a stale battle or pending record does not crash a resumed save", () => {
  const failures: string[] = [];
  const stale: [string, unknown][] = [
    ["pending", {id: "d999", kind: "combatLosses", power: "GE", prompt: "x", options: []}],
    ["battle", {kind: "land", attacker: "GE", defender: "FR", from: "berlin", to: "saxony", mainAttack: [], mainDefense: []}],
    ["navalTransit", {power: "UK", unitIds: ["u-missing"], path: ["north-atlantic"], index: 0}],
  ];
  for (const [field, value] of stale) {
    const G = setupImperialElegy(makeCtx("0"));
    (G as unknown as Record<string, unknown>)[field] = value;
    try {
      ensureStateDefaults(G);
      // A stale record must at least not make the migration itself throw.
      checkInvariants(G);
    } catch (error) {
      failures.push(`${field}: threw ${(error as Error).message}`);
    }
  }
  if (failures.length > 0) for (const failure of failures) console.log(`  ${failure}`);
  expect(failures).toEqual([]);
});
