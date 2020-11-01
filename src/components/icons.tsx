import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";
import {Champion, IEra, Region,} from "../types/core";
import {blue, grey, purple, red, yellow} from "@material-ui/core/colors";
import LooksOneIcon from '@material-ui/icons/LooksOne';
import LooksTwoIcon from '@material-ui/icons/LooksTwo';
import Looks3Icon from '@material-ui/icons/Looks3';

const verticalAlign = {verticalAlign: "-0.125em"};

export interface IShareIconProps {
    r: Region
}

export const DrawnShareIcon = ({r}:IShareIconProps) => <SvgIcon style={verticalAlign}>
    <path d="
			 M2,8 12,4 22,8 12,12 Z
			 M2,8 2,18 12,22 12,12 Z
			 M12,22 22,18 22,8 12,12Z
    "
          style={{
              stroke: "#ffffff",
              fill: getColor(r),
              strokeWidth: 1,
          }}
    />
</SvgIcon>

export interface IChampionProps {
    champion: Champion,
}

export const ChampionIcon = ({champion}:IChampionProps) => {
    const IconComponent = ()=>{
        switch (champion.era){
            case IEra.ONE:
                return LooksOneIcon;
            case IEra.TWO:
                return LooksTwoIcon;
            case IEra.THREE:
                return Looks3Icon;
        }
    }
    const IC = IconComponent();
    return <IC style={{color: getColor(champion.region)}}/>
}

export const ActionPointIcon = () => <SvgIcon style={verticalAlign}>
    <path d="
             M6 6
             A6,3 0 0,0 18,6
             A6,3 0 0,0 6,6
             L6, 18
             A6,3,0 0,0 18,18
             L18, 6
             "
          style={{
              stroke: "#000000",
              fill: "#ffffff",
              strokeWidth: 2,
          }}/>
</SvgIcon>

export const getColor = (r: Region): string => {
    switch (r) {
        case Region.WE:
            return purple[500]
        case Region.NA:
            return blue[800]
        case Region.EE:
            return red[500]
        case Region.ASIA:
            return yellow[700]
        case Region.NONE:
            return grey[700]
    }
}
