import React from "react";
import {Player} from "../../Game";
import {Typography} from "@material-ui/core";
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";
import Button from "@material-ui/core/Button";

interface ShareLinkProps {
    matchID: string;
    player: Player;
    numPlayer: number,
}

export const ShareLink = ({matchID, player, numPlayer}: ShareLinkProps) => {
    useI18n(i18n);
    const urlPrefix = `${window.location.origin}/join/${matchID}/`;

    const copyToClipboard = (e: any) => {
        e.preventDefault();
        e.clipboardData.setData('text/plain', e.target.value);
    };

    return <>
        <Typography>{i18n.lobby.shareLink}</Typography>
        {Player.P0 !== player && <Typography>{urlPrefix + Player.P0}</Typography>}
        {Player.P1 !== player && <Typography>{urlPrefix + Player.P1}</Typography>}
        {Player.P2 !== player && numPlayer > 2 && <Typography>{urlPrefix + Player.P2}</Typography>}
        {Player.P3 !== player && numPlayer > 3 && <Typography>{urlPrefix + Player.P3}</Typography>}
        <Typography>{i18n.playerName.spectator}</Typography>
        <Typography>{urlPrefix + Player.spectate}</Typography>
    </>
}
