import React from "react";
import {BoardProps} from "boardgame.io/react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {POWER_NAMES, VQGame} from "../constant/general";
import {ownerOf} from "../ownership";
import {tutorialLesson} from "../tutorial";

export const TutorialGuide = ({G, ctx, playerID}: Pick<BoardProps<VQGame>, "G" | "ctx" | "playerID">) => {
    const [expanded, setExpanded] = React.useState(false);
    const contentID = React.useId();
    if (G.scenario !== "tutorial") return null;
    const lesson = tutorialLesson(G, ctx.phase ?? "");
    const owner = lesson && ownerOf(G, lesson.power);
    const finished = ctx.gameover !== undefined;
    const steps = ["确认手牌", "春季部署", "轮流行动"];
    const step = ["cardDraw", "spring", "action"].indexOf(ctx.phase ?? "");
    return <div className="vq-guide">
        <div className="vq-guide-title">双人教学模式 · 勒班陀海战</div>
        <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: "wrap", mb: 1}}>
            {steps.map((label, index) => <Chip key={label} size="small" label={`${index + 1}. ${label}`}
                color={!finished && step === index ? "primary" : "default"}
                variant={!finished && step === index ? "filled" : "outlined"}/>)}
        </Stack>
        <Typography variant="subtitle2">{finished ? "教学结束：回顾本局" : lesson?.title}</Typography>
        {!finished && lesson && <>
            <Typography variant="body2" color={owner === playerID ? "primary" : "text.secondary"} sx={{my: 0.5}}>
                {`当前操作：P${Number(owner) + 1} · ${POWER_NAMES[lesson.power].zh}。`}
                {playerID === null ? "旁观教学：仅查看公开提示。" : owner === playerID
                    ? "轮到你操作。" : `等待对方操作；本地热座请切换到 P${Number(owner) + 1} 标签页。`}
            </Typography>
            <Typography variant="body2">{lesson.instruction}</Typography>
        </>}
        {finished && <Typography variant="body2">可结合胜利结果、双方 VP 和日志回顾出牌、移动与战斗；重新开局即可再次练习。</Typography>}
        <Button size="small" aria-expanded={expanded} aria-controls={contentID} sx={{px: 0}}
                onClick={() => setExpanded(!expanded)}>{expanded ? "收起规则说明" : "展开规则说明"}</Button>
        {expanded && <Stack id={contentID} spacing={1}>
            <Typography variant="body2">P1 控制奥斯曼帝国，P2 控制西班牙；双方各自保留自己的手牌。</Typography>
            <Typography variant="caption" color="text.secondary">
                学习范围：出牌、CP、陆海军、战斗与海盗。外交、宗教、殖民等系统在教学局关闭；地图 × 标记地区不可进入。
                奥斯曼军事胜利立即获胜，或在回合结束达到 20 VP；第三回合结束未达成则西班牙获胜。
            </Typography>
        </Stack>}
    </div>;
};
