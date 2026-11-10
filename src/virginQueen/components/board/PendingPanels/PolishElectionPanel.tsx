import React from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, VQGame} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {polishElectionBidOptions, type PolishElectionPower} from "../../../polishElection";

export interface PendingPolishElectionPanelProps {
    G: VQGame;
    playerID: string | null;
    onBid: (bid: string) => void;
    /** Hotseat hint pointing at the bidding seat's tab. */
    switchToTab?: string;
}

/**
 * #86 Polish Royal Election collects one bid at a time through the
 * `polishElectionBid` stage.  The engine keeps `activePower` on the power that
 * played the card, so the normal objective panel stays visible unless this
 * panel replaces it; otherwise the active seat can click End Impulse while
 * boardgame.io has already moved the stage to another player.
 */
export const PendingPolishElectionPanel = ({G, playerID, onBid, switchToTab}: PendingPolishElectionPanelProps) => {
    i18n.use();
    const pending = G.pendingPolishElection;
    const bidder = pending?.remaining[0] as PolishElectionPower | undefined;
    const [bid, setBid] = React.useState("");
    React.useEffect(() => {setBid("");}, [bidder]);
    if (pending === undefined || bidder === undefined) return null;
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const isBidder = ownerOf(G, bidder) === playerID;
    if (!isBidder) {
        return <Stack spacing={0.5}>
            <Typography variant="subtitle2">{i18n.chain.vq.board.polishElectionTitle}</Typography>
            <Typography variant="body2" color="text.secondary">
                {i18n.chain.vq.board.polishElectionWaiting.replace("{power}", powerName(bidder, vqLocale))}
                {switchToTab !== undefined ? ` ${switchToTab}` : ""}
            </Typography>
        </Stack>;
    }
    const options = polishElectionBidOptions(G, bidder, vqLocale);
    return <Stack spacing={0.75}>
        <Typography variant="subtitle2">{i18n.chain.vq.board.polishElectionTitle}</Typography>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.eventTargets.polishBidHint}
        </Typography>
        <Typography variant="body2">
            {i18n.chain.vq.board.polishElectionCurrent.replace("{power}", powerName(bidder, vqLocale))}
        </Typography>
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-pending-polish-bid">{i18n.chain.vq.eventTargets.polishBid}</InputLabel>
            <Select labelId="vq-pending-polish-bid" label={i18n.chain.vq.eventTargets.polishBid} displayEmpty
                    value={bid} onChange={(event) => setBid(event.target.value)}>
                {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
        </FormControl>
        <Button variant="contained" size="small" onClick={() => onBid(bid === "" ? "pass" : bid)}>
            {i18n.chain.vq.board.polishElectionSubmit}
        </Button>
    </Stack>;
};
