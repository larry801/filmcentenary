import Chip from "@mui/material/Chip";
import {eventTargetOptions, eventTargetValue} from "../../../eventTargets";
import {POLISH_ELECTION_POWERS, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, type PolishElectionBidChoices, type PolishElectionPower} from "../../../polishElection";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {areaName, controllerName, powerName, powerShortName, isPower} from "../../../constant/general";
import {seaZoneName} from "../../../mapData";
import {Controller} from "../../../constant/general";

import {cell, leaderLabel, placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const SpaceDetail = () => {
    const {G, vqLocale, selected, space, spaceDef, selectedSea} = useVQBoard();
    return <>
    {space !== undefined && spaceDef !== undefined && <section className="vq-space-detail" aria-label={i18n.chain.vq.board.spaceDetailLabel}>
        <Typography variant="subtitle2">{placeLabel(spaceDef.id)}</Typography>
        <Typography variant="caption" color="text.secondary">
            {spaceDef.kind === "key" ? i18n.chain.vq.board.keyCity : spaceDef.kind === "fortress" ? i18n.chain.vq.board.fortress : i18n.chain.vq.board.openCity}
            {spaceDef.ports !== undefined && spaceDef.ports.length > 0 ? ` · ${i18n.chain.vq.board.port}: ${spaceDef.ports.map((id) => seaZoneName(id, vqLocale)).join(", ")}` : ""}
            {spaceDef.area !== undefined ? ` · ${areaName(spaceDef.area, vqLocale)}` : ""}
        </Typography>
        <Typography variant="body2" sx={{mt: 0.5}}>
            {i18n.chain.vq.board.control}: <b>{controllerName(space.control, vqLocale)}</b>
            {" · "}{space.religion === "protestant" ? i18n.chain.vq.board.protestant : i18n.chain.vq.board.catholic}
            {space.unrest ? ` · ${i18n.chain.vq.board.unrest}` : ""}
            {space.siege !== undefined ? ` · ${i18n.chain.vq.board.besiegedBy} ${powerShortName(space.siege.by, vqLocale)}` : ""}
        </Typography>
        {Object.keys(space.land).map((c) => {
            const st = space.land[c as keyof typeof space.land];
            if (st === undefined) {
                return null;
            }
            return <Typography key={c} variant="caption" sx={{display: "block"}}>
                {i18n.chain.vq.board.army} {controllerName(c as any, vqLocale)}: {i18n.chain.vq.board.regular} {cell(st.regular)} / {i18n.chain.vq.board.merc} {cell(st.merc)} / {i18n.chain.vq.board.cav} {cell(st.cav)}
            </Typography>;
        })}
        {Object.keys(space.naval).map((c) => {
            const st = space.naval[c as keyof typeof space.naval];
            if (st === undefined) {
                return null;
            }
            return <Typography key={c} variant="caption" sx={{display: "block"}}>
                {i18n.chain.vq.board.navy} {controllerName(c as any, vqLocale)}: {i18n.chain.vq.board.galley} {cell(st.galley)} / {i18n.chain.vq.board.galleon} {cell(st.galleon)} / {i18n.chain.vq.board.racebuilt} {cell(st.racebuilt)} / {i18n.chain.vq.board.corsair} {cell(st.corsair)}
            </Typography>;
        })}
        {G.espionage?.jesuits.includes(selected!) && <Chip size="small" label={i18n.chain.vq.board.jesuits}/>}
        {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
            {i18n.chain.vq.board.leaders}: {space.leaders.map((id) => leaderLabel(id)).join(", ")}
        </Typography>}
    </section>}
    {selectedSea && selected && <section className="vq-space-detail" aria-label={i18n.chain.vq.board.seaDetailLabel}>
        <Typography variant="subtitle2">{seaZoneName(selected, vqLocaleNow())}</Typography>
        <Typography variant="caption">{i18n.chain.vq.board.seaFleets}</Typography>
        {Object.entries(selectedSea.naval).map(([controller, stack]) => <Typography key={controller} variant="body2">
            {controllerName(controller as Controller, vqLocale)}: {i18n.chain.vq.board.galley} {stack?.galley ?? 0} / {i18n.chain.vq.board.galleon} {stack?.galleon ?? 0} / {i18n.chain.vq.board.racebuilt} {stack?.racebuilt ?? 0} / {i18n.chain.vq.board.corsair} {stack?.corsair ?? 0}
        </Typography>)}
        {Object.keys(selectedSea.naval).length === 0 && <Typography variant="body2">{i18n.chain.vq.board.noFleet}</Typography>}
    </section>}
    </>;
};
