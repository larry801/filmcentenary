import React from "react";
import {Player} from "../../Game";
import Typography from "@mui/material/Typography";
import i18n from "../../constant/i18n";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@mui/icons-material/FileCopy';
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";

interface ShareLinkProps {
    matchID: string;
    player: Player;
    numPlayer: number;
    gameName: string;
}

export const ShareLink = ({matchID, player, numPlayer, gameName}: ShareLinkProps) => {
    i18n.use();
    const urlPrefix = `${window.location.origin}/join/${gameName}/${matchID}/`;
    const ids = Array.from({length: Math.max(2, numPlayer)}, (_, i) => String(i));
    const links = ids.map((id) => ({id, url: urlPrefix + id}));
    const spectateURL = urlPrefix + Player.SPECTATE;

    const onCopy = () => {
        const copyText = [
            i18n.chain.lobby.shareLink,
            ...links.filter((l) => l.id !== player).map((l) => l.url),
            i18n.chain.playerName.spectator,
            spectateURL,
        ].join("\r\n");
        copy(copyText, {
            message: i18n.chain.lobby.copyPrompt,
        });
    }
    return (
        <Box sx={{mt: 2, display: "flex", flexDirection: "column", gap: 1}}>
            <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                <IconButton
                    color="primary"
                    aria-label={i18n.chain.lobby.copyPrompt}
                    edge="start"
                    onClick={onCopy}>
                    <ContentCopyIcon/>
                </IconButton>
                <Typography variant="body2">复制邀请链接</Typography>
            </Box>
            <Typography variant="body2">{i18n.chain.lobby.shareLink}</Typography>
            <Box sx={{display: "flex", flexWrap: "wrap", gap: 1}}>
                {links.filter((l) => l.id !== player).map((l) =>
                    <Link key={l.id} href={l.url} target="_blank" rel="noopener" sx={{mr: 1}}>
                        {matchID}P{Number(l.id) + 1}
                    </Link>)}
                <Link href={spectateURL} target="_blank" rel="noopener">
                    {i18n.chain.playerName.spectator}
                </Link>
            </Box>
        </Box>
    );
};

export default ShareLink;