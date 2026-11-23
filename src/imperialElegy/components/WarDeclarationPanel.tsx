/**
 * The war declaration form, inside the War panel.
 *
 * A declaration used to be assembled in two places: a home card's "choose the
 * war target" dialog, and a block in the Orders panel that only appeared once
 * the player had clicked a target's space on the map.  Both steps are gone:
 * this component asks the questions itself — aim, one or two targets, the
 * objective spaces — and derives every list from `engine/declarationTargets.ts`,
 * so no click on the map is needed and no offered target can be one
 * `declareWar` refuses.
 *
 * Rule 14.1 gets its own row: the Bismarck and Aux Armes home cards may attack
 * **two different powers**, and the second one may be a non-player power, so
 * the form offers "target 2" beside the first target whenever the card prints
 * the clause.  The objectives are then the legal pairs of spaces held by the
 * named targets, which is exactly rule 13.0's "up to two spaces" with the
 * defenders of 14.1.
 *
 * The choices are deliberately local state.  They are clamped on every render
 * (a target that is no longer legal falls back to the first one, an objective
 * that the current aim refuses falls back to the aim's first space), so a new
 * impulse or a new home card cannot leave a stale selection behind — which is
 * exactly the reset the old block needed a model-level effect for.  The
 * component unmounts when the declaration is made (a war starts and the War
 * panel switches to the war controls), so nothing survives a declaration.
 */
import React from "react";
import type {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {
  BISMARCK_HOME_CARD,
  JIHAD_HOME_CARD,
  RUSSO_TURKISH_WARS_HOME_CARD,
  warDeclarationAllowsTwoPowers,
  warDeclarationEntitlement,
  warDeclarationMayForbidJoins,
  type WarDeclarationAim,
} from "../engine/rules";
import {
  declarationAimsFor,
  declarationDefenders,
  declarationObjectives,
  declarationSecondObjectives,
  declarationSecondTargets,
  warTargetKey,
  type WarDeclarationDefender,
} from "../engine/declarationTargets";
import {warTargetFromKey, seekingAidSlots, type WarTarget} from "../engine/limitedWar";
import {ConfirmButton} from "./ConfirmButton";
import {IEPanel} from "./theme";
import {bi} from "./boardHelpers";
import type {ieT} from "./i18n";

/** The war declaration the panel would send; `null` while none is complete. */
export interface WarDeclaration {
  target: WarTarget;
  aim: WarDeclarationAim;
  objectives: SpaceId[];
  cp: number;
  options: {
    secondTarget?: WarTarget;
    primary?: WarTarget;
    forbidPlayers?: boolean;
  } | undefined;
}

export interface WarDeclarationPanelProps {
  G: ImperialElegyState;
  viewer: Power;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  /** The card title, e.g. "Otto von Bismarck", for the entitlement hint. */
  homeCardTitle: (card: string) => string;
  /** Only the action phase declares war (12.0 / 13.0). */
  canActionCard: boolean;
  /** CP left in this impulse; the ordinary declaration spends 1–4. */
  cpRemaining: number;
  confirmActions: boolean;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
}

const aimLabel = (aim: WarDeclarationAim, t: ReturnType<typeof ieT>): string =>
  aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : t.unification;

/** A non-player target's printed name, reached through its home space. */
const minorLabel = (minor: string, locale: "en" | "zh_CN"): string => {
  const home = MINOR_POWER_HOMES[minor];
  return home !== undefined && SPACES[home] !== undefined ? spaceLabel(home, locale) : minor;
};

const defenderLabel = (
  entry: WarDeclarationDefender, locale: "en" | "zh_CN", t: ReturnType<typeof ieT>,
): string =>
  typeof entry.target === "string"
    ? t.seats[entry.target]
    : minorLabel(entry.target.minor, locale);

export const WarDeclarationPanel = (props: WarDeclarationPanelProps) => {
  const {
    G, viewer, locale, t, homeCardTitle, canActionCard, cpRemaining,
    confirmActions, doAction, moves,
  } = props;
  const entitlement = warDeclarationEntitlement(G, viewer);

  const [chosenDefender, setChosenDefender] = React.useState<string>("");
  const [chosenAim, setChosenAim] = React.useState<WarDeclarationAim | null>(null);
  const [chosenObjective, setChosenObjective] = React.useState<SpaceId | "">("");
  const [chosenCp, setChosenCp] = React.useState(2);
  const [chosenSecondObjective, setChosenSecondObjective] = React.useState<SpaceId | "">("");
  const [chosenSecondTarget, setChosenSecondTarget] = React.useState<string>("");
  const [chosenPrimary, setChosenPrimary] = React.useState<string>("");
  const [forbidPlayers, setForbidPlayers] = React.useState(false);

  // A stable identity matters: the aim-selection memo below keys on this list,
  // and `declarationAimsFor` builds a fresh array.
  const aims = React.useMemo(
    () => declarationAimsFor(entitlement),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entitlement?.card ?? null, entitlement?.aim ?? null],
  );
  const declarationBlocked = G.war !== null || G.wtt >= 3 || G.powers[viewer].eliminated;
  // The enumeration checks every space each defender controls against the aim,
  // which is too much work to repeat while the seat cannot declare at all — the
  // panel stays mounted even with the Orders body in front.  Declaring is an
  // Action-phase act (13.0), so only that phase enumerates.
  const enumerate = canActionCard && !declarationBlocked;
  // Only defenders with at least one objective the aim accepts are offered: a
  // power the aim cannot be declared on (no key it controls, or a truce) would
  // otherwise be a dead row in the dropdown.
  const allDefenders = React.useMemo(
    () => (enumerate ? declarationDefenders(G, viewer, entitlement) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, enumerate],
  );
  const defendersForAim = React.useCallback(
    (a: WarDeclarationAim): WarDeclarationDefender[] =>
      allDefenders.filter((candidate) => declarationObjectives(G, viewer, entitlement, candidate, a).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allDefenders, G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null],
  );
  // One scan in the ordinary case.  A printed aim with no legal objective in
  // this position (Jihad's liberation before any Balkan rebellion, say) must
  // not own the initial selection, so the first aim that has a target wins.
  const {aim, defenders} = React.useMemo(() => {
    if (chosenAim !== null && aims.includes(chosenAim)) {
      return {aim: chosenAim, defenders: defendersForAim(chosenAim)};
    }
    for (const candidate of aims) {
      const list = defendersForAim(candidate);
      if (list.length > 0) return {aim: candidate, defenders: list};
    }
    return {aim: aims[0], defenders: []};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenAim, aims, defendersForAim]);

  const entry: WarDeclarationDefender | undefined =
    defenders.find((candidate) => warTargetKey(candidate.target) === chosenDefender) ?? defenders[0];

  // Rule 14.1: the second target and the primary defender are only offered when
  // the live home card prints the two-target clause for the chosen aim.  The
  // second target may be a power or a non-player power (`declarationSecondTargets`
  // filters with the same gates `declareWar` runs), and only ones whose own
  // declaration has an objective survive, so the pair can always be completed.
  const twoTargetEligible = entitlement !== null && entry !== undefined
    && warDeclarationAllowsTwoPowers(entitlement.card, aim);
  const secondTargetOptions = React.useMemo(
    () => (twoTargetEligible && entry !== undefined
      ? declarationSecondTargets(G, viewer, entitlement, entry, aim)
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [twoTargetEligible, G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, entry, aim],
  );
  const secondEntry: WarDeclarationDefender | undefined =
    secondTargetOptions.find((candidate) => warTargetKey(candidate.target) === chosenSecondTarget);
  // The spaces the declaration may name: a target pair uses both lists, so a
  // pair such as FR + Denmark can take one objective from either.
  const objectives = React.useMemo(
    () => (entry === undefined ? [] : declarationObjectives(G, viewer, entitlement, entry, aim, secondEntry)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, entry, aim, secondEntry],
  );
  const objective: SpaceId | "" =
    chosenObjective !== "" && objectives.includes(chosenObjective) ? chosenObjective : objectives[0] ?? "";
  // Rule 13.0: "the attacker chooses up to two spaces".  The second one is
  // optional, so the ordinary single-target declaration offers the same list.
  const secondObjectives = React.useMemo(
    () => (entry === undefined || objective === ""
      ? []
      : declarationSecondObjectives(
        G, viewer, entitlement, entry, aim, objective as SpaceId, secondEntry ?? null,
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, entry, aim, objective, secondEntry],
  );
  const secondObjective: SpaceId | "" =
    chosenSecondObjective !== "" && secondObjectives.includes(chosenSecondObjective)
      ? chosenSecondObjective
      : "";
  // 14.1: "the defending players determine, between the two of them, who the
  // primary defender is".  Only a player power can be the primary (14.1 uses it
  // for the capital that ends the war); a minor pair has no primary to choose.
  const primaryChoices: Power[] = [entry?.target, secondEntry?.target]
    .filter((candidate): candidate is Power => typeof candidate === "string");
  const primary: Power | "" = primaryChoices.includes(chosenPrimary as Power)
    ? chosenPrimary as Power
    : primaryChoices[0] ?? "";

  const forbidPlayersAllowed = entitlement !== null && warDeclarationMayForbidJoins(entitlement.card);
  // The card funds the declaration with its printed CP; an ordinary one picks
  // 1–4 and pays it out of the impulse (13.0).
  // Errata 12.17: an ordinary declaration spends the whole card played this
  // impulse, so the panel locks the CP value to that card's printed CP.
  const impulseCp = G.impulseCardCp ?? null;
  const cp = entitlement !== null ? entitlement.cp : impulseCp ?? chosenCp;
  const enoughCp = impulseCp !== null ? cpRemaining === impulseCp : cpRemaining >= cp;
  const canDeclare = canActionCard && objective !== "" && (entitlement !== null || enoughCp);

  const declaration: WarDeclaration | null = entry === undefined || objective === ""
    ? null
    : {
      target: entry.target,
      aim,
      objectives: secondObjective === "" ? [objective] : [objective, secondObjective],
      cp,
      options: {
        ...(secondEntry === undefined
          ? {}
          // 14.1's primary is a *player* power; a pair of two non-player
          // powers has none to determine, so the clause is omitted.
          : {
            secondTarget: secondEntry.target,
            ...(primaryChoices.length > 0 ? {primary: primary as Power} : {}),
          }),
        ...(forbidPlayersAllowed && forbidPlayers ? {forbidPlayers: true} : {}),
      },
    };
  const options = declaration === null ? undefined : declaration.options;
  const hasOptions = options !== undefined && Object.keys(options).length > 0;

  // Rule 13.4.2: a declaration on a non-player power *without* a player ally
  // makes that power seek aid — the asked players are the diplomacy-marker
  // holder, then the 13.4.3 table's 1st/2nd/3rd Choice.  Show who that is, so
  // picking Denmark is not a blind pick.  `seekingAidSlots` is the same
  // enumeration `beginSeekingAid` runs, so the hint cannot name a player the
  // move would never ask (Bismarck's join ban suppresses it entirely).
  const aidHint = React.useMemo(() => {
    // Only the first target runs the 13.4 chain; a second non-player target is
    // recorded as a co-defender minor with the war.
    const minor = entry === undefined || typeof entry.target === "string" ? null : entry.target.minor;
    if (minor === null) return null;
    const forbidden = forbidPlayersAllowed && forbidPlayers;
    const slots = forbidden ? [] : seekingAidSlots(G, viewer, minor);
    return {minor, forbidden, slots};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, viewer, entry, forbidPlayersAllowed, forbidPlayers]);

  const reason = canDeclare
    ? undefined
    : !canActionCard
      ? bi(locale, "A war can only be declared during your Action impulse.", "只能在你的行动轮宣战。")
      : G.wtt >= 3
      ? bi(locale, "World Tension is 3+; a new war cannot be declared.", "世界紧张达到 3+，无法发动新的战争。")
      : objective === ""
        ? bi(locale, "No legal objective for this defender and aim.", "该防守方与战争目标下没有合法目标空间。")
        : impulseCp !== null && cpRemaining !== impulseCp
          ? bi(locale, `Errata 12.17: the whole ${impulseCp} CP card must pay for the war; ${cpRemaining} CP remain.`, `勘误 12.17：必须用整张 ${impulseCp} CP 的牌支付战争；当前剩余 ${cpRemaining} CP。`)
          : bi(locale, `Needs ${cp} CP in this impulse.`, `本行动轮需要 ${cp} CP。`);

  const title = entitlement !== null
    ? bi(locale, `Declare war — ${homeCardTitle(entitlement.card)}`, `宣战 — ${homeCardTitle(entitlement.card)}`)
    : t.declareWar;

  return (
    <IEPanel title={title}>
      <div className="ie-war-declare" data-testid="ie-war-declare">
        <div className="ie-inline">
          <span className="ie-inline" role="group" aria-label={t.warAim}>
            {entitlement?.aim !== null && entitlement?.aim !== undefined ? (
              <span className="ie-chip" data-testid="ie-war-declare-aim-locked">{aimLabel(entitlement.aim, t)}</span>
            ) : (
              aims.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ie-chip${option === aim ? " selected" : ""}`}
                  data-testid={`ie-war-declare-aim-${option}`}
                  aria-pressed={option === aim}
                  onClick={() => {
                    setChosenAim(option);
                    setChosenObjective("");
                    setChosenSecondObjective("");
                    setChosenSecondTarget("");
                    setChosenPrimary("");
                  }}
                >
                  {aimLabel(option, t)}
                </button>
              ))
            )}
          </span>
          {entitlement !== null || impulseCp !== null ? (
            <span className="ie-chip" data-testid="ie-war-declare-cp-locked">{cp} CP</span>
          ) : (
            <label className="ie-inline">
              <span className="ie-muted">{t.cp}</span>
              <select
                className="ie-select"
                data-testid="ie-war-declare-cp"
                value={chosenCp}
                onChange={(event) => setChosenCp(Number(event.target.value))}
                title={t.cp}
              >
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} CP</option>)}
              </select>
            </label>
          )}
        </div>
        {defenders.length === 0 ? (
          <div className="ie-hint" data-testid="ie-war-declare-none">
            {!canActionCard
              ? bi(locale,
                "A war can only be declared during your Action impulse.",
                "只能在你的行动轮宣战。")
              : bi(locale,
                `No legal declaration for ${aimLabel(aim, t)} right now (World Tension 3+, a truce, or no target the card allows).`,
                `当前没有可用的${aimLabel(aim, t)}宣战（世界紧张 3+、停战，或没有符合卡面的目标）。`)}
          </div>
        ) : (
          <>
            <div className="ie-inline">
              <label className="ie-inline">
                <span className="ie-muted">{t.target}</span>
                <select
                  className="ie-select"
                  data-testid="ie-war-declare-defender"
                  value={entry === undefined ? "" : warTargetKey(entry.target)}
                  onChange={(event) => {
                    setChosenDefender(event.target.value);
                    setChosenObjective("");
                    setChosenSecondObjective("");
                    setChosenSecondTarget("");
                    setChosenPrimary("");
                  }}
                  title={t.target}
                >
                  {defenders.map((candidate) => (
                    <option key={warTargetKey(candidate.target)} value={warTargetKey(candidate.target)}>
                      {defenderLabel(candidate, locale, t)}
                    </option>
                  ))}
                </select>
              </label>
              {/* Rule 14.1: the GE and FR home cards may attack two different
                  powers with one declaration.  Sitting beside the first target
                  makes the shape of the declaration visible before the spaces
                  are picked; a non-player power is offered too. */}
              {twoTargetEligible && secondTargetOptions.length > 0 && (
                <label className="ie-inline">
                  <span className="ie-muted">{bi(locale, "Second target", "第二目标")}</span>
                  <select
                    className="ie-select"
                    data-testid="ie-war-second-power"
                    value={secondEntry === undefined ? "" : warTargetKey(secondEntry.target)}
                    onChange={(event) => {
                      setChosenSecondTarget(event.target.value);
                      setChosenObjective("");
                      setChosenSecondObjective("");
                      setChosenPrimary("");
                    }}
                    title={bi(locale, "Second target (14.1)", "第二目标（14.1）")}
                  >
                    <option value="">{bi(locale, "One target", "单一目标")}</option>
                    {secondTargetOptions.map((candidate) => (
                      <option key={warTargetKey(candidate.target)} value={warTargetKey(candidate.target)}>
                        {defenderLabel(candidate, locale, t)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="ie-inline">
              <label className="ie-inline">
                <span className="ie-muted">{bi(locale, "Objective", "目标空间")}</span>
                <select
                  className="ie-select"
                  data-testid="ie-war-declare-objective"
                  value={objective}
                  onChange={(event) => {
                    setChosenObjective(event.target.value as SpaceId);
                    setChosenSecondObjective("");
                  }}
                  title={t.objectives}
                >
                  {objectives.length === 0 && <option value="">—</option>}
                  {objectives.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
                </select>
              </label>
              {secondObjectives.length > 0 && (
                <label className="ie-inline">
                  <span className="ie-muted">{bi(locale, "Second objective", "第二目标空间")}</span>
                  <select
                    className="ie-select"
                    data-testid="ie-war-declare-second-objective"
                    value={secondObjective}
                    onChange={(event) => setChosenSecondObjective(event.target.value as SpaceId | "")}
                    title={t.objectives}
                  >
                    <option value="">{bi(locale, "One objective", "单一目标")}</option>
                    {secondObjectives.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
                  </select>
                </label>
              )}
              {primaryChoices.length > 1 && (
                <select
                  className="ie-select"
                  data-testid="ie-war-primary-defender"
                  value={primary}
                  onChange={(event) => setChosenPrimary(event.target.value as Power)}
                  title={bi(locale, "Primary defender (14.1)", "主要防守方（14.1）")}
                >
                  {primaryChoices.map((p) => (
                    <option key={p} value={p}>{bi(locale, `Primary: ${t.seats[p]}`, `主要防守方：${t.seats[p]}`)}</option>
                  ))}
                </select>
              )}
              {forbidPlayersAllowed && (
                <label className="ie-inline ie-war-forbid" data-testid="ie-war-forbid-join">
                  <input
                    type="checkbox"
                    checked={forbidPlayers}
                    onChange={(event) => setForbidPlayers(event.target.checked)}
                  />
                  {bi(locale, "Forbid player allies", "禁止玩家盟友参战")}
                </label>
              )}
              {/* Declaring war cannot be undone, so it arms first like every
                  other irreversible control.  The label carries the CP price so
                  the confirmation names what the click is about to spend. */}
              <ConfirmButton
                className="ie-btn"
                data-testid="ie-declare-war"
                disabled={!canDeclare || declaration === null}
                confirm={confirmActions}
                confirmLabel={bi(locale,
                  `Confirm: declare war (${cp} CP)`,
                  `确认：宣战（${cp} CP）`)}
                onConfirm={() => {
                  if (declaration === null) return;
                  doAction(
                    () => moves.declareWar(
                      declaration.target,
                      declaration.aim,
                      declaration.objectives,
                      declaration.cp,
                      hasOptions ? options : undefined,
                    ),
                    {
                      label: bi(locale, `Declare war (${cp} CP)`, `宣战（${cp} CP）`),
                      reason,
                    },
                  );
                }}
              >
                {t.declareWar}
              </ConfirmButton>
            </div>

            {entitlement !== null && (
              <div className="ie-hint" data-testid="ie-war-entitlement">
                {bi(locale,
                  `${entitlement.card === BISMARCK_HOME_CARD ? "Bismarck" : "The card"} funds this declaration with its printed CP; pick the target and objective here.`,
                  `本牌以印制的 CP 支付宣战费用；在此选择目标与目标空间。`)}
              </div>
            )}
            {twoTargetEligible && (
              <div className="ie-hint" data-testid="ie-war-two-powers">
                {bi(locale,
                  "This card may name a second target; the defenders agree on the primary, and the attacker decides if they cannot.",
                  "本牌可同时指定第二个目标；防守方协商主要防守方，协商不成则由进攻方决定。")}
              </div>
            )}
            {aidHint !== null && (
              <div className="ie-hint" data-testid="ie-war-nonplayer-aid">
                {aidHint.forbidden
                  ? bi(locale,
                    "You forbid other players from joining: the non-player power defends alone (13.4.2 / 15.4.2).",
                    "你已禁止其他玩家参战：该非玩家势力将独自防守（13.4.2 / 15.4.2）。")
                  : (
                    <>
                      {bi(locale,
                        "This target is a non-player power with no player ally. It will seek aid (13.4.2):",
                        "该目标是没有玩家盟友的非玩家势力，会寻求援助（13.4.2）：")}
                      {aidHint.slots.length > 0 && (
                        <span data-testid="ie-war-nonplayer-aid-candidates">
                          {" "}
                          {aidHint.slots
                            .map((slot) => {
                              const who = slot.candidates.map((p) => t.seats[p]).join(" / ");
                              const step = slot.diplomacy
                                ? bi(locale, "diplomacy marker", "外交标记")
                                : bi(locale, `choice ${slot.step - 1}`, `第 ${slot.step - 1} 选择`);
                              return `${minorLabel(aidHint.minor, locale)}: ${step} — ${who}${slot.rollOff ? " (*)" : ""}`;
                            })
                            .join("; ")}
                        </span>
                      )}
                      {aidHint.slots.length === 0 && (
                        <span>
                          {" "}
                          {bi(locale,
                            "no player may aid it, so it defends alone (15.4.2).",
                            "没有玩家可以援助它，因此它独自防守（15.4.2）。")}
                        </span>
                      )}
                      {aidHint.slots.some((slot) => slot.rollOff) && (
                        <span>
                          {" "}
                          {bi(locale,
                            "(*) both players roll off, higher roll asks first.",
                            "(*) 两名玩家掷骰比大小，点数高者先被询问。")}
                        </span>
                      )}
                      {secondEntry !== undefined && typeof secondEntry.target !== "string" && (
                        <span>
                          {" "}
                          {bi(locale,
                            `The second target, ${minorLabel(secondEntry.target.minor, locale)}, joins the defending side with the war; only the first target runs the aid search.`,
                            `第二目标${minorLabel(secondEntry.target.minor, locale)}随战争加入防守方；求援只针对第一目标。`)}
                        </span>
                      )}
                    </>
                  )}
              </div>
            )}
            {secondObjectives.length > 0 && (
              <div className="ie-hint" data-testid="ie-war-two-objectives">
                {bi(locale,
                  "A war may target up to two spaces; a conquest may include only one key (13.0 / 13.3).",
                  "战争可指定至多两个空间；征服战争至多包含一个关键区（13.0 / 13.3）。")}
              </div>
            )}
            {entitlement?.card === RUSSO_TURKISH_WARS_HOME_CARD && (
              <div className="ie-hint" data-testid="ie-war-target-rule">
                {bi(locale,
                  "Russo-Turkish Wars may only declare war on the Ottomans.",
                  "《俄土战争》只能对奥斯曼宣战。")}
              </div>
            )}
            {entitlement?.card === JIHAD_HOME_CARD && (
              <div className="ie-hint" data-testid="ie-war-target-rule">
                {bi(locale,
                  "Jihad may only declare war on Russia or a power controlling an Ottoman home space.",
                  "《圣战》只能对俄国或控制奥斯曼本土空间的国家宣战。")}
              </div>
            )}
            {reason !== undefined && (
              <div className="ie-hint" data-testid="ie-war-declare-reason">{reason}</div>
            )}
          </>
        )}
      </div>
    </IEPanel>
  );
};
