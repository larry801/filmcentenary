import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import {POWER_NAMES, POWERS} from "../../../../constant/general";
import {cardById} from "../../../../constant/cards";
import {warCost, atWar} from "../../../../util";
import {MINOR_POWERS, MINOR_NAMES} from "../../../../constant/general";
import {minorAvailable} from "../../../../util";
import {ownerOf} from "../../../../ownership";
import {betrothalChoices} from "../../board";
import {LEADER_BY_ID} from "../../../../constant/leaders";
import {catholicLeagueSpaceOptions} from "../../../../util";
import {SPACE_BY_ID} from "../../../../mapData";
import {seaPathBetweenPorts} from "../../../../util";

export const DiplomacyPanel = (props: any) => {
    const {G, moves, me, myTurn, playerID, ctx, hand, selected} = props;
    const {diploTarget, setDiploTarget, loanFromPort, setLoanFromPort, loanToPort, setLoanToPort, 
           loanLeader, setLoanLeader, domesticRoyal, setDomesticRoyal, foreignRoyal, setForeignRoyal} = props;
    
    const handCp = hand.reduce((n: number, id: string) => n + cardById(id).cp, 0);
    const betrothal = betrothalChoices(G, me, domesticRoyal, foreignRoyal);
    const ps = me ? G.powers[me] : undefined;
    
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2">外交</Typography>
            <Typography variant="caption" color="text.secondary">
                手牌总 CP：{handCp}（宣战/议和使用手牌支付，本国牌不可用于宣战）
            </Typography>
            {G.pendingCatholicLeague !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                <Typography variant="subtitle2">天主教联盟：西班牙选择法国地区</Typography>
                <Typography variant="caption" color="text.secondary">
                    还需选择 {G.pendingCatholicLeague.remaining} 个未设防的法国本土地区（不能是休格诺家乡地区）。
                </Typography>
                {me === "spain" ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {catholicLeagueSpaceOptions(G).map((id: string) => 
                        <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseCatholicLeagueSpace({space: id})}>{SPACE_BY_ID[id].name}</Button>
                    )}
                </Stack> : <Typography variant="body2" color="text.secondary">等待西班牙选择…</Typography>}
            </Stack>}
            {G.pendingHreReplacement !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                <Typography variant="subtitle2">神圣罗马帝国冬季补员</Typography>
                <Typography variant="caption" color="text.secondary">
                    选择 1 正规军、2 雇佣兵，或将雇佣兵市场标记从 0 移到 4。
                </Typography>
                {playerID !== null && ownerOf(G, "hre") === playerID ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canRegular}
                        onClick={() => moves.chooseHreReplacement({choice: "regular"})}>维也纳 +1 正规军</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMercs}
                        onClick={() => moves.chooseHreReplacement({choice: "mercs"})}>维也纳 +2 雇佣兵</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMarker || G.mercenariesForHire !== 0}
                        onClick={() => moves.chooseHreReplacement({choice: "marker"})}>雇佣兵市场 0→4</Button>
                </Stack> : <Typography variant="body2" color="text.secondary">等待神圣罗马选择…</Typography>}
            </Stack>}
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-diplo">目标强国</InputLabel>
                <Select labelId="vq-diplo" label="目标强国" value={diploTarget}
                        onChange={(e) => setDiploTarget(e.target.value)}>
                    {POWERS.filter((p: string) => p !== me).map((p: string) => <MenuItem key={p} value={p}>{POWER_NAMES[p as keyof typeof POWER_NAMES].zh}</MenuItem>)}
                </Select>
            </FormControl>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                    onClick={() => moves.declareWar({target: diploTarget})}>
                    宣战 ({warCost(G, me, diploTarget)} CP)
                </Button>
                <Button size="small" variant="outlined" disabled={!myTurn || !atWar(G, me, diploTarget)}
                    onClick={() => moves.makePeace({target: diploTarget})}>议和</Button>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                    onClick={() => moves.formAlliance({target: diploTarget})}>结盟</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                宣战/议和使用手牌支付；同盟只持续本回合。
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) ||
                    !ps?.cards.some((id: string) => cardById(id).kind !== "home")}
                    onClick={() => moves.giveRandomCard({target: diploTarget})}>随机赠送一张牌</Button>
                <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) || selected === undefined ||
                    (G.spaces[selected]?.land[me]?.merc ?? 0) < 1}
                    onClick={() => selected !== null && moves.giveMercenary({target: diploTarget, space: selected})}>赠送选中地区1雇佣兵</Button>
            </Stack>
            {ps !== undefined && ps.treasures.length > 0 && <Stack spacing={0.5}>
                <Typography variant="subtitle2">赠送宝藏给 {POWER_NAMES[diploTarget as keyof typeof POWER_NAMES].zh}</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {ps.treasures.map((value: number, index: number) => 
                        <Button key={`${value}-${index}`} size="small" variant="outlined"
                            disabled={!myTurn || atWar(G, me, diploTarget)}
                            onClick={() => moves.giveTreasure({target: diploTarget, index})}>价值 {value}</Button>
                    )}
                </Stack>
            </Stack>}
            {G.powers[me]?.allies.includes(diploTarget) && <Stack spacing={0.5}>
                <Typography variant="subtitle2">海军借调</Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-from">借出港口</InputLabel>
                    <Select labelId="vq-loan-from" label="借出港口" value={loanFromPort}
                            onChange={(e) => setLoanFromPort(e.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === me && (space.ports?.length ?? 0) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-to">接收港口</InputLabel>
                    <Select labelId="vq-loan-to" label="接收港口" value={loanToPort}
                            onChange={(e) => setLoanToPort(e.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === diploTarget && (space.ports?.length ?? 0) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-loan-leader">随借海军将领（可选）</InputLabel>
                    <Select labelId="vq-loan-leader" label="随借海军将领（可选）" value={loanLeader}
                            onChange={(e) => setLoanLeader(e.target.value)}>
                        <MenuItem value="">不借将领</MenuItem>
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
                            借出 {kind}
                        </Button>
                    )}
                </Stack>
            </Stack>}
            <Typography variant="subtitle2">对小国宣战 (2 CP)</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {MINOR_POWERS.map((m: string) => 
                    <Button key={m} size="small" variant="outlined"
                        disabled={!myTurn || G.powers[me].warsMinors.includes(m) ||
                            POWERS.some((major: string) => G.powers[major].alliedMinors.includes(m)) ||
                            !minorAvailable(G, m)}
                        onClick={() => moves.declareWarMinor({target: m})}>
                        {MINOR_NAMES[m as keyof typeof MINOR_NAMES].zh}
                    </Button>
                )}
            </Stack>
            <Divider/>
            <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                结束外交回合
            </Button>
        </Stack>
    );
};
