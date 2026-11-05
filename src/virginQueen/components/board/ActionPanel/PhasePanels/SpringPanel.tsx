import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {cardById} from "../../../../constant/cards";
import {homeCardChoiceRequired, keepsBothHomeCards, hreReligiousPreferenceRequired} from "../../../../util";
import {HRE_RELIGIOUS_PREFERENCE_NAMES, HreReligiousPreference, hreReligiousPreferenceName} from "../../../../constant/general";
import {LEADER_BY_ID, SEA_CAPTAIN_LEADER_BY_CAPTAIN} from "../../../../constant/leaders";
import {seaCaptainById, seaCaptainName} from "../../../../scenario";
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
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.spring;
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
                <Typography variant="subtitle2">{e.navalReturn}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.navalReturnDesc}
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
                <Typography variant="subtitle2">{e.secretPref}</Typography>
                <Typography variant="caption" color="text.secondary">{e.secretPrefDesc}</Typography>
                <Stack direction="row" spacing={0.5}>
                    {(Object.keys(HRE_RELIGIOUS_PREFERENCE_NAMES) as HreReligiousPreference[]).map((preference) =>
                        <Button key={preference} size="small" variant="outlined" disabled={!myTurn}
                                onClick={() => moves.chooseHreReligiousPreference({preference})}>
                            {hreReligiousPreferenceName(preference, vqLocale)}
                        </Button>
                    )}
                </Stack>
            </Stack>}
            <Typography variant="body2">
                {e.springDeploy}: {choiceRequired && e.springDeployChoice}
            </Typography>
            {mayKeepBoth && <Typography variant="caption" color="success.main">
                {e.suleiman}
            </Typography>}
            {choiceRequired && <Stack spacing={0.5}>
                <Typography variant="subtitle2">{e.chooseHomeCard}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.chooseHomeCardDesc}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {springHomeCards.map((id: string) => <Button key={id} size="small" variant="outlined"
                                                       disabled={!myTurn}
                                                       onClick={() => moves.chooseHomeCard({cardId: id})}>
                        {e.keep} {cardById(id).name}
                    </Button>)}
                </Stack>
            </Stack>}
            {me && G.powers[me]?.homeCardSetAside?.length > 0 && <Typography variant="caption" color="text.secondary">
                {e.faceDown}: {(G.powers[me].homeCardSetAside ?? []).map((id: string) => cardById(id).name).join("、")}
            </Typography>}
            {me === "england" && <Stack spacing={0.5}>
                <Typography variant="subtitle2">{e.seaCaptain}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {e.seaCaptainDesc}
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-sea-captain">{e.seaCaptain}</InputLabel>
                    <Select labelId="vq-sea-captain" label={e.seaCaptain} value={seaCaptainChoice}
                            onChange={(ev) => setSeaCaptainChoice(ev.target.value)}>
                        {G.powers.england.seaCaptains.filter((id: string) => SEA_CAPTAIN_LEADER_BY_CAPTAIN[id] &&
                            (seaCaptainById(id)?.turn ?? 99) <= G.year &&
                            G.leaders[SEA_CAPTAIN_LEADER_BY_CAPTAIN[id]] === undefined)
                            .map((id: string) => <MenuItem key={id} value={id}>{seaCaptainName(seaCaptainById(id), vqLocale) || id}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-sea-captain-port">{e.port}</InputLabel>
                    <Select labelId="vq-sea-captain-port" label={e.port} value={seaCaptainPort}
                            onChange={(ev) => setSeaCaptainPort(ev.target.value)}>
                        {require("../../../../mapData").SPACES.filter((space: any) => space.control === "england" && spaceHomes(space).includes("england") &&
                            (space.ports?.length ?? 0) > 0 && navalCount(G.spaces[space.id].naval.england) > 0)
                            .map((space: any) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button size="small" variant="outlined" disabled={!myTurn || seaCaptainChoice === "" || seaCaptainPort === ""}
                    onClick={() => moves.placeSeaCaptainLeader({captain: seaCaptainChoice, port: seaCaptainPort})}>
                    {e.placeCaptain}
                </Button>
            </Stack>}
            {me === "spain" && <Stack spacing={0.5}>
                <Typography variant="subtitle2">{e.treasureFleet}</Typography>
                <Typography variant="caption" color="text.secondary">{e.treasureFleetDesc}</Typography>
                <Stack direction="row" spacing={0.5}>
                    {[0, 1, 2].map((count) => <Button key={count} size="small" variant="outlined"
                        disabled={!myTurn || (G.treasureFleetEscorts ?? 0) === count}
                        onClick={() => moves.setTreasureFleetEscorts({count})}>{e.escort} {count}</Button>)}
                </Stack>
            </Stack>}
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-spring-mode">{e.action}</InputLabel>
                <Select labelId="vq-spring-mode" label={e.action} value={mode}
                        onChange={(ev) => {
                            setMode(ev.target.value);
                            props.setFrom(null);
                        }}>
                    <MenuItem value="inspect">{e.inspect}</MenuItem>
                    <MenuItem value="spring">{e.springDeploy}</MenuItem>
                </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
                {e.capital}: {me === "hre" && G.hreCapital !== undefined ? SPACE_BY_ID[G.hreCapital]?.name ?? G.hreCapital : me === "protestant" && G.protestantCapital !== undefined ? SPACE_BY_ID[G.protestantCapital]?.name ?? G.protestantCapital : CAPITAL_SPACES_UI[me] ?? ""} {from !== null ? `· ${e.origin} ${SPACE_BY_ID[from]?.name}` : ""}
            </Typography>
            <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired || preferenceRequired || navalPortChoices.length > 0} onClick={() => moves.endPhaseTurn()}>
                {e.endSpring}
            </Button>
        </Stack>
    );
};
