import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import {POWERS, powerName, minorName} from "../../../../constant/general";
import {cardById} from "../../../../constant/cards";
import {warCost, atWar} from "../../../../util";
import {MINOR_POWERS} from "../../../../constant/general";
import {minorAvailable} from "../../../../util";
import {ownerOf} from "../../../../ownership";
import {betrothalChoices} from "../../board";
import {LEADER_BY_ID} from "../../../../constant/leaders";
import {catholicLeagueSpaceOptions} from "../../../../util";
import {SPACE_BY_ID} from "../../../../mapData";
import {seaPathBetweenPorts} from "../../../../util";

export const DiplomacyPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.diplomacy;
    const {G, moves, me, myTurn, playerID, ctx, hand, selected} = props;
    const {diploTarget, setDiploTarget, loanFromPort, setLoanFromPort, loanToPort, setLoanToPort, 
           loanLeader, setLoanLeader, domesticRoyal, setDomesticRoyal, foreignRoyal, setForeignRoyal} = props;
    
    const handCp = hand.reduce((n: number, id: string) => n + cardById(id).cp, 0);
    const betrothal = betrothalChoices(G, me, domesticRoyal, foreignRoyal);
    const ps = me ? G.powers[me] : undefined;
    
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2">{e.title}</Typography>
            <Typography variant="caption" color="text.secondary">
                {e.handCp}：{handCp}{e.handCpNote}
            </Typography>
            {G.pendingCatholicLeague !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                <Typography variant="subtitle2">{e.leagueTitle}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.leagueRemaining} {G.pendingCatholicLeague.remaining} {e.leagueRemainingNote}
                </Typography>
                {me === "spain" ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {catholicLeagueSpaceOptions(G).map((id: string) => 
                        <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseCatholicLeagueSpace({space: id})}>{SPACE_BY_ID[id].name}</Button>
                    )}
                </Stack> : <Typography variant="body2" color="text.secondary">{e.waitingSpain}</Typography>}
            </Stack>}
            {G.pendingHreReplacement !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                <Typography variant="subtitle2">{e.hreTitle}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.hreDesc}
                </Typography>
                {playerID !== null && ownerOf(G, "hre") === playerID ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canRegular}
                        onClick={() => moves.chooseHreReplacement({choice: "regular"})}>{e.viennaRegular}</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMercs}
                        onClick={() => moves.chooseHreReplacement({choice: "mercs"})}>{e.viennaMercs}</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMarker || G.mercenariesForHire !== 0}
                        onClick={() => moves.chooseHreReplacement({choice: "marker"})}>{e.mercMarket}</Button>
                </Stack> : <Typography variant="body2" color="text.secondary">{e.waitingHre}</Typography>}
            </Stack>}
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-diplo">{e.targetPower}</InputLabel>
                <Select labelId="vq-diplo" label={e.targetPower} value={diploTarget}
                        onChange={(ev) => setDiploTarget(ev.target.value)}>
                    {POWERS.filter((p: string) => p !== me).map((p: string) => <MenuItem key={p} value={p}>{powerName(p as any, vqLocale)}</MenuItem>)}
                </Select>
            </FormControl>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                    onClick={() => moves.declareWar({target: diploTarget})}>
                    {e.declareWar} ({warCost(G, me, diploTarget)} CP)
                </Button>
                <Button size="small" variant="outlined" disabled={!myTurn || !atWar(G, me, diploTarget)}
                    onClick={() => moves.makePeace({target: diploTarget})}>{e.makePeace}</Button>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                    onClick={() => moves.formAlliance({target: diploTarget})}>{e.alliance}</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                {e.note}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) ||
                    !ps?.cards.some((id: string) => cardById(id).kind !== "home")}
                    onClick={() => moves.giveRandomCard({target: diploTarget})}>{e.randomGift}</Button>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) || selected === undefined ||
                    (G.spaces[selected]?.land[me]?.merc ?? 0) < 1}
                    onClick={() => selected !== null && moves.giveMercenary({target: diploTarget, space: selected})}>{e.giftMerc}</Button>
            </Stack>
            {ps !== undefined && ps.treasures.length > 0 && <Stack spacing={0.5}>
                <Typography variant="subtitle2">{e.giftTreasure} {powerName(diploTarget, vqLocale)}</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {ps.treasures.map((value: number, index: number) => 
                        <Button key={`${value}-${index}`} size="small" variant="outlined"
                            disabled={!myTurn || atWar(G, me, diploTarget)}
                            onClick={() => moves.giveTreasure({target: diploTarget, index})}>{e.value} {value}</Button>
                    )}
                </Stack>
            </Stack>}
            {G.powers[me]?.allies.includes(diploTarget) && <Stack spacing={0.5}>
                <Typography variant="subtitle2">{e.navalLoan}</Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-from">{e.loanFrom}</InputLabel>
                    <Select labelId="vq-loan-from" label={e.loanFrom} value={loanFromPort}
                            onChange={(ev) => setLoanFromPort(ev.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === me && (space.ports?.length ?? 0) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-to">{e.loanTo}</InputLabel>
                    <Select labelId="vq-loan-to" label={e.loanTo} value={loanToPort}
                            onChange={(ev) => setLoanToPort(ev.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === diploTarget && (space.ports?.length ?? 0) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-leader">{e.loanLeader}</InputLabel>
                    <Select labelId="vq-loan-leader" label={e.loanLeader} value={loanLeader}
                            onChange={(ev) => setLoanLeader(ev.target.value)}>
                        <MenuItem value="">{e.noLeader}</MenuItem>
                        {(G.spaces[loanFromPort]?.leaders ?? []).filter((id: string) => LEADER_BY_ID[id]?.kind === "naval" &&
                            LEADER_BY_ID[id]?.power === me).map((id: string) =>
                            <MenuItem key={id} value={id}>{LEADER_BY_ID[id]?.name ?? id}</MenuItem>
                        )}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {(["galley", "galleon", "racebuilt"] as const).map((kind: string) =>
                        <Button key={kind} size="small" variant="outlined"
                            disabled={!myTurn || loanFromPort === "" || loanToPort === "" || !seaPathBetweenPorts(loanFromPort, loanToPort)}
                            onClick={() => moves.loanNaval({target: diploTarget, fromPort: loanFromPort, toPort: loanToPort, kind, ...(loanLeader ? {leader: loanLeader} : {})})}>
                            {e.loan} {kind}
                        </Button>
                    )}
                </Stack>
            </Stack>}
            <Typography variant="subtitle2">{e.declareWarMinor}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {MINOR_POWERS.map((m: string) => 
                    <Button key={m} size="small" variant="outlined"
                        disabled={!myTurn || G.powers[me].warsMinors.includes(m) ||
                            POWERS.some((major: string) => G.powers[major].alliedMinors.includes(m)) ||
                            !minorAvailable(G, m)}
                        onClick={() => moves.declareWarMinor({target: m})}>
                        {minorName(m as any, vqLocale)}
                    </Button>
                )}
            </Stack>
            <Divider/>
            <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                {e.endDiplomacy}
            </Button>
        </Stack>
    );
};
