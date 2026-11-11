import Button from "@mui/material/Button";
import {ActionGroup} from "../../theme";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, LandStack, NavalStack} from "../../../constant/general";
import {seaCaptainById, seaCaptainName} from "../../../scenario";
import {seaZoneName} from "../../../mapData";
import {participatingPowers} from "../../../ownership";
import {scenarioName} from "../../../scenario";

import {placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const CardDrawPanel = () => {
    const {G, ctx, moves, vqLocale, me, myTurn, switchToTab, space} = useVQBoard();
    if (me === undefined) return null;
    const powers = participatingPowers(G);
    const nextPhase = G.scenario === "tutorial" ? i18n.chain.vq.cardDraw.springPhase : i18n.chain.vq.cardDraw.diplomacyPhase;
    const winterLosses = (G.winterLossChoices ?? []).filter((entry) => entry.power === me);
    const winterNavalLosses = (G.winterNavalLossChoices ?? []).filter((entry) => entry.power === me);
    const unitNames: Record<keyof LandStack, string> = {regular: i18n.chain.vq.cardDraw.regular, merc: i18n.chain.vq.cardDraw.merc, cav: i18n.chain.vq.cardDraw.cav};
    const shipNames: Record<keyof NavalStack, string> = {galley: i18n.chain.vq.cardDraw.galley, galleon: i18n.chain.vq.cardDraw.galleon, racebuilt: i18n.chain.vq.cardDraw.racebuilt, corsair: i18n.chain.vq.cardDraw.corsair};
    return <Stack spacing={1}>
        <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.cardDrawPhase} · {i18n.chain.vq.cardDraw.turn} {G.year}</Typography>
        {(G.colonyRolls?.length ?? 0) > 0 && <Stack spacing={0.25} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.cardDraw.colonies}</Typography>
            {(G.colonyRolls ?? []).map((entry) => <Typography key={entry.settlement} variant="caption">
                {placeLabel(entry.settlement)} · {powerName(entry.power, vqLocale)} · {entry.total} · {i18n.chain.vq.cardDraw[entry.result === "eliminated" ? "colonyEliminated" : entry.result === "none" ? "colonyNone" : entry.result === "treasure" ? "colonyTreasure" : "colonyTreasureVp"]}
            </Typography>)}
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
        {me !== "france" && me !== "protestant" ? null : G.seaCaptainsAvailable.map((id) => {
            const captain = seaCaptainById(id);
            if (captain === undefined || captain.turn > G.year) {
                return null;
            }
            return <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                           onClick={() => moves.claimSeaCaptain({captain: id})}>
                {i18n.chain.vq.cardDraw.claimCaptain}: {seaCaptainName(captain, vqLocale)}
            </Button>;
        })}
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
