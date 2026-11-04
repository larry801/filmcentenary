import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES} from "../../../../constant/general";
import {cardById} from "../../../../constant/cards";
import {homeCardChoiceRequired, keepsBothHomeCards, hreReligiousPreferenceRequired} from "../../../../util";
import {HRE_RELIGIOUS_PREFERENCE_NAMES, HreReligiousPreference} from "../../../../constant/general";
import {LEADER_BY_ID, SEA_CAPTAIN_LEADER_BY_CAPTAIN} from "../../../../constant/leaders";
import {seaCaptainById} from "../../../../scenario";
import {SPACE_BY_ID} from "../../../../mapData";
import {spaceHomes} from "../../../../constant/general";
import {navalCount} from "../../../../constant/general";

const CAPITAL_SPACES_UI: any = {
    ottoman: "Istanbul",
    spain: "Madrid / Milan",
    england: "London",
    france: "Paris",
    hre: "Vienna",
    protestant: "La Rochelle / Amsterdam",
};

export const SpringPanel = (props: any) => {
    const {G, moves, me, myTurn, hand, mode, setMode, from} = props;
    const {seaCaptainChoice, setSeaCaptainChoice, seaCaptainPort, setSeaCaptainPort} = props;
    const springHomeCards = hand.filter((id: string) => cardById(id).kind === "home");
    const choiceRequired = homeCardChoiceRequired(G, me);
    const preferenceRequired = hreReligiousPreferenceRequired(G, me);
    const mayKeepBoth = keepsBothHomeCards(G, me);
    const navalPortChoices = (G.navalLeaderArrivals ?? []).filter((entry: any) => entry.power === me);
    
    return (
        <Stack spacing={1}>
            {navalPortChoices.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
                <Typography variant="subtitle2">海军将领归国：选择港口</Typography>
                <Typography variant="caption" color="text.secondary">
                    从船池返回的海军将领必须先选择一个合法的本土港口，才能继续春季部署。
                </Typography>
                {navalPortChoices.map((entry: any) => <Stack key={entry.leader} spacing={0.5}>
                    <Typography variant="body2">{LEADER_BY_ID[entry.leader]?.name ?? entry.leader}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {entry.ports.map((port: string) => <Button key={port} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseNavalLeaderPort({leader: entry.leader, port})}>
                            {SPACE_BY_ID[port]?.name ?? port}
                        </Button>)}
                    </Stack>
                </Stack>)}
            </Stack>}
            {preferenceRequired && <Stack spacing={0.5}>
                <Typography variant="subtitle2">秘密宗教倾向</Typography>
                <Typography variant="caption" color="text.secondary">首回合选择一次；胜利判定时足以取胜或阻止他国支配胜利才会公开。</Typography>
                <Stack direction="row" spacing={0.5}>
                    {(Object.keys(HRE_RELIGIOUS_PREFERENCE_NAMES) as HreReligiousPreference[]).map((preference) =>
                        <Button key={preference} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseHreReligiousPreference({preference})}>
                            {HRE_RELIGIOUS_PREFERENCE_NAMES[preference]}
                        </Button>
                    )}
                </Stack>
            </Stack>}
            <Typography variant="body2">
                春季部署：{choiceRequired && "先秘密选择本回合保留的本国牌（未选中的面朝下放在势力卡上），然后"}可从首都免费调动一支陆军编队。
            </Typography>
            {mayKeepBoth && <Typography variant="caption" color="success.main">
                苏莱曼一世在位：奥斯曼可保留两张本国牌，无需二选一。
            </Typography>}
            {choiceRequired && <Stack spacing={0.5}>
                <Typography variant="subtitle2">选择保留的本国牌</Typography>
                <Typography variant="caption" color="text.secondary">
                    其余本国牌将面朝下放在势力卡上，直到下一年的 Card Draw。
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {springHomeCards.map((id: string) => <Button key={id} size="small" variant="outlined"
                                                       disabled={!myTurn}
                                                       onClick={() => moves.chooseHomeCard({cardId: id})}>
                        保留 {cardById(id).name}
                    </Button>)}
                </Stack>
            </Stack>}
            {me && G.powers[me]?.homeCardSetAside?.length > 0 && <Typography variant="caption" color="text.secondary">
                面朝下放在势力卡上：{(G.powers[me].homeCardSetAside ?? []).map((id: string) => cardById(id).name).join("、")}
            </Typography>}
            {me === "england" && <Stack spacing={0.5}>
                <Typography variant="subtitle2">海船长作为海军将领</Typography>
                <Typography variant="caption" color="text.secondary">
                    可把一名英国海船长放到有英国舰队的英国本土港口，作为本回合海军将领；冬季返回海船长池。
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-sea-captain">海船长</InputLabel>
                    <Select labelId="vq-sea-captain" label="海船长" value={seaCaptainChoice}
                            onChange={(e) => setSeaCaptainChoice(e.target.value)}>
                        {G.powers.england.seaCaptains.filter((id: string) => SEA_CAPTAIN_LEADER_BY_CAPTAIN[id] &&
                            (seaCaptainById(id)?.turn ?? 99) <= G.year &&
                            G.leaders[SEA_CAPTAIN_LEADER_BY_CAPTAIN[id]] === undefined)
                            .map((id: string) => <MenuItem key={id} value={id}>{seaCaptainById(id)?.nameEn ?? id}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-sea-captain-port">港口</InputLabel>
                    <Select labelId="vq-sea-captain-port" label="港口" value={seaCaptainPort}
                            onChange={(e) => setSeaCaptainPort(e.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === "england" && spaceHomes(space).includes("england") &&
                            (space.ports?.length ?? 0) > 0 && navalCount(G.spaces[space.id].naval.england) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button size="small" variant="outlined" disabled={!myTurn || seaCaptainChoice === "" || seaCaptainPort === ""}
                    onClick={() => moves.placeSeaCaptainLeader({captain: seaCaptainChoice, port: seaCaptainPort})}>
                    放置海船长
                </Button>
            </Stack>}
            {me === "spain" && <Stack spacing={0.5}>
                <Typography variant="subtitle2">珍宝舰队护航</Typography>
                <Typography variant="caption" color="text.secondary">最多 2 艘大帆船；仅春季调整，且本回合只能单向移动。</Typography>
                <Stack direction="row" spacing={0.5}>
                    {[0, 1, 2].map((count) => <Button key={count} size="small" variant="outlined"
                        disabled={!myTurn || (G.treasureFleetEscorts ?? 0) === count}
                        onClick={() => moves.setTreasureFleetEscorts({count})}>护航 {count}</Button>)}
                </Stack>
            </Stack>}
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-spring-mode">行动</InputLabel>
                <Select labelId="vq-spring-mode" label="行动" value={mode}
                        onChange={(e) => {
                            setMode(e.target.value);
                            props.setFrom(null);
                        }}>
                    <MenuItem value="inspect">查看</MenuItem>
                    <MenuItem value="spring">春季部署</MenuItem>
                </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
                首都：{me === "hre" && G.hreCapital !== undefined ? SPACE_BY_ID[G.hreCapital]?.name ?? G.hreCapital : me === "protestant" && G.protestantCapital !== undefined ? SPACE_BY_ID[G.protestantCapital]?.name ?? G.protestantCapital : CAPITAL_SPACES_UI[me] ?? ""} {from !== null ? `· 起点 ${SPACE_BY_ID[from]?.name}` : ""}
            </Typography>
            <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired || preferenceRequired || navalPortChoices.length > 0} onClick={() => moves.endPhaseTurn()}>
                结束春季部署
            </Button>
        </Stack>
    );
};
