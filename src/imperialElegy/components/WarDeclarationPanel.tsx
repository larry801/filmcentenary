/**
 * The war declaration form, inside the War panel.
 *
 * A declaration used to be assembled in two places: a home card's "choose the
 * war target" dialog, and a block in the Orders panel that only appeared once
 * the player had clicked a target's space on the map.  Both steps are gone:
 * this component asks the three questions itself — defender, aim, objective —
 * and derives every list from `engine/declarationTargets.ts`, so no click on
 * the map is needed and no offered target can be one `declareWar` refuses.
 *
 * The choices are deliberately local state.  They are clamped on every render
 * (a defender that is no longer legal falls back to the first one, an
 * objective that the current aim refuses falls back to the aim's first space),
 * so a new impulse or a new home card cannot leave a stale selection behind —
 * which is exactly the reset the old block needed a model-level effect for.
 * The component unmounts when the declaration is made (a war starts and the
 * War panel switches to the war controls), so nothing survives a declaration.
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
  warDeclarationTargetLegal,
  type WarDeclarationAim,
} from "../engine/rules";
import {hasTruce} from "../engine/limitedWar";
import {
  declarationAimsFor,
  declarationDefenders,
  declarationObjectives,
  declarationSecondObjectives,
  warTargetKey,
  type WarDeclarationDefender,
} from "../engine/declarationTargets";
import {ConfirmButton} from "./ConfirmButton";
import {IEPanel} from "./theme";
import {bi, POWER_KEYS} from "./boardHelpers";
import type {ieT} from "./i18n";

/** The war declaration the panel would send; `null` while none is complete. */
export interface WarDeclaration {
  target: WarDeclarationDefender["target"];
  aim: WarDeclarationAim;
  objectives: SpaceId[];
  cp: number;
  options: {
    secondTarget?: Power;
    primary?: Power;
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
  const [chosenSecondPower, setChosenSecondPower] = React.useState<Power | "">("");
  const [chosenPrimary, setChosenPrimary] = React.useState<Power | "">("");
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

  const objectives = React.useMemo(
    () => (entry === undefined ? [] : declarationObjectives(G, viewer, entitlement, entry, aim)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, entry, aim],
  );
  const objective: SpaceId | "" =
    chosenObjective !== "" && objectives.includes(chosenObjective) ? chosenObjective : objectives[0] ?? "";

  // Rule 14.1: the second power and the primary defender are only offered when
  // the live home card prints the two-power clause for the chosen aim.
  const twoPowerEligible = entitlement !== null && entry !== undefined
    && typeof entry.target === "string"
    && warDeclarationAllowsTwoPowers(entitlement.card, aim);
  const secondPowerOptions = twoPowerEligible
    ? POWER_KEYS.filter((p) => p !== viewer && p !== entry.target
      && !hasTruce(G, viewer, p)
      && warDeclarationTargetLegal(G, entitlement, p))
    : [];
  const secondPower: Power | "" = secondPowerOptions.includes(chosenSecondPower as Power)
    ? chosenSecondPower as Power
    : "";
  const secondObjectives = React.useMemo(
    () => (entry === undefined || objective === ""
      ? []
      : declarationSecondObjectives(
        G, viewer, entitlement, entry, aim, objective as SpaceId,
        secondPower === "" ? null : secondPower,
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, viewer, entitlement?.card ?? null, entitlement?.aim ?? null, entry, aim, objective, secondPower],
  );
  const secondObjective: SpaceId | "" =
    chosenSecondObjective !== "" && secondObjectives.includes(chosenSecondObjective)
      ? chosenSecondObjective
      : "";
  const primaryChoices: Power[] = entry !== undefined && typeof entry.target === "string" && secondPower !== ""
    ? [entry.target, secondPower]
    : [];
  const primary: Power | "" = primaryChoices.includes(chosenPrimary as Power)
    ? chosenPrimary as Power
    : primaryChoices[0] ?? "";

  const forbidPlayersAllowed = entitlement !== null && warDeclarationMayForbidJoins(entitlement.card);
  // The card funds the declaration with its printed CP; an ordinary one picks
  // 1–4 and pays it out of the impulse (13.0).
  const cp = entitlement !== null ? entitlement.cp : chosenCp;
  const enoughCp = cpRemaining >= cp;
  const canDeclare = canActionCard && objective !== "" && (entitlement !== null || enoughCp);

  const declaration: WarDeclaration | null = entry === undefined || objective === ""
    ? null
    : {
      target: entry.target,
      aim,
      objectives: secondObjective === "" ? [objective] : [objective, secondObjective],
      cp,
      options: {
        ...(secondPower !== "" ? {secondTarget: secondPower, primary: primary as Power} : {}),
        ...(forbidPlayersAllowed && forbidPlayers ? {forbidPlayers: true} : {}),
      },
    };
  const options = declaration === null ? undefined : declaration.options;
  const hasOptions = options !== undefined && Object.keys(options).length > 0;

  const reason = canDeclare
    ? undefined
    : !canActionCard
      ? bi(locale, "A war can only be declared during your Action impulse.", "只能在你的行动轮宣战。")
      : G.wtt >= 3
      ? bi(locale, "World Tension is 3+; a new war cannot be declared.", "世界紧张达到 3+，无法发动新的战争。")
      : objective === ""
        ? bi(locale, "No legal objective for this defender and aim.", "该防守方与战争目标下没有合法目标空间。")
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
                    setChosenSecondPower("");
                    setChosenPrimary("");
                  }}
                >
                  {aimLabel(option, t)}
                </button>
              ))
            )}
          </span>
          {entitlement !== null ? (
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
                    setChosenSecondPower("");
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
              {secondPowerOptions.length > 0 && (
                <select
                  className="ie-select"
                  data-testid="ie-war-second-power"
                  value={secondPower}
                  onChange={(event) => {
                    setChosenSecondPower(event.target.value as Power | "");
                    setChosenSecondObjective("");
                  }}
                  title={bi(locale, "Second power (14.1)", "第二个国家（14.1）")}
                >
                  <option value="">{bi(locale, "One power", "单一国家")}</option>
                  {secondPowerOptions.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                </select>
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
                  `${entitlement.card === BISMARCK_HOME_CARD ? "Bismarck" : "The card"} funds this declaration with its printed CP; pick the defender and objective here.`,
                  `本牌以印制的 CP 支付宣战费用；在此选择防守方与目标空间。`)}
              </div>
            )}
            {secondPowerOptions.length > 0 && (
              <div className="ie-hint" data-testid="ie-war-two-powers">
                {bi(locale,
                  "This card may name a second power; the defenders agree on the primary, and the attacker decides if they cannot.",
                  "本牌可同时指定第二个国家；防守方协商主要防守方，协商不成则由进攻方决定。")}
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
