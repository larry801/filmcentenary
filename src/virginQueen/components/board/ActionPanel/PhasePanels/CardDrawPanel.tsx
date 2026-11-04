import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import {POWER_NAMES} from "../../../../constant/general";
import {participatingPowers} from "../../../../ownership";
import {scenarioName} from "../../../../scenario";
import {seaCaptainById} from "../../../../scenario";
import {ActionGroup} from "../../../../theme";
import {homeCardChoiceRequired} from "../../../../util";

export const CardDrawPanel = (props: any) => {
    const {G, moves, me, myTurn, ctx} = props;
    const powers = participatingPowers(G);
    const nextPhase = G.scenario === "tutorial" ? "春季部署阶段" : "外交阶段";
    const winterLosses = (G.winterLossChoices ?? []).filter((entry: any) => entry.power === me);
    const winterNavalLosses = (G.winterNavalLossChoices ?? []).filter((entry: any) => entry.power === me);
    const unitNames: any = {regular: "正规军", merc: "雇佣兵", cav: "骑兵"};
    const shipNames: any = {galley: "桨帆船", galleon: "大帆船", racebuilt: "快帆船", corsair: "海盗船"};
    
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2">Card Draw 阶段 · 第 {G.year} 回合</Typography>
            {winterLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                <Typography variant="subtitle2">冬季损失：选择或确认失去的单位类型</Typography>
                <Typography variant="caption" color="text.secondary">
                    已自动移除相应数量的单位；普通冬季损失可改选该地现有足够数量的类型，或保留自动结果；莫里斯科人随 #28 离场，只能确认。
                </Typography>
                {winterLosses.map((entry: any, index: number) => {
                    const stack = G.spaces[entry.space]?.land[me];
                    const choices = entry.confirmOnly ? [] : (["regular", "merc", "cav"] as const)
                        .filter((kind) => (stack?.[kind] ?? 0) >= entry.amount);
                    return <Stack key={`${entry.space}-${index}`} spacing={0.5}>
                        <Typography variant="body2">
                            {require("../../../../mapData").SPACE_BY_ID[entry.space]?.name ?? entry.space} · 需失去 {entry.amount} 个单位
                        </Typography>
                        {entry.confirmOnly && <Typography variant="caption" color="text.secondary">
                            莫里斯科人（#28）随牌离场，只能确认移除，不能改为失去其他兵种。
                        </Typography>}
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {choices.map((kind: any) => 
                                <Button key={kind} size="small" variant="outlined"
                                    disabled={!myTurn}
                                    onClick={() => moves.chooseWinterLoss({space: entry.space, kind})}>
                                    改为失去 {unitNames[kind]}
                                </Button>
                            )}
                            <Button size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseWinterLoss({space: entry.space, kind: "auto"})}>
                                {entry.confirmOnly ? "确认移除" : "保留自动结果"}
                            </Button>
                        </Stack>
                    </Stack>;
                })}
            </Stack>}
            {winterNavalLosses.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                <Typography variant="subtitle2">冬季海军损失：确认损失的舰型</Typography>
                <Typography variant="caption" color="text.secondary">
                    无可用返港港口时整支舰队按 20.4 消灭；可为每处损失确认损失的舰型，或保留自动结果（不会因此保留舰船）。
                </Typography>
                {winterNavalLosses.map((entry: any, index: number) => (
                    <Stack key={`${entry.zone}-${index}`} spacing={0.5}>
                        <Typography variant="body2">
                            {require("../../../../mapData").SEA_ZONE_BY_ID[entry.zone]?.name ?? entry.zone} · 损失 {entry.amount} 艘舰船
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            {(Object.keys(shipNames) as any[])
                                .filter((kind) => entry.removed[kind] > 0)
                                .map((kind: any) => 
                                    <Button key={kind} size="small" variant="outlined"
                                        disabled={!myTurn}
                                        onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind})}>
                                        确认 {shipNames[kind]} ×{entry.removed[kind]}
                                    </Button>
                                )}
                            <Button size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseWinterNavalLoss({zone: entry.zone, kind: "auto"})}>
                                保留自动结果
                            </Button>
                        </Stack>
                    </Stack>
                ))}
            </Stack>}
            <Typography variant="body2" color={myTurn ? "primary" : "text.secondary"}>
                {`${myTurn ? "请确认" : "等待"} P${Number(ctx.currentPlayer) + 1} · ${POWER_NAMES[G.activePower].zh} 完成抽牌（${powers.indexOf(G.activePower) + 1}/${powers.length}）。`}
            </Typography>
            {me !== "france" && me !== "protestant" ? null : G.seaCaptainsAvailable?.map((id: string) => {
                const captain = seaCaptainById(id);
                if (captain === undefined || captain.turn > G.year) return null;
                return <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                               onClick={() => moves.claimSeaCaptain({captain: id})}>
                    领取共享船长：{captain.nameZh ?? captain.nameEn}
                </Button>;
            })}
            <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                {`确认${POWER_NAMES[G.activePower].zh}抽牌完成`}
            </Button>
            <ActionGroup title="抽牌与本国牌规则">
                <Typography variant="body2">已按本回合可用性发放本国牌与年度手牌。拥有两张可用本国牌的强国，将在春季部署时秘密保留一张。</Typography>
                <Typography variant="body2">{`各参战强国依次确认后进入${nextPhase}；同一玩家控制的强国也需分别确认。`}</Typography>
                {G.powers.ottoman.ruler === "suleiman" &&
                    <Typography variant="caption" color="text.secondary">苏莱曼一世在位时，奥斯曼可保留两张本国牌。</Typography>}
                <Typography variant="caption" color="text.secondary">{scenarioName(G.scenario)}</Typography>
            </ActionGroup>
        </Stack>
    );
};
