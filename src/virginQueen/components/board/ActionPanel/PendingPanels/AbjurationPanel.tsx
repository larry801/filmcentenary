import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {abjurationOffers, abjurationSelection, acceptAbjurationOffer} from "../../board";

export const PendingAbjurationPanel = (props: any) => {
    i18n.use();
    const {G, moves, playerID, selectedAbjurationPower, setSelectedAbjurationPower} = props;
    const offers = abjurationOffers(G);
    const selected = abjurationSelection(offers, selectedAbjurationPower);
    const ownedOffer = ownerOf(G, "protestant") === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.abjuration.title}</Typography>
            <Typography variant="body2">
                {i18n.chain.vq.abjuration.desc}
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
                    {i18n.chain.vq.abjuration.selected}: {selected.powerName} → {selected.spaceName} · {selected.units > 0 ? `${selected.units} ${i18n.chain.vq.abjuration.regulars}` : i18n.chain.vq.abjuration.noRegulars}
                    {selected.leaderName !== undefined ? ` + ${selected.leaderName}` : ""}{i18n.chain.vq.abjuration.settle}
                </Typography>
                <Button variant="contained" color="success" onClick={() => {
                    acceptAbjurationOffer(moves, selected);
                    setSelectedAbjurationPower(undefined);
                }}>{i18n.chain.vq.abjuration.accept} {selected.powerName} {i18n.chain.vq.abjuration.proposal}</Button>
            </>}
            {!ownedOffer && <Typography variant="body2">{i18n.chain.vq.abjuration.waiting}</Typography>}
        </Stack>
    );
};
