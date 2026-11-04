import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cardById} from "../../../../constant/cards";
import {cardEventOptions} from "../../../../cardEvents";

export const PendingCardEventPanel = (props: any) => {
    const {G, moves, playerID, ctx} = props;
    return (
        <Stack spacing={1}>
            <Typography>{G.pendingCardEvent.kind === "cancelEvent" ? "事件响应" : "大维齐尔"} · 等待奥斯曼帝国选择。</Typography>
            {G.pendingCardEvent.kind === "cancelEvent" ? 
                <Typography variant="body2">
                    {cardById(G.pendingCardEvent.cardId).name} 尚未结算；可打出大维齐尔取消此事件。
                </Typography> : 
                G.pendingCardEvent.step === "recruit" ? 
                <Typography variant="body2">
                    还可增加 {G.pendingCardEvent.remaining} 个单位。正规军可放入合法家乡地区或境外战争；桨帆船限爱琴海家乡港口。
                </Typography> : 
                <Typography variant="body2">
                    选择增募单位或尝试建造运河。苏伊士运河仅限 5～6 人局；取消事件在其他事件结算前选择。
                </Typography>
            }
            {G.pendingCardEvent.kind === "grandVizier" && G.pendingCardEvent.step === "effect" && ctx.numPlayers >= 5 &&
                !G.suezDone && 
                <Typography variant="body2">
                    运河判定：掷 1 骰，加累计失败 {G.suezAttempts} 次{G.powers.ottoman.scienceBonuses.includes("excavation") ? "，再加挖掘奖励 2" : ""}，达到 6 即成功；奖励 2 VP 和永久抽牌 +1。
                </Typography>
            }
            {ownerOf(G, G.pendingCardEvent.responding) === playerID && cardEventOptions(G, ctx.numPlayers).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseCardEvent({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
