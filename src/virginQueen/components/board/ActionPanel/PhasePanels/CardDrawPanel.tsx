import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {participatingPowers} from "../../../../ownership";
import {scenarioName, seaCaptainName, seaCaptainById} from "../../../../scenario";
import {ActionGroup} from "../../../../theme";
import {homeCardChoiceRequired} from "../../../../util";

export const CardDrawPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.cardDraw;
    const {G, moves, me, myTurn, ctx} = props;
    const powers = participatingPowers(G);
    const nextPhase = G.scenario === "tutorial" ? e.springPhase : e.diplomacyPhase;
    const winterLosses = (G.winterLossChoices ?? []).filter((entry: any) => entry.power === me);
    const winterNavalLosses = (G.winterNavalLossChoices ?? []).filter((entry: any) => entry.power === me);
    const unitNames: any = {regular: e.regular, merc: e.merc, cav: e.cav};
    const shipNames: any = {galley: e.galley, galleon: e.galleon, racebuilt: e.racebuilt, corsair: e.corsair};
    
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2">{e.cardDrawPhase} · {e.turn} {G.year}</Typography>
            {winterLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                <Typography variant="subtitle2">{e.winterLosses}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.winterLossesDesc}
                </Typography>
                {winterLosses.map((entry: any, index: number) => {
                    const stack = G.spaces[entry.space]?.land[me];
                    const choices = entry.confirmOnly ? [] : (["regular", "merc", "cav"] as const)
                        .filter((kind) => (stack?.[kind] ?? 0) >= entry.amount);
                    return <Stack key={`${entry.space}-${index}`} spacing={0.5}>
                        <Typography variant="body2">
                            {require("../../../../mapData").SPACE_BY_ID[entry.space]?.name ?? entry.space} · {e.needLose} {entry.amount} {e.units}
                        </Typography>
                        {entry.confirmOnly && <Typography variant="caption" color="text.secondary">
                            {e.morisco}
                        </Typography>}
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {choices.map((kind: any) => 
                                <Button key={kind} size="small" variant="outlined"
                                    disabled={!myTurn}
                                    onClick={() => moves.chooseWinterLoss({space: entry.space, kind})}>
                                    {e.changeTo} {unitNames[kind]}
                                </Button>
                            )}
                            <Button size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseWinterLoss({space: entry.space, kind: "auto"})}>
                                {entry.confirmOnly ? e.confirmRemove : e.keepAuto}
                            </Button>
                        </Stack>
                    </Stack>;
                })}
            </Stack>}
            {winterNavalLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                <Typography variant="subtitle2">{e.winterNavalLosses}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.winterNavalDesc}
                </Typography>
                {winterNavalLosses.map((entry: any, index: number) => (
                    <Stack key={`${entry.zone}-${index}`} spacing={0.5}>
                        <Typography variant="body2">
                            {require("../../../../mapData").SEA_ZONE_BY_ID[entry.zone]?.name ?? entry.zone} · {e.lost} {entry.amount} {e.ships}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {(Object.keys(shipNames) as any[])
                                .filter((kind) => entry.removed[kind] > 0)
                                .map((kind: any) => 
                                    <Button key={kind} size="small" variant="outlined"
                                        disabled={!myTurn}
                                        onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind})}>
                                        {e.confirm} {shipNames[kind]} ×{entry.removed[kind]}
                                    </Button>
                                )}
                            <Button size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind: "auto"})}>
                                {e.keepAuto}
                            </Button>
                        </Stack>
                    </Stack>
                ))}
            </Stack>}
            <Typography variant="body2" color={myTurn ? "primary" : "text.secondary"}>
                {`${myTurn ? e.pleaseConfirm : e.waiting} P${Number(ctx.currentPlayer) + 1} · ${powerName(G.activePower, vqLocale)} ${e.completeDraw}（${powers.indexOf(G.activePower) + 1}/${powers.length}）。`}
            </Typography>
            {me !== "france" && me !== "protestant" ? null : G.seaCaptainsAvailable?.map((id: string) => {
                const captain = seaCaptainById(id);
                if (captain === undefined || captain.turn > G.year) return null;
                return <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                               onClick={() => moves.claimSeaCaptain({captain: id})}>
                    {e.claimCaptain}: {seaCaptainName(captain, vqLocale)}
                </Button>;
            })}
            <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                {`${e.confirm} ${powerName(G.activePower, vqLocale)} ${e.drawDone}`}
            </Button>
            <ActionGroup title={e.rules}>
                <Typography variant="body2">{e.rule1}</Typography>
                <Typography variant="body2">{`${e.rule2a} ${nextPhase}${e.rule2b}`}</Typography>
                {G.powers.ottoman.ruler === "suleiman" &&
                    <Typography variant="caption" color="text.secondary">{e.suleiman}</Typography>}
                <Typography variant="caption" color="text.secondary">{scenarioName(G.scenario, vqLocale)}</Typography>
            </ActionGroup>
        </Stack>
    );
};
