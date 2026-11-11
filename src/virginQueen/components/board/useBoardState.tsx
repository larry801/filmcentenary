import React from "react";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import {eventTargetOptions, eventTargetValue} from "../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../polishElection";
import {blockingPendingReason, vqLocaleNow} from "./helpers";
import {useNotificationPermission, useTurnNotification} from "./useNotifications";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../constant/i18n";
import {controllerName, powerName, landCount, LandStack, POWER_INFO, POWERS, Power, ReligionArea, VQGame, isPower} from "../../constant/general";
import {cardById, cardName} from "../../constant/cards";
import {LEADER_BY_ID} from "../../constant/leaders";
import {SEA_ZONE_BY_ID, SPACE_BY_ID} from "../../mapData";
import {capitalSpacesFor, controlledKeys, protestantKeysOutsideNetherlands, rulerStats, victoryStandings, formationCapacity, friendlyController, legalTargets} from "../../util";
import {controlledPowers, ownerOf, isActivatedMajor} from "../../ownership";
import {TUTORIAL_POWER_CARDS} from "../../tutorial";
import {Controller} from "../../constant/general";
import {passBlockReasons, type PassBlock} from "../../moves";

import {ArmyMutinyTargetSelection, EMPTY_EVENT_SELECTION, GermanRecruitmentTargetSelection, MODE_COST, Mode, StaffordTargetSelection, VirginQueenBoardProps, actionResponderChoices, actionWindowResponders, eventSelectionReducer, leaderLabel, legalDiplomacyTarget, phaseLabel, unitLabel, virginQueenCombatRetrieveOptions} from "./helpers";

/** All board state, derived values and handlers shared by the VQ panels. */
export const useBoardState = ({G, log, ctx, moves, playerID, isActive, matchID, hotseat = false}: VirginQueenBoardProps) => {
    i18n.use();
    const vqLocale = vqLocaleNow();
    const militaryKeyCount = (p: Power): number =>
        p === "protestant" ? protestantKeysOutsideNetherlands(G).length : controlledKeys(G, p).length;
    const militaryGoalFor = (p: Power): number => G.scenario === "tutorial"
        ? ((TUTORIAL_POWER_CARDS as Record<string, {military: number}>)[p]?.military ?? POWER_INFO[p].autoWinKeys)
        : POWER_INFO[p].autoWinKeys;
    const militaryGoal = (p: Power): string => i18n.chain.vq.intel.militaryGoal
        .replace("{count}", String(militaryKeyCount(p)))
        .replace("{goal}", String(militaryGoalFor(p)));
    const [selected, setSelected] = React.useState<string | undefined>(G.scenario === "tutorial"
        ? playerID === "1" ? "madrid" : "istanbul" : "london");
    const isDesktop = useMediaQuery("(min-width:1024px)");
    const [mobileView, setMobileView] = React.useState("map");
    const [handExpanded, setHandExpanded] = React.useState(true);
    const [selectedCard, setSelectedCard] = React.useState<string>();
    const [eventSelection, dispatchEventSelection] = React.useReducer(eventSelectionReducer, EMPTY_EVENT_SELECTION);
    const actionRef = React.useRef<HTMLElement>(null);
    const sidebarRef = React.useRef<HTMLElement>(null);
    const panelID = React.useId();
    const [mode, setMode] = React.useState<Mode>("inspect");
    const [from, setFrom] = React.useState<string | null>(null);
    const [movingUnits, setMovingUnits] = React.useState<LandStack>({regular: 0, merc: 0, cav: 0});
    const [movingOwner, setMovingOwner] = React.useState<Controller>("ottoman");
    const [movingLeaders, setMovingLeaders] = React.useState<string[]>([]);
    const [transportZones, setTransportZones] = React.useState<string[]>([]);
    const [rebelCp, setRebelCp] = React.useState(2);
    const [seaCaptainChoice, setSeaCaptainChoice] = React.useState("");
    const [seaCaptainPort, setSeaCaptainPort] = React.useState("");
    const [piracyZone, setPiracyZone] = React.useState("");
    const [piracyTarget, setPiracyTarget] = React.useState("");
    const [diploTarget, setDiploTarget] = React.useState<Power>("spain");
    const [actionNotice, setActionNotice] = React.useState<string | undefined>();
    const [loanFromPort, setLoanFromPort] = React.useState("");
    const [loanToPort, setLoanToPort] = React.useState("");
    const [loanLeader, setLoanLeader] = React.useState("");
    const [domesticRoyal, setDomesticRoyal] = React.useState("");
    const [foreignRoyal, setForeignRoyal] = React.useState("");
    const [patronageCp, setPatronageCp] = React.useState(2);
    const [espionageTargetSelection, setEspionageTarget] = React.useState<Power>("spain");
    const [assassinationTarget, setAssassinationTarget] = React.useState("elizabeth");
    const [assassinationCp, setAssassinationCp] = React.useState(2);
    const [catholicRebellionCp, setCatholicRebellionCp] = React.useState(3);
    const [informantSource, setInformantSource] = React.useState("");
    const eventTarget = eventSelection.text;
    const espionageEventTarget = eventSelection.espionage;
    const holyLeagueEventTarget = eventSelection.holyLeague;
    const menendezEventTarget = eventSelection.menendez;
    const polishElectionBids = eventSelection.polish;
    const armyMutinySelection = eventSelection.armyMutiny;
    const staffordSelection = eventSelection.stafford;
    const germanRecruitmentSelection = eventSelection.germanRecruitment;
    const setEventTarget = (value: string): void => dispatchEventSelection({type: "setText", value});
    const setEspionageEventTarget = (value: string): void => dispatchEventSelection({type: "setEspionage", value});
    const setHolyLeagueEventTarget = (value: string): void => dispatchEventSelection({type: "setHolyLeague", value});
    const setMenendezEventTarget = (value: string): void => dispatchEventSelection({type: "setMenendez", value});
    const setPolishElectionBids = (value: PolishElectionBidChoices | ((current: PolishElectionBidChoices) => PolishElectionBidChoices)): void =>
        dispatchEventSelection({type: "setPolish", value});
    const setArmyMutinySelection = (value: ArmyMutinyTargetSelection): void => dispatchEventSelection({type: "setArmyMutiny", value});
    const setStaffordSelection = (value: StaffordTargetSelection): void => dispatchEventSelection({type: "setStafford", value});
    const setGermanRecruitmentSelection = (value: GermanRecruitmentTargetSelection): void => dispatchEventSelection({type: "setGermanRecruitment", value});
    const setEventBranches = (value: string[]): void => dispatchEventSelection({type: "setBranches", value});
    const setEventBranchParam = (branchId: string, paramId: string, value: string): void =>
        dispatchEventSelection({type: "setBranchParam", branchId, paramId, value});
    /** Opens a card and clears every target selection that belonged to the previous one. */
    const openCard = (cardId: string): void => {
        setSelectedCard(cardId);
        dispatchEventSelection({type: "open", cardId});
    };
    const [expeditionCaptain, setExpeditionCaptain] = React.useState("");
    const [expeditionHasColony, setExpeditionHasColony] = React.useState(false);
    const [foreignArmySize, setForeignArmySize] = React.useState(3);
    const [foreignWarUnits, setForeignWarUnits] = React.useState<{space: string; kind: keyof LandStack}[]>([]);
    const [foreignWarLeader, setForeignWarLeader] = React.useState("");
    const [gregorianTarget, setGregorianTarget] = React.useState<Power>("france");
    const [selectedActionResponder, setSelectedActionResponder] = React.useState<Power>();
    const [selectedAbjurationPower, setSelectedAbjurationPower] = React.useState<Power>();
    // Pass / end-impulse are destructive enough to deserve a confirmation.
    const [confirmAction, setConfirmAction] = React.useState<"pass" | "endImpulse" | null>(null);
    const [sheetOpen, setSheetOpen] = React.useState(false);
    // Phones edit the staged formation in a bottom sheet instead of a map overlay.
    const [formationSheetOpen, setFormationSheetOpen] = React.useState(false);

    const [viewPower, setViewPower] = React.useState<Power>();
    const owned = controlledPowers(G, playerID);
    const piracyResponder = G.pendingPiracy && (G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target);
    const actionResponders = actionWindowResponders(G);
    const myActionChoices = actionResponderChoices(G, playerID);
    const myActionResponders = myActionChoices.map((choice) => choice.responder);
    // Ignore a stale selection when the response window shrinks (another
    // holder answered) or a new window offers a different set of powers.
    const actionResponder = (selectedActionResponder !== undefined && myActionResponders.includes(selectedActionResponder)
        ? selectedActionResponder : undefined) ?? myActionResponders[0] ?? actionResponders[0];
    const responsePower = G.pendingPolishElection && ownerOf(G, G.pendingPolishElection.remaining[0]) === playerID ? G.pendingPolishElection.remaining[0] :
        G.gregorianResponse && ownerOf(G, G.gregorianResponse.responder) === playerID ? G.gregorianResponse.responder :
        G.pendingBeacon && ownerOf(G, G.pendingBeacon.defender) === playerID ? G.pendingBeacon.defender :
        G.pendingInterceptionOrder && ownerOf(G, G.pendingInterceptionOrder.defender) === playerID ? G.pendingInterceptionOrder.defender :
        G.pendingIntercept && ownerOf(G, G.pendingIntercept.defender) === playerID ? G.pendingIntercept.defender :
        G.pendingEspionage && ownerOf(G, G.pendingEspionage.responding) === playerID ? G.pendingEspionage.responding :
        actionResponder && ownerOf(G, actionResponder) === playerID ? actionResponder :
        piracyResponder && ownerOf(G, piracyResponder) === playerID ? piracyResponder :
        G.pendingCardEvent && ownerOf(G, G.pendingCardEvent.responding) === playerID ? G.pendingCardEvent.responding :
        G.pendingTutorialEvent && ownerOf(G, G.pendingTutorialEvent.responding) === playerID ? G.pendingTutorialEvent.responding :
        G.pendingCityRebels && isPower(G.pendingCityRebels.controller) && ownerOf(G, G.pendingCityRebels.controller) === playerID ? G.pendingCityRebels.controller :
        G.pendingBattle && ownerOf(G, G.pendingBattle.responding) === playerID ? G.pendingBattle.responding :
        G.pendingBetrothal && ownerOf(G, G.pendingBetrothal.target) === playerID ? G.pendingBetrothal.target :
        G.pendingForeignWar && ownerOf(G, G.pendingForeignWar.power) === playerID ? G.pendingForeignWar.power :
        G.pendingRebelMove && ownerOf(G, G.pendingRebelMove.power) === playerID ? G.pendingRebelMove.power : undefined;
    const me: Power | undefined = responsePower ?? (ctx.currentPlayer === playerID ? G.activePower :
        viewPower && owned.includes(viewPower) ? viewPower : owned[0]);
    const legalEspionageTargets = POWERS.filter((p) => p !== me && !isActivatedMajor(G, p));
    const espionageTarget = legalEspionageTargets.includes(espionageTargetSelection) ? espionageTargetSelection : legalEspionageTargets[0];
    const myTurn = ctx.gameover === undefined && me !== undefined && ctx.currentPlayer === playerID && me === G.activePower;
    const diploTargetValue = legalDiplomacyTarget(me, diploTarget);
    const switchToTab = (power: Power | undefined): string | undefined => {
        if (!hotseat || power === undefined) return undefined;
        const seat = ownerOf(G, power);
        if (seat === undefined || seat === playerID) return undefined;
        return i18n.chain.vq.shell.switchToTab.replace("{tab}", String(Number(seat) + 1));
    };
    useTurnNotification({
        isMyTurn: myTurn,
        needsResponse: responsePower !== undefined && ctx.gameover === undefined,
        titleSuffix: responsePower !== undefined ? i18n.chain.vq.shell.responseNeeded : myTurn ? i18n.chain.vq.shell.yourTurn : undefined,
    });
    useNotificationPermission(myTurn || responsePower !== undefined);
    const phase = ctx.phase ?? "";
    // boardgame.io clears ctx.phase when the game ends; showing the empty key
    // would render "vq.header.phase." and spam the i18n missing-key warning.
    const phaseText = phaseLabel(phase);
    // The winter step advances the year before endIf reports the time-limit
    // winner, so cap the header at the scenario's final turn on game over.
    const displayYear = ctx.gameover !== undefined ? Math.min(G.year, G.endTurn) : G.year;
    const ps = me !== undefined ? G.powers[me] : undefined;
    const cp = ps?.cp ?? 0;
    const hand = ps?.cards ?? [];
    const passBlockCodes: PassBlock[] = myTurn && phase === "action" && me !== undefined ? passBlockReasons(G, me) : [];
    const passBlockText = (code: PassBlock): string => {
        switch (code) {
            case "played":
                return i18n.chain.vq.turn.passAlreadyPlayed;
            case "mandatory": {
                const id = hand.find((candidate) => cardById(candidate).officialKind === "mandatory");
                return i18n.chain.vq.turn.mustPlayMandatory.replace("{card}", id !== undefined ? cardName(id, vqLocale) : "");
            }
            case "home": {
                const id = hand.find((candidate) => cardById(candidate).kind === "home");
                return i18n.chain.vq.turn.mustPlayHome.replace("{card}", id !== undefined ? cardName(id, vqLocale) : "");
            }
            case "admin":
                return i18n.chain.vq.turn.handOverAdmin
                    .replace("{hand}", String(hand.length))
                    .replace("{admin}", me !== undefined ? String(rulerStats(G, me).admin) : "");
        }
    };
    // Every rule that blocks a pass is listed, not just the first one: a large
    // hand plus an unplayed Home card are independent restrictions.
    const passBlockReason = passBlockCodes.length > 0 ? passBlockCodes.map(passBlockText).join(" · ") : undefined;
    // Ending after a card is the normal way to finish an impulse; only the
    // no-card path is a pass and subject to the pass restrictions.
    const endImpulseBlocked = passBlockCodes.length > 0 && !passBlockCodes.includes("played");
    // Hotseat: every mounted seat shares one screen, so an idle panel has to
    // say which tab the device user should open next.
    const hotseatWaitHint = (): string | undefined => {
        if (myTurn || me === undefined) return undefined;
        const base = `${i18n.chain.vq.board.waiting} ${powerName(G.activePower, vqLocale)} ${i18n.chain.vq.board.act}${i18n.chain.vq.punct.period}`;
        const tab = switchToTab(G.activePower);
        return tab === undefined ? base : `${base} ${tab}`;
    };
    const canAct = myTurn && phase === "action" && !G.pendingPolishElection && !G.pendingEspionage && !G.pendingBattle && !G.pendingActivation && !G.pendingCardEvent && !G.pendingTutorialEvent && !G.pendingPiracy && !G.pendingAction && !G.pendingIntercept && !G.pendingAbjuration && !G.gregorianResponse && !G.pendingBeacon && !G.pendingInterceptionOrder && !G.pendingCityRebels && !G.pendingReliefSplit && !G.pendingRebelMove && !G.pendingForeignWar;
    const vqCombatRetrieve = virginQueenCombatRetrieveOptions(G, playerID);

    /** Why an action mode is unavailable, or undefined when it can be picked. */
    const modeDisabledReason = (candidate: Mode): string | undefined => {
        if (!myTurn || me === undefined) return i18n.chain.vq.turn.notYourTurn;
        if (!canAct && candidate !== "spring") return blockingPendingReason(G) ?? i18n.chain.vq.turn.disabled;
        const cost = MODE_COST[candidate];
        if (cp < cost) return i18n.chain.vq.turn.neededCp.replace("{need}", String(cost));
        return undefined;
    };

    const isMoveMode = (candidate: Mode): boolean =>
        candidate === "moveLand" || candidate === "moveNaval" || candidate === "navalTransport" || candidate === "spring";

    /** Steps to display in the map banner for the current multi-step action. */
    const stepState = (): {steps: string[]; active: number} | undefined => {
        if (mode === "inspect") return undefined;
        // Single-click actions still get a banner, so every mode says what to click and what it costs.
        if (!isMoveMode(mode)) return {steps: [`${i18n.chain.vq.step.clickHighlighted} · ${mode === "rebellion" ? rebelCp : MODE_COST[mode]} CP`], active: 0};
        const e = i18n.chain.vq.step;
        const steps = mode === "moveNaval"
            ? [e.chooseOrigin, e.chooseTarget]
            : [e.chooseOrigin, e.chooseUnit, e.chooseTarget];
        return {steps, active: from === null ? 0 : 1};
    };

    const mapHighlights = mode === "inspect" ? undefined : legalTargets(G, me, mode, from);
    const stepInfo = stepState();

    /** Sea zones that can be appended next to the transport route. */
    const transportCandidates = (() => {
        if (mode !== "navalTransport" || from === null) return [];
        const last = transportZones[transportZones.length - 1];
        const zones = last !== undefined ? SEA_ZONE_BY_ID[last]?.adjacent ?? [] : (SPACE_BY_ID[from]?.ports ?? []);
        return [...new Set(zones)]
            .filter((id) => !transportZones.includes(id))
            .map((id) => SEA_ZONE_BY_ID[id])
            .filter((zone) => zone !== undefined);
    })();

    /**
     * Units staged by default when an origin is chosen: the whole stack clipped
     * to the formation limit so the obvious next click does not fail silently.
     */
    const defaultFormationUnits = (origin: string, leaders: string[]): LandStack => {
        const available = (me !== undefined ? G.spaces[origin]?.land[me] : undefined) ?? {regular: 0, merc: 0, cav: 0};
        let remaining = formationCapacity(leaders);
        const units: LandStack = {regular: 0, merc: 0, cav: 0};
        for (const kind of ["regular", "merc", "cav"] as const) {
            const take = Math.min(available[kind], remaining);
            units[kind] = take;
            remaining -= take;
        }
        return units;
    };

    /**
     * Owner, unit-count and leader controls for a staged land formation.
     * Spring Deployment moves only the active power's own troops, so it hides
     * the owner picker.
     */
    const stackPicker = (spring: boolean) => {
        if (from === null) return null;
        const source = G.spaces[from];
        if (source === undefined) return null;
        const owner: Controller = spring && me !== undefined ? me : movingOwner;
        const available = source.land[owner] ?? {regular: 0, merc: 0, cav: 0};
        const capacity = formationCapacity(movingLeaders);
        const chosen = landCount(movingUnits);
        return <>
            {!spring && <Select size="small" value={movingOwner} onChange={(event) => {
                const nextOwner = event.target.value as Controller;
                setMovingOwner(nextOwner);
                setMovingUnits({...G.spaces[from].land[nextOwner]!});
                setMovingLeaders([]);
            }}>
                {(Object.keys(G.spaces[from].land) as Controller[])
                    .filter((candidate) => ((spring || mode === "navalTransport") ? candidate === me : friendlyController(G, me, candidate)) &&
                        landCount(G.spaces[from].land[candidate]) > 0)
                    .map((candidate) => <MenuItem key={candidate} value={candidate}>{controllerName(candidate, vqLocale)}</MenuItem>)}
            </Select>}
            {(["regular", "merc", "cav"] as const).map((kind) => <Stack key={kind} direction="row" spacing={1}>
                <Typography variant="caption">{unitLabel(kind)}</Typography>
                <Select size="small" value={movingUnits[kind]} onChange={(event) => setMovingUnits({...movingUnits, [kind]: Number(event.target.value)})}>
                    {Array.from({length: (available[kind] ?? 0) + 1}, (_, count) => <MenuItem key={count} value={count}>{count}</MenuItem>)}
                </Select>
            </Stack>)}
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {source.leaders.filter((leader) => LEADER_BY_ID[leader]?.power === owner && LEADER_BY_ID[leader]?.kind === "army").map((leader) =>
                    <Button key={leader} variant={movingLeaders.includes(leader) ? "contained" : "outlined"} onClick={() => setMovingLeaders(movingLeaders.includes(leader) ? movingLeaders.filter((id) => id !== leader) : [...movingLeaders, leader])}>{leaderLabel(leader)}</Button>)}
            </Stack>
            <Typography variant="caption" color={chosen > capacity ? "error" : "text.secondary"}>
                {i18n.chain.vq.springUi.commandLimit.replace("{count}", String(capacity))}
                {chosen > capacity ? ` · ${i18n.chain.vq.springUi.overCapacity}` : ""}
            </Typography>
        </>;
    };

    /** One-line read-out for the map dock that replaces the picker on phones. */
    const formationSummary = (): string => {
        const units = (["regular", "merc", "cav"] as const)
            .map((kind) => `${unitLabel(kind)} ${movingUnits[kind]}`)
            .join(" · ");
        const leaders = movingLeaders.length > 0 ? ` · ${movingLeaders.map(leaderLabel).join(" + ")}` : "";
        return `${units}${leaders} · ${i18n.chain.vq.springUi.commandLimit.replace("{count}", String(formationCapacity(movingLeaders)))}`;
    };

    React.useEffect(() => {
        // Spring deployment is the only map action available in the spring
        // phase, so arm it automatically instead of asking for a dropdown pick.
        setMode(ctx.phase === "spring" && myTurn ? "spring" : "inspect");
        setFrom(null);
        setForeignWarUnits([]);
        setForeignWarLeader("");
    }, [ctx.phase, ctx.currentPlayer, G.activePower, myTurn]);

    // A move that went through (the log grew) supersedes the last rejected-click
    // notice. Declared before the CP check below so its own notice survives.
    React.useEffect(() => {setActionNotice(undefined);}, [G.log.length]);

    React.useEffect(() => {
        // A one-shot action can spend the last CP; do not leave the map in a
        // mode whose next click would be rejected by the engine.
        if (!myTurn || mode === "inspect" || mode === "spring") return;
        if (cp < MODE_COST[mode]) {
            setMode("inspect");
            setFrom(null);
            setTransportZones([]);
            setActionNotice(i18n.chain.vq.actionUi.notEnoughCp);
        }
    }, [cp, mode, myTurn]);

    React.useEffect(() => {
        // The sheet only exists while a formation is being staged; close it as
        // soon as the move ends, the action changes, or the viewport is wide.
        if (isDesktop || from === null || (mode !== "spring" && mode !== "moveLand" && mode !== "navalTransport")) {
            setFormationSheetOpen(false);
        }
    }, [from, mode, isDesktop]);

    React.useEffect(() => {setSelectedCard(undefined);}, [me, playerID]);

    React.useEffect(() => {
        // Hotseat boards stay mounted while other seats finish the game.  A
        // pass/end-impulse confirmation left open on an earlier tab would
        // otherwise sit on top of the game-over panel and look clickable.
        if (ctx.gameover === undefined) return;
        setConfirmAction(null);
        setSelectedCard(undefined);
        setFrom(null);
        setTransportZones([]);
    }, [ctx.gameover]);

    React.useEffect(() => {
        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || confirmAction !== null) return;
            if (from !== null) {
                event.preventDefault();
                setFrom(null);
                setTransportZones([]);
            } else if (mode !== "inspect") {
                event.preventDefault();
                setMode(phase === "spring" ? "spring" : "inspect");
            }
        };
        window.addEventListener("keydown", cancelOnEscape);
        return () => window.removeEventListener("keydown", cancelOnEscape);
    }, [from, mode, confirmAction, phase]);

    const doSpaceAction = (id: string): void => {
        // Sea labels share selection with cities; only naval moves and transport routes accept them.
        if (G.spaces[id] === undefined && mode !== "moveNaval" && mode !== "navalTransport") return;
        // While routing a naval transport, clicking sea zones appends them to the
        // ordered route instead of executing anything.
        if (mode === "navalTransport" && from !== null && G.spaces[id] === undefined) {
            setTransportZones((zones) => zones.includes(id) ? zones : [...zones, id]);
            return;
        }
        if ((!canAct && !(myTurn && phase === "spring" && mode === "spring")) || me === undefined) {
            return;
        }
        const oneShot = mode === "recruitRegular" || mode === "recruitMerc" || mode === "recruitCav" ||
            mode === "buildGalley" || mode === "buildGalleon" || mode === "buildRacebuilt" || mode === "buildCorsair" ||
            mode === "control" || mode === "assault" || mode === "buildFortress" || mode === "rebellion";
        if (oneShot && mapHighlights !== undefined && !mapHighlights.has(id)) {
            setActionNotice(i18n.chain.vq.actionUi.illegalTarget);
            return;
        }
        switch (mode) {
            case "recruitRegular":
                moves.recruit({space: id, kind: "regular"});
                break;
            case "recruitMerc":
                moves.recruit({space: id, kind: "merc"});
                break;
            case "recruitCav":
                moves.recruit({space: id, kind: "cav"});
                break;
            case "buildGalley":
                moves.buildNaval({port: id, kind: "galley"});
                break;
            case "buildGalleon":
                moves.buildNaval({port: id, kind: "galleon"});
                break;
            case "buildRacebuilt":
                moves.buildNaval({port: id, kind: "racebuilt"});
                break;
            case "buildCorsair":
                moves.buildNaval({port: id, kind: "corsair"});
                break;
            case "moveLand":
            case "navalTransport":
                if (from === null) {
                    const owner = (Object.keys(G.spaces[id].land) as Controller[]).find((candidate) =>
                        (mode === "navalTransport" ? candidate === me : friendlyController(G, me, candidate)) && landCount(G.spaces[id].land[candidate]) > 0);
                    if (owner) {
                        setFrom(id);
                        setMovingOwner(owner);
                        setMovingUnits({...G.spaces[id].land[owner]!});
                        setMovingLeaders(G.spaces[id].leaders.filter((leader) => LEADER_BY_ID[leader]?.power === owner && LEADER_BY_ID[leader]?.kind === "army"));
                        setTransportZones([]);
                    }
                } else {
                    if (mode === "navalTransport") moves.navalTransport({from, to: id, zones: transportZones, units: movingUnits, leaders: movingLeaders});
                    else moves.moveLand({from, to: id, units: movingUnits, unitPower: movingOwner, leaders: movingLeaders});
                    setFrom(null);
                }
                break;
            case "moveNaval":
                if (from === null) {
                    if (G.seaZones[id as keyof VQGame["seaZones"]]?.naval[me] !== undefined) {
                        setFrom(id);
                    } else if (G.spaces[id] !== undefined && (G.spaces[id].naval[me] !== undefined)) {
                        setFrom(id);
                    }
                } else {
                    moves.moveNaval({from, to: id});
                    setFrom(null);
                }
                break;
            case "spring":
                if (from === null) {
                    const stack = G.spaces[id].land[me];
                    if (capitalSpacesFor(G, me).includes(id) && stack !== undefined && landCount(stack) > 0) {
                        const leaders = G.spaces[id].leaders
                            .filter((leader) => LEADER_BY_ID[leader]?.power === me && LEADER_BY_ID[leader]?.kind === "army")
                            .slice(0, 2);
                        setFrom(id);
                        setMovingOwner(me);
                        setMovingLeaders(leaders);
                        setMovingUnits(defaultFormationUnits(id, leaders));
                    }
                } else {
                    moves.springDeploy({from, to: id, units: movingUnits, leaders: movingLeaders});
                    setFrom(null);
                }
                break;
            case "control":
                moves.controlSpace({space: id});
                break;
            case "assault":
                moves.assault({space: id});
                break;
            case "buildFortress":
                moves.buildFortress({space: id});
                break;
            case "rebellion":
                moves.rebellion({space: id, cp: rebelCp});
                break;
            default:
                break;
        }
    };

    const onSelect = (id: string): void => {
        setSelected(id);
        doSpaceAction(id);
        // Read-only taps open the bottom sheet on phones; an active action keeps
        // the map in front so the target can still be chosen.
        if (!isDesktop && mode === "inspect" && G.spaces[id] !== undefined) setSheetOpen(true);
    };

    const space = selected !== undefined ? G.spaces[selected] : undefined;
    const spaceDef = selected !== undefined ? SPACE_BY_ID[selected] : undefined;
    const standings = victoryStandings(G);

    const religionActions = (me: Power): { label: string; run: () => void }[] => {
        const list: { label: string; run: () => void }[] = [];
        const add = (label: string, side: "preach" | "suppress", area: ReligionArea) => {
            list.push({
                label,
                run: () => side === "preach" ? moves.preach({area}) : moves.suppress({area}),
            });
        };
        if (me === "spain") {
            add(i18n.chain.vq.religionActions.preachEngland, "preach", "england");
            add(i18n.chain.vq.religionActions.suppressNetherlands, "suppress", "netherlands");
        }
        if (me === "protestant") {
            add(i18n.chain.vq.religionActions.preachFrance, "preach", "france");
            add(i18n.chain.vq.religionActions.preachNetherlands, "preach", "netherlands");
            add(i18n.chain.vq.religionActions.preachScotland, "preach", "scotland");
        }
        if (me === "england") {
            add(i18n.chain.vq.religionActions.suppressEngland, "suppress", "england");
        }
        if (me === "france") {
            add(i18n.chain.vq.religionActions.suppressFrance, "suppress", "france");
            add(i18n.chain.vq.religionActions.suppressScotland, "suppress", "scotland");
        }
        return list;
    };

    const pendingPower = G.pendingPolishElection?.remaining[0] ?? G.gregorianResponse?.responder ?? G.pendingBeacon?.defender ?? G.pendingInterceptionOrder?.defender ?? G.pendingIntercept?.defender ?? actionResponder ?? piracyResponder ??
        G.pendingEspionage?.responding ?? G.pendingCardEvent?.responding ?? G.pendingTutorialEvent?.responding ?? G.pendingBattle?.responding ?? G.pendingActivation?.ally ?? G.pendingBetrothal?.target ?? G.pendingRebelMove?.power ??
        G.pendingReliefSplit?.power ?? G.pendingForeignWar?.power ??
        (G.pendingCityRebels !== undefined ? (isPower(G.pendingCityRebels.controller) ? G.pendingCityRebels.controller : G.pendingCityRebels.power) : undefined) ??
        (G.pendingAbjuration !== undefined ? "protestant" as Power : undefined);
    const hasResponse = pendingPower !== undefined && ctx.gameover === undefined;
    // Winter attrition choices are mandatory but are not `pending*` responses,
    // so they need their own cue on the action tab (especially on mobile).
    const winterLandChoice = me !== undefined && (G.winterLossChoices ?? []).some((entry) => entry.power === me);
    const winterNavalChoice = me !== undefined && (G.winterNavalLossChoices ?? []).some((entry) => entry.power === me);
    const winterChoiceRequired = phase === "cardDraw" && (winterLandChoice || winterNavalChoice);
    const needsAction = hasResponse || winterChoiceRequired;
    const winterChoiceLabel = winterLandChoice && winterNavalChoice
        ? `${i18n.chain.vq.cardDraw.winterLosses} / ${i18n.chain.vq.cardDraw.winterNavalLosses}`
        : winterLandChoice ? i18n.chain.vq.cardDraw.winterLosses : i18n.chain.vq.cardDraw.winterNavalLosses;
    const selectedSea = selected ? G.seaZones[selected as keyof VQGame["seaZones"]] : undefined;
    const panelProps = (name: string) => ({id: `${panelID}-${name}`, role: isDesktop ? undefined : "tabpanel",
        "aria-labelledby": isDesktop ? undefined : `${panelID}-tab-${name}`, hidden: !isDesktop && mobileView !== name,
        // Lets the skip link land on the action panel for keyboard users.
        tabIndex: name === "action" ? -1 : undefined});
    React.useEffect(() => {
        if (needsAction) {
            if (actionRef.current) actionRef.current.scrollTop = 0;
            if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
        }
    }, [needsAction, pendingPower, G.pendingBattle?.step, G.pendingPiracy?.step, G.pendingTutorialEvent?.step, G.pendingCardEvent, G.pendingEspionage?.step]);
    return {G, log, ctx, moves, playerID, isActive, matchID, hotseat, vqLocale, militaryKeyCount, militaryGoalFor, militaryGoal, selected, setSelected, isDesktop, mobileView, setMobileView, handExpanded, setHandExpanded, selectedCard, setSelectedCard, eventSelection, dispatchEventSelection, actionRef, sidebarRef, panelID, mode, setMode, from, setFrom, movingUnits, setMovingUnits, movingOwner, setMovingOwner, movingLeaders, setMovingLeaders, transportZones, setTransportZones, rebelCp, setRebelCp, seaCaptainChoice, setSeaCaptainChoice, seaCaptainPort, setSeaCaptainPort, piracyZone, setPiracyZone, piracyTarget, setPiracyTarget, diploTarget, setDiploTarget, actionNotice, setActionNotice, loanFromPort, setLoanFromPort, loanToPort, setLoanToPort, loanLeader, setLoanLeader, domesticRoyal, setDomesticRoyal, foreignRoyal, setForeignRoyal, patronageCp, setPatronageCp, espionageTargetSelection, setEspionageTarget, assassinationTarget, setAssassinationTarget, assassinationCp, setAssassinationCp, catholicRebellionCp, setCatholicRebellionCp, informantSource, setInformantSource, eventTarget, espionageEventTarget, holyLeagueEventTarget, menendezEventTarget, polishElectionBids, armyMutinySelection, staffordSelection, germanRecruitmentSelection, setEventTarget, setEspionageEventTarget, setHolyLeagueEventTarget, setMenendezEventTarget, setPolishElectionBids, setArmyMutinySelection, setStaffordSelection, setGermanRecruitmentSelection, setEventBranches, setEventBranchParam, openCard, expeditionCaptain, setExpeditionCaptain, expeditionHasColony, setExpeditionHasColony, foreignArmySize, setForeignArmySize, foreignWarUnits, setForeignWarUnits, foreignWarLeader, setForeignWarLeader, gregorianTarget, setGregorianTarget, selectedActionResponder, setSelectedActionResponder, selectedAbjurationPower, setSelectedAbjurationPower, confirmAction, setConfirmAction, sheetOpen, setSheetOpen, formationSheetOpen, setFormationSheetOpen, viewPower, setViewPower, owned, piracyResponder, actionResponders, myActionChoices, myActionResponders, actionResponder, responsePower, me, legalEspionageTargets, espionageTarget, myTurn, diploTargetValue, switchToTab, phase, phaseText, displayYear, ps, cp, hand, passBlockCodes, passBlockText, passBlockReason, endImpulseBlocked, hotseatWaitHint, canAct, vqCombatRetrieve, modeDisabledReason, isMoveMode, stepState, mapHighlights, stepInfo, transportCandidates, defaultFormationUnits, stackPicker, formationSummary, doSpaceAction, onSelect, space, spaceDef, standings, religionActions, pendingPower, hasResponse, winterLandChoice, winterNavalChoice, winterChoiceRequired, needsAction, winterChoiceLabel, selectedSea, panelProps};
};
