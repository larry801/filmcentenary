import React from "react";
import Drawer from "@mui/material/Drawer";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import i18n from "../../../constant/i18n";
import {Controller, isPower, powerName, controllerName, POWER_NAMES, VQGame} from "../../constant/general";
import {SPACE_BY_ID} from "../../mapData";
import {LEADER_BY_ID} from "../../constant/leaders";

export interface MobileSpaceSheetProps {
    G: VQGame;
    /** Selected space id, or undefined to keep the sheet closed. */
    spaceId?: string;
    open: boolean;
    onClose: () => void;
}

const cell = (value: number): string => (value > 0 ? String(value) : "\u00b7");

/**
 * Bottom sheet with the selected space's details for narrow screens, so players
 * no longer have to switch to the action tab just to read a city.
 */
export const MobileSpaceSheet = ({G, spaceId, open, onClose}: MobileSpaceSheetProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.board;
    const def = spaceId !== undefined ? SPACE_BY_ID[spaceId] : undefined;
    const space = spaceId !== undefined ? G.spaces[spaceId] : undefined;
    return <Drawer anchor="bottom" open={open && def !== undefined && space !== undefined} onClose={onClose}
                   slotProps={{paper: {className: "vq-sheet", sx: {maxHeight: "72dvh", borderRadius: "14px 14px 0 0"}}}}>
        {def !== undefined && space !== undefined && <div role="dialog" aria-modal="true" aria-label={`${def.name} \u00b7 ${e.spaceDetailLabel}`}>
            <div className="vq-sheet-handle" aria-hidden="true"/>
            <div className="vq-sheet-head">
                <Typography variant="subtitle1" sx={{fontWeight: 700}}>{def.name}</Typography>
                <Button size="small" onClick={onClose}>{i18n.chain.vq.shell.close}</Button>
            </div>
            <Typography variant="caption" color="text.secondary">
                {def.kind === "key" ? e.keyCity : def.kind === "fortress" ? e.fortress : e.openCity}
                {def.ports !== undefined && def.ports.length > 0 ? ` \u00b7 ${e.port}: ${def.ports.join(", ")}` : ""}
            </Typography>
            <Typography variant="body2" sx={{mt: 0.5}}>
                {e.control}{i18n.chain.vq.punct.colon}
                <b>{isPower(space.control) ? powerName(space.control, vqLocale) : space.control}</b>
                {" \u00b7 "}{space.religion === "protestant" ? e.protestant : e.catholic}
                {space.unrest ? ` \u00b7 ${e.unrest}` : ""}
                {space.siege !== undefined ? ` \u00b7 ${e.besiegedBy} ${POWER_NAMES[space.siege.by].short}` : ""}
            </Typography>
            {Object.keys(space.land).map((controller) => {
                const stack = space.land[controller as Controller];
                return stack === undefined ? null : <Typography key={controller} variant="caption" sx={{display: "block"}}>
                    {e.army} {controllerName(controller as Controller, vqLocale)}{i18n.chain.vq.punct.colon}
                    {e.regular} {cell(stack.regular)} / {e.merc} {cell(stack.merc)} / {e.cav} {cell(stack.cav)}
                </Typography>;
            })}
            {Object.keys(space.naval).map((controller) => {
                const stack = space.naval[controller as Controller];
                return stack === undefined ? null : <Typography key={`n-${controller}`} variant="caption" sx={{display: "block"}}>
                    {e.navy} {controllerName(controller as Controller, vqLocale)}{i18n.chain.vq.punct.colon}
                    {e.galley} {cell(stack.galley)} / {e.galleon} {cell(stack.galleon)} / {e.racebuilt} {cell(stack.racebuilt)} / {e.corsair} {cell(stack.corsair)}
                </Typography>;
            })}
            {G.espionage?.jesuits.includes(def.id) && <Chip size="small" label={e.jesuits}/>}
            {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                {e.leaders}{i18n.chain.vq.punct.colon} {space.leaders.map((id) => LEADER_BY_ID[id]?.name ?? id).join(", ")}
            </Typography>}
        </div>}
    </Drawer>;
};
