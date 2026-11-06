import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {Power} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {abjurationOffers, abjurationSelection, acceptAbjurationOffer} from "../../../abjuration";
import {PendingPanelProps} from "./types";

export interface PendingAbjurationPanelProps extends PendingPanelProps {
    /** Offer currently highlighted in the panel. */
    selectedPower?: Power;
    onSelect: (power: Power | undefined) => void;
}

/** Act of Abjuration (#103) offer selection. */
export const PendingAbjurationPanel = ({G, moves, playerID, selectedPower, onSelect}: PendingAbjurationPanelProps) => {
    i18n.use();
    if (G.pendingAbjuration === undefined) return null;
    const offers = abjurationOffers(G);
    const selected = abjurationSelection(offers, selectedPower);
    const ownedOffer = ownerOf(G, "protestant") === playerID;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.abjuration.title}</Typography>
        <Typography variant="body2">
            {i18n.chain.vq.abjuration.desc}
        </Typography>
        {ownedOffer && offers.map((offer) => <Button key={offer.power}
                variant={selected?.power === offer.power ? "contained" : "outlined"}
                aria-pressed={selected?.power === offer.power}
                onClick={() => onSelect(offer.power)}>
            {offer.label}
        </Button>)}
        {ownedOffer && selected !== undefined && <>
            <Typography variant="caption" color="text.secondary">
                {i18n.chain.vq.abjuration.selected}{i18n.chain.vq.punct.colon}{selected.powerName} → {selected.spaceName} · {selected.units > 0 ? `${selected.units} ${i18n.chain.vq.abjuration.regulars}` : i18n.chain.vq.abjuration.noRegulars}
                {selected.leaderName !== undefined ? ` + ${selected.leaderName}` : ""}{i18n.chain.vq.abjuration.settle}
            </Typography>
            <Button variant="contained" color="success" onClick={() => {
                acceptAbjurationOffer(moves, selected);
                onSelect(undefined);
            }}>{i18n.chain.vq.abjuration.accept} {selected.powerName} {i18n.chain.vq.abjuration.proposal}</Button>
        </>}
        {!ownedOffer && <Typography variant="body2">{i18n.chain.vq.abjuration.waiting}</Typography>}
    </Stack>;
};
