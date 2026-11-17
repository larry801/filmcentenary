import React from "react";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import LinkIcon from "@mui/icons-material/Link";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FlagIcon from "@mui/icons-material/Flag";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListItem from "@mui/material/ListItem";
import List from "@mui/material/List";
import Box from "@mui/material/Box";
import SvgIcon from "@mui/material/SvgIcon";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import {
    ActionPointIcon,
    CardIcon,
    CardToArchiveIcon,
    FreeBreakthroughIcon,
    BuyCardForFreeIcon,
    NormalCardIcon,
    IndustryCardIcon,
    AestheticsCardIcon,
    LegendCardIcon,
    BasicCardIcon,
    FilmCardIcon,
    PersonCardIcon,
    DrawnShareIcon,
    ChampionIcon,
    DevelopmentAwardBadge,
    DiscardIconHelper,
} from "./icons";
import { Region, IEra } from "../types/core";
import "./manual-page.css";

const Icon = ({ children }: { children: React.ReactNode }) => (
    <ListItemIcon style={{ minWidth: 36, color: "#1976d2" }}>{children}</ListItemIcon>
);

const StepItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <ListItem dense disableGutters>
        <Icon>{icon}</Icon>
        <ListItemText primary={text} />
    </ListItem>
);

const ManualPage = () => {
    return (
        <Grid container className="manual-page" spacing={2}>
            <Grid size={12}>
                <Typography variant="h4" gutterBottom>使用手册 / User Manual</Typography>
            </Grid>

            <Grid size={12}><Divider /></Grid>

            {/* 如何使用 */}
            <Grid size={{xs: 12, md: 6}}>
                <Typography variant="h5" gutterBottom>如何使用？ / How to Use</Typography>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6">作为房主 / As Host</Typography>
                    <List dense>
                        <StepItem icon={<NormalCardIcon />} text="1. 选择人数，点击【创建游戏】" />
                        <StepItem icon={<ShuffleIcon fontSize="small" />} text="2. 选择【完全随机】" />
                        <StepItem icon={<LinkIcon fontSize="small" />} text="3. 点击底部【复制邀请链接】，分发给每位玩家" />
                        <StepItem icon={<BasicCardIcon />} text="4. 点击【展示牌列】" />
                    </List>
                </Box>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6">作为玩家 / As Player</Typography>
                    <List dense>
                        <StepItem icon={<LinkIcon fontSize="small" />} text="1. 进入邀请链接" />
                        <StepItem icon={<BasicCardIcon />} text="2. 等待【展示牌列】" />
                    </List>
                </Box>
            </Grid>

            {/* 如何操作 */}
            <Grid size={{xs: 12, md: 6}}>
                <Typography variant="h5" gutterBottom>如何操作？ / How to Operate</Typography>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6">卡牌 UI / Card UI</Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>从左到右：</Typography>
                    <List dense>
                        <StepItem icon={<SvgIcon fontSize="small" viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" fill="currentColor"/></SvgIcon>} text="【打出】— 使用卡牌效果" />
                        <StepItem icon={<span style={{display:"inline-flex",alignItems:"center",gap:2}}><CardToArchiveIcon /><ArrowUpwardIcon fontSize="small" /></span>} text="【突破】— 存款0 / 存款1 / 存款2 三种突破方式" />
                    </List>
                </Box>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6">玩家操作界面 UI</Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>从上到下：</Typography>
                    <List dense>
                        <StepItem icon={<UndoIcon fontSize="small" />} text="【撤回】已执行的操作" />
                        <StepItem icon={<RedoIcon fontSize="small" />} text="【恢复】已撤销的操作" />
                        <StepItem icon={<FlagIcon fontSize="small" color="error" />} text="红色【投降】（功能不完善，请勿使用）" />
                        <StepItem icon={<ActionPointIcon />} text="【使用行动力抽牌】— 消耗 1 行动力摸 1 张牌" />
                        <StepItem icon={<SkipNextIcon fontSize="small" />} text="【结束回合】— 进入恢复阶段" />
                        <StepItem icon={<CardIcon />} text="【选择效果】【自动XX】— 《传世经典》打出时的自动选项" />
                    </List>
                </Box>
            </Grid>

            <Grid size={12}><Divider /></Grid>

            {/* 卡牌图标速查 */}
            <Grid size={12}>
                <Typography variant="h5" gutterBottom>卡牌图标速查 / Card Icon Reference</Typography>
                <List dense className="manual-icon-ref">
                    <StepItem icon={<BasicCardIcon />} text="基础卡 — 文艺片/商业片/B级片/烂片/传世经典/资金" />
                    <StepItem icon={<LegendCardIcon />} text="传奇卡 (★) — 金色边框传奇" />
                    <StepItem icon={<NormalCardIcon />} text="普通卡 — 白色边框普通" />
                    <StepItem icon={<IndustryCardIcon />} text="工业标记" />
                    <StepItem icon={<AestheticsCardIcon />} text="美学标记" />
                    <StepItem icon={<DrawnShareIcon r={Region.NA} />} text="地区份额" />
                    <StepItem icon={<ChampionIcon champion={{ era: IEra.ONE, region: Region.NA }} />} text="第一名指示物 — 1/2/3 数字图标" />
                </List>
            </Grid>

            <Grid size={12}><Divider /></Grid>

            {/* 选项 */}
            <Grid size={{xs: 12, md: 6}}>
                <Typography variant="h5" gutterBottom>选项 / Options</Typography>

                <Typography variant="h6">行动顺序 / Turn Order</Typography>
                <List dense>
                    <StepItem icon={<ShuffleIcon fontSize="small" />} text="完全随机 — 打乱所有人顺序" />
                    <StepItem icon={<ShuffleIcon fontSize="small" />} text="匿名随机 — 匿名 + 完全随机" />
                </List>

                <Typography variant="h6">自定义选项</Typography>
                <List dense>
                    <StepItem icon={<CheckBoxOutlineBlankIcon fontSize="small" />} text="流派扩复选框 — 启用/禁用各个扩展" />
                    <StepItem icon={<RadioButtonUncheckedIcon fontSize="small" />} text="全部发放 / 每时代2个" />
                </List>
                <Box sx={{mt: 1}}>
                    <Typography variant="subtitle2">流派扩购买规则：</Typography>
                    <List dense>
                        <StepItem icon={<NormalCardIcon />} text="杨 - 流派扩：仅限地区时代 = 流派时代时才可购买" />
                        <StepItem icon={<NormalCardIcon />} text="其他流派扩：仅限地区时代 ≥ 流派时代时才可购买" />
                        <StepItem icon={<NormalCardIcon />} text="每局游戏只能购买 1 个流派（无论来自哪个扩展）" />
                    </List>
                </Box>
            </Grid>

            <Grid size={{xs: 12, md: 6}}>
                <Typography variant="h6" style={{ marginTop: 0 }}>流派扩模式说明</Typography>
                <List dense>
                    <StepItem icon={<RadioButtonUncheckedIcon fontSize="small" />} text="全部发放 — 所有启用的流派全部放入对应扩展区域" />
                    <StepItem icon={<RadioButtonUncheckedIcon fontSize="small" />} text="每时代2个 — 每个时代从启用扩展中各抽 2 张放入【流派扩】区域" />
                </List>
            </Grid>

            <Grid size={12}><Divider /></Grid>

            {/* 功能 */}
            <Grid size={{xs: 12, md: 6}}>
                <Typography variant="h5" gutterBottom>功能 / Features</Typography>

                <Typography variant="h6">自定义命名</Typography>
                <List dense>
                    <StepItem icon={<SvgIcon fontSize="small" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></SvgIcon>} text="右上角填写玩家名，对局内如需改名，请先【离开】再重新【加入】" />
                </List>

                <Typography variant="h6">地区聚焦</Typography>
                <List dense>
                    <StepItem icon={<CenterFocusStrongIcon fontSize="small" />} text="点击地区按钮选中某个地区，仅显示该地区" />
                    <StepItem icon={<span style={{fontFamily:"monospace",fontWeight:"bold",fontSize:14}}>A/D</span>} text="按 A / D 键快捷切换地区" />
                </List>
            </Grid>
        </Grid>
    );
};

export default ManualPage;
