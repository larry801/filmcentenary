/**
 * Derived state for the Imperial Elegy board.
 *
 * The whole non-presentational body of the board lives here: React state,
 * effects (bot driver, seat reporting, keyboard targeting), rules helpers and
 * every value the layout needs.  BoardLayout never computes game state; it only
 * renders this model, which keeps the rules-facing code testable and the
 * presentation file focused on markup.
 */
import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState, PendingOption, Power, POWERS, SpaceId, Unit} from "../types";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {cpBudgetFor, effectiveKeyType, friendlySpace, gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, landStackingLimit, landUnitsIn, minorAlliesOf, minorController, navalUnitsIn, ownsKey} from "../engine/rules";
import {CARD_BY_ID, cardById, decadeLabel} from "../engine/deck";
import {Decade} from "../constant/cards";
import {cpChainResolution} from "../engine/economy";
import {GOALS_BY_ID} from "../constant/goals";
import {ieT} from "./i18n";
import {logText} from "./logText";
import i18n from "../../constant/i18n";
import {
  BALANCE_OF_POWER_CARD,
  amphibiousAssaultCheck,
  navalInterceptCheck,
  navalTransportCheck,
  responseCardEligibility,
} from "../moves";
import {planNavalTransport} from "../engine/navalMovement";
import {
  AU_NATIONALITIES,
  auIncorporateDecision,
  auRightsDecision,
  canGrantCitizenship,
  isCwArmySpace,
  jihadUse,
  passRestriction,
  superiorStaffWorkFreeDeploy,
  TSRR_RAIL_ARMY_KINDS,
  tsrrRail,
} from "../engine/characteristics";
import {polishController, polishRecruitDecision} from "../engine/poland";
import {deployReserveLimit, isLoneMinorWar, loneMinorDefender, rapidMobilizationFreeDeploy} from "../engine/limitedWar";
import {polishReserveDeployer} from "../engine/poland";
import {italyAllianceBox, italyAllianceSide} from "../engine/italyEntry";
import {isIndependentItaly} from "../engine/greatWarFlow";
import {gwActionAllowance} from "../engine/gwImpulse";
import {treatyOptionLabel} from "../engine/treatyChoice";
import {
  POWER_KEYS,
  amphibiousReasonText,
  bi,
  BATTLE_STAGE,
  controlLabel,
  interceptReasonText,
  isPowerKey,
  OPTION_ZH,
  PHASE_LABEL,
  pickActionTarget,
  PROMPT_ZH,
  powerOrMinorLabel,
  responseReasonText,
  transportReasonText,
  unitLabel,
} from "./boardHelpers";
import {handChoiceAvailability} from "./HandChoices";
import {CardChoiceFace} from "./CardChoice";
import {PhaseAction} from "./PhaseActions";
import {BotSeatsContext} from "./botContext";
import {SeatUiContext} from "./seatUiContext";
import {useInteraction, interactionPrompt} from "./useInteraction";
import {useCardFaceMode} from "./preferences";
import {botMoveFor} from "../engine/bot";


export interface BoardModelProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  hotseat?: boolean;
}

export const useBoardModel = ({G, ctx, moves, playerID, hotseat = false}: BoardModelProps) => {
  i18n.use();
  const t = ieT();
  const actualLocale: "en" | "zh_CN" = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const decade = decadeLabel(G.decade as Decade);
  const viewer = playerID === null || playerID === undefined ? null : POWER_KEYS[Number(playerID)] ?? null;

  const {interaction, dispatch} = useInteraction();
  const selected: SpaceId | null = interaction.kind === "idle" ? null
    : interaction.kind === "targeting" ? interaction.from
      : interaction.space;
  const selectedUnit: string | null = interaction.kind === "unit" ? interaction.unit : null;
  const targeting = interaction.kind === "targeting" ? interaction : null;
  const battleFrom: SpaceId | null = targeting?.intent === "landBattle" ? targeting.from : null;
  const navalFrom: SpaceId | null = targeting?.intent === "navalBattle" ? targeting.from : null;
  const [board, setBoard] = React.useState<"world" | "greatWar">("world");
  const [railTab, setRailTab] = React.useState("action");
  const [warAim, setWarAim] = React.useState<"conquest" | "liberation" | "unification">("conquest");
  const [warCp, setWarCp] = React.useState(2);
  const [secondObjective, setSecondObjective] = React.useState<SpaceId | "">("");
  const [mpitTarget, setMpitTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "AU");
  const [mpitTrack, setMpitTrack] = React.useState<"te" | "ta" | "neutral">("neutral");
  const [warAlly, setWarAlly] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [warMinor, setWarMinor] = React.useState<string>("");
  const [giveTarget, setGiveTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [giveCardId, setGiveCardId] = React.useState<string>("");
  const [confirmSurrender, setConfirmSurrender] = React.useState(false);
  const [auReformTarget, setAuReformTarget] = React.useState<string>("");
  const [auCitizenTarget, setAuCitizenTarget] = React.useState<string>("");
  const [auIncorporateTarget, setAuIncorporateTarget] = React.useState<string>("");
  const [auSacrifice, setAuSacrifice] = React.useState(false);
  const [tsrrUnitId, setTsrrUnitId] = React.useState<string>("");
  const [tsrrTo, setTsrrTo] = React.useState<string>("");
  const [polishReserve, setPolishReserve] = React.useState(true);
  const [gwTransferTo, setGwTransferTo] = React.useState<string>("");
  const [gwTransferAmount, setGwTransferAmount] = React.useState(1);
  const [dockCollapsed, setDockCollapsed] = React.useState(false);
  // Phones start at the peek position (the plan's drawer); desktop keeps the
  // 220 px hand row open.  SSR has no window and defaults to desktop.
  const [trayOpen, setTrayOpen] = React.useState(() =>
    typeof window === "undefined" || window.innerWidth >= 768);
  const [trayExpanded, setTrayExpanded] = React.useState(false);
  const [cardFaceMode, setCardFaceMode] = useCardFaceMode();
  const [amphibiousFrom, setAmphibiousFrom] = React.useState<string>("");
  const [amphibiousTo, setAmphibiousTo] = React.useState<string>("");
  const [amphibiousUnitIds, setAmphibiousUnitIds] = React.useState<string[]>([]);
  const [transportFrom, setTransportFrom] = React.useState<string>("");
  const [transportTo, setTransportTo] = React.useState<string>("");
  const [transportLand, setTransportLand] = React.useState<string>("");
  const [interceptPort, setInterceptPort] = React.useState<string>("");
  // A test/SSR renderer may mock useContext without a provider; the default
  // context value is equivalent to this fallback.
  const seatUi = React.useContext(SeatUiContext) ?? {currentSeat: null};

  React.useEffect(() => {
    // Only the visible seat reports to the shared strip.  Hidden boards keep
    // their effects running (the bots depend on them) but must not make the
    // shell re-render on every one of their state syncs.
    if (hotseat && seatUi.currentSeat !== viewer) return;
    seatUi.onGameState?.(G);
    // The report carries public seat fields only; explicit deps keep the loop
    // closed (a snapshot update cannot change G or the current seat).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, hotseat, viewer, seatUi.currentSeat, seatUi.onGameState]);

  const me = viewer ? G.powers[viewer] : null;
  const phase = G.phase;
  const active = G.activePower;
  const isActive = viewer !== null && viewer === active;
  const eliminated = me?.eliminated === true;
  // Rule 34: a hotseat seat marked as a bot is driven by `botMoveFor` below and
  // is read-only for the person at the keyboard.  Every "may act" flag folds
  // this in, so no control on a bot seat can be clicked.
  const botSeats = React.useContext(BotSeatsContext);
  const isBotViewer = hotseat && viewer !== null && botSeats.has(viewer);
  const pending = G.pending;
  const canDecide = pending !== null && viewer !== null && pending.power === viewer && !isBotViewer;
  const war = G.war;
  const gw = G.gw;
  const battle = G.battle;
  // When a war (or the Great War) starts, bring its panel into view once; the
  // player can still switch back to Action without the tab fighting them.
  const warWasActive = React.useRef(war !== null || gw !== null);
  React.useEffect(() => {
    const hasWar = war !== null || gw !== null;
    if (hasWar && !warWasActive.current) setRailTab("war");
    warWasActive.current = hasWar;
  }, [war, gw]);

  const warBelligerents = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])]
    : [];
  const isPrincipal = viewer !== null && war !== null && (viewer === war.attacker || viewer === war.defender);
  const isBelligerent = viewer !== null && warBelligerents.includes(viewer);

  const cpBudget = (): number => viewer === null ? 0 : cpBudgetFor(G, viewer);
  const canAct = viewer !== null && !eliminated && !isBotViewer && isActive && pending === null &&
    (phase === "action" || phase === "wartime" || (phase === "gwManeuver" && !gw?.neutralImpulses));
  const canSpend = (cost: number): boolean => canAct && cpBudget() >= cost;
  const canActionCard = viewer !== null && !eliminated && !isBotViewer && isActive && phase === "action" && pending === null;
  const canPhaseAct = viewer !== null && !eliminated && !isBotViewer && (phase === "end" || phase === "gwPlanning" ? true : isActive);
  const forcedPass = viewer !== null ? passRestriction(G, viewer).forced : false;
  const forcedCardIds = viewer !== null ? passRestriction(G, viewer).cards.map((c) => c.card) : [];
  const forcedGwCard = viewer !== null && phase === "gwManeuver" && G.powers[viewer].gwCard
    ? passRestriction(G, viewer, [G.powers[viewer].gwCard as string]).forced
    : false;
  const forcedPassTitle = bi(actualLocale,
    "A card in hand forbids passing (The Dual Monarchy / Exhaustion). Play it for CP or its event first.",
    "手中有禁止停牌的牌（二元君主国 / 精疲力竭）。请先作为 CP 或事件打出。");
  const hasPhaseButtons = viewer !== null && !eliminated && ((phase === "prep" || phase === "diplomacy") ? canPhaseAct : phase === "action" ? isActive : phase === "end" ? canPhaseAct : false);
  // Buttons that end or continue the current phase step.  They belong in the
  // pinned dock with the pending decisions: both answer "what may I do now",
  // and neither may be pushed below the fold by a tall map or a long hand.
  const phaseActions: PhaseAction[] = hasPhaseButtons ? [
    ...(phase === "prep" && canPhaseAct && !me?.flags.prepDone
      ? [{key: "finishPrep", label: t.finishPrep, testId: "ie-finish-prep", onClick: () => moves.finishPrep()}]
      : []),
    ...(phase === "diplomacy" && canPhaseAct && me?.selectedHomeCard
      ? [{key: "endDiplomacy", label: t.endDiplomacy, testId: "ie-end-diplomacy", onClick: () => moves.endDiplomacy()}]
      : []),
    ...(phase === "action" && isActive && !eliminated
      ? [{
          key: "pass",
          label: t.pass,
          testId: "ie-pass",
          disabled: forcedPass,
          title: forcedPass ? forcedPassTitle : undefined,
          onClick: () => moves.pass(),
        }]
      : []),
    ...(phase === "action" && isActive && !eliminated
      ? [{key: "endImpulse", label: t.endImpulse, testId: "ie-end-impulse", onClick: () => moves.endImpulse()}]
      : []),
    ...(phase === "end" && canPhaseAct
      ? [{key: "endPhaseTurn", label: t.continue, testId: "ie-end-phase-turn", onClick: () => moves.endPhaseTurn()}]
      : []),
  ] : [];

  // ------------------------------------------------------------- 33.x national actions
  const nationalActionPhase = viewer !== null && !eliminated && isActive && phase === "action" && pending === null;
  const auRightsEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => auRightsDecision(G, nationality).allowed)
    : [];
  const auReformValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auReformTarget, AU_NATIONALITIES, auRightsEligible)
    : "";
  const auReformDecision = auReformValue !== "" ? auRightsDecision(G, auReformValue) : null;
  const auCitizenEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => canGrantCitizenship(G, "AU", nationality, {sacrificeStability: auSacrifice}).allowed)
    : [];
  const auCitizenValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auCitizenTarget, AU_NATIONALITIES, auCitizenEligible)
    : "";
  const auCitizenDecision = auCitizenValue !== ""
    ? canGrantCitizenship(G, "AU", auCitizenValue, {sacrificeStability: auSacrifice})
    : null;
  const auIncorporateCandidates = nationalActionPhase && viewer === "AU"
    ? Object.values(SPACES)
        .filter((space) => {
          const control = G.spaces[space.id]?.control;
          return typeof control === "string" && !isPowerKey(control) && G.spaces[space.id]?.ally === "AU";
        })
        .map((space) => space.id)
    : [];
  const auIncorporateEligible = auIncorporateCandidates.filter((space) => auIncorporateDecision(G, space).allowed);
  const auIncorporateValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auIncorporateTarget, auIncorporateCandidates, auIncorporateEligible)
    : "";
  const auIncorporate = auIncorporateValue !== "" ? auIncorporateDecision(G, auIncorporateValue) : null;
  const zouaveInPlay = Object.values(G.units).some((unit) => unit.kind === "zouave" && unit.owner === "FR");
  const zouaveReason = zouaveInPlay
    ? bi(actualLocale, "The Zouaves are already in play.", "祖阿夫已在场上。")
    : cpBudget() < 1
      ? bi(actualLocale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。")
      : undefined;
  const tsrrPhase = viewer !== null && !eliminated && isActive && (phase === "action" || phase === "wartime") && pending === null;
  const tsrrArmies = tsrrPhase && viewer !== null
    ? Object.values(G.units).filter((unit) => unit.owner === viewer && TSRR_RAIL_ARMY_KINDS.includes(unit.kind) && unit.space && TSRR_ROUTE.includes(unit.space))
    : [];
  const tsrrUnitValue = tsrrPhase && viewer !== null
    ? pickActionTarget(tsrrUnitId, tsrrArmies.map((unit) => unit.id), tsrrArmies.map((unit) => unit.id))
    : "";
  const tsrrFrom = tsrrUnitValue !== "" ? G.units[tsrrUnitValue]?.space ?? null : null;
  const tsrrDestinations = tsrrFrom !== null ? TSRR_ROUTE.filter((space) => space !== tsrrFrom) : [];
  const tsrrToValue = tsrrFrom !== null ? pickActionTarget(tsrrTo, tsrrDestinations, tsrrDestinations) : "";
  const tsrrDecision = tsrrUnitValue !== "" && tsrrToValue !== ""
    ? tsrrRail(G, viewer as Power, tsrrUnitValue, tsrrToValue)
    : null;
  const showNationalActions = viewer !== null && (
    (nationalActionPhase && (viewer === "FR" || viewer === "AU" || viewer === "RU")) || tsrrArmies.length > 0
  );
  const needsCp = (cost: number): string => bi(actualLocale, `Needs ${cost} CP in this impulse.`, `本行动轮需要 ${cost} CP。`);
  const auReformReason = auReformDecision === null
    ? undefined
    : auReformDecision.allowed !== true
      ? auReformDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auCitizenReason = auCitizenDecision === null
    ? undefined
    : auCitizenDecision.allowed !== true
      ? auCitizenDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auIncorporateReason = auIncorporate === null
    ? bi(actualLocale, "No allied minor power is eligible.", "没有符合条件的盟国小国。")
    : auIncorporate.allowed !== true
      ? auIncorporate.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const tsrrReason = tsrrArmies.length === 0
    ? bi(actualLocale, "No army is on the Trans-Siberian Railroad.", "西伯利亚铁路上没有军团。")
    : tsrrDecision !== null && tsrrDecision.allowed !== true
      ? tsrrDecision.reasons.join(" | ")
      : undefined;
  const jihadDecision = battle !== null ? jihadUse(G, "OT", battle) : null;
  const jihadReason = jihadDecision !== null && jihadDecision.allowed !== true
    ? jihadDecision.reasons.join(" | ")
    : undefined;
  const polishOwner = viewer === null ? null : polishController(G);
  const polishArmyDecision = viewer !== null && selected !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "army", selected, 2)
    : null;
  const polishReserveDecision = viewer !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "reserveArmy", null, 2)
    : null;

  // ------------------------------------------------------- 19.10 / 19.1 naval controls
  const lastLog = G.log[G.log.length - 1];
  const lastNavalBox: SpaceId | null = (() => {
    if (!lastLog || lastLog.turn !== G.turn) return null;
    const destination = (): SpaceId | null => {
      if (lastLog.key === "navalMove" && typeof lastLog.args?.to === "string") return lastLog.args.to as SpaceId;
      if (lastLog.key === "gwManeuverAction" && lastLog.args?.kind === "naval" && typeof lastLog.args?.to === "string") {
        return lastLog.args.to as SpaceId;
      }
      return null;
    };
    const box = destination();
    return box !== null && isNavalBox(box) ? box : null;
  })();
  const lastNavalMover: Power | null = lastNavalBox !== null && lastLog?.power !== undefined ? lastLog.power : null;

  const amphibiousVisible = viewer !== null && !eliminated && (phase === "action" || phase === "wartime") && pending === null;
  const ownLoadedArmyAt = (space: SpaceId): boolean =>
    G.spaces[space]?.units.some((id) => {
      const unit = G.units[id];
      return unit !== undefined && unit.owner === viewer && isArmyKind(unit.kind) && !unit.naval;
    }) ?? false;
  const amphibiousOrigins: SpaceId[] = !amphibiousVisible || viewer === null
    ? []
    : Object.values(SPACES)
        .filter((def) => {
          if (!ownLoadedArmyAt(def.id)) return false;
          if (isNavalBox(def.id)) return true;
          return (def.ports?.length ?? 0) > 0 && friendlySpace(G, def.id, viewer);
        })
        .map((def) => def.id);
  const amphibiousFromValue = pickActionTarget(amphibiousFrom, amphibiousOrigins, amphibiousOrigins);
  const amphibiousTargets: SpaceId[] = React.useMemo(() => {
    if (!amphibiousVisible || viewer === null || amphibiousFromValue === "") return [];
    const boxes = isNavalBox(amphibiousFromValue) ? [amphibiousFromValue] : portBoxes(amphibiousFromValue);
    return Object.values(SPACES)
      .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0)
      .filter((def) => (def.ports ?? []).some((box) => boxes.includes(box)))
      .filter((def) => !friendlySpace(G, def.id, viewer))
      .map((def) => def.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amphibiousVisible, viewer, amphibiousFromValue, G.spaces]);
  const amphibiousToValue = pickActionTarget(amphibiousTo, amphibiousTargets, amphibiousTargets);
  const amphibiousBox: SpaceId | null = (() => {
    if (amphibiousFromValue === "" || amphibiousToValue === "") return null;
    if (isNavalBox(amphibiousFromValue)) {
      return portBoxes(amphibiousToValue).includes(amphibiousFromValue) ? amphibiousFromValue : null;
    }
    return portBoxes(amphibiousFromValue).find((box) => portBoxes(amphibiousToValue).includes(box)) ?? null;
  })();
  const amphibiousArmies: string[] = amphibiousBox === null || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => unit.owner === viewer && !unit.naval && isArmyKind(unit.kind) && (unit.space === amphibiousBox || unit.space === amphibiousFromValue))
        .map((unit) => unit.id);
  const chosenAmphibiousArmies = amphibiousUnitIds.filter((id) => amphibiousArmies.includes(id));
  const amphibiousArmyValue = chosenAmphibiousArmies.length > 0
    ? chosenAmphibiousArmies.slice(0, 2)
    : amphibiousArmies.slice(0, 2);
  const amphibiousCheck = amphibiousVisible && viewer !== null
    ? amphibiousAssaultCheck(G, viewer, amphibiousFromValue, amphibiousToValue, amphibiousArmyValue)
    : null;
  const amphibiousPhaseOk = phase === "action" ? isActive : phase === "wartime" ? isBelligerent : false;
  const amphibiousReason = amphibiousCheck === null
    ? undefined
    : amphibiousOrigins.length === 0
      ? bi(actualLocale, "No friendly army is loaded in a port or naval box.", "没有已装载于港口或海域的友方军团。")
      : amphibiousReasonText(actualLocale, amphibiousCheck);
  const amphibiousCanGo = amphibiousCheck?.ok === true && amphibiousPhaseOk;
  const toggleAmphibiousArmy = (id: string, checked: boolean): void => {
    const base = amphibiousArmyValue;
    const next = checked
      ? (base.includes(id) ? base : [...base, id]).slice(0, 2)
      : base.filter((entry) => entry !== id);
    setAmphibiousUnitIds(next);
  };

  // ------------------------------------------------------- 12.3 naval transport
  const transportVisible = viewer !== null && !eliminated && pending === null && battle === null &&
    (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  const transportMajor = viewer !== null ? gwAllyImpulseFor(G, viewer) : null;
  const transportOwns = (owner: string | undefined): boolean =>
    viewer !== null && (owner === viewer || (transportMajor !== null && owner === transportMajor));
  const transportable = (id: string): boolean => {
    const unit = G.units[id];
    return unit !== undefined && transportOwns(unit.owner) && unit.naval !== true && isArmyKind(unit.kind) && Boolean(unit.space);
  };
  const transportOrigins: SpaceId[] = !transportVisible || viewer === null
    ? []
    : [...new Set(Object.values(G.units).filter((unit) => transportable(unit.id)).map((unit) => unit.space as SpaceId))]
        .filter((space) => G.spaces[space] && (isNavalBox(space) || portBoxes(space).length > 0))
        .sort();
  const transportFromValue = pickActionTarget(transportFrom, transportOrigins, transportOrigins);
  const transportLands = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units).filter((unit) => transportable(unit.id) && unit.space === transportFromValue).map((unit) => unit.id);
  const transportLandValue = pickActionTarget(transportLand, transportLands, transportLands);
  const transportFleet = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => transportOwns(unit.owner) && unit.naval === true && unit.space === transportFromValue)
        .map((unit) => unit.id);
  const transportReachableFrom = (target: SpaceId): boolean =>
    viewer !== null && transportLandValue !== "" &&
    planNavalTransport(
      G,
      viewer,
      G.units[transportLandValue],
      transportFleet.map((id) => G.units[id]),
      target,
    ).ok;
  const transportTargets: SpaceId[] = React.useMemo(
    () => !transportVisible || viewer === null || transportLandValue === ""
      ? []
      : Object.values(SPACES)
          .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0 && def.id !== transportFromValue)
          .filter((def) => transportReachableFrom(def.id))
          .map((def) => def.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transportVisible, viewer, transportLandValue, transportFromValue, transportFleet.join(","), G.spaces],
  );
  const transportToValue = pickActionTarget(transportTo, transportTargets, transportTargets);
  const transportCheck = transportVisible && viewer !== null
    ? navalTransportCheck(G, viewer, transportLandValue, transportFleet, transportToValue)
    : null;
  const transportPhaseOk = phase === "action" ? isActive
    : phase === "wartime" ? isActive && war?.status === "maneuver"
      : phase === "gwManeuver" ? isActive
        : false;
  const transportReason = transportCheck === null
    ? undefined
    : transportOrigins.length === 0
      ? bi(actualLocale, "No land unit is in a friendly port or naval box.", "没有位于友好港口或海域的陆军单位。")
      : transportTargets.length === 0
        ? bi(actualLocale, "No friendly port is reachable with this force.", "该部队没有可抵达的友好港口。")
        : transportReasonText(actualLocale, transportCheck.reason);
  const transportCanGo = transportCheck?.ok === true && transportPhaseOk;

  const adjacentPortsToBox: SpaceId[] = lastNavalBox === null
    ? []
    : Object.values(SPACES).filter((def) => (def.ports ?? []).includes(lastNavalBox)).map((def) => def.id);
  const ownAdjacentPorts = viewer === null ? [] : adjacentPortsToBox.filter((id) => friendlySpace(G, id, viewer));
  const interceptPorts = ownAdjacentPorts.length > 0 ? ownAdjacentPorts : adjacentPortsToBox;
  const interceptPortValue = pickActionTarget(interceptPort, interceptPorts, interceptPorts);
  const interceptCheck = lastNavalBox !== null
    ? navalInterceptCheck(G, viewer, interceptPortValue, lastNavalBox)
    : null;
  const interceptReason = interceptCheck === null ? undefined : interceptReasonText(actualLocale, interceptCheck);
  const interceptVisible = lastNavalBox !== null && viewer !== null && !eliminated;

  React.useEffect(() => { (window as any).__IE_STATE__ = G; }, [G]);
  React.useEffect(() => { setSecondObjective(""); setConfirmSurrender(false); }, [selected]);
  React.useEffect(() => { setConfirmSurrender(false); }, [war?.status, war?.attacker, war?.defender]);
  React.useEffect(() => { dispatch({type: "reset"}); }, [phase]);

  // ------------------------------------------------------------------ bot auto-submit (Rule 34)
  // When this board instance belongs to a bot seat in hotseat mode, automatically
  // dispatch the bot's decided move after a short delay so the human player can
  // see what happened before the state advances.
  const botTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // boardgame.io re-syncs the view even when a move is rejected, so an illegal
  // decision used to be re-sent every 500 ms forever (console flood + a frozen
  // match).  Track whether the state actually moved under the same decision.
  const botFailureRef = React.useRef<{key: string; state: string; count: number} | null>(null);
  React.useEffect(() => {
    // Only active in hotseat mode and when this seat is flagged as a bot.
    if (!hotseat || viewer === null || !botSeats.has(viewer) || eliminated) return;

    // The bot needs to act when:
    //   • There is an open pending decision addressed to this power, OR
    //   • It is this power's normal turn to act (action / wartime / prep /
    //     diplomacy / gwManeuver all use isActive; end / gwPlanning / gwWinter
    //     ask all powers to take their turn sequentially so canPhaseAct is true).
    const needsAct =
      (pending !== null && pending.power === viewer) ||
      (pending === null && (
        isActive ||
        phase === "end" ||
        phase === "gwPlanning" ||
        phase === "gwWinter"
      ));

    if (!needsAct) return;

    // Clear any previously scheduled timer before scheduling a new one.
    if (botTimerRef.current !== null) clearTimeout(botTimerRef.current);
    botTimerRef.current = setTimeout(() => {
      botTimerRef.current = null;
      try {
        const decision = botMoveFor(G, ctx, viewer);
        const key = `${decision.move}|${JSON.stringify(decision.args ?? [])}`;
        // A rejected move leaves the state untouched, so "same decision on an
        // unchanged state" is the reliable failure signal.
        const stateKey = `${G.turn}|${phase}|${active}|${G.cpRemaining}|${G.log.length}|${pending?.id ?? "-"}`;
        const previous = botFailureRef.current;
        const count = previous !== null && previous.key === key && previous.state === stateKey
          ? previous.count + 1
          : 0;
        if (count >= 3) {
          // The engine keeps refusing this decision.  Take a legal escape move
          // so the match can continue instead of spinning forever.
          botFailureRef.current = {key, state: stateKey, count};
          const escape: Record<string, string> = {
            action: "endImpulse",
            wartime: "passWarMove",
            prep: "finishPrep",
            diplomacy: "endDiplomacy",
            end: "endPhaseTurn",
            gwPlanning: "endGwPlanningMove",
            gwManeuver: "gwPass",
            gwWinter: "gwResolveWinter",
          };
          const fallback = escape[phase];
          console.warn("[IE bot] repeated invalid decision", key, "→ falling back to", fallback);
          const fn = fallback === undefined ? undefined : (moves as Record<string, () => void>)[fallback];
          if (typeof fn === "function") fn();
          return;
        }
        botFailureRef.current = {key, state: stateKey, count};
        const fn = (moves as Record<string, (...args: unknown[]) => void>)[decision.move];
        if (typeof fn === "function") fn(...(decision.args ?? []));
      } catch (err) {
        console.warn("[IE bot] auto-submit error", err);
      }
    }, 500);

    return () => {
      if (botTimerRef.current !== null) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  // G and ctx change on every game-state update — that is the correct trigger.
  // moves is a stable boardgame.io object; eslint-disable keeps the hook clean.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, ctx, viewer, hotseat, botSeats, eliminated, pending, isActive, phase]);

  const selectedState = selected ? G.spaces[selected] : null;
  const selectedUnitDef = selectedUnit ? G.units[selectedUnit] : undefined;
  const commandedOwner = viewer === null ? null : gwAllyImpulseFor(G, viewer) ?? viewer;
  const commandsSelected = (unit: Unit): boolean => unit.owner === commandedOwner ||
    (phase === "gwManeuver" && viewer !== null && commandedOwner === viewer && !isPowerKey(unit.owner) &&
      unit.owner !== "US" && unit.owner !== "IT" && minorController(G, unit.owner) === viewer);
  const ownUnitsInSelected = selectedState
    ? selectedState.units.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined && viewer !== null && commandsSelected(u))
    : [];
  const ownLandInSelected = ownUnitsInSelected.filter((u) => !u.naval);
  const ownNavalInSelected = ownUnitsInSelected.filter((u) => u.naval);

  const enemyLandTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (friendlySpace(G, id, viewer)) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && !u.naval && u.owner !== viewer;
      });
    });
  };
  const enemyNavalTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && u.naval === true && u.owner !== viewer;
      });
    });
  };
  const potentialLandTargets = enemyLandTargetsFrom(selected);
  const potentialNavalTargets = enemyNavalTargetsFrom(selected);

  const unitMoveTargets: SpaceId[] = (() => {
    if (!selectedUnitDef || !selectedUnitDef.space || viewer === null || !commandsSelected(selectedUnitDef)) return [];
    return neighboursOf(selectedUnitDef.space).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (selectedUnitDef.naval) return true;
      return state.control === commandedOwner || state.occupiedBy === commandedOwner || friendlySpace(G, id, viewer) || (state.influence === viewer && state.control === null);
    });
  })();

  const pendingSpaceTargets: SpaceId[] = canDecide && pending
    ? pending.options.filter((o) => SPACES[o.id]).map((o) => o.id as SpaceId)
    : [];
  const battleTargets = [...enemyLandTargetsFrom(battleFrom), ...enemyNavalTargetsFrom(navalFrom)];

  const myOnMapArmies = viewer === null ? 0 : Object.values(G.units).filter((u) => u.owner === viewer && isArmyKind(u.kind) && u.space).length;
  const myForts = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.fort?.power === viewer).length;
  const myMinorAllies = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.ally === viewer).length;

  const hand = viewer ? G.powers[viewer].hand : [];
  const handCounts = (G as unknown as {handCounts?: Partial<Record<Power, number>>}).handCounts ?? {};
  const goalCounts = (G as unknown as {goalCounts?: Partial<Record<Power, number>>}).goalCounts ?? {};

  const doAction = React.useCallback((fn: () => void) => {
    try {
      fn();
    } catch (error) {
      console.warn("illegal Imperial Elegy action", error);
    }
  }, []);

  const beginTargeting = React.useCallback((intent: Parameters<typeof interactionPrompt>[0], from: SpaceId, targets: SpaceId[], sources: string[] = []) => {
    dispatch({type: "beginTargeting", intent, from, sources, targets});
  }, [dispatch]);

  /** SpacePanel's "in this space" buttons enter targeting; only these clicks
   *  (and never a plain map click) can start a CP-spending action. */
  const setBattleFrom = React.useRef<(id: SpaceId | null) => void>(() => {});
  setBattleFrom.current = (id: SpaceId | null) => {
    if (id === null) { dispatch({type: "cancel"}); return; }
    beginTargeting("landBattle", id, enemyLandTargetsFrom(id));
  };
  const setNavalFrom = React.useRef<(id: SpaceId | null) => void>(() => {});
  setNavalFrom.current = (id: SpaceId | null) => {
    if (id === null) { dispatch({type: "cancel"}); return; }
    beginTargeting("navalBattle", id, enemyNavalTargetsFrom(id));
  };
  const setSelectedUnit = React.useCallback((id: string | null) => {
    if (id === null) {
      if (interaction.kind === "unit") dispatch({type: "selectSpace", space: interaction.space});
      else if (interaction.kind === "targeting") dispatch({type: "cancel"});
      return;
    }
    if (selected !== null) dispatch({type: "selectUnit", space: selected, unit: id});
  }, [dispatch, interaction, selected]);

  /**
   * Submit the pending targeting action.  This is the ONLY path that spends CP
   * from a map click; every other click just moves the selection.  An
   * out-of-target click is ignored instead of being treated as a confirmation.
   */
  const submitTargeting = (target: SpaceId) => {
    if (interaction.kind !== "targeting") return;
    if (!interaction.targets.includes(target)) return;
    const {intent, from, sources} = interaction;
    const battleAllowed = phase === "gwManeuver"
      ? canAct && viewer !== null && gwActionAllowance(G, viewer, intent === "navalBattle" ? "naval" : "landBattle").ok
      : canSpend(1);
    if ((intent === "landBattle" || intent === "navalBattle") && !battleAllowed) {
      dispatch({type: "cancel"});
      return;
    }
    switch (intent) {
      case "landBattle":
        doAction(() => moves.landBattle(from, target));
        break;
      case "navalBattle":
        doAction(() => moves.navalBattle(from, target));
        break;
      case "redeploy": {
        const unit = sources[0];
        if (unit) doAction(() => G.units[unit]?.naval ? moves.navalMove([unit], target) : moves.redeploy(unit, target));
        break;
      }
      case "gwMarch":
        if (sources[0]) doAction(() => moves.gwMarch(sources[0], target));
        break;
      case "gwRail":
        if (sources[0]) doAction(() => moves.gwRail(sources[0], target));
        break;
      case "amphibious":
        doAction(() => moves.amphibiousAssault(from, target, sources));
        break;
      case "navalIntercept":
        doAction(() => moves.navalIntercept(from, target));
        break;
      case "navalTransport":
        if (sources[0]) doAction(() => moves.navalTransport(sources[0], sources.slice(1), target));
        break;
    }
    // Every action, successful or not, leaves targeting: no stale mode can
    // swallow the next map click and silently spend CP again.
    dispatch({type: "commit", space: target});
  };

  const onSelectImpl = React.useRef<(id: SpaceId) => void>(() => {});
  onSelectImpl.current = (id: SpaceId) => {
    if (interaction.kind === "targeting") {
      submitTargeting(id);
      return;
    }
    if (canDecide && pending && pending.options.some((o) => o.id === id && SPACES[o.id])) {
      doAction(() => moves.resolvePending(id));
      return;
    }
    // A unit stays selected while the space cursor moves, so SpacePanel can
    // offer the explicit "move here" button; the map click itself never moves.
    if (interaction.kind === "unit") {
      dispatch({type: "selectUnit", space: id, unit: interaction.unit});
      return;
    }
    dispatch({type: "selectSpace", space: id});
  };
  const onSelect = React.useCallback((id: SpaceId) => onSelectImpl.current(id), []);

  // Esc leaves targeting (or clears the selection); a single legal target can
  // be confirmed with Enter.  Both keys stand down while a form control has
  // focus so typing in a space picker never fires a battle.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const target = event.target as HTMLElement | null;
      if (target && typeof target.closest === "function" &&
        target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !== null) return;
      if (event.key === "Escape" || event.key === "Esc") {
        if (interaction.kind === "targeting" || interaction.kind === "unit" || interaction.kind === "space") {
          event.preventDefault();
          dispatch({type: "cancel"});
        }
        return;
      }
      if ((event.key === "Enter" || event.key === "Return") && interaction.kind === "targeting" && interaction.targets.length === 1) {
        event.preventDefault();
        submitTargeting(interaction.targets[0]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // submitTargeting intentionally closes over the current targeting state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, dispatch]);

  const pendingKindLabels = t.pendingKind as unknown as Record<string, string>;
  const pendingKind = pending ? pendingKindLabels[pending.kind] ?? t.pendingDecision : null;
  const pendingPrompt = pending ? (actualLocale === "zh_CN" ? PROMPT_ZH[pending.prompt] ?? pending.prompt : pending.prompt) : "";
  /** The card id an option names, from `data.card` or a `card:<id>[:mode]` id. */
  const optionCardId = (o: PendingOption): string | null => {
    const data = o.data?.card;
    if (typeof data === "string" && CARD_BY_ID[data]) return data;
    if (o.id.startsWith("card:")) {
      const card = o.id.split(":")[1];
      if (card && CARD_BY_ID[card]) return card;
    }
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) return o.label.slice(5);
    return null;
  };
  const optionLabel = (o: PendingOption): string => {
    // `playerView` already clears the options of a decision that is not ours.
    // The extra mask is a safety net for any caller that renders raw state;
    // the deciding seat must still read its own face-down bid card.
    if (o.secret && (viewer === null || pending === null || pending.power !== viewer)) return t.hidden;
    if (actualLocale === "zh_CN" && o.labelZh !== undefined && o.labelZh !== "") return o.labelZh;
    if (o.id === "done") return o.label === "No more support" ? bi(actualLocale, "No more support", "不再支援") : t.skip;
    const optionCard = typeof o.data?.card === "string" ? o.data.card : null;
    if (optionCard && CARD_BY_ID[optionCard]) {
      const c = CARD_BY_ID[optionCard];
      const title = actualLocale === "zh_CN" ? c.titleZh : c.title;
      // Only the combat discard window spends the card; an auction bids with it.
      return pending?.kind === "combatDiscard" ? `${title} (${bi(actualLocale, "discard", "弃牌")})` : title;
    }
    if (o.id.startsWith("battle:") || o.id.startsWith("move:")) {
      const target = o.id.slice(o.id.indexOf(":") + 1);
      if (SPACES[target]) {
        const prefix = o.id.startsWith("battle:")
          ? bi(actualLocale, "Another battle", "再战")
          : bi(actualLocale, "Move one space", "移动一格");
        return `${prefix}: ${spaceLabel(target, actualLocale)}`;
      }
    }
    if (SPACES[o.id]) return spaceLabel(o.id, actualLocale);
    if (G.units[o.id]) return unitLabel(G.units[o.id], t);
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) {
      const c = CARD_BY_ID[o.label.slice(5)];
      return `${t.cardType.combat}: ${actualLocale === "zh_CN" ? c.titleZh : c.title}`;
    }
    return actualLocale === "zh_CN" ? OPTION_ZH[o.label] ?? o.label : o.label;
  };
  /**
   * A pending option that names a card or a National Goal shows its printed
   * face, so "pick a card" decisions do not degrade to title-only buttons.
   * A face-down auction bid keeps its face private until the auction reveals.
   */
  const optionFace = (o: PendingOption): CardChoiceFace | null => {
    if (o.secret && (viewer === null || pending === null || pending.power !== viewer)) return null;
    const card = optionCardId(o);
    if (card !== null) return {card: CARD_BY_ID[card]};
    const goal = GOALS_BY_ID[o.id];
    return goal ? {goal} : null;
  };
  /** Action label under a card face: the face already prints the title. */
  const optionAction = (o: PendingOption): string => {
    if (pending?.kind === "combatCard") return bi(actualLocale, "Play this card", "打出此牌");
    if (pending?.kind === "combatDiscard") return bi(actualLocale, "Discard this card", "弃置此牌");
    if (pending?.kind === "goalChoice") return bi(actualLocale, "Keep this Goal", "保留此目标");
    if (o.id.startsWith("card:")) return bi(actualLocale, "Bid with this card", "以此牌竞价");
    return bi(actualLocale, "Choose", "选择");
  };
  const canDecline = canDecide && pending !== null && pending.kind !== "combatLosses" && pending.kind !== "combatCard" && pending.kind !== "combatDiscard" && pending.kind !== "decisiveBattle";

  const warStatusLabels: Record<string, string> = {
    warAim: t.warAim,
    alliance: t.warAlliance,
    shift: bi(actualLocale, "Alliance shift", "同盟转换"),
    initiative: bi(actualLocale, "Initiative", "先手"),
    maneuver: t.warManeuver,
    victory: t.warVictory,
    demobilization: t.demobilization,
    done: t.done,
  };
  const warStatusLabel = war ? warStatusLabels[war.status] ?? war.status : "";
  const warAimLabel = (aim: string | null): string =>
    aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : aim === "unification" ? t.unification : "—";
  const callableAllies = war && viewer !== null
    ? POWER_KEYS.filter((p) => p !== viewer && !warBelligerents.includes(p) && (handCounts[p] ?? G.powers[p].hand.length) > 0)
    : [];
  const warAllyValue = callableAllies.includes(warAlly) ? warAlly : callableAllies[0];
  const callableMinors = war && viewer !== null && (viewer === war.attacker || viewer === war.defender)
    ? minorAlliesOf(G, viewer).filter((minor) =>
      MINOR_POWER_HOMES[minor] !== undefined &&
      !war.attackerMinors.includes(minor) &&
      !war.defenderMinors.includes(minor))
    : [];
  const warMinorValue = pickActionTarget(warMinor, callableMinors, callableMinors);
  const warBudgetRows = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])].filter(isPowerKey)
    : [];
  const warDefenderMinors = war
    ? [...new Set(war.defenderMinors.filter((m) => m !== war.defender && m !== loneMinorDefender(war)))]
    : [];
  const minorMarkerRows = Object.entries(G.minorCardMarkers ?? {})
    .filter(([, count]) => count !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const warTargetControl = selectedState && isPowerKey(selectedState.control) && selectedState.control !== viewer ? selectedState.control : null;
  const targetControlledSpaces = warTargetControl
    ? Object.values(SPACES).filter((sp) => G.spaces[sp.id]?.control === warTargetControl && sp.id !== selected).map((sp) => sp.id)
    : [];
  const canDeclareWar = canActionCard && war === null && G.wtt < 3 && warTargetControl !== null && G.cpRemaining >= warCp;

  const gwOrderPowers = gw
    ? gw.order.map((slot) => (isPowerKey(slot) ? slot : null)).filter((p): p is Power => p !== null)
    : [];
  const gwBudgetOrder = [...new Set([...gwOrderPowers, ...POWER_KEYS])];
  const gwSlotLabel = (slot: Power | "bonus" | "IT" | "US" | null): string => {
    if (slot === null) return "—";
    if (slot === "bonus") return bi(actualLocale, "Bonus", "奖励");
    if (isPowerKey(slot)) return t.seats[slot];
    if (slot === "IT") {
      return isIndependentItaly(G) ? bi(actualLocale, "Italy (its own)", "意大利（自主）") : bi(actualLocale, "Italy", "意大利");
    }
    return bi(actualLocale, "US", "美国");
  };
  const italyBox = italyAllianceBox(G);
  const italySide = italyAllianceSide(G);
  const italyBoxLabel = italyBox === "neutral"
    ? bi(actualLocale, "neutral box", "中立框")
    : `${italySide === "te" ? "TE" : "TA"} ${italyBox.endsWith("Committed") ? bi(actualLocale, "committed", "承诺框") : bi(actualLocale, "aligned", "倾向框")}`;
  const italyShowing = G.persistent.italyUnified === true && gw !== undefined;
  const italyHow = italyBox === "neutral"
    ? bi(actualLocale, "stays out of the war (25.3)", "不参战（25.3）")
    : italyBox.endsWith("Committed")
      ? bi(actualLocale, "joins automatically at the outbreak (25.3)", "大战爆发时自动参战（25.3）")
      : bi(actualLocale, "roll 4–6 at the outbreak, else back to neutral (25.3)", "爆发时掷 4–6 参战，否则退回中立（25.3）");
  const canGwDraft = selected !== null && viewer !== null && me !== null && phase === "gwManeuver" && isActive && pending === null && !eliminated && gwActionAllowance(G, viewer, "draft").ok && me.manpower >= 1;
  const gwDeployRoom = selected !== null && selectedState !== null && selectedState !== undefined
    ? Math.max(0, landStackingLimit(selected) - landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length)
    : 0;
  const canGwDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState && phase === "gwManeuver" &&
    isActive && pending === null && !eliminated && gwActionAllowance(G, viewer, "deploy").ok && me.reserves.length > 0 &&
    gwDeployRoom > 0 && !isNavalBox(selected) && friendlySpace(G, selected, viewer) &&
    (isHomeSpace(G, selected, viewer) || ownsKey(G, selected, viewer)) && !selectedState.trench,
  );
  const gwSideAllies: Power[] = viewer === null || !gw
    ? []
    : (gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [])
        .filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const gwTransferToValue: string = gwSideAllies.includes(gwTransferTo as Power)
    ? (gwTransferTo as Power)
    : gwSideAllies[0] ?? "";
  const gwTransferAmountValue = 1;
  const canGwTransfer = Boolean(
    viewer !== null && me !== null && gw !== null && phase === "gwPlanning" && isActive && pending === null &&
    !eliminated && gwTransferToValue !== "" && gwTransferAmountValue <= (me.gwBudget ?? 0) &&
    me.flags.gwCpTransferDone !== true,
  );
  const gwJointNavalAllies: Power[] = (() => {
    if (viewer === null || !gw || phase !== "gwManeuver" || !selectedUnitDef || !selectedUnitDef.naval ||
      selectedUnitDef.owner !== viewer || !selectedUnitDef.space) return [];
    const side = gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [];
    return side.filter((ally) =>
      ally !== viewer &&
      G.powers[ally]?.eliminated !== true &&
      navalUnitsIn(G, selectedUnitDef.space!).some((unit) => unit.owner === ally),
    );
  })();
  const gwJointNavalUnitIds = (ally: Power): string[] =>
    selectedUnitDef?.space
      ? navalUnitsIn(G, selectedUnitDef.space).filter((unit) => unit.owner === ally).map((unit) => unit.id)
      : [];
  const gwCardId = me?.gwCard === undefined || me?.gwCard === null ? "" : String(me.gwCard);
  const gwCombatCardHeld = ["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(gwCardId);
  const gwCardAlreadyFaceup = gwCombatCardHeld && String(me?.flags.gwFaceupCombat ?? "").includes(gwCardId);
  const canGwReveal = Boolean(
    viewer !== null && !eliminated && pending === null && me !== null && gwCombatCardHeld && !gwCardAlreadyFaceup &&
    (phase === "gwPlanning" || phase === "gwManeuver"),
  );
  const deployFree = viewer !== null && phase === "wartime" && (
    rapidMobilizationFreeDeploy(G, viewer, war) || superiorStaffWorkFreeDeploy(G, viewer, war)
  );
  const deployLimit = viewer !== null ? deployReserveLimit(G, viewer, war) : 0;
  const deployRoom = selected !== null
    ? Math.max(0, (SPACES[selected]?.home === "OT" ? 2 : SPACES[selected]?.region === "europe" ? 3 : 2) - (selectedState ? landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length : 0))
    : 0;
  const canDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState &&
    phase === "wartime" && isActive && pending === null && !eliminated &&
    me.reserves.length > 0 && deployRoom > 0 && deployLimit > 0 &&
    (deployFree || cpBudget() >= 1) &&
    SPACES[selected]?.submap === "main" &&
    (selectedState.control === viewer || selectedState.occupiedBy === viewer) &&
    hasLoc(G, viewer, selected, {landOnly: true}),
  );

  const homeCardTitle = (id: string): string => {
    const card = CARD_BY_ID[id];
    return card ? (actualLocale === "zh_CN" ? card.titleZh : card.title) : id;
  };
  const saveList = String(me?.flags.savedCards ?? "").split(",").filter(Boolean);
  const ngChoices = String(me?.flags.ngChoices ?? "").split(",").filter(Boolean);
  const giveCards = hand.filter((id) => cardById(id).kind !== "home");
  const giveCardValue = giveCards.includes(giveCardId) ? giveCardId : giveCards[0] ?? "";

  const responseInHand = hand.some((id) => cardById(id).type === "response");
  const responseWindow = viewer !== null && responseInHand &&
    hand.some((id) => cardById(id).type === "response" && responseCardEligibility(G, viewer, id).ok);

  const chainInfo = viewer !== null && me !== null ? cpChainResolution(G, viewer) : null;
  const chainUsed = G.flags.cpChainSpent === true;
  const chainNonEmpty = me !== null && me.cpChain.length > 0;
  const chainReady = viewer !== null && me !== null && !eliminated && isActive && phase === "action" &&
    pending === null && G.cpRemaining === 0 && chainNonEmpty && !chainUsed && (chainInfo?.cpSpendable ?? 0) > 0;
  const chainSpendable = chainInfo?.cpSpendable ?? 0;
  const chainCap = chainInfo?.singleActionCap ?? 4;
  const chainDisabledReason = chainReady ? undefined
    : !chainNonEmpty ? bi(actualLocale, "No cards in the CP chain.", "CP 链中没有牌。")
      : chainUsed ? bi(actualLocale, "Already used this action phase.", "本行动阶段已使用。")
        : phase !== "action" ? bi(actualLocale, "Only usable during the action phase.", "仅在行动阶段可用。")
          : !isActive || eliminated ? bi(actualLocale, "Only the active power can use its CP chain.", "仅当前行动国家可使用 CP 链。")
            : pending !== null ? bi(actualLocale, "Resolve the pending decision first.", "请先处理待决事项。")
              : G.cpRemaining > 0 ? bi(actualLocale, "Finish this impulse first; the chain starts a fresh one.", "请先结束本次行动；CP 链需从新的行动开始。")
                : chainSpendable <= 0 ? bi(actualLocale, "The chained cards have no CP.", "CP 链中的牌没有 CP。")
                  : bi(actualLocale, "Not available now.", "当前不可用。");
  // A battle selection needs a click on the map. Show that instruction in the
  // pinned dock too, so the player never has to scroll back to the SpacePanel
  // to learn that the map is waiting for a target.
  const targetingHint: {title: string; body: string; cancel: () => void} | null = battleFrom !== null
    ? {
        title: bi(actualLocale, "Choose a battle target", "选择战斗目标"),
        body: bi(actualLocale,
          `From ${spaceLabel(battleFrom, actualLocale)}: click a highlighted adjacent space on the map.`,
          `从${spaceLabel(battleFrom, actualLocale)}出击：在地图上点击高亮的相邻空间。`),
        cancel: () => dispatch({type: "cancel"}),
      }
    : navalFrom !== null
      ? {
          title: bi(actualLocale, "Choose a naval battle space", "选择海战海域"),
          body: bi(actualLocale,
            `From ${spaceLabel(navalFrom, actualLocale)}: click a highlighted adjacent sea space on the map.`,
            `从${spaceLabel(navalFrom, actualLocale)}出击：在地图上点击高亮的相邻海域。`),
          cancel: () => dispatch({type: "cancel"}),
        }
      : null;
  // Card choices that the rules require now (home card, National Goal, the prep
  // stability discard) join the same pinned dock, so a tall map or a long hand
  // cannot hide them. HandPanel only shows a pointer.
  const choicesProps = {
    viewer, me, locale: actualLocale, t, phase, canPhaseAct, hand, ngChoices,
    doAction, moves,
  };
  const choiceKinds = handChoiceAvailability(choicesProps);
  const dockChoices = choiceKinds.required || choiceKinds.optional;
  // The dock also carries the phase buttons now, so it must render whenever
  // there is something to press — not only when a decision is pending.
  const dockVisible = pending !== null || battle !== null || G.result !== null ||
    targetingHint !== null || dockChoices || phaseActions.length > 0;
  const dockSummary = pending !== null
    ? `${t.pendingFor}: ${t.seats[pending.power]}`
    : battle !== null
      ? bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")
      : G.result !== null
        ? t.gameOver
        : targetingHint !== null
          ? targetingHint.title
          : choiceKinds.required
            ? bi(actualLocale, "Required card choice", "需要选择卡牌")
            : choiceKinds.optional
              // An optional action must not read as a blocker.
              ? bi(actualLocale, "Optional: discard for stability", "可选：弃牌换稳定")
              : canAct
                ? bi(actualLocale, "Your impulse", "你的行动轮")
                : bi(actualLocale, "Waiting", "等待");
  const handChoicesHint = choiceKinds.required
    ? bi(actualLocale, "Required choices are pinned in the decision panel above.", "当前必须做出的选择已固定在页面顶部的决策面板。")
    : choiceKinds.optional
      ? bi(actualLocale, "An optional stability discard is available in the decision panel above.", "决策面板提供了可选的弃牌换稳定操作。")
      : null;
  const mapHint = pendingSpaceTargets.length > 0
    ? bi(actualLocale, "Click a highlighted space to answer the pending decision.", "点击高亮空间以完成待决事项。")
    : battleFrom !== null
      ? bi(actualLocale, "Click a highlighted adjacent space to attack it.", "点击高亮的相邻空间发动进攻。")
      : navalFrom !== null
        ? bi(actualLocale, "Click a highlighted adjacent sea space to fight there.", "点击高亮的相邻海域发动海战。")
        : selectedUnitDef
          ? bi(actualLocale, "Click a highlighted space to move the selected unit there.", "点击高亮空间移动所选单位。")
          : bi(actualLocale, "Click a space; select one of your units to see its legal moves.", "点击空间；选择己方单位以查看合法移动。");

  const mapLegalTargets = targeting !== null && targeting.intent !== "landBattle" && targeting.intent !== "navalBattle"
    ? targeting.targets
    : pendingSpaceTargets;
  const mapBattleTargets = targeting !== null && (targeting.intent === "landBattle" || targeting.intent === "navalBattle")
    ? targeting.targets
    : [];
  const isCurrentSeat = !hotseat || seatUi.currentSeat === viewer;
  const otherSeatPending = hotseat && isCurrentSeat && pending !== null && viewer !== null &&
    pending.power !== viewer && seatUi.onSwitchSeat !== undefined;
  const modePill = targeting !== null ? {
    label: interactionPrompt(targeting.intent, actualLocale),
    from: spaceLabel(targeting.from, actualLocale),
    count: targeting.targets.length,
    cancelLabel: t.cancel,
    onCancel: () => dispatch({type: "cancel"}),
    targets: targeting.targets.map((id) => ({id, label: spaceLabel(id, actualLocale)})),
    onChoose: (id: SpaceId) => submitTargeting(id),
  } : null;

  return {
    modePill,
    mapLegalTargets,
    mapBattleTargets,
    isCurrentSeat,
    otherSeatPending,
    G,
    ctx,
    moves,
    playerID,
    hotseat,
    t,
    actualLocale,
    decade,
    viewer,
    selected,
    selectedUnit,
    targeting,
    battleFrom,
    navalFrom,
    seatUi,
    me,
    phase,
    active,
    isActive,
    eliminated,
    botSeats,
    isBotViewer,
    pending,
    canDecide,
    war,
    gw,
    battle,
    warWasActive,
    warBelligerents,
    isPrincipal,
    isBelligerent,
    cpBudget,
    canAct,
    canSpend,
    canActionCard,
    canPhaseAct,
    forcedPass,
    forcedCardIds,
    forcedGwCard,
    forcedPassTitle,
    hasPhaseButtons,
    phaseActions,
    nationalActionPhase,
    auRightsEligible,
    auReformValue,
    auReformDecision,
    auCitizenEligible,
    auCitizenValue,
    auCitizenDecision,
    auIncorporateCandidates,
    auIncorporateEligible,
    auIncorporateValue,
    auIncorporate,
    zouaveInPlay,
    zouaveReason,
    tsrrPhase,
    tsrrArmies,
    tsrrUnitValue,
    tsrrFrom,
    tsrrDestinations,
    tsrrToValue,
    tsrrDecision,
    showNationalActions,
    needsCp,
    auReformReason,
    auCitizenReason,
    auIncorporateReason,
    tsrrReason,
    jihadDecision,
    jihadReason,
    polishOwner,
    polishArmyDecision,
    polishReserveDecision,
    lastLog,
    lastNavalBox,
    lastNavalMover,
    amphibiousVisible,
    ownLoadedArmyAt,
    amphibiousOrigins,
    amphibiousFromValue,
    amphibiousTargets,
    amphibiousToValue,
    amphibiousBox,
    amphibiousArmies,
    chosenAmphibiousArmies,
    amphibiousArmyValue,
    amphibiousCheck,
    amphibiousPhaseOk,
    amphibiousReason,
    amphibiousCanGo,
    toggleAmphibiousArmy,
    transportVisible,
    transportMajor,
    transportOwns,
    transportable,
    transportOrigins,
    transportFromValue,
    transportLands,
    transportLandValue,
    transportFleet,
    transportReachableFrom,
    transportTargets,
    transportToValue,
    transportCheck,
    transportPhaseOk,
    transportReason,
    transportCanGo,
    adjacentPortsToBox,
    ownAdjacentPorts,
    interceptPorts,
    interceptPortValue,
    interceptCheck,
    interceptReason,
    interceptVisible,
    botTimerRef,
    botFailureRef,
    selectedState,
    selectedUnitDef,
    commandedOwner,
    commandsSelected,
    ownUnitsInSelected,
    ownLandInSelected,
    ownNavalInSelected,
    enemyLandTargetsFrom,
    enemyNavalTargetsFrom,
    potentialLandTargets,
    potentialNavalTargets,
    unitMoveTargets,
    pendingSpaceTargets,
    battleTargets,
    myOnMapArmies,
    myForts,
    myMinorAllies,
    hand,
    handCounts,
    goalCounts,
    doAction,
    beginTargeting,
    setBattleFrom,
    setNavalFrom,
    setSelectedUnit,
    submitTargeting,
    onSelectImpl,
    onSelect,
    pendingKindLabels,
    pendingKind,
    pendingPrompt,
    optionCardId,
    optionLabel,
    optionFace,
    optionAction,
    canDecline,
    warStatusLabels,
    warStatusLabel,
    warAimLabel,
    callableAllies,
    warAllyValue,
    callableMinors,
    warMinorValue,
    warBudgetRows,
    warDefenderMinors,
    minorMarkerRows,
    warTargetControl,
    targetControlledSpaces,
    canDeclareWar,
    gwOrderPowers,
    gwBudgetOrder,
    gwSlotLabel,
    italyBox,
    italySide,
    italyBoxLabel,
    italyShowing,
    italyHow,
    canGwDraft,
    gwDeployRoom,
    canGwDeployHere,
    gwSideAllies,
    gwTransferToValue,
    gwTransferAmountValue,
    canGwTransfer,
    gwJointNavalAllies,
    gwJointNavalUnitIds,
    gwCardId,
    gwCombatCardHeld,
    gwCardAlreadyFaceup,
    canGwReveal,
    deployFree,
    deployLimit,
    deployRoom,
    canDeployHere,
    homeCardTitle,
    saveList,
    ngChoices,
    giveCards,
    giveCardValue,
    responseInHand,
    responseWindow,
    chainInfo,
    chainUsed,
    chainNonEmpty,
    chainReady,
    chainSpendable,
    chainCap,
    chainDisabledReason,
    targetingHint,
    choicesProps,
    choiceKinds,
    dockChoices,
    dockVisible,
    dockSummary,
    handChoicesHint,
    mapHint,
    board,
    setBoard,
    railTab,
    setRailTab,
    warAim,
    setWarAim,
    warCp,
    setWarCp,
    secondObjective,
    setSecondObjective,
    mpitTarget,
    setMpitTarget,
    mpitTrack,
    setMpitTrack,
    warAlly,
    setWarAlly,
    warMinor,
    setWarMinor,
    giveTarget,
    setGiveTarget,
    giveCardId,
    setGiveCardId,
    confirmSurrender,
    setConfirmSurrender,
    auReformTarget,
    setAuReformTarget,
    auCitizenTarget,
    setAuCitizenTarget,
    auIncorporateTarget,
    setAuIncorporateTarget,
    auSacrifice,
    setAuSacrifice,
    tsrrUnitId,
    setTsrrUnitId,
    tsrrTo,
    setTsrrTo,
    polishReserve,
    setPolishReserve,
    gwTransferTo,
    setGwTransferTo,
    gwTransferAmount,
    setGwTransferAmount,
    dockCollapsed,
    setDockCollapsed,
    trayOpen,
    setTrayOpen,
    trayExpanded,
    setTrayExpanded,
    cardFaceMode,
    setCardFaceMode,
    amphibiousFrom,
    setAmphibiousFrom,
    amphibiousTo,
    setAmphibiousTo,
    amphibiousUnitIds,
    setAmphibiousUnitIds,
    transportFrom,
    setTransportFrom,
    transportTo,
    setTransportTo,
    transportLand,
    setTransportLand,
    interceptPort,
    setInterceptPort,
    interaction,
    dispatch,
  };
};

export type BoardModel = ReturnType<typeof useBoardModel>;
