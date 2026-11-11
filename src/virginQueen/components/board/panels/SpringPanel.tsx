import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {HRE_RELIGIOUS_PREFERENCE_NAMES, hreReligiousPreferenceName, HreReligiousPreference, navalCount, spaceHomes} from "../../../constant/general";
import {cardById, cardName} from "../../../constant/cards";
import {SEA_CAPTAIN_LEADER_BY_CAPTAIN} from "../../../constant/leaders";
import {seaCaptainById, seaCaptainName} from "../../../scenario";
import {SPACES} from "../../../mapData";
import {capitalSpacesFor, homeCardChoiceRequired, hreReligiousPreferenceRequired, keepsBothHomeCards} from "../../../util";

import {leaderLabel, placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const SpringPanel = () => {
    const {G, moves, vqLocale, from, seaCaptainChoice, setSeaCaptainChoice, seaCaptainPort, setSeaCaptainPort, me, myTurn, ps, hand, hotseatWaitHint, stackPicker, space} = useVQBoard();
    if (me === undefined) return null;
    const springHomeCards = hand.filter((id) => cardById(id).kind === "home");
    const choiceRequired = homeCardChoiceRequired(G, me);
    const preferenceRequired = hreReligiousPreferenceRequired(G, me);
    const mayKeepBoth = keepsBothHomeCards(G, me);
    const navalPortChoices = (G.navalLeaderArrivals ?? []).filter((entry) => entry.power === me);
    return <Stack spacing={1}>
        {hotseatWaitHint() !== undefined && <Typography variant="body2" color="text.secondary">{hotseatWaitHint()}</Typography>}
        {navalPortChoices.length > 0 && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "warning.main", borderRadius: 1}}>
            <Typography variant="subtitle2">{i18n.chain.vq.spring.navalReturn}</Typography>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.spring.navalReturnDesc}
            </Typography>
            {navalPortChoices.map((entry) => <Stack key={entry.leader} spacing={0.5}>
                <Typography variant="body2">{leaderLabel(entry.leader)}</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {entry.ports.map((port) => <Button key={port} size="small" variant="outlined" disabled={!myTurn}
                        onClick={() => moves.chooseNavalLeaderPort({leader: entry.leader, port})}>
                        {placeLabel(port)}
                    </Button>)}
                </Stack>
            </Stack>)}
        </Stack>}
        {preferenceRequired && <Stack spacing={0.5}>
            <Typography variant="subtitle2">{i18n.chain.vq.spring.secretPref}</Typography>
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.spring.secretPrefDesc}</Typography>
            <Stack direction="row" spacing={0.5}>
                {(Object.keys(HRE_RELIGIOUS_PREFERENCE_NAMES) as HreReligiousPreference[]).map((preference) =>
                    <Button key={preference} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseHreReligiousPreference({preference})}>
                        {hreReligiousPreferenceName(preference, vqLocale)}
                    </Button>)}
            </Stack>
        </Stack>}
        <Typography variant="body2">
            {choiceRequired ? i18n.chain.vq.springUi.deployHintChoice : i18n.chain.vq.springUi.deployHint}
        </Typography>
        {mayKeepBoth && <Typography variant="caption" color="success.main">
            {i18n.chain.vq.spring.suleiman}
        </Typography>}
        {choiceRequired && <Stack spacing={0.5}>
            <Typography variant="subtitle2">{i18n.chain.vq.spring.chooseHomeCard}</Typography>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.spring.chooseHomeCardDesc}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {springHomeCards.map((id) => <Button key={id} size="small" variant="outlined"
                                                   disabled={!myTurn}
                                                   onClick={() => moves.chooseHomeCard({cardId: id})}>
                    {i18n.chain.vq.spring.keep} {cardName(id, vqLocale)}
                </Button>)}
            </Stack>
        </Stack>}
        {ps !== undefined && (ps.homeCardSetAside?.length ?? 0) > 0 && <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.spring.faceDown}: {(ps.homeCardSetAside ?? []).map((id) => cardName(id, vqLocale)).join(", ")}
        </Typography>}
        {me === "england" && <Stack spacing={0.5}>
            <Typography variant="subtitle2">{i18n.chain.vq.spring.seaCaptain}</Typography>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.spring.seaCaptainDesc}
            </Typography>
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-sea-captain">{i18n.chain.vq.springUi.seaCaptain}</InputLabel>
                <Select labelId="vq-sea-captain" label={i18n.chain.vq.springUi.seaCaptain} value={seaCaptainChoice}
                        onChange={(e) => setSeaCaptainChoice(e.target.value)}>
                    {G.powers.england.seaCaptains.filter((id) => SEA_CAPTAIN_LEADER_BY_CAPTAIN[id] &&
                        (seaCaptainById(id)?.turn ?? 99) <= G.year &&
                        G.leaders[SEA_CAPTAIN_LEADER_BY_CAPTAIN[id]] === undefined)
                        .map((id) => <MenuItem key={id} value={id}>{seaCaptainName(seaCaptainById(id), vqLocaleNow()) || id}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-sea-captain-port">{i18n.chain.vq.spring.port}</InputLabel>
                <Select labelId="vq-sea-captain-port" label={i18n.chain.vq.spring.port} value={seaCaptainPort}
                        onChange={(e) => setSeaCaptainPort(e.target.value)}>
                    {SPACES.filter((space) => space.control === "england" && spaceHomes(space).includes("england") &&
                        (space.ports?.length ?? 0) > 0 && navalCount(G.spaces[space.id].naval.england) > 0)
                        .map((space) => <MenuItem key={space.id} value={space.id}>{placeLabel(space.id)}</MenuItem>)}
                </Select>
            </FormControl>
            <Button size="small" variant="outlined" disabled={!myTurn || seaCaptainChoice === "" || seaCaptainPort === ""}
                onClick={() => moves.placeSeaCaptainLeader({captain: seaCaptainChoice, port: seaCaptainPort})}>
                {i18n.chain.vq.spring.placeCaptain}
            </Button>
        </Stack>}
        {me === "spain" && <Stack spacing={0.5}>
            <Typography variant="subtitle2">{i18n.chain.vq.spring.treasureFleet}</Typography>
            <Typography variant="caption" color="text.secondary">{i18n.chain.vq.spring.treasureFleetDesc}</Typography>
            <Stack direction="row" spacing={0.5}>
                {[0, 1, 2].map((count) => <Button key={count} size="small" variant="outlined"
                    disabled={!myTurn || (G.treasureFleetEscorts ?? 0) === count}
                    onClick={() => moves.setTreasureFleetEscorts({count})}>{i18n.chain.vq.spring.escort} {count}</Button>)}
            </Stack>
        </Stack>}
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.spring.capital}: {(me !== undefined ? capitalSpacesFor(G, me) : []).map((id) => placeLabel(id)).join(" / ")} {from !== null ? `· ${i18n.chain.vq.spring.origin} ${placeLabel(from)}` : ""}
        </Typography>
        {from !== null && <Stack spacing={0.5}>
            <Typography variant="caption">{i18n.chain.vq.board.moveHint}</Typography>
            {stackPicker(true)}
        </Stack>}
        <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired || preferenceRequired || navalPortChoices.length > 0} onClick={() => moves.endPhaseTurn()}>
            {i18n.chain.vq.spring.endSpring}
        </Button>
    </Stack>;
};
