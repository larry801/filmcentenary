import React from "react";
import Button from "@mui/material/Button";
import i18n from "../../constant/i18n";
import {POWER_NAMES, powerName, Power} from "../../constant/general";
import {ownerOf} from "../../ownership";

interface ResponseBannerProps {
    hasResponse: boolean;
    pendingPower?: string;
    playerID: string | null;
    G: any;
    isDesktop: boolean;
    onViewResponse: () => void;
}

export const ResponseBanner: React.FC<ResponseBannerProps> = ({
    hasResponse,
    pendingPower,
    playerID,
    G,
    isDesktop,
    onViewResponse
}) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (!hasResponse || !pendingPower) return null;
    
    return (
        <div className="vq-response" role="status">
            <span>
                {i18n.chain.vq.response.needsResponse} · {powerName(pendingPower as Power, vqLocale)}
                {ownerOf(G, pendingPower) === playerID ? i18n.chain.vq.response.youChoose : i18n.chain.vq.response.waiting}
            </span>
            {!isDesktop && <Button size="small" onClick={onViewResponse}>{i18n.chain.vq.response.viewResponse}</Button>}
        </div>
    );
};
