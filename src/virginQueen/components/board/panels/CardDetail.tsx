import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import {EventBranchPanel} from "../EventBranchPanel";
import {branchParamValues, effectiveBranchIds, eventBranchChoice, eventBranchTarget} from "../../../eventBranches";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, landCount, POWERS, Power} from "../../../constant/general";
import {cardById, cardName} from "../../../constant/cards";
import {atWar} from "../../../util";
import {isActivatedMajor} from "../../../ownership";
import {canPlayTutorialEvent} from "../../../tutorialEvents";
import {canPlayGrandVizier, canPlayUntimelyDeath, isGrandVizier, untimelyDeathTargets} from "../../../cardEvents";
import {canPlayEspionageEvent, canPlayNorthernRising, doubleAgentTargets, isEspionageEvent} from "../../../espionage";

import {ArmyMutinyTargetSelect, CardArt, EventTargetSelect, GermanRecruitmentTargetSelect, HolyLeagueTargetSelect, MenendezTargetSelect, PolishElectionTargetSelect, StaffordTargetSelect, armyMutinyTargetValue, cardKindLabel, eventTargetMode, germanRecruitmentTargetValue, holyLeagueTargetOptions, holyLeagueTargetValue, leaderLabel, menendezTargetOptions, menendezTargetValue, playEventCard, staffordTargetValue} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const CardDetail = ({id}: {id: string}) => {
    const {G, ctx, moves, vqLocale, selected, setSelectedCard, eventSelection, from, eventTarget, espionageEventTarget, holyLeagueEventTarget, menendezEventTarget, polishElectionBids, armyMutinySelection, staffordSelection, germanRecruitmentSelection, setEventTarget, setEspionageEventTarget, setHolyLeagueEventTarget, setMenendezEventTarget, setPolishElectionBids, setArmyMutinySelection, setStaffordSelection, setGermanRecruitmentSelection, setEventBranches, setEventBranchParam, foreignArmySize, setForeignArmySize, me, ps, canAct, onSelect, space} = useVQBoard();
    const def = cardById(id);
    // Official cards carry the Chinese card face in `text`; show its English
    // translation when the board is in English.
    const cardText = vqLocale === "en" ? (def.textEn ?? def.text) : def.text;
    const disabled = !canAct || ps === undefined || ps.cardPlayed;
    const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
    const espionageTargets = handler === "walsingham" ? ["offensive", "defensive", ...POWERS.filter((p) => p !== "england" && !isActivatedMajor(G, p))] :
        handler === "cipherKey" ? ["remove", ...POWERS.filter((p) => p !== me && !isActivatedMajor(G, p))] :
            handler === "doubleAgent" && me !== undefined ? doubleAgentTargets(G, me) :
                handler === "untimelyDeath" && G.scenario !== "tutorial" ? (untimelyDeathTargets(G).length ? untimelyDeathTargets(G) : ["none"]) : [];
    const espionageTarget = espionageTargets.includes(espionageEventTarget) ? espionageEventTarget : espionageTargets[0];
    const targetMode = eventTargetMode(handler, espionageTargets.length);
    const foreignWarPower = targetMode === "foreignWar" ? (handler === "warInPersia" ? "ottoman" : "hre") : undefined;
    const holyLeagueOptions = targetMode === "holyLeague" ? holyLeagueTargetOptions(G) : [];
    const holyLeagueTarget = holyLeagueTargetValue(G, holyLeagueEventTarget);
    const menendezOptions = targetMode === "menendez" ? menendezTargetOptions(G) : [];
    const menendezTarget = menendezTargetValue(G, menendezEventTarget);
    const polishElection = targetMode === "polishElection";
    const armyMutiny = targetMode === "armyMutiny";
    const stafford = targetMode === "stafford";
    const germanRecruitment = targetMode === "germanRecruitment";
    const foreignWarBlocked = foreignWarPower !== undefined && (G.foreignWars[foreignWarPower] !== undefined ||
        (foreignWarPower === "hre" && atWar(G, "hre", "ottoman")) ||
        Object.values(G.spaces).filter((space) => space.siege === undefined)
            .reduce((total, space) => total + landCount(space.land[foreignWarPower]), 0) < 3);
    const canPlayAsEvent = def.kind !== "command" || def.officialKind === "mandatory" || G.scenario === "tutorial";
    const branchChoice = canPlayAsEvent && me !== undefined ? eventBranchChoice(G, id, me, ctx.numPlayers ?? 6) : undefined;
    const branchIds = branchChoice !== undefined ? effectiveBranchIds(branchChoice, eventSelection.branches) : [];
    const branchDefs = branchChoice !== undefined
        ? branchChoice.branches.filter((entry) => branchIds.includes(entry.id))
        : [];
    const branchValues: Record<string, Record<string, string>> = {};
    for (const entry of branchDefs) branchValues[entry.id] = branchParamValues(entry, eventSelection.branchParams[entry.id]);
    const branchTarget = branchChoice !== undefined ? eventBranchTarget(branchDefs, branchValues) : undefined;
    const branchComplete = branchChoice === undefined ||
        branchIds.length >= Math.min(branchChoice.maxSelections, branchChoice.branches.length);
    // Cards without an effect-branch entry or a dedicated selector get an
    // enumerable target dropdown; the old free-text field is gone.
    const targetOptions = canPlayAsEvent && branchChoice === undefined && targetMode === "freeText" && me !== undefined
        ? eventTargetOptions(G, id, me) : [];
    const targetChoice = eventTargetValue(targetOptions, eventTarget);
    return <Paper key={id} variant="outlined" sx={{p: 0.75, mb: 0.5}}>
        <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
            <Typography variant="caption" sx={{fontWeight: 700}}>{cardName(id, vqLocale)}</Typography>
            <Chip size="small" label={`${def.cp} CP`} color={def.kind === "home" ? "secondary" : "default"}/>
            <Chip size="small" variant="outlined" label={cardKindLabel(def)}/>
        </Stack>
        <CardArt def={def} className="vq-card-detail-art"/>
        {cardText !== undefined && <Typography variant="caption" color="text.secondary">{cardText}</Typography>}
        {branchChoice !== undefined && <EventBranchPanel choice={branchChoice} selected={eventSelection.branches}
            params={eventSelection.branchParams} onSelect={setEventBranches} onParam={setEventBranchParam}/>}
        {branchChoice === undefined && espionageTargets.length > 0 && <Select size="small" fullWidth value={espionageTarget}
            onChange={(e) => setEspionageEventTarget(e.target.value)}>
            {espionageTargets.map((target) => <MenuItem key={target} value={target}>
                {target === "offensive" ? i18n.chain.vq.board.offensive : target === "defensive" ? i18n.chain.vq.board.defensive : target === "remove" ? i18n.chain.vq.board.removeAll : target.includes(">")
                    ? `${i18n.chain.vq.board.defect} ${powerName(target.split(">")[0] as Power, vqLocale)} ${i18n.chain.vq.board.spy}${i18n.chain.vq.punct.openParen}${i18n.chain.vq.board.recall} ${powerName(target.split(">")[1] as Power, vqLocale)} ${i18n.chain.vq.board.ownSpy}${i18n.chain.vq.punct.closeParen}`
                    : handler === "doubleAgent" ? `${i18n.chain.vq.board.defect} ${powerName(target as Power, vqLocale)} ${i18n.chain.vq.board.spy}`
                    : handler === "untimelyDeath" ? (target === "none" ? i18n.chain.vq.board.noRemovableLeader : `${i18n.chain.vq.board.removeGame}: ${leaderLabel(target)}`)
                    : powerName(target as Power, vqLocale)}
            </MenuItem>)}
        </Select>}
        {branchChoice === undefined && foreignWarPower !== undefined && <FormControl size="small" sx={{mt: 0.5, minWidth: 130}}>
            <InputLabel id={`vq-war-size-${id}`}>{i18n.chain.vq.board.foreignArmySize}</InputLabel>
            <Select labelId={`vq-war-size-${id}`} label={i18n.chain.vq.board.foreignArmySize} value={foreignArmySize}
                    onChange={(e) => setForeignArmySize(Number(e.target.value))}>
                {[3, 5].map((n) => <MenuItem key={n} value={n}>{n} {i18n.chain.vq.board.independentArmies}</MenuItem>)}
            </Select>
        </FormControl>}
        {branchChoice === undefined && holyLeagueOptions.length > 0 && <HolyLeagueTargetSelect options={holyLeagueOptions}
            value={holyLeagueTarget} onChange={setHolyLeagueEventTarget}/>}
        {branchChoice === undefined && menendezOptions.length > 0 && <MenendezTargetSelect options={menendezOptions}
            value={menendezTarget ?? ""} onChange={setMenendezEventTarget}/>}
        {branchChoice === undefined && polishElection && <PolishElectionTargetSelect G={G} value={polishElectionBids}
            onChange={(power, choice) => setPolishElectionBids((current) => ({...current, [power]: choice}))}/>}
        {branchChoice === undefined && armyMutiny && <ArmyMutinyTargetSelect G={G} value={armyMutinySelection}
            onChange={(space, owner) => setArmyMutinySelection({space, owner})}/>}
        {branchChoice === undefined && stafford && <StaffordTargetSelect G={G} value={staffordSelection}
            onChange={(power, discard) => setStaffordSelection({power, discard})}/>}
        {branchChoice === undefined && germanRecruitment && <GermanRecruitmentTargetSelect G={G} hre={me === "hre"}
            value={germanRecruitmentSelection}
            onChange={(space: string, power?: Power, secondSpace?: string, secondPower?: Power) =>
                setGermanRecruitmentSelection({space, power, secondSpace, secondPower})}/>}
        {targetOptions.length > 0 && <EventTargetSelect cardId={id} options={targetOptions}
            value={targetChoice ?? ""} onChange={setEventTarget}/>}
        <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
            {canPlayAsEvent && <Button size="small" variant="contained"
                                              disabled={disabled || foreignWarBlocked || !branchComplete ||
                                                  (branchChoice === undefined && isEspionageEvent(handler) && !canPlayEspionageEvent(G, me!, handler, espionageTarget)) ||
                                                  (branchChoice !== undefined && isEspionageEvent(handler) &&
                                                      !canPlayEspionageEvent(G, me!, handler, branchTarget)) ||
                                                  (handler === "untimelyDeath" && G.scenario !== "tutorial" && !canPlayUntimelyDeath(G, espionageTarget)) ||
                                                  (handler === "northernRising" && G.scenario !== "tutorial" && !canPlayNorthernRising(G)) ||
                                                  (isGrandVizier(def) && !canPlayGrandVizier(G, me!, ctx.numPlayers)) ||
                                                  (G.scenario === "tutorial" && !canPlayTutorialEvent(G, me!, id))}
                                              onClick={() => {
                                                  playEventCard(moves.playCard, id, {
                                                      selected: branchChoice !== undefined ? branchTarget : espionageTargets.length > 0 ? espionageTarget : foreignWarPower !== undefined ? String(foreignArmySize) : holyLeagueOptions.length > 0 ? holyLeagueTarget : menendezOptions.length > 0 ? menendezTarget : polishElection ? polishElectionTargetValue(G, polishElectionBids) : armyMutiny ? armyMutinyTargetValue(G, armyMutinySelection) : stafford ? staffordTargetValue(G, staffordSelection) : germanRecruitment ? germanRecruitmentTargetValue(G, germanRecruitmentSelection, me === "hre") : targetOptions.length > 0 ? targetChoice : undefined,
                                                      // Every target is now picked from a selector.
                                                      typed: "",
                                                  });
                                                  setEventTarget("");
                                                  setHolyLeagueEventTarget("");
                                                  setMenendezEventTarget("");
                                                  setPolishElectionBids({});
                                                  setArmyMutinySelection({space: ""});
                                                  setStaffordSelection({power: ""});
                                                  setGermanRecruitmentSelection({space: ""});
                                                  setEventBranches([]);
                                                  setSelectedCard(undefined);
                                              }}>
                {def.kind === "home" ? i18n.chain.vq.board.useAbility : i18n.chain.vq.board.asEvent}
            </Button>}
            <Button size="small" variant="outlined" disabled={disabled || def.officialKind === "mandatory"}
                    onClick={() => {moves.playCard({cardId: id}); setSelectedCard(undefined);}}>{i18n.chain.vq.board.asCp}</Button>
        </Stack>
    </Paper>;
};
