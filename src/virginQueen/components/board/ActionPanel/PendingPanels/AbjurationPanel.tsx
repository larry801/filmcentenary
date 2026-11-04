import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {abjurationOffers, abjurationSelection, acceptAbjurationOffer} from "../../board";

export const PendingAbjurationPanel = (props: any) => {
    const {G, moves, playerID, selectedAbjurationPower, setSelectedAbjurationPower} = props;
    const offers = abjurationOffers(G);
    const selected = abjurationSelection(offers, selectedAbjurationPower);
    const ownedOffer = ownerOf(G, "protestant") === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>誓绝法案 · 等待新教选择一项提议。</Typography>
            <Typography variant="body2">
                每个提议立即与新教结盟，并从提议方本土控制地区抽调至多 5 个正规军（可随行 1 个陆军将领）。新教只能接受一项。
            </Typography>
            {ownedOffer && offers.map((offer: any) => 
                <Button key={offer.power}
                    variant={selected?.power === offer.power ? "contained" : "outlined"}
                    aria-pressed={selected?.power === offer.power}
                    onClick={() => setSelectedAbjurationPower(offer.power)}>
                    {offer.label}
                </Button>
            )}
            {ownedOffer && selected !== undefined && <>
                <Typography variant="caption" color="text.secondary">
                    已选：{selected.powerName} → {selected.spaceName} · {selected.units > 0 ? `${selected.units} 正规军` : "无正规军"}
                    {selected.leaderName !== undefined ? ` + ${selected.leaderName}` : ""}；接受后立即结算。
                </Typography>
                <Button variant="contained" color="success" onClick={() => {
                    acceptAbjurationOffer(moves, selected);
                    setSelectedAbjurationPower(undefined);
                }}>接受 {selected.powerName} 的提议</Button>
            </>}
            {!ownedOffer && <Typography variant="body2">等待新教玩家选择；其他势力此时无法行动。</Typography>}
        </Stack>
    );
};
