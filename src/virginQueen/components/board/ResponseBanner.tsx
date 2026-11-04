import React from "react";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../constant/general";
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
    if (!hasResponse || !pendingPower) return null;
    
    return (
        <div className="vq-response" role="status">
            <span>
                需要响应 · {POWER_NAMES[pendingPower as keyof typeof POWER_NAMES].zh}
                {ownerOf(G, pendingPower) === playerID ? " · 轮到你选择" : " · 等待选择"}
            </span>
            {!isDesktop && <Button size="small" onClick={onViewResponse}>查看响应</Button>}
        </div>
    );
};
