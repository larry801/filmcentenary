import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import {ActionGroup} from "../../theme";
import {POWER_NAMES, CONTROLLER_COLORS, POWERS, baseVp} from "../../constant/general";
import {controlledKeys, powerVp, religiousSpecialVp} from "../../util";
import {ownerOf, isActivatedMajor} from "../../ownership";
import {HRE_RELIGIOUS_PREFERENCE_NAMES} from "../../constant/general";
import {hreReligiousVp} from "../../util";
import {cardById} from "../../constant/cards";
import {protestantSpaceCount} from "../../util";
import {scenarioName} from "../../scenario";
import {POWER_INFO} from "../../constant/general";

export const IntelSidebar = (props: any) => {
    const {G, ctx, me, ps, playerID, panelProps} = props;
    
    return (
        <section className="vq-panel vq-intel" {...panelProps("intel")}>
            <ActionGroup title="列强概览">
                {POWERS.map((p: string) => (
                    <Stack key={p} direction="row" spacing={0.5} sx={{alignItems: "center", mb: 0.25}}>
                        <Box sx={{width: 10, height: 10, bgcolor: (CONTROLLER_COLORS as any)[p], borderRadius: 0.5}}/>
                        <Typography variant="caption" sx={{minWidth: 72}}>
                            {(POWER_NAMES as any)[p].short} · {ownerOf(G, p) === undefined ? "未激活" : `P${Number(ownerOf(G, p)) + 1}`}
                        </Typography>
                        {isActivatedMajor(G, p) && 
                            <Chip size="small" variant="outlined" label={ownerOf(G, p) === undefined ? "待激活" : "激活"}/>}
                        <Chip size="small" label={`${powerVp(G, p)} VP`}/>
                        {p === "hre" && G.hreReligiousPreferenceChosen && 
                            <Chip size="small" variant="outlined"
                                label={G.hreReligiousPreference !== undefined && (me === "hre" || G.hreReligiousPreferenceRevealed)
                                    ? `${G.hreReligiousPreferenceRevealed ? "已公开" : "秘密"}：${HRE_RELIGIOUS_PREFERENCE_NAMES[G.hreReligiousPreference]} · ${hreReligiousVp(G)} VP${G.hreReligiousPreferenceRevealed ? "" : "（未计入）"}`
                                    : "宗教倾向已秘密选择"}/>}
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, p).length}K`}/>
                        <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}牌`}/>
                        {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                            <Chip size="small" variant="outlined" label={`面朝下 ${G.homeCardSetAsideCounts?.[p]}`}/>}
                        {G.powers[p].wars.length > 0 && 
                            <Typography variant="caption" color="text.secondary">
                                战:{G.powers[p].wars.map((w: string) => (POWER_NAMES as any)[w].short).join("/")}
                            </Typography>}
                    </Stack>
                ))}
            </ActionGroup>
            {me !== undefined && ps !== undefined && 
                <ActionGroup title="我的势力">
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: (CONTROLLER_COLORS as any)[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{(POWER_NAMES as any)[me].zh}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} 关键城市`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        统治者：{ps.ruler === "elizabethDead" ? "伊丽莎白逝世后的继任政府" : 
                            (require("../../constant/general").RULER_NAMES[ps.ruler] ?? POWER_INFO[me].ruler.name)}（行政 {ps.ruler === "elizabethDead" ? 1 : POWER_INFO[me].ruler.admin} / 额外牌 {ps.ruler === "elizabethDead" ? 0 : POWER_INFO[me].ruler.cardBonus}）
                        · 基础 {baseVp(G, me)} + 宗教 {religiousSpecialVp(G, me)} + 奖励 {ps.bonusVp}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                        <Typography variant="caption">战争：{ps.wars.length > 0 ? ps.wars.map((w: string) => (POWER_NAMES as any)[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">同盟：{ps.allies.length > 0 ? ps.allies.map((w: string) => (POWER_NAMES as any)[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">宝藏：{ps.treasures.length}</Typography>
                    </Stack>
                </ActionGroup>
            }
            {G.espionage?.inspections.filter((entry: any) => playerID !== null && ownerOf(G, entry.viewer) === playerID).map((entry: any) =>
                <ActionGroup key={`${entry.viewer}:${entry.target}`} title={`秘密情报 · ${(POWER_NAMES as any)[entry.target].zh}手牌快照`}>
                    <Typography variant="caption">仅你可见；记录查看时的手牌，不随对方后续行动更新。</Typography>
                    {entry.cards.map((id: string) => <Typography key={id} variant="body2">{cardById(id).name} · {cardById(id).cp} CP</Typography>)}
                </ActionGroup>
            )}
            <ActionGroup title={`对局日志 · ${G.log.length}`}>
                {G.lastRolls && <Typography variant="body2">最近掷骰：{G.lastRolls}</Typography>}
                <List dense disablePadding>{G.log.slice(-30).reverse().map((line: string, index: number) => 
                    <ListItem key={index} disableGutters sx={{py: 0.5}}>
                        <Typography variant="caption">{line}</Typography>
                    </ListItem>
                )}</List>
            </ActionGroup>
            <ActionGroup title="场景与胜利条件">
                <Typography variant="body2">{scenarioName(G.scenario)} · 牌堆 {G.deckCount ?? 0} · 新教地区 {protestantSpaceCount(G)}</Typography>
                {G.scenario === "tutorial" && <>
                    <Typography variant="body2">奥斯曼：军事胜利立即获胜；回合结束达到 20 VP 获胜。第 3 回合结束未达成则西班牙获胜。</Typography>
                    <Typography variant="body2">奥斯曼 {powerVp(G, "ottoman")} VP（关键城市 {baseVp(G, "ottoman")}，无动荡要塞 {require("../../tutorial").tutorialFortressVp(G)}，其他 {G.powers.ottoman.bonusVp}）。剩余回合：{Math.max(0, 4 - G.year)}。</Typography>
                </>}
            </ActionGroup>
        </section>
    );
};
