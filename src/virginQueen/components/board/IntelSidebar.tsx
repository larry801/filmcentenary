import React from "react";
import i18n from "../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import {ActionGroup} from "../../theme";
import {POWER_NAMES, CONTROLLER_COLORS, POWERS, baseVp, powerName, Power, VQLocale, hreReligiousPreferenceName, rulerName} from "../../constant/general";
import {controlledKeys, powerVp, religiousSpecialVp} from "../../util";
import {ownerOf, isActivatedMajor} from "../../ownership";
import {hreReligiousVp} from "../../util";
import {cardById} from "../../constant/cards";
import {protestantSpaceCount} from "../../util";
import {scenarioName} from "../../scenario";
import {POWER_INFO} from "../../constant/general";

export const IntelSidebar = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, ctx, me, ps, playerID, panelProps} = props;
    const e = i18n.chain.vq.intel;
    return (
        <section className="vq-panel vq-intel" {...panelProps("intel")}>
            <ActionGroup title={e.overview}>
                {POWERS.map((p: string) => (
                    <Stack key={p} direction="row" spacing={0.5} sx={{alignItems: "center", mb: 0.25}}>
                        <Box sx={{width: 10, height: 10, bgcolor: (CONTROLLER_COLORS as any)[p], borderRadius: 0.5}}/>
                        <Typography variant="caption" sx={{minWidth: 72}}>
                            {(POWER_NAMES as any)[p].short} · {ownerOf(G, p) === undefined ? e.unactivated : `P${Number(ownerOf(G, p)) + 1}`}
                        </Typography>
                        {isActivatedMajor(G, p) && 
                            <Chip size="small" variant="outlined" label={ownerOf(G, p) === undefined ? e.pendingActivation : e.activated}/>}
                        <Chip size="small" label={`${powerVp(G, p)} VP`}/>
                        {p === "hre" && G.hreReligiousPreferenceChosen && 
                            <Chip size="small" variant="outlined"
                                label={G.hreReligiousPreference !== undefined && (me === "hre" || G.hreReligiousPreferenceRevealed)
                                    ? `${G.hreReligiousPreferenceRevealed ? e.revealed : e.secret}: ${hreReligiousPreferenceName(G.hreReligiousPreference, vqLocale)} · ${hreReligiousVp(G)} VP${G.hreReligiousPreferenceRevealed ? "" : e.notCounted}`
                                    : e.secretChosen}/>}
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, p).length}K`}/>
                        <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}${e.cards}`}/>
                        {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                            <Chip size="small" variant="outlined" label={`${e.faceDown} ${G.homeCardSetAsideCounts?.[p]}`}/>}
                        {G.powers[p].wars.length > 0 && 
                            <Typography variant="caption" color="text.secondary">
                                {e.war}:{G.powers[p].wars.map((w: string) => (POWER_NAMES as any)[w].short).join("/")}
                            </Typography>}
                    </Stack>
                ))}
            </ActionGroup>
            {me !== undefined && ps !== undefined && 
                <ActionGroup title={e.myPower}>
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: (CONTROLLER_COLORS as any)[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{powerName(me as Power, vqLocale)}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} ${e.keys}`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        {e.ruler}: {ps.ruler === "elizabethDead" ? e.elizabethDead : rulerName(ps.ruler, vqLocale)} ({e.admin} {ps.ruler === "elizabethDead" ? 1 : POWER_INFO[me].ruler.admin} / {e.extraCards} {ps.ruler === "elizabethDead" ? 0 : POWER_INFO[me].ruler.cardBonus})
                        · {e.base} {baseVp(G, me)} + {e.religion} {religiousSpecialVp(G, me)} + {e.bonus} {ps.bonusVp}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                        <Typography variant="caption">{e.wars}: {ps.wars.length > 0 ? ps.wars.map((w: string) => (POWER_NAMES as any)[w].short).join(", ") : e.none}</Typography>
                        <Typography variant="caption">{e.allies}: {ps.allies.length > 0 ? ps.allies.map((w: string) => (POWER_NAMES as any)[w].short).join(", ") : e.none}</Typography>
                        <Typography variant="caption">{e.treasures}: {ps.treasures.length}</Typography>
                    </Stack>
                </ActionGroup>
            }
            {G.espionage?.inspections.filter((entry: any) => playerID !== null && ownerOf(G, entry.viewer) === playerID).map((entry: any) =>
                <ActionGroup key={`${entry.viewer}:${entry.target}`} title={`${e.secretIntel} · ${powerName(entry.target as Power, vqLocale)}${e.handSnapshot}`}>
                    <Typography variant="caption">{e.onlyYou}</Typography>
                    {entry.cards.map((id: string) => <Typography key={id} variant="body2">{cardById(id).name} · {cardById(id).cp} CP</Typography>)}
                </ActionGroup>
            )}
            <ActionGroup title={`${e.log} · ${G.log.length}`}>
                {G.lastRolls && <Typography variant="body2">{e.lastRolls}: {G.lastRolls}</Typography>}
                <List dense disablePadding>{G.log.slice(-30).reverse().map((line: string, index: number) => 
                    <ListItem key={index} disableGutters sx={{py: 0.5}}>
                        <Typography variant="caption">{line}</Typography>
                    </ListItem>
                )}</List>
            </ActionGroup>
            <ActionGroup title={e.scenario}>
                <Typography variant="body2">{scenarioName(G.scenario)} · {e.deck} {G.deckCount ?? 0} · {e.protestantSpaces} {protestantSpaceCount(G)}</Typography>
                {G.scenario === "tutorial" && <>
                    <Typography variant="body2">{e.tutorialOttoman}</Typography>
                    <Typography variant="body2">{e.tutorialOttoman2} {powerVp(G, "ottoman")} VP（{e.keys} {baseVp(G, "ottoman")}，{e.fortress} {require("../../tutorial").tutorialFortressVp(G)}，{e.other} {G.powers.ottoman.bonusVp}）。{e.remainingTurns} {Math.max(0, 4 - G.year)}。</Typography>
                </>}
            </ActionGroup>
        </section>
    );
};
