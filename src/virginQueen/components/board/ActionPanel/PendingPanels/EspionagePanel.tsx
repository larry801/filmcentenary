import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {espionageOptions} from "../../../../espionage";

export const PendingEspionagePanel = (props: any) => {
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>谍报结算 · 等待 {POWER_NAMES[G.pendingEspionage.responding].zh} 选择。</Typography>
            <Typography variant="body2">
                {G.pendingEspionage.step === "responses" ? "可在掷骰前使用响应牌。" :
                 G.pendingEspionage.step === "offense" ? `剩余 ${G.pendingEspionage.remaining} 次情报效果，每种效果最多一次。` :
                 G.pendingEspionage.step === "conversions" ? `在英格兰分配${G.pendingEspionage.conversionSide === "protestant" ? "新教" : "天主教"}转化骰；可用 6 点扩展基础，或保留至最后转化有部队的地区。` :
                 G.pendingEspionage.step === "rebelLosses" ? `英格兰还需分配 ${G.pendingEspionage.remaining} 次损失。` :
                 G.pendingEspionage.step === "massacreConvert" ? `圣巴托罗缪大屠杀：还可将 ${G.pendingEspionage.remaining} 个法国政治控制的新教地区改为天主教。` :
                 G.pendingEspionage.step === "massacreAssassinate" ? `法国可免费对科利尼进行一次 ${G.pendingEspionage.cp} CP 刺杀。` :
                 G.pendingEspionage.step === "northernConvert" ? `北方崛起：西班牙再选择 ${G.pendingEspionage.remaining} 个英格兰地区改为天主教（无新教部队，距事件开始时的天主教地区 2 格内）。` :
                 G.pendingEspionage.step === "northernUnrest" ? `北方崛起：西班牙未与英格兰交战，再放置 ${G.pendingEspionage.remaining} 个动荡（无人占领或天主教地区）。` :
                 "选择下方合法选项，完成官方结果表的后续结算。"}
            </Typography>
            {ownerOf(G, G.pendingEspionage.responding) === playerID && espionageOptions(G).map((entry: any) =>
                <Button key={entry.id} variant="outlined" onClick={() => moves.chooseEspionage({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
