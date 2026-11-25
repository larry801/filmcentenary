import React from "react";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {ActionGroup} from "../../theme";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, LandStack, MoriscoUnrestChoice, NavalStack, VQGame, WinterReturnChoice} from "../../../constant/general";
import {seaZoneName} from "../../../mapData";
import {participatingPowers} from "../../../ownership";
import {scenarioName} from "../../../scenario";
import {legalWinterLandReturnOptions, legalWinterLandReturnUnits, moriscoUnrestOptions} from "../../../util";

import {placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

/**
 * Composition choices for an overstacked fortress beyond the automatic one.
 * A garrison that may stay, or a stack with a single unit kind, has nothing to
 * choose here; the destination buttons already cover moving everything home.
 */
const winterReturnUnits = (
    G: Parameters<typeof legalWinterLandReturnUnits>[0],
    power: Parameters<typeof legalWinterLandReturnUnits>[1],
    entry: WinterReturnChoice,
    to: string,
): LandStack[] => {
    const kinds = (["regular", "merc", "cav"] as const).filter((kind) => entry.before[kind] > 0);
    if (entry.minMove <= 0 || kinds.length < 2) return [];
    const automatic = legalWinterLandReturnUnits(G, power, entry, entry.autoTo)
        .find((units) => units.regular === entry.autoMoved.regular && units.merc === entry.autoMoved.merc &&
            units.cav === entry.autoMoved.cav);
    return legalWinterLandReturnUnits(G, power, entry, to)
        .filter((units) => automatic === undefined || units.regular !== automatic.regular ||
            units.merc !== automatic.merc || units.cav !== automatic.cav);
};

/**
 * Choose which units leave an overstacked fortress.  Every kind gets a count
 * picker and the confirm button stays disabled until the combination is one
 * `legalWinterLandReturnUnits` accepts for that destination.
 */
const WinterCompositionPicker = ({entry, options, disabled, unitNames, onConfirm}: {
    entry: WinterReturnChoice;
    options: LandStack[];
    disabled: boolean;
    unitNames: Record<keyof LandStack, string>;
    onConfirm: (units: LandStack) => void;
}) => {
    const [units, setUnits] = React.useState<LandStack>(options[0]);
    const shown = options.find((option) => option.regular === units.regular &&
        option.merc === units.merc && option.cav === units.cav);
    const set = (kind: keyof LandStack, value: number): void => setUnits({...units, [kind]: value});
    return <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.chooseComposition}</Typography>
        <Stack direction="row" spacing={1} sx={{flexWrap: "wrap"}}>
            {(["regular", "merc", "cav"] as const).map((kind) => <Stack key={kind} direction="row" spacing={1}>
                <Typography variant="caption">{unitNames[kind]}</Typography>
                <Select size="small" inputProps={{"aria-label": unitNames[kind]}} value={units[kind]}
                    disabled={disabled}
                    onChange={(event) => set(kind, Number(event.target.value))}>
                    {Array.from({length: entry.before[kind] + 1}, (_, count) => <MenuItem key={count} value={count}>{count}</MenuItem>)}
                </Select>
            </Stack>)}
        </Stack>
        <Button size="small" variant="outlined" disabled={disabled || shown === undefined}
            onClick={() => shown !== undefined && onConfirm(shown)}>
            {i18n.chain.vq.cardDraw.confirm}
        </Button>
    </Stack>;
};

/**
 * Rule 20.1: the Ottoman's owner places the winter Unrest markers within two
 * spaces of the Morisco unit.  The automatic pair is preselected, so the
 * confirm button accepts it unchanged and the map keeps that result if the
 * turn ends without a choice.
 */
const MoriscoUnrestPicker = ({G, choice, disabled, onConfirm}: {
    G: VQGame;
    choice: MoriscoUnrestChoice;
    disabled: boolean;
    onConfirm: (spaces: string[]) => void;
}) => {
    const [picked, setPicked] = React.useState<string[]>(choice.auto);
    // The legal spaces are read fresh: winter replacements run after rule 20.1
    // marks the automatic pair, so a capital that just received its regular is
    // no longer unoccupied.
    const options = [...new Set([...moriscoUnrestOptions(G, choice.origin), ...choice.auto])];
    const toggle = (id: string): void => setPicked((current) => {
        if (current.includes(id)) return current.filter((entry) => entry !== id);
        // A full selection replaces its oldest space, so one tap never leaves
        // the player without a confirmable pair.
        return current.length >= choice.count ? [...current.slice(1), id] : [...current, id];
    });
    return <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.moriscoUnrestDesc}</Typography>
        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
            {options.map((id) => <Button key={id} size="small" disabled={disabled}
                variant={picked.includes(id) ? "contained" : "outlined"}
                onClick={() => toggle(id)}>{placeLabel(id)}</Button>)}
        </Stack>
        <Button size="small" variant="outlined" disabled={disabled || picked.length !== choice.count}
            onClick={() => onConfirm(picked)}>
            {i18n.chain.vq.cardDraw.confirmUnrest}
        </Button>
    </Stack>;
};

export const CardDrawPanel = () => {
    const {G, ctx, moves, vqLocale, me, myTurn, switchToTab, space} = useVQBoard();
    if (me === undefined) return null;
    const powers = participatingPowers(G);
    const nextPhase = G.scenario === "tutorial" ? i18n.chain.vq.cardDraw.springPhase : i18n.chain.vq.cardDraw.diplomacyPhase;
    const winterLosses = (G.winterLossChoices ?? []).filter((entry) => entry.power === me);
    const winterNavalLosses = (G.winterNavalLossChoices ?? []).filter((entry) => entry.power === me);
    const winterReturns = (G.winterReturnChoices ?? []).filter((entry) => entry.power === me);
    const winterNavalReturns = (G.winterNavalReturnChoices ?? []).filter((entry) => entry.power === me);
    const moriscoUnrest = G.pendingMoriscoUnrest?.power === me ? G.pendingMoriscoUnrest : undefined;
    const unitNames: Record<keyof LandStack, string> = {regular: i18n.chain.vq.cardDraw.regular, merc: i18n.chain.vq.cardDraw.merc, cav: i18n.chain.vq.cardDraw.cav};
    const shipNames: Record<keyof NavalStack, string> = {galley: i18n.chain.vq.cardDraw.galley, galleon: i18n.chain.vq.cardDraw.galleon, racebuilt: i18n.chain.vq.cardDraw.racebuilt, corsair: i18n.chain.vq.cardDraw.corsair};
    return <Stack spacing={1}>
        <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.cardDrawPhase} · {i18n.chain.vq.cardDraw.turn} {G.year}</Typography>
        {G.scenario !== "tutorial" && (G.treasurePoolCount !== undefined || G.treasurePool !== undefined) && <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.cardDraw.treasurePool}{i18n.chain.vq.punct.colon}
            {i18n.chain.vq.cardDraw.treasurePoolValue
                .replace("{pool}", String(G.treasurePoolCount ?? G.treasurePool?.length ?? 0))
                .replace("{discard}", String(G.treasureDiscard?.length ?? 0))}
        </Typography>}
        {(G.colonyRolls?.length ?? 0) > 0 && <Stack spacing={0.25} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.colonies}</Typography>
            {(G.colonyRolls ?? []).map((entry) => <Typography key={entry.settlement} variant="caption">
                {placeLabel(entry.settlement)} · {powerName(entry.power, vqLocale)} · {entry.total} · {i18n.chain.vq.cardDraw[entry.result === "eliminated" ? "colonyEliminated" : entry.result === "none" ? "colonyNone" : entry.result === "treasure" ? "colonyTreasure" : "colonyTreasureVp"]}
            </Typography>)}
        </Stack>}
        {moriscoUnrest !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.moriscoUnrest}</Typography>
            <MoriscoUnrestPicker G={G} choice={moriscoUnrest} disabled={!myTurn}
                onConfirm={(spaces) => moves.chooseMoriscoUnrest({spaces})}/>
        </Stack>}
        {winterReturns.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "info.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterReturns}</Typography>
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.winterReturnsDesc}</Typography>
            {winterReturns.map((entry) => {
                const destinations = legalWinterLandReturnOptions(G, me, entry);
                const alternatives = destinations.filter((option) => option !== entry.autoTo);
                const compositions = winterReturnUnits(G, me, entry, entry.autoTo);
                return <Stack key={entry.id} spacing={0.5}>
                    <Typography variant="body2">
                        {placeLabel(entry.from)} → {placeLabel(entry.autoTo)} · {i18n.chain.vq.cardDraw.needMove} {entry.minMove} {i18n.chain.vq.cardDraw.units}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {alternatives.map((option) => <Button key={option} size="small" variant="outlined"
                            disabled={!myTurn}
                            onClick={() => moves.chooseWinterReturn({id: entry.id, to: option})}>
                            {i18n.chain.vq.cardDraw.moveTo} {placeLabel(option)}
                        </Button>)}
                    </Stack>
                    {compositions.length > 0 && <WinterCompositionPicker entry={entry} options={compositions} disabled={!myTurn}
                        unitNames={unitNames}
                        onConfirm={(units) => moves.chooseWinterReturn({id: entry.id, to: entry.autoTo, units})}/>}
                </Stack>;
            })}
        </Stack>}
        {winterNavalReturns.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "info.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterNavalReturns}</Typography>
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.winterNavalReturnsDesc}</Typography>
            {winterNavalReturns.map((entry) => (
                <Stack key={entry.id} spacing={0.5}>
                    <Typography variant="body2">
                        {seaZoneName(entry.zone, vqLocaleNow())} → {placeLabel(entry.auto)}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {entry.options.filter((port) => port !== entry.auto).map((port) =>
                            <Button key={port} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseWinterNavalReturn({id: entry.id, port})}>
                                {i18n.chain.vq.cardDraw.moveTo} {placeLabel(port)}
                            </Button>)}
                    </Stack>
                </Stack>
            ))}
        </Stack>}
        {winterLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterLosses}</Typography>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.cardDraw.winterLossesDesc}
            </Typography>
            {winterLosses.map((entry, index) => {
                const stack = G.spaces[entry.space]?.land[me];
                const choices = entry.confirmOnly ? [] : (["regular", "merc", "cav"] as const)
                    .filter((kind) => (stack?.[kind] ?? 0) >= entry.amount);
                return <Stack key={`${entry.space}-${index}`} spacing={0.5}>
                    <Typography variant="body2">
                        {placeLabel(entry.space)} · {i18n.chain.vq.cardDraw.needLose} {entry.amount} {i18n.chain.vq.cardDraw.units}
                    </Typography>
                    {entry.confirmOnly && <Typography variant="caption" color="text.secondary">
                        {i18n.chain.vq.cardDraw.morisco}
                    </Typography>}
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {choices.map((kind) => <Button key={kind} size="small" variant="outlined"
                            disabled={!myTurn}
                            onClick={() => moves.chooseWinterLoss({space: entry.space, kind})}>
                            {i18n.chain.vq.cardDraw.changeTo} {unitNames[kind]}
                        </Button>)}
                        <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseWinterLoss({space: entry.space, kind: "auto"})}>
                            {entry.confirmOnly ? i18n.chain.vq.cardDraw.confirmRemove : i18n.chain.vq.cardDraw.keepAuto}
                        </Button>
                    </Stack>
                </Stack>;
            })}
        </Stack>}
        {winterNavalLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.winterNavalLosses}</Typography>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.cardDraw.winterNavalDesc}
            </Typography>
            {winterNavalLosses.map((entry, index) => (
                <Stack key={`${entry.zone}-${index}`} spacing={0.5}>
                    <Typography variant="body2">
                        {seaZoneName(entry.zone, vqLocaleNow())} · {i18n.chain.vq.cardDraw.lost} {entry.amount} {i18n.chain.vq.cardDraw.ships}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {(Object.keys(shipNames) as (keyof NavalStack)[])
                            .filter((kind) => entry.removed[kind] > 0)
                            .map((kind) => <Button key={kind} size="small" variant="outlined"
                                disabled={!myTurn}
                                onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind})}>
                                {i18n.chain.vq.cardDraw.confirm} {shipNames[kind]} ×{entry.removed[kind]}
                            </Button>)}
                        <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind: "auto"})}>
                            {i18n.chain.vq.cardDraw.keepAuto}
                        </Button>
                    </Stack>
                </Stack>
            ))}
        </Stack>}
        <Typography variant="body2" color={myTurn ? "primary" : "text.secondary"}>
            {`${myTurn ? i18n.chain.vq.cardDraw.pleaseConfirm : i18n.chain.vq.cardDraw.waiting} P${Number(ctx.currentPlayer) + 1} · ${powerName(G.activePower, vqLocale)} ${i18n.chain.vq.cardDraw.completeDraw}${i18n.chain.vq.punct.openParen}${powers.indexOf(G.activePower) + 1}/${powers.length}${i18n.chain.vq.punct.closeParen}${i18n.chain.vq.punct.period}${!myTurn && switchToTab(G.activePower) !== undefined ? ` ${switchToTab(G.activePower)}` : ""}`}
        </Typography>
        <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
            {`${i18n.chain.vq.cardDraw.confirm}${vqLocale === "en" ? " " : ""}${powerName(G.activePower, vqLocale)}${vqLocale === "en" ? " " : ""}${i18n.chain.vq.cardDraw.drawDone}`}
        </Button>
        <ActionGroup title={i18n.chain.vq.cardDraw.rules}>
        <Typography variant="body2">{i18n.chain.vq.cardDraw.rule1}</Typography>
        <Typography variant="body2">{`${i18n.chain.vq.cardDraw.rule2a}${vqLocale === "en" ? " " : ""}${nextPhase}${i18n.chain.vq.cardDraw.rule2b}`}</Typography>
        {G.powers.ottoman.ruler === "suleiman" &&
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.cardDraw.suleiman}</Typography>}
        <Typography variant="caption" color="text.secondary">{scenarioName(G.scenario, vqLocale)}</Typography>
        </ActionGroup>
    </Stack>;
};
